// Builder characters (MERGE_PLAN.md Phase 2).
//
// Characters are private data, which is why this router could not exist before Phase 1b gave the
// server a real identity boundary: every route here is `requireAuth`, and a row belongs to exactly
// one user. Another user's id reads as 404 rather than 403 so the id space is not walkable.
const express = require('express');
const crypto = require('node:crypto');
const db = require('../db');
const { characterVisibility, listGrants, normaliseVisibility, resolveCharacterAccess } = require('../lib/characterAccess');
const { characterSummary, publicCharacter, serializeDocument } = require('../lib/characters');
const { genToken } = require('../lib/tokens');
const { canUserModifyPlayer, getCampaignMembership, holdsPlayerSeat, optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();

// The builder mints `crypto.randomUUID()` client-side and that id is the character's identity in
// localStorage, so the server accepts the client's id instead of assigning its own. Constrain it
// to something id-shaped: it lands in URLs and in a primary key.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

// `genToken` mints 24 alphanumerics; the bound is wide enough to survive that length changing.
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

function isValidId(id) {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/** Fetch a row the caller owns, deleted rows included. Callers decide what a tombstone means. */
async function findOwnedCharacter(userId, id) {
  if (!isValidId(id)) return null;
  return await db.get('SELECT * FROM characters WHERE id = ? AND user_id = ?', id, userId);
}

/**
 * What the caller may do with a row, or null when it should read as absent (MERGE_PLAN.md Phase 5
 * plus sharing). Every rule lives in `lib/characterAccess.js`; this is the id check in front of it.
 *
 * Invisible still means **404 rather than 403**, because a 403 would confirm the id exists.
 */
async function resolveAccess(user, id) {
  if (!isValidId(id)) return null;
  const row = await db.get('SELECT * FROM characters WHERE id = ?', id);
  return await resolveCharacterAccess(user, row);
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
    const access = await resolveAccess(req.user, req.params.id);
    if (!access) return res.status(404).json({ error: 'character_not_found' });
    res.json({ ok: true, character: publicCharacter(access.row, access) });
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

/**
 * Update one character. `version` is the version the client last saw; a mismatch means the sheet
 * was edited somewhere else since, and the write is refused with the server's copy attached rather
 * than silently clobbering the other device's edit.
 *
 * An edit grant reaches this route, but only the *document*: the seat is the owner's act of
 * sharing, so a granted editor sending `campaign_id` or `player_id` is told no rather than quietly
 * ignored. Someone who may read but not write gets 403 — they already know the id exists, so there
 * is nothing left for a 404 to protect.
 */
router.put('/api/characters/:id', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const access = await resolveAccess(req.user, req.params.id);
    if (!access) return res.status(404).json({ error: 'character_not_found' });
    if (!access.canEdit) return res.status(403).json({ error: 'character_not_editable' });
    const row = access.row;

    const expected = normaliseId(body.version);
    if (expected === null) return res.status(400).json({ error: 'version_required' });
    if (expected !== Number(row.version)) {
      return res.status(409).json({ error: 'version_conflict', character: publicCharacter(row, access) });
    }

    const doc = serializeDocument(body.data, body.name, body.summary);
    if (doc.error) return res.status(doc.error === 'data_too_large' ? 413 : 400).json({ error: doc.error });

    const scope = await resolveWriteScope(req.user, body, access);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    await db.run(
      `UPDATE characters SET campaign_id = ?, player_id = ?, name = ?, summary = ?, data = ?, schema_version = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`,
      scope.campaignId, scope.playerId, doc.name, doc.summary, doc.text,
      normaliseSchemaVersion(body.schema_version ?? row.schema_version),
      new Date().toISOString(), row.id, expected,
    );
    const updated = await db.get('SELECT * FROM characters WHERE id = ?', row.id);
    res.json({ ok: true, character: publicCharacter(updated, access) });
  } catch (e) {
    console.error('PUT /api/characters/:id', e);
    res.status(500).json({ error: e.message });
  }
});

/** The seat an update lands on: the owner's to move, and nobody else's to touch. */
async function resolveWriteScope(user, body, access) {
  if (access.isOwner) return await resolveScope(user, body, access.row);

  const movesSeat = ['campaign_id', 'player_id'].some((field) => {
    return Object.hasOwn(body, field) && normaliseId(body[field]) !== (access.row[field] ?? null);
  });
  if (movesSeat) return { error: 'seat_is_owner_only', status: 403 };
  return { campaignId: access.row.campaign_id ?? null, playerId: access.row.player_id ?? null };
}

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
    await db.transaction(async (trx) => {
      // Sharing does not survive a deletion. The tombstone already reads as absent, but dropping
      // the token and the grants is what makes that true for anyone still holding a link.
      await trx.run('DELETE FROM character_grants WHERE character_id = ?', row.id);
      await trx.run(
        'UPDATE characters SET deleted_at = ?, updated_at = ?, share_token = NULL, version = version + 1 WHERE id = ?',
        now, now, row.id,
      );
    });
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

/* -------------------------------------------------------------------------
 * Sharing: who may open this sheet, and who may edit it.
 *
 * Everything under here is the owner's alone. `visibility` is the D&D Beyond-shaped choice
 * (private / campaign / public), `share_token` is the link that carries it, and
 * `character_grants` is the named list — a specific account, or whoever runs a given campaign.
 * A share link is one URL whatever the setting: who it lets in is `visibility`'s answer, so
 * narrowing a character narrows every link already sent without minting a new one.
 * ------------------------------------------------------------------------- */

/** The owner's view of a character's sharing, minting the link token on first read. */
router.get('/api/characters/:id/sharing', requireAuth, async (req, res) => {
  try {
    const row = await findOwnedCharacter(req.user.id, req.params.id);
    if (!row || row.deleted_at) return res.status(404).json({ error: 'character_not_found' });
    const token = row.share_token || await mintShareToken(row.id);
    res.json({ ok: true, sharing: await sharingPayload({ ...row, share_token: token }) });
  } catch (e) {
    console.error('GET /api/characters/:id/sharing', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Set the visibility, and optionally rotate the link. Rotating is the revoke: every URL handed out
 * so far stops resolving, which is the only way back from "I posted it somewhere I should not have".
 */
router.put('/api/characters/:id/sharing', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const row = await findOwnedCharacter(req.user.id, req.params.id);
    if (!row || row.deleted_at) return res.status(404).json({ error: 'character_not_found' });

    let visibility = row.visibility;
    if (Object.hasOwn(body, 'visibility')) {
      const normalised = normaliseVisibility(body.visibility);
      if (normalised.error) return res.status(400).json({ error: normalised.error });
      visibility = normalised.value;
    }

    await db.run('UPDATE characters SET visibility = ? WHERE id = ?', visibility, row.id);
    const token = body.rotate_token ? await mintShareToken(row.id) : (row.share_token || await mintShareToken(row.id));
    res.json({ ok: true, sharing: await sharingPayload({ ...row, visibility, share_token: token }) });
  } catch (e) {
    console.error('PUT /api/characters/:id/sharing', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Hand the sheet to one account, or to whoever runs one campaign. The subject has to be someone
 * the owner already shares a table with — a grant list that could name any account on the system
 * would be a way to test whether a username exists.
 */
router.post('/api/characters/:id/grants', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const row = await findOwnedCharacter(req.user.id, req.params.id);
    if (!row || row.deleted_at) return res.status(404).json({ error: 'character_not_found' });

    const subjectType = body.subject_type;
    const subjectId = normaliseId(body.subject_id);
    const access = body.access === 'edit' ? 'edit' : 'view';
    if (subjectType !== 'user' && subjectType !== 'campaign_owner') {
      return res.status(400).json({ error: 'invalid_subject_type' });
    }
    if (subjectId === null) return res.status(400).json({ error: 'subject_id_required' });
    if (subjectType === 'user' && Number(subjectId) === Number(req.user.id)) {
      return res.status(400).json({ error: 'cannot_grant_to_self' });
    }

    const allowed = subjectType === 'user'
      ? await sharesACampaign(req.user.id, subjectId)
      : Boolean(await getCampaignMembership(req.user.id, subjectId));
    if (!allowed) return res.status(400).json({ error: 'subject_not_at_a_shared_table' });

    await db.run(
      `INSERT INTO character_grants(character_id, subject_type, subject_id, access) VALUES (?, ?, ?, ?)
       ON CONFLICT(character_id, subject_type, subject_id) DO UPDATE SET access = excluded.access`,
      row.id, subjectType, subjectId, access,
    );
    res.status(201).json({ ok: true, sharing: await sharingPayload(row) });
  } catch (e) {
    console.error('POST /api/characters/:id/grants', e);
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/characters/:id/grants/:grantId', requireAuth, async (req, res) => {
  try {
    const row = await findOwnedCharacter(req.user.id, req.params.id);
    if (!row || row.deleted_at) return res.status(404).json({ error: 'character_not_found' });
    const grantId = normaliseId(req.params.grantId);
    const grant = grantId === null
      ? null
      : await db.get('SELECT * FROM character_grants WHERE id = ? AND character_id = ?', grantId, row.id);
    if (!grant) return res.status(404).json({ error: 'grant_not_found' });
    await db.run('DELETE FROM character_grants WHERE id = ?', grant.id);
    res.json({ ok: true, sharing: await sharingPayload(row) });
  } catch (e) {
    console.error('DELETE /api/characters/:id/grants/:grantId', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * A shared link. `optionalAuth` because a public character is readable signed out — that is the
 * whole point of the setting — while a campaign-only or privately granted one resolves through the
 * same rules as its id would, so one URL serves every visibility.
 */
router.get('/api/shared/characters/:token', optionalAuth, async (req, res) => {
  try {
    const token = req.params.token;
    if (typeof token !== 'string' || !SHARE_TOKEN_PATTERN.test(token)) {
      return res.status(404).json({ error: 'character_not_found' });
    }
    const row = await db.get('SELECT * FROM characters WHERE share_token = ?', token);
    const access = await resolveCharacterAccess(req.user, row);
    if (!access) return res.status(404).json({ error: 'character_not_found' });
    res.json({ ok: true, character: publicCharacter(access.row, access) });
  } catch (e) {
    console.error('GET /api/shared/characters/:token', e);
    res.status(500).json({ error: e.message });
  }
});

async function mintShareToken(characterId) {
  const token = genToken(24);
  await db.run('UPDATE characters SET share_token = ? WHERE id = ?', token, characterId);
  return token;
}

/** Two accounts share a table when one campaign lists both as members. */
async function sharesACampaign(userId, otherUserId) {
  const row = await db.get(
    `SELECT 1 AS ok FROM campaign_members a
       JOIN campaign_members b ON b.campaign_id = a.campaign_id
      WHERE a.user_id = ? AND b.user_id = ? LIMIT 1`,
    userId, otherUserId,
  );
  return Boolean(row);
}

/**
 * The sharing state as the owner's editor needs it. Each grant carries a label because a list of
 * bare ids is not something anyone can revoke with confidence.
 */
async function sharingPayload(row) {
  const grants = [];
  for (const grant of await listGrants(row.id)) {
    grants.push({ ...grant, label: await describeGrantSubject(grant) });
  }
  return {
    character_id: row.id,
    visibility: characterVisibility(row),
    share_token: row.share_token ?? null,
    grants,
  };
}

async function describeGrantSubject(grant) {
  if (grant.subject_type === 'user') {
    const user = await db.get('SELECT username FROM users WHERE id = ?', grant.subject_id);
    return user?.username || `Account ${grant.subject_id}`;
  }
  const campaign = await db.get('SELECT name FROM campaigns WHERE id = ?', grant.subject_id);
  return campaign?.name ? `GM of ${campaign.name}` : `GM of campaign ${grant.subject_id}`;
}

function normaliseSchemaVersion(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

module.exports = router;
