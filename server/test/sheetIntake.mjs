/**
 * The sheet-intake schema and import planner (MERGE_PLAN.md §20).
 *
 * `POST /api/sync` cannot be driven by the smoke harness in any meaningful way: it fetches a real
 * Google spreadsheet, so every step a snapshot can reach stops at "invalid sheet id". The part
 * worth testing is the decision — which row becomes which seat — and that is pure, so it is
 * tested directly here with rows a Form would actually produce.
 *
 * The first case is the one that matters most. The importer this replaced keyed players off the
 * sheet's row index and wrote `INSERT OR REPLACE INTO players (id, ...)`, so importing five rows
 * overwrote players 1–5 across the whole database regardless of campaign. There is now no path
 * from a row to a player id at all; ids come from matching within the campaign, or from the
 * database on insert.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, '..', 'package.json'));
const { INTAKE_FIELDS, matchHeaders, planSheetImport, readRow, normaliseIdentity } = require('./lib/sheetIntake.js');

/** Sonar S2871: a bare .sort() on strings is implementation-defined; compare explicitly. */
const byName = (values) => [...values].sort((a, b) => String(a).localeCompare(String(b)));

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
    return;
  }
  failures.push({ name, detail });
  const suffix = detail ? `\n        ${detail}` : '';
  console.log(`FAIL  ${name}${suffix}`);
}

function equal(name, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  check(name, a === b, `expected ${b}\n        got      ${a}`);
}

/* ---------- header matching ---------- */

// The exact questions the template asks must map with no help from the DM.
const formHeaders = ['Timestamp', ...INTAKE_FIELDS.map((f) => f.question)];
{
  const { mapping, unmatchedHeaders, missingRequired } = matchHeaders(formHeaders);
  equal('every template question auto-maps', byName(Object.keys(mapping)), byName(INTAKE_FIELDS.map((f) => f.key)));
  equal("Google's Timestamp column is reported, not silently dropped", unmatchedHeaders, ['Timestamp']);
  equal('nothing required is missing from the template', missingRequired, []);
}

// A hand-built sheet with terser headers, different case and punctuation.
{
  const { mapping, missingRequired } = matchHeaders(['Name', 'DISCORD', 'Time zone', 'availability!']);
  equal('terse headers still map', mapping, { name: 'Name', discord: 'DISCORD', timezone: 'Time zone', notes: 'availability!' });
  equal('nothing required missing', missingRequired, []);
}

// A sheet missing a required question is reported before anything is written.
{
  const { missingRequired } = matchHeaders(['Name', 'Discord']);
  equal('missing required questions are named', byName(missingRequired), ['notes', 'timezone']);
}

// An explicit mapping beats the aliases, which is the whole point of the mapping UI.
{
  const values = readRow({ 'Column B': 'Bran', Name: 'Wrong' }, { name: 'Column B' });
  check('an explicit mapping wins over an alias match', values.name === 'Bran', `got ${values.name}`);
}

/* ---------- identity normalisation ---------- */

check('discord handles compare without @ or case', normaliseIdentity('@Bran#1234') === normaliseIdentity('bran1234'));
check('names compare without punctuation', normaliseIdentity("O'Brien-Smith") === normaliseIdentity('obriensmith'));

/* ---------- the planner ---------- */

const seats = [
  { id: 41, name: 'Bran', discord: 'bran#1234', timezone: 'EST', notes: 'weekends' },
  { id: 42, name: 'Cora', discord: '', timezone: 'PST', notes: '' },
];

// Row order must not decide anything. Two rows, both matching existing seats, plus one new.
{
  const rows = [
    { 'What is your name?': 'Someone New', 'What is your Discord username?': 'new#1', 'What time zone are you in?': 'GMT', 'When are you generally free to play?': 'Mondays 7pm-11pm' },
    { 'What is your name?': 'Renamed Bran', 'What is your Discord username?': '@Bran#1234', 'When are you generally free to play?': 'Fridays 8pm-midnight' },
    { 'What is your name?': 'cora', 'What time zone are you in?': 'MST' },
  ];
  const plan = planSheetImport({ rows, seats });

  equal('one new row creates one seat', plan.creates.map((c) => c.values.name), ['Someone New']);
  equal('a create carries no player id at all', plan.creates.map((c) => byName(Object.keys(c))), [['rowIndex', 'values']]);
  equal('discord matches an existing seat despite the rename', [...plan.updates.map((u) => u.seatId)].sort((a, b) => a - b), [41, 42]);

  const bran = plan.updates.find((u) => u.seatId === 41);
  equal('an unclaimed seat takes the sheet\'s new name', bran.columns.name, 'Renamed Bran');
  check('a blank answer does not clear the column', bran.columns.timezone === undefined, JSON.stringify(bran.columns));

  const cora = plan.updates.find((u) => u.seatId === 42);
  equal('a name-only match still works when there is no discord handle', cora.columns.timezone, 'MST');
}

