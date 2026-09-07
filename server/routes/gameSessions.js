// Play sessions and their shared dice feed.
//
// Starting one is the DM's act — or a member's, when the owner has granted `can_manage_sessions`,
// which is why the flag exists rather than ownership being the only answer. *Rolling* is every
// member's: the point of the feed is that the table sees each other's dice.
const express = require('express');
const db = require('../db');
const { normaliseRoll, publicRoll, publicSession } = require('../lib/gameSessions');
const {
  getCampaignMembership,
  isCampaignOwner,
  memberHasPermission,
  requireAuth,
} = require('../middleware/auth');

const router = express.Router();

/** How many rolls one request may return. A session runs for hours; the feed is read in pages. */
const ROLL_PAGE = 100;

function parseId(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Membership plus whether the caller may start and end sessions, or the response to send. */
async function resolveAccess(req, res, campaignId) {
  if (campaignId === null) {
    res.status(400).json({ error: 'campaign_id required' });
    return null;
  }
  const membership = await getCampaignMembership(req.user.id, campaignId);
  if (!membership) {
    res.status(403).json({ error: 'not_a_member' });
    return null;
  }
  const isOwner = await isCampaignOwner(req.user.id, campaignId);
  return {
    membership,
    isOwner,
    canManage: isOwner || memberHasPermission(membership, 'can_manage_sessions'),
  };
}

/**
 * One session and the caller's rights over it. A session in a campaign they are not in reads as
 * absent, so the id space is not walkable — the same rule as the Powered Character routes.
 */
async function loadForCaller(req, res) {
  const id = parseId(req.params.id);
  const row = id ? await db.get('SELECT * FROM game_sessions WHERE id = ?', id) : null;
  if (!row) {
    res.status(404).json({ error: 'session_not_found' });
    return null;
  }
  const access = await resolveAccess(req, res, row.campaign_id);
  if (!access) return null;
  return { row, ...access };
}

router.get('/api/game-sessions', requireAuth, async (req, res) => {
  try {
    const campaignId = parseId(req.query.campaign_id);
    const access = await resolveAccess(req, res, campaignId);
    if (!access) return;

    const rows = await db.all(
      'SELECT * FROM game_sessions WHERE campaign_id = ? ORDER BY id DESC LIMIT 50',
      campaignId,
    );
    res.json({
      ok: true,
      sessions: rows.map((row) => publicSession(row)),
      can_manage: access.canManage,
    });
  } catch (e) {
    console.error('GET /api/game-sessions', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/game-sessions', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const campaignId = parseId(body.campaign_id);
    const access = await resolveAccess(req, res, campaignId);
    if (!access) return;
    if (!access.canManage) return res.status(403).json({ error: 'session_management_required' });

    // One open session per campaign: two feeds running at once is two histories nobody can read.
    const open = await db.get(
      'SELECT * FROM game_sessions WHERE campaign_id = ? AND ended_at IS NULL',
      campaignId,
    );
    if (open) return res.status(409).json({ error: 'session_already_open', session: publicSession(open) });

    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 120) : null;
    const groupId = parseId(body.group_id);
    const inserted = await db.run(
      'INSERT INTO game_sessions(campaign_id, group_id, name, started_by) VALUES (?, ?, ?, ?)',
      campaignId,
      groupId,
      name,
      req.user.id,
    );
    const row = await db.get('SELECT * FROM game_sessions WHERE id = ?', inserted.lastInsertRowid);
    res.json({ ok: true, session: publicSession(row) });
  } catch (e) {
    console.error('POST /api/game-sessions', e);
    res.status(500).json({ error: e.message });
  }
});

// Ending is not deleting: the rolls stay, because the log of what happened is the point.
router.post('/api/game-sessions/:id/end', requireAuth, async (req, res) => {
  try {
    const found = await loadForCaller(req, res);
    if (!found) return;
    if (!found.canManage) return res.status(403).json({ error: 'session_management_required' });
    if (found.row.ended_at) return res.json({ ok: true, session: publicSession(found.row) });

    await db.run("UPDATE game_sessions SET ended_at = datetime('now') WHERE id = ?", found.row.id);
    const row = await db.get('SELECT * FROM game_sessions WHERE id = ?', found.row.id);
    res.json({ ok: true, session: publicSession(row) });
  } catch (e) {
    console.error('POST /api/game-sessions/:id/end', e);
    res.status(500).json({ error: e.message });
  }
});

// `after` is the last roll id the caller already has, so a poll costs one indexed range scan.
router.get('/api/game-sessions/:id/rolls', requireAuth, async (req, res) => {
  try {
    const found = await loadForCaller(req, res);
    if (!found) return;

    const after = parseId(req.query.after) ?? 0;
    const rows = await db.all(
      `SELECT session_rolls.*, users.username
         FROM session_rolls
         LEFT JOIN users ON users.id = session_rolls.user_id
        WHERE session_rolls.session_id = ? AND session_rolls.id > ?
        ORDER BY session_rolls.id ASC
        LIMIT ${ROLL_PAGE}`,
      found.row.id,
      after,
    );
    res.json({ ok: true, rolls: rows.map((row) => publicRoll(row)) });
  } catch (e) {
    console.error('GET /api/game-sessions/:id/rolls', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/game-sessions/:id/rolls', requireAuth, async (req, res) => {
  try {
    const found = await loadForCaller(req, res);
    if (!found) return;
    // A closed session is a record, not a place to write. Rolling into one would rewrite history.
    if (found.row.ended_at) return res.status(409).json({ error: 'session_closed' });

    const roll = normaliseRoll(req.body || {});
    if (roll.error) return res.status(400).json({ error: roll.error });

    const inserted = await db.run(
      `INSERT INTO session_rolls(
         session_id, campaign_id, user_id, character_name, label, detail, notation, total, results, note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      found.row.id,
      found.row.campaign_id,
      req.user.id,
      roll.value.character_name,
      roll.value.label,
      roll.value.detail,
      roll.value.notation,
      roll.value.total,
      roll.value.results,
      roll.value.note,
    );
    const row = await db.get(
      `SELECT session_rolls.*, users.username
         FROM session_rolls LEFT JOIN users ON users.id = session_rolls.user_id
        WHERE session_rolls.id = ?`,
      inserted.lastInsertRowid,
    );
    res.json({ ok: true, roll: publicRoll(row) });
  } catch (e) {
    console.error('POST /api/game-sessions/:id/rolls', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
