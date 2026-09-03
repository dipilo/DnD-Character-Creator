// The Pre-Game Form (Kids on Bikes, Appendix A).
//
// A form belongs to the member who wrote it and is scoped to one campaign. Three readers, three
// routes, and they are not interchangeable:
//
//   - its author reads and writes their own (`/api/pre-game-form`);
//   - the campaign owner reads every one of them, with names (`/api/pre-game-forms`);
//   - anyone at the table reads the compiled merge, with none (`/api/pre-game-form/summary`).
//
// The merge is computed here rather than in the client for that last reason: a client that could
// assemble it would have had to be handed the forms first.
const express = require('express');
const db = require('../db');
const { compileForms, normaliseForm, publicForm } = require('../lib/preGameForm');
const { getCampaignMembership, isCampaignOwner, requireAuth } = require('../middleware/auth');

const router = express.Router();

/** The campaign id every route here requires, or null when it is missing or not a number. */
function campaignIdFrom(source) {
  const raw = source.campaign_id ?? source['campaign_id'];
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Resolve the caller's membership, or the response to send instead. Reading a form is not a
 * permission the owner grants: every member has one and every member may read the merge.
 */
async function requireMember(req, res, campaignId) {
  if (campaignId === null) {
    res.status(400).json({ error: 'campaign_id required' });
    return null;
  }
  const membership = await getCampaignMembership(req.user.id, campaignId);
  if (!membership) {
    res.status(403).json({ error: 'not_a_member' });
    return null;
  }
  return membership;
}

// The caller's own form for one campaign. A member who has not written one reads `form: null`
// rather than a 404 — there is nothing missing, they simply have not answered yet.
router.get('/api/pre-game-form', requireAuth, async (req, res) => {
  try {
    const campaignId = campaignIdFrom(req.query);
    if (!(await requireMember(req, res, campaignId))) return;
    const row = await db.get(
      'SELECT * FROM pre_game_forms WHERE campaign_id = ? AND user_id = ?',
      campaignId,
      req.user.id,
    );
    res.json({ ok: true, form: row ? publicForm(row) : null });
  } catch (e) {
    console.error('GET /api/pre-game-form', e);
    res.status(500).json({ error: e.message });
  }
});

// Write the caller's own form. Nobody may write anybody else's, the owner included: the whole
// point of the form is that it says what its author is comfortable with.
router.put('/api/pre-game-form', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const campaignId = campaignIdFrom(body);
    if (!(await requireMember(req, res, campaignId))) return;

    const normalised = normaliseForm(body.data);
    if (normalised.error) return res.status(400).json({ error: normalised.error });
    const text = JSON.stringify(normalised.value);

    const existing = await db.get(
      'SELECT id FROM pre_game_forms WHERE campaign_id = ? AND user_id = ?',
      campaignId,
      req.user.id,
    );
    if (existing) {
      await db.run(
        "UPDATE pre_game_forms SET data = ?, updated_at = datetime('now') WHERE id = ?",
        text,
        existing.id,
      );
    } else {
      await db.run(
        'INSERT INTO pre_game_forms(campaign_id, user_id, data) VALUES (?, ?, ?)',
        campaignId,
        req.user.id,
        text,
      );
    }

    const row = await db.get(
      'SELECT * FROM pre_game_forms WHERE campaign_id = ? AND user_id = ?',
      campaignId,
      req.user.id,
    );
    res.json({ ok: true, form: publicForm(row) });
  } catch (e) {
    console.error('PUT /api/pre-game-form', e);
    res.status(500).json({ error: e.message });
  }
});

// Every form at one table, with names. The owner's alone: this is the view the compiled merge
// exists to avoid handing anybody else.
router.get('/api/pre-game-forms', requireAuth, async (req, res) => {
  try {
    const campaignId = campaignIdFrom(req.query);
    if (!(await requireMember(req, res, campaignId))) return;
    if (!(await isCampaignOwner(req.user.id, campaignId))) {
      return res.status(403).json({ error: 'owner_required' });
    }
    const rows = await db.all(
      `SELECT f.*, u.username AS owner_name
         FROM pre_game_forms f
         LEFT JOIN users u ON u.id = f.user_id
        WHERE f.campaign_id = ?
        ORDER BY f.updated_at DESC, f.id ASC`,
      campaignId,
    );
    res.json({ ok: true, forms: rows.map((row) => publicForm(row)) });
  } catch (e) {
    console.error('GET /api/pre-game-forms', e);
    res.status(500).json({ error: e.message });
  }
});

// The table's compiled answers: every line, no names, computed here so no member's form has to
// travel to reach it.
router.get('/api/pre-game-form/summary', requireAuth, async (req, res) => {
  try {
    const campaignId = campaignIdFrom(req.query);
    if (!(await requireMember(req, res, campaignId))) return;
    const rows = await db.all('SELECT * FROM pre_game_forms WHERE campaign_id = ?', campaignId);
    res.json({ ok: true, summary: compileForms(rows) });
  } catch (e) {
    console.error('GET /api/pre-game-form/summary', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
