// Builder characters (MERGE_PLAN.md Phase 2).
//
// Characters are private data, which is why this router could not exist before Phase 1b gave the
// server a real identity boundary: every route here is `requireAuth`, and a row belongs to exactly
// one user. Another user's id reads as 404 rather than 403 so the id space is not walkable.
const express = require('express');
const crypto = require('node:crypto');
const db = require('../db');
const { characterSummary, publicCharacter, serializeDocument } = require('../lib/characters');
const { canUserModifyPlayer, getCampaignMembership, holdsPlayerSeat, requireAuth } = require('../middleware/auth');

const router = express.Router();

// The builder mints `crypto.randomUUID()` client-side and that id is the character's identity in
// localStorage, so the server accepts the client's id instead of assigning its own. Constrain it
// to something id-shaped: it lands in URLs and in a primary key.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

function isValidId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/** Fetch a row the caller owns, deleted rows included. Callers decide what a tombstone means. */
async function findOwnedCharacter(userId, id) {
  if (!isValidId(id)) return null;
  return await db.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', id, userId);
}

/**
 * Fetch a row the caller may *read* (MERGE_PLAN.md Phase 5).
 *
 * Attaching a character to a campaign is the act of sharing it: the campaign's members can read it
 * from then on, which is what makes a party view and a roster of real sheets possible. Nothing else
 * widens — an unattached character stays invisible, and invisible here means **404 rather than
 * 403**, because a 403 would confirm the id exists. Writes are unaffected; they still go through
 * `findOwnedCharacter`.
 */
async function findReadableCharacter(user, id) {
  if (!isValidId(id)) return null;
  const row = await db.get('SELECT * FROM characters WHERE id = ?', id);
  if (!row || row.deleted_at) return null;
  if (Number(row.user_id) === Number(user.id)) return row;
  if (row.campaign_id == null) return null;
  const membership = await getCampaignMembership(user.id, row.campaign_id);
  return membership ? row : null;
}

/**
 * Resolve the campaign seat a character is attached to. Both columns are nullable — a character
 * built signed-in but outside any campaign is the common case — but a non-null value has to be
 * one the caller may actually use, or this becomes a way to write into someone else's campaign.
 */
async function resolveScope(user, body, existing) {
  const campaignId = Object.hasOwn(body, 'campaign_id')
    ? normaliseId(body.campaign_id)
    : (existing?.campaign_id ?? null);
  const playerId = Object.hasOwn(body, 'player_id')
    ? normaliseId(body.player_id)
    : (existing?.player_id ?? null);

  if (campaignId !== null) {
    const mem = await getCampaignMembership(user.id, campaignId);
    if (!mem) return { error: 'not_a_member', status: 403 };
  }
  if (playerId !== null) {
    if (campaignId === null) return { error: 'campaign_id_required_for_player', status: 400 };
    const player = await db.get('SELECT id, campaign_id FROM players WHERE id = ?', playerId);
    if (!player || Number(player.campaign_id) !== Number(campaignId)) {
      return { error: 'player_not_in_campaign', status: 400 };
    }
    // The seat's own holder, or whoever runs the campaign. Seating writes nothing on the seat, so
    // it does not want `can_edit_self` — a member whose permissions were later narrowed can still
    // put their character where they sit.
    const mayUse = await holdsPlayerSeat(user, campaignId, playerId)
      || await canUserModifyPlayer(user, campaignId, playerId);
    if (!mayUse) return { error: 'forbidden', status: 403 };
  }
  return { campaignId, playerId };
}

