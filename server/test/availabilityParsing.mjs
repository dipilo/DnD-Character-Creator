/**
 * Free-text availability parsing, asserted against the phrasings players actually write.
 *
 * MERGE_PLAN.md §13 left this as "the heuristics themselves are loose ... it should be judged
 * against real player notes rather than guessed at". This is that judgement, written down: each
 * case states the weekdays and the local wall-clock window the note should produce, so the next
 * change to the parser has something to fail against.
 *
 * Assertions are structural — weekday set, start/end clock times, block count per week — never
 * absolute dates, because the parser projects forward from "now" and a snapshot would rot daily.
 */

import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, '..');

// The parser is pure, but lib/availability requires db/index.js, which refuses to load
// unconfigured. Point it at a throwaway file that is never written to.
const scratchDb = path.join(mkdtempSync(path.join(os.tmpdir(), 'dnd-avail-')), 'unused.db');
process.env.TURSO_DATABASE_URL = `file:${scratchDb.replaceAll('\\', '/')}`;

const require = createRequire(path.join(serverDir, 'package.json'));
const { buildRangesFromText } = require('./lib/availability.js');
const { DateTime } = require('luxon');

const DAY_ABBREV = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

let passed = 0;
const failures = [];

function describeBlock(block, zone) {
  const start = DateTime.fromISO(block.start_iso).setZone(zone);
  const end = DateTime.fromISO(block.end_iso).setZone(zone);
  return {
    weekday: start.weekday,
    start: start.toFormat('HH:mm'),
    end: end.toFormat('HH:mm'),
    crossesMidnight: end.toFormat('yyyy-LL-dd') !== start.toFormat('yyyy-LL-dd'),
  };
}

function summarise(blocks, zone) {
  const shapes = new Map();
  for (const block of blocks) {
    const d = describeBlock(block, zone);
    const key = `${DAY_ABBREV[d.weekday]} ${d.start}-${d.end}${d.crossesMidnight ? '+1' : ''}`;
    shapes.set(key, (shapes.get(key) ?? 0) + 1);
  }
  return shapes;
}

/**
 * @param {object} spec
 * @param {string} spec.text      the note as a player would type it
 * @param {string} spec.timezone  the seat's configured zone abbreviation
 * @param {string} spec.zone      IANA zone the expectations are written in
 * @param {string[]} spec.expect  one "Day HH:mm-HH:mm" (with "+1" when it runs past midnight) per
 *                                distinct block shape; every shape must appear and no other may
 */
function check(spec) {
  const { text, timezone, zone, expect, days = 14 } = spec;
  const blocks = buildRangesFromText(text, timezone, days);
  const shapes = summarise(blocks, zone);
  const got = [...shapes.keys()].sort((a, b) => a.localeCompare(b));
  const want = [...expect].sort((a, b) => a.localeCompare(b));

  if (got.length === want.length && got.every((value, i) => value === want[i])) {
    passed += 1;
    console.log(`PASS  ${text || '(empty)'}`);
    return;
  }

  failures.push({ text, want, got });
  console.log(`FAIL  ${text || '(empty)'}\n        want ${JSON.stringify(want)}\n        got  ${JSON.stringify(got)}`);
}

const ET = 'America/New_York';
const PT = 'America/Los_Angeles';
const LONDON = 'Europe/London';

// The case §13 recorded: the day is stated on one fragment and the hours on the next, and the
// old splitter parsed them apart — "a correct Wednesday block and a Monday block of 12pm-6pm".
check({
  text: 'every Monday and Wednesday 7pm-11pm',
  timezone: 'EST', zone: ET,
  expect: ['Mon 19:00-23:00', 'Wed 19:00-23:00'],
});

// The hours land on the *last* fragment here, so the fill has to run backwards as well.
check({
  text: 'Mon, Wed, Fri 8pm-midnight',
  timezone: 'EST', zone: ET,
  expect: ['Mon 20:00-00:00+1', 'Wed 20:00-00:00+1', 'Fri 20:00-00:00+1'],
});

// Abbreviations, and a slash as a separator.
check({
  text: 'Tues/Thurs 7-11pm',
  timezone: 'PST', zone: PT,
  expect: ['Tue 19:00-23:00', 'Thu 19:00-23:00'],
});

// "between A and B" must survive the split on "and".
check({
  text: 'free between 5pm and 9pm on Sundays',
  timezone: 'EST', zone: ET,
  expect: ['Sun 17:00-21:00'],
});

// Two complete clauses, each keeping its own hours.
check({
  text: 'Friday 7pm-11pm and Saturday 2pm-6pm',
  timezone: 'EST', zone: ET,
  expect: ['Fri 19:00-23:00', 'Sat 14:00-18:00'],
});

check({
  text: 'Monday 6pm-9pm, Wednesday 7pm-11pm',
  timezone: 'EST', zone: ET,
  expect: ['Mon 18:00-21:00', 'Wed 19:00-23:00'],
});

// Group words expand to their days; "after" is open-ended to end of day.
check({
  text: 'weekdays after 6pm',
  timezone: 'EST', zone: ET,
  expect: ['Mon 18:00-23:59', 'Tue 18:00-23:59', 'Wed 18:00-23:59', 'Thu 18:00-23:59', 'Fri 18:00-23:59'],
});

