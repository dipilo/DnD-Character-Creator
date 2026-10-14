// One JSON document, not mapped columns, or `loadCharacterIntoBuilder` breaks silently.
const { characterVisibility } = require('./characterAccess');

// A serialised document larger than this is not a character sheet any more; the most likely cause
// is a portrait data URL. Rejecting it here beats storing a row nothing can load.
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

// Denormalised so a party view needs no document, and bounded: only a card subtitle reads it.
const MAX_SUMMARY_LENGTH = 200;

/** Stored verbatim: resolving ids to names needs the library, which is the client's. */
function normaliseSummary(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, MAX_SUMMARY_LENGTH);
  return trimmed || null;
}

/** `SELECT *` reads `data`, whose inlined pictures are what timed the party view out. */
const SUMMARY_COLUMNS = 'id, user_id, campaign_id, player_id, name, summary, visibility, schema_version, version, created_at, updated_at, deleted_at';

/** `share_token` is absent: a credential, handed out by the owner's sharing route alone. */
function characterSummary(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    user_id: row.user_id,
    campaign_id: row.campaign_id ?? null,
    player_id: row.player_id ?? null,
    name: row.name ?? null,
    summary: row.summary ?? null,
    visibility: characterVisibility(row),
    schema_version: row.schema_version ?? 1,
    version: row.version ?? 1,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/** The joined names are the only fields here that are not the character's own. */
function campaignCharacterSummary(row, access = null) {
  const summary = characterSummary(row);
  if (!summary) return null;
  return {
    ...summary,
    owner_name: row.owner_name ?? null,
    player_name: row.player_name ?? null,
    // Saying so stops the roster offering a link that can only 404.
    can_read: Boolean(access),
    can_edit: Boolean(access?.canEdit),
  };
}

/** Unreadable JSON reports `data: null`; the access flags are a courtesy, rechecked on write. */
function publicCharacter(row, access = { isOwner: true, canEdit: true }) {
  const summary = characterSummary(row);
  if (!summary) return null;
  return {
    ...summary,
    is_owner: Boolean(access.isOwner),
    can_edit: Boolean(access.canEdit),
    data: parseDocument(row),
  };
}

function parseDocument(row) {
  const raw = typeof row.data === 'string' ? row.data : '';
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.warn('characters.data is not valid JSON for character', row.id, e?.message);
    return null;
  }
}

/** `{ error }` for anything a client should be told about, `{ text, name }` otherwise. */
function serializeDocument(data, fallbackName, summary) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'data_must_be_an_object' };
  }
  let text;
  try {
    text = JSON.stringify(data);
  } catch (e) {
    console.warn('character document could not be serialised', e?.message);
    return { error: 'data_not_serializable' };
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_DOCUMENT_BYTES) {
    return { error: 'data_too_large' };
  }
  return { text, name: pickName(data.name, fallbackName), summary: normaliseSummary(summary) };
}

/** The document's own name wins; the payload's is the fallback. Neither present reads as null. */
function pickName(documentName, fallbackName) {
  for (const candidate of [documentName, fallbackName]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
}

module.exports = {
  MAX_DOCUMENT_BYTES,
  SUMMARY_COLUMNS,
  campaignCharacterSummary,
  characterSummary,
  publicCharacter,
  serializeDocument,
};
