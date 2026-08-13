const chrono = require('chrono-node');
const { DateTime } = require('luxon');
const db = require('../db');

/* ---------- timezone mapping ---------- */

function tzFromAbbrev(tzRaw) {
  if (!tzRaw) return null;
  const s = String(tzRaw).trim().toLowerCase();
  const map = {
    'est': 'America/New_York','edt':'America/New_York',
    'cst': 'America/Chicago','cdt':'America/Chicago',
    'mst': 'America/Denver','mdt':'America/Denver',
    'pst': 'America/Los_Angeles','pdt':'America/Los_Angeles',
    'bst': 'Europe/London','gmt':'Etc/UTC','utc':'Etc/UTC','cet':'Europe/Paris','ceST':'Europe/Paris'
  };
  // direct exact match
  if (map[s]) return map[s];
  // sometimes user writes 'Est' or 'est ' etc
  const up = s.toUpperCase();
  if (map[up.toLowerCase()]) return map[up.toLowerCase()];
  return null;
}

// Extract an explicit timezone abbreviation from the free-text itself (e.g. "8pm BST")
function extractTzFromText(text) {
  if (!text) return null;
  const m = text.match(/\b(EST|EDT|CST|CDT|MST|MDT|PST|PDT|BST|GMT|UTC|CET|CEST)\b/i);
  if (m) return tzFromAbbrev(m[1]);
  return null;
}

/**
 * chrono resolves a wall-clock reading against the *system* zone, so "7pm" on a server in UTC
 * became 7pm UTC no matter which zone the player wrote it in. Re-stamp the components it read
 * into the target zone instead of converting the instant it produced.
 */
function reanchorToZone(jsDate, zone) {
  const local = DateTime.fromJSDate(jsDate);
  return DateTime.fromObject(
    {
      year: local.year,
      month: local.month,
      day: local.day,
      hour: local.hour,
      minute: local.minute,
      second: local.second
    },
    { zone }
  );
}

function extractRangesWithChrono(text, tz = 'Etc/UTC') {
  if (!text) return [];
  const zone = tz ?? 'Etc/UTC';
  const nowInZone = DateTime.now().setZone(zone).toJSDate(); // reference date anchored to zone
  const results = chrono.parse(text, nowInZone, { forwardDate: true });

  const ranges = [];

  for (const r of results) {
    if (!r.start) continue;
    const sdt = reanchorToZone(r.start.date(), zone);
    // A single time ("after 8pm") has no end; give it a block rather than dropping it.
    const edt = r.end ? reanchorToZone(r.end.date(), zone) : sdt.plus({ hours: 6 });
    if (!sdt.isValid || !edt.isValid || edt <= sdt) continue;
    ranges.push({ start_iso: sdt.toUTC().toISO(), end_iso: edt.toUTC().toISO() });
  }
  return ranges;
}

/* ---------- free-text availability heuristics ----------
 *
 * A player writes availability the way they would say it: the days once, the hours once, and the
 * two halves in whichever order came out. "Mon, Wed, Fri 8pm-midnight" states the hours only on
 * the last fragment; "every Monday and Wednesday 7pm-11pm" only on the second. Parsing each
 * fragment in isolation is what produced a correct Wednesday block beside a Monday block of
 * 12pm-6pm (MERGE_PLAN.md §13) — so the fragments are parsed first and *associated* second.
 */

const ALL_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

// The day words that actually turn up in player notes. A full-name-only regex missed every
// abbreviation, which is how "Mon, Wed, Fri 8pm-midnight" lost two of its three days.
const DAY_TOKEN_GROUPS = [
  { days: [1], tokens: ['monday', 'mondays', 'mon', 'mons'] },
  { days: [2], tokens: ['tuesday', 'tuesdays', 'tue', 'tues', 'tuc'] },
  { days: [3], tokens: ['wednesday', 'wednesdays', 'wed', 'weds', 'wedn'] },
  { days: [4], tokens: ['thursday', 'thursdays', 'thu', 'thur', 'thurs'] },
  { days: [5], tokens: ['friday', 'fridays', 'fri', 'fris'] },
  { days: [6], tokens: ['saturday', 'saturdays', 'sat', 'sats'] },
  { days: [7], tokens: ['sunday', 'sundays', 'sun', 'suns'] },
  { days: [1, 2, 3, 4, 5], tokens: ['weekday', 'weekdays', 'weeknight', 'weeknights'] },
  { days: [6, 7], tokens: ['weekend', 'weekends'] },
  { days: ALL_WEEKDAYS, tokens: ['daily', 'everyday'] }
];

