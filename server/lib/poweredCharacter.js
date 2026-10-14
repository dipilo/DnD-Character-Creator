/** A server concern: what a player may see is a boundary, and every member writes play state. */

const ID = /^[A-Za-z0-9_-]{1,64}$/;

const MAX_NAME = 120;
const MAX_TEXT = 2000;
const MAX_ASPECTS = 60;
const MAX_FEARS = 20;

function text(value, limit = MAX_TEXT) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function boolOf(value) {
  return value === true;
}

function idOf(value) {
  return typeof value === 'string' && ID.test(value) ? value : null;
}

function wholeNumber(value, fallback = 0) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** The ids and faces are the client's, so the shape is bounded and the values are not read. */
function normaliseStats(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const stats = {};
  for (const [id, die] of Object.entries(value)) {
    if (!ID.test(id) || Object.keys(stats).length >= 12) continue;
    stats[id] = text(die, 8);
  }
  return stats;
}

function normaliseAspect(value) {
  const id = idOf(value?.id);
  if (!id) return null;
  return {
    id,
    text: text(value.text),
    // Which seat has this Aspect in front of them, and whether it is currently turned sideways.
    holder: wholeNumber(value.holder, 0) || null,
    active: boolOf(value.active),
    // The GM may hold an Aspect back until it matters. Hidden ones never leave the server.
    hidden: boolOf(value.hidden),
  };
}

function normaliseFear(value) {
  const id = idOf(value?.id);
  if (!id) return null;
  return { id, text: text(value.text), revealed: boolOf(value.revealed) };
}

function normaliseList(value, limit, map) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    const mapped = map(entry);
    if (!mapped || seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    out.push(mapped);
    if (out.length >= limit) break;
  }
  return out;
}

/** Bound an incoming document. Anything outside the shape is dropped rather than stored. */
function normaliseDocument(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'data_must_be_an_object' };
  const pool = wholeNumber(data.powerTokens?.pool, 0);
  const spent = wholeNumber(data.powerTokens?.spent, 0);
  return {
    value: {
      name: text(data.name, MAX_NAME),
      concept: text(data.concept),
      stats: normaliseStats(data.stats),
      // Spending past the pool is a rule the book allows ("Exertion past bounds of Power Tokens"),
      // so `spent` is not clamped to it — only to something a counter can render.
      powerTokens: { pool: Math.max(0, pool), spent: Math.max(0, spent) },
      aspects: normaliseList(data.aspects, MAX_ASPECTS, normaliseAspect),
      fears: normaliseList(data.fears, MAX_FEARS, normaliseFear),
    },
  };
}

function parseDocument(row) {
  try {
    return JSON.parse(row.data);
  } catch (e) {
    console.warn('powered_characters.data is not valid JSON for', row.id, e?.message);
    return normaliseDocument({}).value;
  }
}

/** Hidden cards are removed, not flagged; the counts stay, because the table sees them. */
function redactForPlayers(document) {
  const aspects = document.aspects.filter((aspect) => !aspect.hidden);
  const revealed = document.fears.filter((fear) => fear.revealed);
  return {
    ...document,
    aspects,
    fears: revealed,
    hiddenAspects: document.aspects.length - aspects.length,
    hiddenFears: document.fears.length - revealed.length,
  };
}

function publicPoweredCharacter(row, isOwner) {
  const document = parseDocument(row);
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    version: row.version ?? 1,
    is_owner: Boolean(isOwner),
    data: isOwner ? { ...document, hiddenAspects: 0, hiddenFears: 0 } : redactForPlayers(document),
    updated_at: row.updated_at ?? null,
  };
}

/** Only these fields, and only on existing Aspects; everything else is the GM's. */
function applyPlayPatch(document, patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { error: 'patch_must_be_an_object' };
  const next = { ...document, aspects: document.aspects.map((aspect) => ({ ...aspect })) };

  if (Object.hasOwn(patch, 'spent')) {
    next.powerTokens = { ...document.powerTokens, spent: Math.max(0, wholeNumber(patch.spent, document.powerTokens.spent)) };
  }
  for (const move of Array.isArray(patch.aspects) ? patch.aspects : []) {
    const aspect = next.aspects.find((entry) => entry.id === idOf(move?.id));
    // A hidden Aspect is not at the table yet, so it cannot be turned sideways — and answering a
    // move on one would confirm the id exists, which is what hiding it is for.
    if (!aspect || aspect.hidden) continue;
    if (Object.hasOwn(move, 'active')) aspect.active = boolOf(move.active);
    if (Object.hasOwn(move, 'holder')) aspect.holder = wholeNumber(move.holder, 0) || null;
  }
  return { value: next };
}

module.exports = {
  applyPlayPatch,
  normaliseDocument,
  parseDocument,
  publicPoweredCharacter,
  redactForPlayers,
};
