// What the Discord bot may do on a linked user's behalf. Every per-user route is `requireBotAuth`,
// and every character decision goes through `lib/characterAccess.js` exactly as the browser routes
// do, so a sheet the site would 404 for this user 404s for the bot too. The one write is the play
// state (`POST .../play`): a fixed table of actions applied server-side, never a document upload.
const express = require('express');
const db = require('../db');
const { resolveCharacterAccess } = require('../lib/characterAccess');
const { SUMMARY_COLUMNS, characterSummary, publicCharacter, serializeDocument } = require('../lib/characters');
const { requireBotAuth, requireBotKey } = require('../middleware/botAuth');
const { KINDS, searchContent, getContent } = require('../lib/botContent');
const { deriveSheet } = require('../lib/botSheet');
const { applyPlayAction, playState } = require('../lib/botPlayState');
const {
  aggregateAvailability, campaignForMember, campaignMembers, clearFutureAvailability, ensureSeat,
  listCampaignsForUser, writeAvailabilityFromText,
} = require('../lib/botCampaigns');

const router = express.Router();

const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

router.get('/api/bot/me', requireBotAuth, (req, res) => {
  res.json({ ok: true, user: { id: req.user.id, username: req.user.username ?? null, discord_id: req.botDiscordId } });
});

// The caller's own characters, summaries only — the same shape and the same reason as
// GET /api/characters: documents carry portraits, and a list is a picker.
router.get('/api/bot/characters', requireBotAuth, async (req, res) => {
  try {
    const rows = await db.all(
      `SELECT ${SUMMARY_COLUMNS} FROM characters WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id ASC`,
      req.user.id,
    );
    res.json({ ok: true, characters: rows.map(characterSummary) });
  } catch (e) {
    console.error('GET /api/bot/characters', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/bot/characters/:id', requireBotAuth, async (req, res) => {
  try {
    if (!ID_PATTERN.test(req.params.id)) return res.status(404).json({ error: 'character_not_found' });
    const row = await db.get('SELECT * FROM characters WHERE id = ?', req.params.id);
    const access = await resolveCharacterAccess(req.user, row);
    if (!access) return res.status(404).json({ error: 'character_not_found' });
    res.json({ ok: true, character: publicCharacter(access.row, access) });
  } catch (e) {
    console.error('GET /api/bot/characters/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// The derived sheet — attacks, spell DCs, each known spell's dice — computed here with the app's
// own maths so the bot never carries a copy. 501 means this Node cannot load the app's TypeScript
// (type stripping needs 22.18+), which is the operator's problem and is said so in the body.
router.get('/api/bot/characters/:id/sheet', requireBotAuth, async (req, res) => {
  try {
    if (!ID_PATTERN.test(req.params.id)) return res.status(404).json({ error: 'character_not_found' });
    const row = await db.get('SELECT * FROM characters WHERE id = ?', req.params.id);
    const access = await resolveCharacterAccess(req.user, row);
    if (!access) return res.status(404).json({ error: 'character_not_found' });
    const character = publicCharacter(access.row, access);
    let sheet;
    try {
      sheet = await deriveSheet(character.data ?? {});
    } catch (e) {
      console.error('GET /api/bot/characters/:id/sheet: sheet maths unavailable', e);
      return res.status(501).json({ error: 'sheet_maths_unavailable', detail: e?.message });
    }
    res.json({ ok: true, id: character.id, name: character.name, sheet });
  } catch (e) {
    console.error('GET /api/bot/characters/:id/sheet', e);
    res.status(500).json({ error: e.message });
  }
});

async function loadEditable(req, res) {
  if (!ID_PATTERN.test(req.params.id)) {
    res.status(404).json({ error: 'character_not_found' });
    return null;
  }
  const row = await db.get('SELECT * FROM characters WHERE id = ?', req.params.id);
  const access = await resolveCharacterAccess(req.user, row);
  if (!access) {
    res.status(404).json({ error: 'character_not_found' });
    return null;
  }
  return { row, access, character: publicCharacter(access.row, access) };
}

// Hit points, slots, conditions, the purse and the pack, read the way the sheet reads them.
router.get('/api/bot/characters/:id/play', requireBotAuth, async (req, res) => {
  try {
    const loaded = await loadEditable(req, res);
    if (!loaded) return;
    let state;
    try {
      state = await playState(loaded.character.data ?? {});
    } catch (e) {
      console.error('GET /api/bot/characters/:id/play: play maths unavailable', e);
      return res.status(501).json({ error: 'sheet_maths_unavailable', detail: e?.message });
    }
    res.json({ ok: true, id: loaded.character.id, name: loaded.character.name, version: loaded.character.version, can_edit: loaded.access.canEdit, state });
  } catch (e) {
    console.error('GET /api/bot/characters/:id/play', e);
    res.status(500).json({ error: e.message });
  }
});

// One action from `botPlayState.ACTIONS`, applied to the stored document and written back under
// the row's version, so a browser edit landing in between is a retry here rather than a clobber.
// `can_edit` is the same grant the PUT route honours; a reader who may not write gets 403.
router.post('/api/bot/characters/:id/play', requireBotAuth, async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { action, ...args } = body;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const loaded = await loadEditable(req, res);
      if (!loaded) return;
      if (!loaded.access.canEdit) return res.status(403).json({ error: 'character_not_editable' });
      const { row, access, character } = loaded;
      let applied;
      try {
        applied = await applyPlayAction(character.data ?? {}, action, args);
      } catch (e) {
        console.error('POST /api/bot/characters/:id/play: play maths unavailable', e);
        return res.status(501).json({ error: 'sheet_maths_unavailable', detail: e?.message });
      }
      if (applied.error) return res.status(400).json({ error: applied.error, detail: applied.detail ?? null });
      const doc = serializeDocument(applied.doc, row.name, row.summary);
      if (doc.error) return res.status(doc.error === 'data_too_large' ? 413 : 400).json({ error: doc.error });
      const result = await db.run(
        'UPDATE characters SET data = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?',
        doc.text, new Date().toISOString(), row.id, Number(row.version),
      );
      if (result.changes === 0) continue;
      const state = await playState(applied.doc);
      return res.json({ ok: true, id: character.id, name: character.name, version: Number(row.version) + 1, can_edit: access.canEdit, state });
    }
    res.status(409).json({ error: 'version_conflict' });
  } catch (e) {
    console.error('POST /api/bot/characters/:id/play', e);
    res.status(500).json({ error: e.message });
  }
});

// ---- campaigns: the table's calendar, read and written as the member -----------------------------
// A campaign the caller is not in reads as absent, like a character they cannot see. Availability is
// written only against the caller's own seat; the aggregate is the same computation the site's
// scheduler page runs, so the bot and the browser agree on when the table is free.

const CAMPAIGN_ID_PATTERN = /^\d{1,12}$/;
const AVAILABILITY_TEXT_MAX = 500;
const AGGREGATE_MAX_DAYS = 56;

async function loadCampaignForCaller(req, res) {
  if (!CAMPAIGN_ID_PATTERN.test(String(req.params.id))) {
    res.status(404).json({ error: 'campaign_not_found' });
    return null;
  }
  const found = await campaignForMember(req.user.id, Number(req.params.id));
  if (!found) {
    res.status(404).json({ error: 'campaign_not_found' });
    return null;
  }
  return found;
}

function publicCampaign(campaign, membership) {
  return {
    id: campaign.id,
    name: campaign.name,
    system_id: campaign.system_id ?? null,
    role: membership.role,
    player_id: membership.player_id ?? null,
  };
}

router.get('/api/bot/campaigns', requireBotAuth, async (req, res) => {
  try {
    const rows = await listCampaignsForUser(req.user.id);
    res.json({
      ok: true,
      campaigns: rows.map((row) => ({
        id: row.id, name: row.name, system_id: row.system_id ?? null, role: row.role,
        player_id: row.player_id ?? null, member_count: Number(row.member_count || 0),
      })),
    });
  } catch (e) {
    console.error('GET /api/bot/campaigns', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/bot/campaigns/:id', requireBotAuth, async (req, res) => {
  try {
    const found = await loadCampaignForCaller(req, res);
    if (!found) return;
    const members = await campaignMembers(found.campaign.id);
    res.json({ ok: true, campaign: publicCampaign(found.campaign, found.membership), members });
  } catch (e) {
    console.error('GET /api/bot/campaigns/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// `start`/`end` are ISO instants; the window is capped so a bot cannot ask for a year of intervals.
router.get('/api/bot/campaigns/:id/availability', requireBotAuth, async (req, res) => {
  try {
    const found = await loadCampaignForCaller(req, res);
    if (!found) return;
    const start = new Date(String(req.query.start || ''));
    const end = new Date(String(req.query.end || ''));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: 'bad_window' });
    }
    if (end - start > AGGREGATE_MAX_DAYS * 86400000) return res.status(400).json({ error: 'window_too_long' });
    const [intervals, members] = await Promise.all([
      aggregateAvailability(found.campaign.id, start.toISOString(), end.toISOString()),
      campaignMembers(found.campaign.id),
    ]);
    res.json({ ok: true, campaign: publicCampaign(found.campaign, found.membership), members, intervals });
  } catch (e) {
    console.error('GET /api/bot/campaigns/:id/availability', e);
    res.status(500).json({ error: e.message });
  }
});

// `{text, timezone?, days_ahead?, replace?}` writes the caller's own blocks; `{clear: true}` drops
// their future ones. Never another member's — the browser's owner-edit path stays the only one.
router.post('/api/bot/campaigns/:id/availability', requireBotAuth, async (req, res) => {
  try {
    const found = await loadCampaignForCaller(req, res);
    if (!found) return;
    const body = req.body || {};
    const playerId = await ensureSeat(found.campaign.id, req.user, found.membership);
    const nowIso = new Date().toISOString();
    let cleared = 0;
    if (body.clear === true || body.replace === true) cleared = await clearFutureAvailability(playerId, nowIso);
    if (body.clear === true) return res.json({ ok: true, player_id: playerId, cleared, written: [] });
    const text = typeof body.text === 'string' ? body.text.trim().slice(0, AVAILABILITY_TEXT_MAX) : '';
    if (!text) return res.status(400).json({ error: 'text_required' });
    const daysRaw = Number.parseInt(body.days_ahead, 10);
    const daysAhead = Number.isFinite(daysRaw) ? Math.max(1, Math.min(daysRaw, AGGREGATE_MAX_DAYS)) : 14;
    const timezone = typeof body.timezone === 'string' ? body.timezone : '';
    const result = await writeAvailabilityFromText(playerId, found.campaign.id, text, timezone, daysAhead);
    if (result.error) return res.status(400).json({ error: result.error });
    if (result.written.length === 0) return res.status(400).json({ error: 'nothing_parsed' });
    res.json({ ok: true, player_id: playerId, cleared, written: result.written, timezone: result.timezone });
  } catch (e) {
    console.error('POST /api/bot/campaigns/:id/availability', e);
    res.status(500).json({ error: e.message });
  }
});

// The content library, keyed but not per-user: a spell is the same spell whoever asks. Only the
// SRD-derived packs are served (see lib/botContent.js); an unknown kind is 404 like an unknown id.
router.get('/api/bot/content/:kind', requireBotKey, (req, res) => {
  if (!Object.hasOwn(KINDS, req.params.kind)) return res.status(404).json({ error: 'content_kind_unknown' });
  const results = searchContent(req.params.kind, String(req.query.q ?? ''), {
    limit: req.query.limit,
    edition: /^\d{4}$/.test(String(req.query.edition ?? '')) ? String(req.query.edition) : '',
  });
  res.json({ ok: true, kind: req.params.kind, results });
});

router.get('/api/bot/content/:kind/:id', requireBotKey, (req, res) => {
  if (!Object.hasOwn(KINDS, req.params.kind) || !ID_PATTERN.test(req.params.id)) {
    return res.status(404).json({ error: 'content_not_found' });
  }
  const entry = getContent(req.params.kind, req.params.id);
  if (!entry) return res.status(404).json({ error: 'content_not_found' });
  res.json({ ok: true, entry });
});

module.exports = router;