const DAY_TOKENS = new Map();
for (const group of DAY_TOKEN_GROUPS) {
  for (const token of group.tokens) DAY_TOKENS.set(token, group.days);
}

// Vague times, resolved once here rather than at four call sites. These are defaults for text
// that names no clock time at all; anything explicit wins.
const DAY_PART_RANGES = new Map([
  ['morning', { start: '8:00 am', end: '12:00 pm' }],
  ['mornings', { start: '8:00 am', end: '12:00 pm' }],
  ['afternoon', { start: '12:00 pm', end: '5:00 pm' }],
  ['afternoons', { start: '12:00 pm', end: '5:00 pm' }],
  ['evening', { start: '6:00 pm', end: '11:00 pm' }],
  ['evenings', { start: '6:00 pm', end: '11:00 pm' }],
  ['night', { start: '8:00 pm', end: '12:00 am' }],
  ['nights', { start: '8:00 pm', end: '12:00 am' }],
  ['tonight', { start: '8:00 pm', end: '12:00 am' }],
  ['late', { start: '9:00 pm', end: '2:00 am' }]
]);

const TZ_TOKEN = '(?:EST|EDT|CST|CDT|MST|MDT|PST|PDT|BST|GMT|UTC|CET|CEST)';
const CLOCK_TOKEN = '(?:\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)?|noon|midnight)';
const DASH = '(?:to|through|thru|till|til|until|-|–|—)';

const timeRangePattern = new RegExp(
  `(${CLOCK_TOKEN})\\s*(?:${TZ_TOKEN})?\\s*${DASH}\\s*(${CLOCK_TOKEN})\\s*(?:${TZ_TOKEN})?`,
  'gi'
);
const afterPattern = new RegExp(`\\b(?:any\\s?time\\s+)?after\\s+(${CLOCK_TOKEN})`, 'i');
const beforePattern = new RegExp(`\\b(?:any\\s?time\\s+)?before\\s+(${CLOCK_TOKEN})`, 'i');
// A lone clock time ("Mondays 8pm") reads as a start, not an instant. The am/pm or the colon is
// required so a date fragment ("Aug 21") is not mistaken for one.
const bareTimePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})\b/i;
// "between 5pm and 9pm" is one range whose separator is the same word that separates clauses,
// so it is rewritten to a dash before anything splits on "and".
const betweenPattern = new RegExp(`\\bbetween\\s+(${CLOCK_TOKEN})\\s+and\\s+(${CLOCK_TOKEN})`, 'gi');

const dayCuePattern = /\b(mon|mons|monday|mondays|tue|tues|tuesday|tuesdays|wed|weds|wednesday|wednesdays|thu|thur|thurs|thursday|thursdays|fri|fris|friday|fridays|sat|sats|saturday|saturdays|sun|suns|sunday|sundays|weekday|weekdays|weeknight|weeknights|weekend|weekends|daily|everyday|every\s+day)\b/i;
const dayPartCuePattern = /\b(morning|mornings|afternoon|afternoons|evening|evenings|night|nights|late|anytime|any\s?time)\b/i;
// Text naming one specific occasion is chrono's job — the heuristics would spread "next Friday"
// across every Friday in the window.
const specificDateCuePattern = /\b(today|tomorrow|tonight|next|this\s+(?:coming|week|weekend)|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|\d{1,2}\/\d{1,2}|\d{1,2}(?:st|nd|rd|th))\b/i;

function hasRecurringCue(text) {
  const value = String(text || '');
  return dayCuePattern.test(value) || dayPartCuePattern.test(value);
}

