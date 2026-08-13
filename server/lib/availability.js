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

function extractRangesWithChrono(text, tz) {
  if (!text) return [];
  const zone = tz || 'Etc/UTC';
  const nowInZone = DateTime.now().setZone(zone).toJSDate(); // reference date anchored to zone
  const results = chrono.parse(text, nowInZone, { forwardDate: true });

  const ranges = [];

  for (const r of results) {
    // chrono returns JS Date objects; they represent absolute instants based on the reference
    if (r.start && r.end) {
      const sIso = DateTime.fromJSDate(r.start.date()).toUTC().toISO();
      const eIso = DateTime.fromJSDate(r.end.date()).toUTC().toISO();
      ranges.push({ start_iso: sIso, end_iso: eIso });
    } else if (r.start && !r.end) {
      // single time or expression like "after 8pm" - create a sensible block (to +6h)
      const sdt = DateTime.fromJSDate(r.start.date()).toUTC();
      const edt = sdt.plus({ hours: 6 });
      ranges.push({ start_iso: sdt.toISO(), end_iso: edt.toISO() });
    }
  }
  return ranges;
}

// These were nested inside extractRangesWithChrono, below its return statement. Their callers
// are all at module scope, so every call threw ReferenceError before this was fixed.
function hasAvailabilityTimeCue(text) {
  return /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|after|before|between|from|until|morning|afternoon|evening|night|late|anytime|any time)\b/i.test(text || '');
}

function hasAvailabilityDayCue(text) {
  return /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekday|weekdays|weekend|weekends|daily|every day|everyday)\b/i.test(text || '');
}

function shouldPreferRecurringHeuristics(text) {
  return /\b(weekday|weekdays|weekend|weekends|usually|typically|generally|anytime|any time|every day|daily|free between|after|between|morning|afternoon|evening|night)\b/i.test(text || '');
}