function normaliseId(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// List the caller's characters. `?campaign_id=` narrows to one campaign — still only the caller's
// own rows; a party view across every member's characters is Phase 5 and needs its own permission
// story. Summaries only: the documents carry portrait data URLs and a client fetches the ones it
// actually needs by id.
router.get('/api/characters', requireAuth, async (req, res) => {
  try {
    const campaignId = normaliseId(req.query.campaign_id);
    const rows = campaignId === null
      ? await db.all('SELECT * FROM characters WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id ASC', req.user.id)
      : await db.all('SELECT * FROM characters WHERE user_id = ? AND campaign_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC, id ASC', req.user.id, campaignId);
    res.json({ ok: true, characters: rows.map(characterSummary) });
  } catch (e) {
    console.error('GET /api/characters', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/characters/:id', requireAuth, async (req, res) => {
  try {
    const row = await findReadableCharacter(req.user, req.params.id);
    if (!row) return res.status(404).json({ error: 'character_not_found' });
    res.json({ ok: true, character: publicCharacter(row) });
  } catch (e) {
    console.error('GET /api/characters/:id', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/characters', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const id = body.id === undefined || body.id === null ? crypto.randomUUID() : body.id;
    if (!isValidId(id)) return res.status(400).json({ error: 'invalid_id' });

    const doc = serializeDocument(body.data, body.name, body.summary);
    if (doc.error) return res.status(doc.error === 'data_too_large' ? 413 : 400).json({ error: doc.error });

    // A soft-deleted row still occupies the id. Resurrecting it silently would undo a deletion the
    // user made on another device, so say so and let the client honour the tombstone.
    const existing = await db.get('SELECT id, deleted_at FROM characters WHERE id = ?', id);
    if (existing) {
      return res.status(409).json({ error: existing.deleted_at ? 'character_deleted' : 'character_exists' });
    }

    const scope = await resolveScope(req.user, body, null);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const now = new Date().toISOString();
    await db.run(
      `INSERT INTO characters(id, user_id, campaign_id, player_id, name, summary, data, schema_version, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      id, req.user.id, scope.campaignId, scope.playerId, doc.name, doc.summary, doc.text, normaliseSchemaVersion(body.schema_version), now, now,
    );
    const created = await db.get('SELECT * FROM characters WHERE id = ?', id);
    res.status(201).json({ ok: true, character: publicCharacter(created) });
  } catch (e) {
    console.error('POST /api/characters', e);
    res.status(500).json({ error: e.message });
  }
});

// Update one character. `version` is the version the client last saw; a mismatch means the sheet
// was edited somewhere else since, and the write is refused with the server's copy attached rather
// than silently clobbering the other device's edit.
router.put('/api/characters/:id', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const row = await findOwnedCharacter(req.user.id, req.params.id);
    if (!row || row.deleted_at) return res.status(404).json({ error: 'character_not_found' });

    const expected = normaliseId(body.version);
    if (expected === null) return res.status(400).json({ error: 'version_required' });
    if (expected !== Number(row.version)) {
      return res.status(409).json({ error: 'version_conflict', character: publicCharacter(row) });
    }

    const doc = serializeDocument(body.data, body.name, body.summary);
    if (doc.error) return res.status(doc.error === 'data_too_large' ? 413 : 400).json({ error: doc.error });

    const scope = await resolveScope(req.user, body, row);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    await db.run(
      `UPDATE characters SET campaign_id = ?, player_id = ?, name = ?, summary = ?, data = ?, schema_version = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND user_id = ? AND version = ?`,
      scope.campaignId, scope.playerId, doc.name, doc.summary, doc.text,
      normaliseSchemaVersion(body.schema_version ?? row.schema_version),
      new Date().toISOString(), row.id, req.user.id, expected,
    );
    const updated = await db.get('SELECT * FROM characters WHERE id = ?', row.id);
    res.json({ ok: true, character: publicCharacter(updated) });
  } catch (e) {
    console.error('PUT /api/characters/:id', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Seat a character at a campaign table, or take it off one (MERGE_PLAN.md Phase 5).
 *
 * The seat is row metadata, not part of the document, so this is deliberately *not* the document
 * write: it carries no `version` and bumps none. A player seating their character has not edited
 * the sheet, and making them send the whole document to do it would mean a device that only knows
 * the summary could not seat anything. `updated_at` is left alone for the same reason — nothing
 * about the character changed.
 *
 * Attaching shares the sheet with the campaign's members (see `findReadableCharacter`), so the
 * write is the owner's alone; `resolveScope` then checks that they may actually use that campaign
 * and that seat.
 */
router.put('/api/characters/:id/seat', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    if (!Object.hasOwn(body, 'campaign_id')) return res.status(400).json({ error: 'campaign_id_required' });

    const row = await findOwnedCharacter(req.user.id, req.params.id);
    if (!row || row.deleted_at) return res.status(404).json({ error: 'character_not_found' });

    // A seat only exists inside a campaign: taking the character off the campaign takes it out of
    // the seat too, rather than leaving a player_id pointing into a campaign it no longer belongs to.
    const campaignId = normaliseId(body.campaign_id);
    const playerId = campaignId === null ? null : normaliseId(body.player_id);
    const scope = await resolveScope(req.user, { campaign_id: campaignId, player_id: playerId }, row);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    await db.run(
      'UPDATE characters SET campaign_id = ?, player_id = ? WHERE id = ? AND user_id = ?',
      scope.campaignId, scope.playerId, row.id, req.user.id,
    );
    const updated = await db.get('SELECT * FROM characters WHERE id = ?', row.id);
    res.json({ ok: true, character: characterSummary(updated) });
  } catch (e) {
    console.error('PUT /api/characters/:id/seat', e);
    res.status(500).json({ error: e.message });
  }
});

// Soft delete: the row stays so other devices can learn the character is gone instead of treating
// its absence as "never uploaded" and pushing it straight back.
router.delete('/api/characters/:id', requireAuth, async (req, res) => {
  try {
    const row = await findOwnedCharacter(req.user.id, req.params.id);
    if (!row) return res.status(404).json({ error: 'character_not_found' });
    if (row.deleted_at) return res.json({ ok: true, already_deleted: true });
    const now = new Date().toISOString();
    await db.run('UPDATE characters SET deleted_at = ?, updated_at = ?, version = version + 1 WHERE id = ?', now, now, row.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/characters/:id', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * The one-time upload offered when someone signs in with characters already in localStorage.
 * Ids that already exist are reported as skipped rather than merged: the local copy and the server
 * copy of the same id may differ, and picking a winner is the sync layer's job, not the import's.
 */
router.post('/api/characters/import', requireAuth, async (req, res) => {
  try {
    const incoming = req.body?.characters;
    if (!Array.isArray(incoming)) return res.status(400).json({ error: 'characters_array_required' });
    if (incoming.length > 200) return res.status(413).json({ error: 'too_many_characters' });

    const imported = [];
    const skipped = [];
    for (const entry of incoming) {
      const result = await importOne(req.user, entry);
      if (result.ok) imported.push(result.id);
      else skipped.push({ id: result.id ?? null, reason: result.reason });
    }
    res.json({ ok: true, imported, skipped });
  } catch (e) {
    console.error('POST /api/characters/import', e);
    res.status(500).json({ error: e.message });
  }
});

async function importOne(user, entry) {
  const id = entry?.id;
  if (!isValidId(id)) return { ok: false, id: null, reason: 'invalid_id' };

  const doc = serializeDocument(entry.data, entry.name, entry.summary);
  if (doc.error) return { ok: false, id, reason: doc.error };

  const existing = await db.get('SELECT id FROM characters WHERE id = ?', id);
  if (existing) return { ok: false, id, reason: 'already_exists' };

  const scope = await resolveScope(user, entry, null);
  if (scope.error) return { ok: false, id, reason: scope.error };

  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO characters(id, user_id, campaign_id, player_id, name, summary, data, schema_version, version, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    id, user.id, scope.campaignId, scope.playerId, doc.name, doc.summary, doc.text, normaliseSchemaVersion(entry.schema_version), now, now,
  );
  return { ok: true, id };
}

function normaliseSchemaVersion(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

module.exports = router;
