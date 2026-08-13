// Builder characters (MERGE_PLAN.md Phase 2).
//
// A character is stored as one JSON document rather than mapped columns, because CLAUDE.md
// requires a saved character to read back into the builder and that needs every choice-mode and
// selection field intact — a lossy column mapping breaks `loadCharacterIntoBuilder` silently.
// These helpers are the single place the document is parsed and the single shape it leaves in.

// A serialised document larger than this is not a character sheet any more; the most likely cause
// is a portrait data URL. Rejecting it here beats storing a row nothing can load.
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

// `summary` is a display line, not data: it is denormalised so a party view can list a campaign's
// characters without parsing everyone's document, and it is bounded because nothing reads it except
// a card subtitle.
const MAX_SUMMARY_LENGTH = 200;

/**
 * The client's one-line description of a character ("Level 5 Elf Wizard 5"). Stored verbatim and
 * never interpreted here — resolving species and class ids to names needs the content library,
 * which is the client's, so this column is the client's to write.
 */
function normaliseSummary(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, MAX_SUMMARY_LENGTH);
  return trimmed || null;
}

/** Row metadata, without the document. What list endpoints return. */
function characterSummary(row) {
  if (!row || typeof row !== 'object') return null;
  return {
    id: row.id,
    user_id: row.user_id,
    campaign_id: row.campaign_id ?? null,
    player_id: row.player_id ?? null,
    name: row.name ?? null,
    summary: row.summary ?? null,
    schema_version: row.schema_version ?? 1,
    version: row.version ?? 1,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/**
 * The party view's row (MERGE_PLAN.md Phase 5): a summary plus the two names a member needs to
 * read it — whose character it is and which seat it sits in. Both come from joins, so they are the
 * only fields here that are not the character's own; `username` is the one column of `users` that
 * is safe to hand a campaign-mate.
 */
function campaignCharacterSummary(row) {
  const summary = characterSummary(row);
  if (!summary) return null;
  return { ...summary, owner_name: row.owner_name ?? null, player_name: row.player_name ?? null };
}

/** The summary plus the parsed document. A row whose JSON is unreadable reports `data: null`. */
function publicCharacter(row) {
  const summary = characterSummary(row);
  if (!summary) return null;
  return { ...summary, data: parseDocument(row) };
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

/**
 * Validate an incoming document and serialise it once. Returns `{ error }` for anything a client
 * should be told about, `{ text, name }` otherwise.
 */
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
  campaignCharacterSummary,
  characterSummary,
  publicCharacter,
  serializeDocument,
};