// Two rows naming the same person must not both land on that seat — the second would silently
// win, and which row that is depends on sheet order.
{
  const rows = [
    { 'What is your name?': 'Bran', 'What time zone are you in?': 'CST' },
    { 'What is your name?': 'Bran', 'What time zone are you in?': 'MST' },
  ];
  const plan = planSheetImport({ rows, seats });
  equal('only the first duplicate row matches the seat', plan.updates.map((u) => [u.rowIndex, u.seatId]), [[0, 41]]);
  equal('the second becomes its own seat rather than overwriting the first', plan.creates.map((c) => c.rowIndex), [1]);
}

// The same, where the first row happens to change nothing: the seat is still taken, so the second
// row cannot fall through onto it.
{
  const rows = [
    { 'What is your name?': 'Bran', 'What time zone are you in?': 'EST' },
    { 'What is your name?': 'Bran', 'What time zone are you in?': 'MST' },
  ];
  const plan = planSheetImport({ rows, seats });
  equal('a no-op first row still holds the seat', plan.skipped.map((s) => [s.rowIndex, s.reason]), [[0, 'nothing_to_update']]);
  equal('the second row does not inherit the seat', plan.creates.map((c) => c.rowIndex), [1]);
}

// A claimed seat belongs to a signed-in user; the sheet may update what they said, never who they are.
{
  const rows = [{
    'What is your name?': 'Someone Else Entirely',
    'What is your Discord username?': 'bran#1234',
    'What time zone are you in?': 'CET',
    'When are you generally free to play?': 'Tuesdays 6pm-10pm',
  }];
  const plan = planSheetImport({ rows, seats, claimedSeatIds: [41] });
  const update = plan.updates[0];
  check('a claimed seat keeps its name', update.columns.name === undefined, JSON.stringify(update.columns));
  check('a claimed seat keeps its discord handle', update.columns.discord === undefined, JSON.stringify(update.columns));
  equal('a claimed seat still takes availability and timezone', [update.columns.timezone, update.columns.notes], ['CET', 'Tuesdays 6pm-10pm']);
  check('the plan says the seat was claimed', update.claimed === true);
}

// Rows Google leaves behind: a trailing blank line, a timestamp and nothing else.
{
  const rows = [
    { Timestamp: '2026/08/13 10:00:00' },
    { 'What is your name?': '   ' },
    { 'What is your name?': 'Real Person', 'What time zone are you in?': 'EST' },
  ];
  const plan = planSheetImport({ rows, seats });
  equal('rows with no name and no handle are skipped', plan.skipped.map((s) => s.reason), ['no_identity', 'no_identity']);
  equal('the real row still imports', plan.creates.length, 1);
}

// A row identical to the seat it matches has nothing to write.
{
  const rows = [{ 'What is your name?': 'Cora', 'What time zone are you in?': 'PST' }];
  const plan = planSheetImport({ rows, seats });
  equal('an unchanged row is reported as skipped, not as an update', plan.skipped.map((s) => s.reason), ['nothing_to_update']);
}

// Seats from another campaign are simply never passed in, but prove the planner cannot reach them.
{
  const rows = [{ 'What is your name?': 'Bran', 'What time zone are you in?': 'EST' }];
  const plan = planSheetImport({ rows, seats: [] });
  equal('with no seats in scope every row is a create', [plan.creates.length, plan.updates.length], [1, 0]);
}

console.log('');
if (failures.length > 0) {
  console.error(`sheet intake FAILED: ${failures.length} of ${failures.length + passed} checks`);
  process.exit(1);
}
console.log(`sheet intake OK: ${passed} checks passed`);
process.exit(0);
