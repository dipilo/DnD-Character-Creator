/**
 * The Pre-Game Form (Kids on Bikes, Appendix A) and the compiled view of a table's answers.
 *
 * This is the one place the server reads inside a form's document rather than storing it verbatim,
 * and that is deliberate: **the compiled merge is a privacy boundary**, so it cannot be computed by
 * the client the way `characters.summary` is. A member who is not the GM never receives anybody's
 * form — only the union below, with no name attached to any line.
 *
 * The list ids are the client's, read out of the rulebook by `scripts/import-kids-on-bikes.mjs`.
 * Nothing here knows what "Wish List" means; it bounds the shape and merges by id.
 */

/** A list id is a slug the importer made out of the book's own heading. */
const LIST_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_LISTS = 32;
const MAX_ENTRIES_PER_LIST = 200;
const MAX_ENTRY_LENGTH = 400;

function normaliseEntries(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().slice(0, MAX_ENTRY_LENGTH);
    if (trimmed) seen.add(trimmed);
    if (seen.size >= MAX_ENTRIES_PER_LIST) break;
  }
  return [...seen];
}

/**
 * Bound an incoming form. Anything outside the shape is dropped rather than stored: a list nobody
 * can see in the form is one nobody can take back out of the merge either.
 */
function normaliseForm(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { error: 'data_must_be_an_object' };
  const source = data.lists && typeof data.lists === 'object' && !Array.isArray(data.lists) ? data.lists : {};
  const lists = {};
  for (const [id, value] of Object.entries(source)) {
    if (!LIST_ID.test(id) || Object.keys(lists).length >= MAX_LISTS) continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    lists[id] = {
      warnings: normaliseEntries(value.warnings),
      notes: normaliseEntries(value.notes),
    };
  }
  return { value: { lists } };
}

function parseForm(row) {
  try {
    return JSON.parse(row.data);
  } catch (e) {
    console.warn('pre_game_forms.data is not valid JSON for form', row.id, e?.message);
    return { lists: {} };
  }
}

/** One row as its own author or the GM sees it: the document, plus who wrote it. */
function publicForm(row, ownerName = null) {
  if (!row) return null;
  return {
    campaign_id: row.campaign_id,
    user_id: row.user_id,
    owner_name: ownerName ?? row.owner_name ?? null,
    data: parseForm(row),
    updated_at: row.updated_at ?? null,
  };
}

/**
 * What the table sees: every answer, by list, with nobody's name on it.
 *
 * `respondents` is the count and not a roster, because the point of the merge is that a line
 * cannot be traced back. It is still reported, because "three of five have answered" is what tells
 * a GM the list is not yet the whole table's.
 */
function compileForms(rows) {
  const lists = new Map();
  for (const row of rows) {
    const form = parseForm(row);
    for (const [id, list] of Object.entries(form.lists ?? {})) {
      const merged = lists.get(id) ?? new Set();
      for (const entry of [...(list.warnings ?? []), ...(list.notes ?? [])]) merged.add(entry);
      lists.set(id, merged);
    }
  }
  const compiled = {};
  for (const [id, entries] of lists) {
    compiled[id] = [...entries].sort((a, b) => a.localeCompare(b));
  }
  return { respondents: rows.length, lists: compiled };
}

module.exports = { compileForms, normaliseForm, publicForm };
