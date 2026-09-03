// The Powered Character (Kids on Bikes, chapter 5).
//
// One document per Powered Character, belonging to a campaign rather than to a user: the table
// co-controls it. Two write paths, because the book gives the GM and the players different rights
// over the same card — the GM owns the document, and "any player may activate any Aspect".
const express = require('express');
const db = require('../db');
const {
  applyPlayPatch,
  normaliseDocument,
  parseDocument,
  publicPoweredCharacter,
} = require('../lib/poweredCharacter');
const { getCampaignMembership, isCampaignOwner, requireAuth } = require('../middleware/auth');

const router = express.Router();

function campaignIdFrom(source) {
  const parsed = Number.parseInt(String(source.campaign_id ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Membership plus whether the caller runs the table, or the response to send instead. */
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
  return { membership, isOwner: await isCampaignOwner(req.user.id, campaignId) };
}

/**
 * Load one Powered Character and the caller's rights over it. A row in a campaign they are not in
 * reads as absent, so the id space is not walkable.
 */
async function loadForCaller(req, res) {
  const id = Number.parseInt(req.params.id, 10);
  const row = Number.isFinite(id) ? await db.get('SELECT * FROM powered_characters WHERE id = ?', id) : null;
  if (!row) {
    res.status(404).json({ error: 'powered_character_not_found' });
    return null;
  }
  const membership = await getCampaignMembership(req.user.id, row.campaign_id);
  if (!membership) {
    res.status(404).json({ error: 'powered_character_not_found' });
    return null;
  }
  return { row, isOwner: await isCampaignOwner(req.user.id, row.campaign_id) };
}

router.get('/api/powered-characters', requireAuth, async (req, res) => {
  try {
    const campaignId = campaignIdFrom(req.query);
    const access = await resolveAccess(req, res, campaignId);
    if (!access) return;
    const rows = await db.all(
      'SELECT * FROM powered_characters WHERE campaign_id = ? ORDER BY id ASC',
      campaignId,
    );
    res.json({ ok: true, powered_characters: rows.map((row) => publicPoweredCharacter(row, access.isOwner)) });
  } catch (e) {
    console.error('GET /api/powered-characters', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/powered-characters', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const campaignId = campaignIdFrom(body);
    const access = await resolveAccess(req, res, campaignId);
    if (!access) return;
    if (!access.isOwner) return res.status(403).json({ error: 'owner_required' });

    const document = normaliseDocument(body.data ?? {});
    if (document.error) return res.status(400).json({ error: document.error });

    const inserted = await db.run(
      'INSERT INTO powered_characters(campaign_id, data) VALUES (?, ?)',
      campaignId,
      JSON.stringify(document.value),
    );
    const row = await db.get('SELECT * FROM powered_characters WHERE id = ?', inserted.lastInsertRowid);
    res.json({ ok: true, powered_character: publicPoweredCharacter(row, true) });
  } catch (e) {
    console.error('POST /api/powered-characters', e);
    res.status(500).json({ error: e.message });
  }
});

// The whole document, the GM's alone. `version` is the one last seen: a player spending a Power
// Token bumps it, so an edit made against a stale card is refused rather than undoing their move.
router.put('/api/powered-characters/:id', requireAuth, async (req, res) => {
  try {
    const found = await loadForCaller(req, res);
    if (!found) return;
    if (!found.isOwner) return res.status(403).json({ error: 'owner_required' });

    const body = req.body || {};
    const version = Number.parseInt(String(body.version ?? ''), 10);
    if (!Number.isFinite(version)) return res.status(400).json({ error: 'version_required' });
    if (version !== (found.row.version ?? 1)) {
      return res.status(409).json({
        error: 'version_conflict',
        powered_character: publicPoweredCharacter(found.row, true),
      });
    }

    const document = normaliseDocument(body.data);
    if (document.error) return res.status(400).json({ error: document.error });

    await db.run(
      "UPDATE powered_characters SET data = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?",
      JSON.stringify(document.value),
      found.row.id,
    );
    const row = await db.get('SELECT * FROM powered_characters WHERE id = ?', found.row.id);
    res.json({ ok: true, powered_character: publicPoweredCharacter(row, true) });
  } catch (e) {
    console.error('PUT /api/powered-characters/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// The play state, which every member at the table may write: Power Tokens spent, and which
// Aspects are turned sideways and in front of whom. It carries no version — two players clicking
// the same card is the case the table exists for, and the patch touches nothing the GM is editing.
router.put('/api/powered-characters/:id/play', requireAuth, async (req, res) => {
  try {
    const found = await loadForCaller(req, res);
    if (!found) return;

    const patched = applyPlayPatch(parseDocument(found.row), req.body || {});
    if (patched.error) return res.status(400).json({ error: patched.error });

    await db.run(
      "UPDATE powered_characters SET data = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?",
      JSON.stringify(patched.value),
      found.row.id,
    );
    const row = await db.get('SELECT * FROM powered_characters WHERE id = ?', found.row.id);
    res.json({ ok: true, powered_character: publicPoweredCharacter(row, found.isOwner) });
  } catch (e) {
    console.error('PUT /api/powered-characters/:id/play', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/powered-characters/:id', requireAuth, async (req, res) => {
  try {
    const found = await loadForCaller(req, res);
    if (!found) return;
    if (!found.isOwner) return res.status(403).json({ error: 'owner_required' });
    await db.run('DELETE FROM powered_characters WHERE id = ?', found.row.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/powered-characters/:id', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