check({
  text: 'weekends after 5pm and weekdays after 8pm',
  timezone: 'EST', zone: ET,
  expect: [
    'Mon 20:00-23:59', 'Tue 20:00-23:59', 'Wed 20:00-23:59', 'Thu 20:00-23:59', 'Fri 20:00-23:59',
    'Sat 17:00-23:59', 'Sun 17:00-23:59',
  ],
});

check({
  text: 'weekends anytime',
  timezone: 'EST', zone: ET,
  expect: ['Sat 00:00-23:59', 'Sun 00:00-23:59'],
});

// A day part, pluralised — "evenings" matched nothing before, because the pattern was \bevening\b.
check({
  text: 'Wednesday nights',
  timezone: 'EST', zone: ET,
  expect: ['Wed 20:00-00:00+1'],
});

check({
  text: 'Sat & Sun mornings',
  timezone: 'EST', zone: ET,
  expect: ['Sat 08:00-12:00', 'Sun 08:00-12:00'],
});

// No day named at all: the day part applies to every day, as it did before.
check({
  text: 'evenings',
  timezone: 'EST', zone: ET,
  expect: ['Mon 18:00-23:00', 'Tue 18:00-23:00', 'Wed 18:00-23:00', 'Thu 18:00-23:00', 'Fri 18:00-23:00', 'Sat 18:00-23:00', 'Sun 18:00-23:00'],
});

// A day with no hours anywhere in the note means the whole day, not nothing.
check({
  text: 'Sundays',
  timezone: 'EST', zone: ET,
  expect: ['Sun 00:00-23:59'],
});

// A lone clock time reads as a start. The zone written into the note beats the seat's.
check({
  text: 'Mondays 8pm BST',
  timezone: 'EST', zone: LONDON,
  expect: ['Mon 20:00-23:59'],
});

check({
  text: 'thurs 6:30pm-10:30pm',
  timezone: 'EST', zone: ET,
  expect: ['Thu 18:30-22:30'],
});

check({
  text: 'every day 9am-5pm',
  timezone: 'UTC', zone: 'Etc/UTC',
  expect: ['Mon 09:00-17:00', 'Tue 09:00-17:00', 'Wed 09:00-17:00', 'Thu 09:00-17:00', 'Fri 09:00-17:00', 'Sat 09:00-17:00', 'Sun 09:00-17:00'],
});

check({
  text: 'Saturday 10am-2pm',
  timezone: 'EST', zone: ET,
  expect: ['Sat 10:00-14:00'],
});

// The smoke harness drives this exact string; keep it honest here too.
check({
  text: 'Free Mondays 6pm-10pm EST',
  timezone: 'EST', zone: ET,
  expect: ['Mon 18:00-22:00'],
});

// Text that names one occasion is chrono's, not the recurring heuristics'.
{
  const dated = buildRangesFromText('Aug 21 7pm-11pm', 'EST', 14);
  const oneOff = dated.length === 1 && describeBlock(dated[0], ET).start === '19:00' && describeBlock(dated[0], ET).end === '23:00';
  if (oneOff) {
    passed += 1;
    console.log('PASS  Aug 21 7pm-11pm resolves to a single dated block in the seat\'s zone');
  } else {
    failures.push({ text: 'Aug 21 7pm-11pm', want: ['one 19:00-23:00 block'], got: dated.map((b) => JSON.stringify(describeBlock(b, ET))) });
    console.log('FAIL  Aug 21 7pm-11pm');
  }
}

// Nothing parseable stays nothing, rather than becoming an all-week guess.
for (const text of ['', '   ', 'ask me', 'depends on work']) {
  const blocks = buildRangesFromText(text, 'EST', 14);
  if (blocks.length === 0) {
    passed += 1;
    console.log(`PASS  ${JSON.stringify(text)} parses to no blocks`);
  } else {
    failures.push({ text, want: ['no blocks'], got: [`${blocks.length} blocks`] });
    console.log(`FAIL  ${JSON.stringify(text)} produced ${blocks.length} blocks`);
  }
}

// Every block must be a forward-running interval — a parse that inverts one silently poisons the
// aggregate view, which sorts by start.
{
  const notes = ['every Monday and Wednesday 7pm-11pm', 'Mon, Wed, Fri 8pm-midnight', 'weekdays after 6pm', 'Sundays'];
  const bad = notes.flatMap((text) => buildRangesFromText(text, 'EST', 14)).filter((b) => !(b.end_iso > b.start_iso));
  if (bad.length === 0) {
    passed += 1;
    console.log('PASS  every produced block ends after it starts');
  } else {
    failures.push({ text: 'interval sanity', want: ['end > start'], got: bad.map((b) => `${b.start_iso}..${b.end_iso}`) });
    console.log('FAIL  some blocks end before they start');
  }
}

console.log('');
if (failures.length > 0) {
  console.error(`availability parsing FAILED: ${failures.length} of ${failures.length + passed} checks`);
  process.exit(1);
}
console.log(`availability parsing OK: ${passed} checks passed`);
process.exit(0);