function splitAvailabilityClauses(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const rawParts = normalized
    .split(/\s*(?:;|\n|,|\band\b)\s*/i)
    .map(part => part.trim())
    .filter(Boolean);

  const combined = [];
  for (let i = 0; i < rawParts.length; i++) {
    const current = rawParts[i];
    const next = rawParts[i + 1];
    if (!next) {
      combined.push(current);
      continue;
    }

    const currentHasTime = hasAvailabilityTimeCue(current);
    const currentHasDay = hasAvailabilityDayCue(current);
    const nextHasTime = hasAvailabilityTimeCue(next);
    const nextHasDay = hasAvailabilityDayCue(next);

    if ((currentHasDay && !currentHasTime && nextHasTime) || (currentHasTime && !currentHasDay && nextHasDay)) {
      combined.push(`${current} ${next}`.trim());
      i += 1;
      continue;
    }

    combined.push(current);
  }

  return combined;
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

function buildHeuristicRangesFromClause(text, fallbackZone, daysAhead = 14) {
  if (!text || String(text).trim() === '') return [];

  const explicitZone = extractTzFromText(text);
  const zone = explicitZone || fallbackZone || 'Etc/UTC';
  const lower = String(text).toLowerCase();
  const dayNames = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  let allowedDays = new Set();

  dayNames.forEach((dn, i) => {
    if (new RegExp(`\\b${dn}s?\\b`).test(lower)) allowedDays.add(i + 1);
  });
  if (/\bweekend(s)?\b/.test(lower)) {
    allowedDays.add(6);
    allowedDays.add(7);
  }
  if (/\bweekday(s)?\b/.test(lower)) {
    [1, 2, 3, 4, 5].forEach(day => allowedDays.add(day));
  }
  if (/\b(every day|daily|everyday)\b/.test(lower)) {
    allowedDays = new Set([1, 2, 3, 4, 5, 6, 7]);
  }

  const tzToken = '(?:EST|EDT|CST|CDT|MST|MDT|PST|PDT|BST|GMT|UTC|CET|CEST)';
  const rangeRegex = new RegExp(`(?:between\\s+|from\\s+)?([0-9]{1,2}(?::[0-9]{2})?\\s*(?:am|pm)?)(?:\\s*${tzToken})?\\s*(?:to|-|until)\\s*([0-9]{1,2}(?::[0-9]{2})?\\s*(?:am|pm)?)(?:\\s*${tzToken})?`, 'i');
  const afterRegex = new RegExp(`\\bafter\\s+([0-9]{1,2}(?::[0-9]{2})?\\s*(?:am|pm)?)(?:\\s*${tzToken})?`, 'i');
  const beforeRegex = new RegExp(`\\bbefore\\s+([0-9]{1,2}(?::[0-9]{2})?\\s*(?:am|pm)?)(?:\\s*${tzToken})?`, 'i');
  const anyTimeAfterRegex = new RegExp(`\\b(?:anytime|any time)\\s+after\\s+([0-9]{1,2}(?::[0-9]{2})?\\s*(?:am|pm)?)(?:\\s*${tzToken})?`, 'i');
  const mRange = text.match(rangeRegex);
  const mAnyTimeAfter = text.match(anyTimeAfterRegex);
  const mAfter = text.match(afterRegex);
  const mBefore = text.match(beforeRegex);

  const rangesOfDay = [];
  if (mRange) rangesOfDay.push({ startText: mRange[1], endText: mRange[2] });
  else if (mAnyTimeAfter) rangesOfDay.push({ startText: mAnyTimeAfter[1], endText: '11:59 pm' });
  else if (mAfter) rangesOfDay.push({ startText: mAfter[1], endText: '11:59 pm' });
  else if (mBefore) rangesOfDay.push({ startText: '12:00 am', endText: mBefore[1] });
  else if (/\b(anytime|any time)\b/.test(lower)) rangesOfDay.push({ startText: '12:00 am', endText: '11:59 pm' });
  else if (/\bevening\b|\bnight\b|\blate\b/.test(lower)) rangesOfDay.push({ startText: '8:00 pm', endText: '3:00 am' });
  else if (/\bafternoon\b/.test(lower)) rangesOfDay.push({ startText: '1:00 pm', endText: '11:00 pm' });
  else if (/\bmorning\b/.test(lower)) rangesOfDay.push({ startText: '8:00 am', endText: '12:00 pm' });

  if (rangesOfDay.length === 0) return [];
  if (allowedDays.size === 0) {
    allowedDays = new Set([1, 2, 3, 4, 5, 6, 7]);
  }

  const parseTime = (tText, baseDate) => {
    const ref = baseDate.toJSDate();
    const parsed = chrono.parse(tText, ref);
    if (parsed && parsed.length > 0 && parsed[0].start) {
      const jsDate = parsed[0].start.date();
      return DateTime.fromObject(
        {
          year: baseDate.year,
          month: baseDate.month,
          day: baseDate.day,
          hour: jsDate.getHours(),
          minute: jsDate.getMinutes(),
          second: jsDate.getSeconds(),
          millisecond: jsDate.getMilliseconds()
        },
        { zone }
      );
    }

    const m = String(tText).match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (!m) return null;
    let hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    const ampm = m[3];
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
      if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
    }
    return baseDate.set({ hour, minute, second: 0, millisecond: 0 });
  };

  const out = [];
  const today = DateTime.now().setZone(zone).startOf('day');
  for (let i = 0; i < daysAhead; i++) {
    const dt = today.plus({ days: i });
    if (!allowedDays.has(dt.weekday)) continue;

    for (const r of rangesOfDay) {
      const startDT = parseTime(r.startText, dt);
      let endDT = parseTime(r.endText, dt);
      if (!startDT || !endDT) continue;
      if (endDT <= startDT) endDT = endDT.plus({ days: 1 });
      out.push({ start_iso: startDT.toUTC().toISO(), end_iso: endDT.toUTC().toISO() });
    }
  }

  return out;
}

function buildRangesFromText(text, tzRaw, daysAhead = 14) {
  if (!text || String(text).trim() === '') return [];

  // prefer timezone mention in text
  const explicitZone = extractTzFromText(text);
  const zone = explicitZone || (tzFromAbbrev(tzRaw) || 'Etc/UTC');
  const clauses = splitAvailabilityClauses(text);

  const heuristicRanges = () => dedupeAvailabilityRanges(
    clauses.flatMap(clause => buildHeuristicRangesFromClause(clause, zone, daysAhead))
  );

  // Recurring phrasing ("every Monday", "weekends") is what the heuristics are for; chrono
  // reads those as a single upcoming date.
  if (shouldPreferRecurringHeuristics(text)) {
    const recurring = heuristicRanges();
    if (recurring.length > 0) return recurring;
  }

  // 1) try chrono anchored to 'zone'
  const chronoRanges = extractRangesWithChrono(text, zone);
  if (chronoRanges && chronoRanges.length > 0) {
    return dedupeAvailabilityRanges(chronoRanges);
  }

  // 2) fall back to the day/time heuristics
  return heuristicRanges();
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