/** "between 5pm and 9pm" -> "5pm - 9pm", so the clause splitter cannot cut a range in half. */
function normalizeAvailabilityText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .replace(betweenPattern, '$1 - $2')
    .trim();
}

function splitAvailabilityClauses(text) {
  const normalized = normalizeAvailabilityText(text);
  if (!normalized) return [];
  return normalized
    .split(/\s*(?:[;,\n/]|\band\b|\bplus\b|&)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseDayTokens(clause) {
  const days = new Set();
  if (/\bevery\s+day\b/i.test(clause)) {
    for (const day of ALL_WEEKDAYS) days.add(day);
  }
  for (const word of String(clause).toLowerCase().match(/[a-z]+/g) || []) {
    const mapped = DAY_TOKENS.get(word);
    if (mapped) for (const day of mapped) days.add(day);
  }
  return [...days].sort((a, b) => a - b);
}

/** A wall-clock reading, keeping the hour as written so a missing am/pm can be inferred later. */
function parseClockTime(text) {
  const value = String(text || '').trim().toLowerCase();
  if (value === 'noon') return { hour: 12, minute: 0, rawHour: 12, meridiem: 'pm' };
  if (value === 'midnight') return { hour: 0, minute: 0, rawHour: 12, meridiem: 'am' };

  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(value);
  if (!match) return null;

  const rawHour = Number.parseInt(match[1], 10);
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0;
  const meridiem = match[3] ? match[3].toLowerCase() : null;
  if (rawHour > 23 || minute > 59) return null;

  let hour = rawHour;
  if (meridiem === 'pm' && rawHour < 12) hour = rawHour + 12;
  if (meridiem === 'am' && rawHour === 12) hour = 0;
  return { hour, minute, rawHour, meridiem };
}

function minutesOfDay(time) {
  return time.hour * 60 + time.minute;
}

/**
 * "7-10pm" and "7pm-11" each state the half of the day once. Push the bare side onto the stated
 * one, then let a still-inverted range mean it runs past midnight.
 */
function resolveTimeRange(startText, endText) {
  const start = parseClockTime(startText);
  const end = parseClockTime(endText);
  if (!start || !end) return null;

  if (!start.meridiem && end.meridiem === 'pm' && start.rawHour < 12 && start.rawHour <= end.rawHour) {
    start.hour += 12;
  }
  if (!end.meridiem && start.meridiem === 'pm' && end.rawHour < 12 && minutesOfDay(end) <= minutesOfDay(start)) {
    end.hour += 12;
  }
  if (minutesOfDay(end) === minutesOfDay(start)) return null;
  return { start, end };
}

function collectExplicitRanges(clause) {
  const ranges = [];
  timeRangePattern.lastIndex = 0;
  let match = timeRangePattern.exec(clause);
  while (match) {
    const resolved = resolveTimeRange(match[1], match[2]);
    if (resolved) ranges.push(resolved);
    match = timeRangePattern.exec(clause);
  }
  return ranges;
}

function allDayRange() {
  return { start: { hour: 0, minute: 0 }, end: { hour: 23, minute: 59 } };
}

function collectImpliedRange(clause) {
  const lower = String(clause).toLowerCase();
  const after = afterPattern.exec(clause);
  if (after) return resolveTimeRange(after[1], '11:59 pm');

  const before = beforePattern.exec(clause);
  if (before) return resolveTimeRange('12:00 am', before[1]);

  if (/\bany\s?time\b/.test(lower) || /\ball\s+day\b/.test(lower)) {
    return allDayRange();
  }

  const bare = bareTimePattern.exec(clause);
  if (bare) return resolveTimeRange(bare[1], '11:59 pm');

  for (const word of lower.match(/[a-z]+/g) || []) {
    const part = DAY_PART_RANGES.get(word);
    if (part) return resolveTimeRange(part.start, part.end);
  }
  return null;
}

function parseTimeRanges(clause) {
  const explicit = collectExplicitRanges(clause);
  if (explicit.length > 0) return explicit;
  const implied = collectImpliedRange(clause);
  return implied ? [implied] : [];
}

/**
 * The nearest clause that supplies the half this one is missing. Days read backwards ("Monday,
 * Wednesday 7pm-11pm" names the day first) and times read forwards ("Mon, Wed, Fri 8pm-midnight"
 * names them last), so the preferred direction differs per half.
 */
function nearestNonEmpty(clauses, index, pick, preferForward) {
  for (let offset = 1; offset < clauses.length; offset++) {
    const preferred = preferForward ? clauses[index + offset] : clauses[index - offset];
    if (preferred && pick(preferred).length > 0) return pick(preferred);
    const other = preferForward ? clauses[index - offset] : clauses[index + offset];
    if (other && pick(other).length > 0) return pick(other);
  }
  return [];
}

function associateDaysAndTimes(clauses) {
  return clauses.map((clause, index) => ({
    days: clause.days.length > 0 ? clause.days : nearestNonEmpty(clauses, index, (c) => c.days, false),
    times: clause.times.length > 0 ? clause.times : nearestNonEmpty(clauses, index, (c) => c.times, true)
  }));
}

function buildRangeOnDay(day, range) {
  const start = day.set({ hour: range.start.hour, minute: range.start.minute, second: 0, millisecond: 0 });
  let end = day.set({ hour: range.end.hour, minute: range.end.minute, second: 0, millisecond: 0 });
  if (end <= start) end = end.plus({ days: 1 });
  if (!start.isValid || !end.isValid) return null;
  return { start_iso: start.toUTC().toISO(), end_iso: end.toUTC().toISO() };
}

function buildHeuristicRanges(text, fallbackZone, daysAhead = 14) {
  const zone = extractTzFromText(text) || fallbackZone || 'Etc/UTC';
  const parsed = splitAvailabilityClauses(text)
    .map((clause) => ({ days: parseDayTokens(clause), times: parseTimeRanges(clause) }))
    .filter((clause) => clause.days.length > 0 || clause.times.length > 0);

  // "Sundays" names days and no hours at all. Dropping it loses the only thing the player said;
  // read it as the whole day rather than nothing.
  const associated = parsed.some((clause) => clause.times.length > 0)
    ? associateDaysAndTimes(parsed)
    : parsed.map((clause) => ({ days: clause.days, times: [allDayRange()] }));

  const clauses = associated.filter((clause) => clause.times.length > 0);
  if (clauses.length === 0) return [];

  const out = [];
  const today = DateTime.now().setZone(zone).startOf('day');
  for (let offset = 0; offset < daysAhead; offset++) {
    const day = today.plus({ days: offset });
    for (const clause of clauses) {
      const allowed = clause.days.length > 0 ? clause.days : ALL_WEEKDAYS;
      if (!allowed.includes(day.weekday)) continue;
      for (const range of clause.times) {
        const built = buildRangeOnDay(day, range);
        if (built) out.push(built);
      }
    }
  }
  return out;
}

function dedupeAvailabilityRanges(ranges = []) {
  const seen = new Set();
  const out = [];
  for (const range of ranges) {
    if (!range?.start_iso || !range?.end_iso) continue;
    const key = `${range.start_iso}|${range.end_iso}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(range);
  }
  return out;
}

function normalizePreviewBlocks(blocks = []) {
  if (!Array.isArray(blocks)) return [];
  const normalized = [];
  for (const block of blocks) {
    const rawStart = block?.start_iso || block?.start;
    const rawEnd = block?.end_iso || block?.end;
    if (!rawStart || !rawEnd) continue;
    const start = DateTime.fromISO(String(rawStart), { setZone: true });
    const end = DateTime.fromISO(String(rawEnd), { setZone: true });
    if (!start.isValid || !end.isValid || end <= start) continue;
    normalized.push({ start_iso: start.toUTC().toISO(), end_iso: end.toUTC().toISO() });
  }
  return dedupeAvailabilityRanges(normalized);
}

function buildRangesFromText(text, tzRaw, daysAhead = 14) {
  if (!text || String(text).trim() === '') return [];

  // A timezone written into the note itself beats the seat's configured one.
  const zone = extractTzFromText(text) || tzFromAbbrev(tzRaw) || 'Etc/UTC';
  const chronoFirst = specificDateCuePattern.test(text) && !hasRecurringCue(text);

  if (chronoFirst) {
    const dated = extractRangesWithChrono(text, zone);
    if (dated.length > 0) return dedupeAvailabilityRanges(dated);
  }

  // Recurring phrasing ("every Monday", "weekends", "evenings") is what the heuristics exist for;
  // chrono reads each day name as one upcoming date and drops the repetition.
  const recurring = dedupeAvailabilityRanges(buildHeuristicRanges(text, zone, daysAhead));
  if (recurring.length > 0) return recurring;

  return dedupeAvailabilityRanges(extractRangesWithChrono(text, zone));
}


/* ---------- DB helpers & merge logic ---------- */
async function insertAvailabilityRow(player_id, start_iso, end_iso, source='manual', campaign_id = null, cx = db) {
  if (campaign_id !== null && campaign_id !== undefined) {
    const info = await cx.run('INSERT INTO availability(player_id,start_iso,end_iso,source,campaign_id) VALUES (?, ?, ?, ?, ?)', player_id, start_iso, end_iso, source, campaign_id);
    return info.lastInsertRowid;
  }
  const info = await cx.run('INSERT INTO availability(player_id,start_iso,end_iso,source) VALUES (?, ?, ?, ?)', player_id, start_iso, end_iso, source);
  return info.lastInsertRowid;
}

async function deleteAvailabilityById(id) {
  await db.run('DELETE FROM availability WHERE id = ?', id);
}

async function updateAvailabilityById(id, start_iso, end_iso) {
  await db.run('UPDATE availability SET start_iso = ?, end_iso = ? WHERE id = ?', start_iso, end_iso, id);
}

async function mergeInsertAvailability(player_id, start_iso, end_iso, source='manual') {
  const findSql2 = `
    SELECT id, start_iso, end_iso FROM availability
    WHERE player_id = ?
      AND NOT (end_iso < ? OR start_iso > ?)
  `;
  const rows = await db.all(findSql2, player_id, start_iso, end_iso);

  // attempt to read player's campaign to annotate inserted availability
  const pRow = await db.get('SELECT campaign_id FROM players WHERE id = ?', player_id);
  const playerCampaign = pRow ? pRow.campaign_id : null;

  if (rows.length === 0) {
    if (playerCampaign !== null && playerCampaign !== undefined) {
      const info = await db.run('INSERT INTO availability(player_id,start_iso,end_iso,source,campaign_id) VALUES (?, ?, ?, ?, ?)', player_id, start_iso, end_iso, source, playerCampaign);
      return { id: info.lastInsertRowid, start_iso, end_iso };
    }
    const info = await db.run('INSERT INTO availability(player_id,start_iso,end_iso,source) VALUES (?, ?, ?, ?)', player_id, start_iso, end_iso, source);
    return { id: info.lastInsertRowid, start_iso, end_iso };
  }

  let minStart = start_iso;
  let maxEnd = end_iso;
  for (const r of rows) {
    if (r.start_iso < minStart) minStart = r.start_iso;
    if (r.end_iso > maxEnd) maxEnd = r.end_iso;
  }

  await db.transaction(async (trx) => {
    for (const r of rows) {
      await trx.run('DELETE FROM availability WHERE id = ?', r.id);
    }
  });

  if (playerCampaign !== null && playerCampaign !== undefined) {
    const info = await db.run('INSERT INTO availability(player_id,start_iso,end_iso,source,campaign_id) VALUES (?, ?, ?, ?, ?)', player_id, minStart, maxEnd, source, playerCampaign);
    return { id: info.lastInsertRowid, start_iso: minStart, end_iso: maxEnd };
  }

  const info = await db.run('INSERT INTO availability(player_id,start_iso,end_iso,source) VALUES (?, ?, ?, ?)', player_id, minStart, maxEnd, source);
  return { id: info.lastInsertRowid, start_iso: minStart, end_iso: maxEnd };
}

module.exports = { tzFromAbbrev, extractTzFromText, extractRangesWithChrono, normalizePreviewBlocks, buildRangesFromText, insertAvailabilityRow, deleteAvailabilityById, updateAvailabilityById, mergeInsertAvailability };
