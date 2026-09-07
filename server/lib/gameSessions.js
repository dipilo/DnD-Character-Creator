/**
 * Play sessions, and the roll feed they collect.
 *
 * The server records what a client says settled and interprets none of it — the dice, the
 * notation and the wording of a roll are the client's, exactly as `characters.summary` is. What it
 * *does* own is who may write: a roll belongs to the session it was made in, and only a member of
 * that campaign can add one or read the feed.
 */

/** Longest a label or a note may be. A roll's wording is a caption, not a document. */
const MAX_TEXT = 200;
const MAX_RESULTS = 100;

function readText(value, limit = MAX_TEXT) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, limit) : null;
}

/**
 * One settled roll, bounded. `results` is stored as the client's own JSON so the feed can show the
 * individual dice; anything that is not a list of plain numbers is dropped rather than stored.
 */
function normaliseRoll(body) {
  const label = readText(body?.label);
  if (!label) return { error: 'label_required' };

  const notation = readText(body?.notation, 60);
  if (!notation) return { error: 'notation_required' };

  const total = Number.parseInt(String(body?.total ?? ''), 10);
  if (!Number.isFinite(total)) return { error: 'total_required' };

  const results = Array.isArray(body?.results)
    ? body.results
        .slice(0, MAX_RESULTS)
        .map((entry) => ({
          value: Number.parseInt(String(entry?.value ?? ''), 10),
          sides: Number.parseInt(String(entry?.sides ?? ''), 10),
          dropped: Boolean(entry?.dropped),
        }))
        .filter((entry) => Number.isFinite(entry.value) && Number.isFinite(entry.sides))
    : [];

  return {
    value: {
      label,
      notation,
      total,
      detail: readText(body?.detail),
      note: readText(body?.note),
      character_name: readText(body?.character_name, 80),
      results: JSON.stringify(results),
    },
  };
}

/** A session row as a client sees it. */
function publicSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    group_id: row.group_id ?? null,
    name: row.name ?? null,
    started_by: row.started_by,
    started_at: row.started_at,
    ended_at: row.ended_at ?? null,
    is_open: !row.ended_at,
  };
}

/**
 * A roll row as a client sees it, with the dice parsed back out. A blob that is not valid JSON is
 * reported as no dice rather than failing the whole feed — the total is the part that matters.
 */
function publicRoll(row) {
  let results = [];
  if (row.results) {
    try {
      const parsed = JSON.parse(row.results);
      if (Array.isArray(parsed)) results = parsed;
    } catch (e) {
      console.warn('session_rolls.results is not valid JSON for roll', row.id, e?.message);
    }
  }

  return {
    id: row.id,
    session_id: row.session_id,
    user_id: row.user_id,
    username: row.username ?? null,
    character_name: row.character_name ?? null,
    label: row.label,
    detail: row.detail ?? null,
    notation: row.notation,
    total: row.total,
    note: row.note ?? null,
    results,
    rolled_at: row.rolled_at,
  };
}

module.exports = { normaliseRoll, publicRoll, publicSession };
