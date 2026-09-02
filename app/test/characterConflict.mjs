// Exercises `mergeTrackerEdits` against the shapes a real 409 produces.
//
// The app has no test runner, and this is the only client rule worth one: which fields a version
// conflict may settle on its own decides whether a co-op session loses a click. The function is
// pure and imports nothing, so its source is stripped of types and imported directly rather than
// dragged in through Vite's alias graph. A source change that defeats the strip fails the import,
// which is loud — it does not silently pass.
//
// Run with `npm run test:conflict` from the workspace root.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/lib/characterConflict.ts', import.meta.url), 'utf8');
const start = source.indexOf('const TRACKER_FIELDS');
const js = source
  .slice(start)
  .replace(/export function mergeTrackerEdits<T extends object>\(base: T, mine: T, theirs: T\): T \| null \{/,
    'function mergeTrackerEdits(base, mine, theirs) {')
  .replace(/function changedKeys\(base: Record<string, unknown>, mine: Record<string, unknown>\): string\[\] \{/,
    'function changedKeys(base, mine) {')
  .replace(/const sameValue = \(left: unknown, right: unknown\) =>/, 'const sameValue = (left, right) =>')
  .replaceAll(/ as Record<string, unknown>/g, '')
  .replaceAll(/ as T/g, '');

const { mergeTrackerEdits } = await import(
  'data:text/javascript,' + encodeURIComponent(js + '\nexport { mergeTrackerEdits };')
);

const base = {
  id: 'c1',
  name: 'Bellara',
  hp: { current: 30, maximum: 30, temporary: 0 },
  spellSlotsUsed: [0, 0, 0],
  conditions: [],
  inspiration: false,
  updatedAt: '2026-09-01T00:00:00.000Z',
};

let passed = 0;
const check = (name, fn) => {
  try { fn(); console.log('ok   ' + name); passed += 1; }
  catch (e) { console.log('FAIL ' + name + '  ' + e.message); }
};

check('two trackers, different fields, both survive', () => {
  const mine = { ...base, hp: { current: 12, maximum: 30, temporary: 0 }, updatedAt: 'x' };
  const theirs = { ...base, spellSlotsUsed: [2, 1, 0], updatedAt: 'y' };
  const merged = mergeTrackerEdits(base, mine, theirs);
  assert.equal(merged.hp.current, 12, 'my hit points');
  assert.deepEqual(merged.spellSlotsUsed, [2, 1, 0], 'their slots');
});

check('the same tracker on both sides: mine lands last', () => {
  const mine = { ...base, conditions: ['Prone'] };
  const theirs = { ...base, conditions: ['Frightened'] };
  assert.deepEqual(mergeTrackerEdits(base, mine, theirs).conditions, ['Prone']);
});

check('a name change is not a tracker, so it still asks', () => {
  const mine = { ...base, name: 'Bellara Quill' };
  const theirs = { ...base, hp: { current: 5, maximum: 30, temporary: 0 } };
  assert.equal(mergeTrackerEdits(base, mine, theirs), null);
});

check('a tracker plus a real edit still asks', () => {
  const mine = { ...base, inspiration: true, name: 'Renamed' };
  const theirs = { ...base, conditions: ['Poisoned'] };
  assert.equal(mergeTrackerEdits(base, mine, theirs), null);
});

check('updatedAt alone is not an edit', () => {
  const mine = { ...base, updatedAt: '2026-09-02T00:00:00.000Z' };
  const theirs = { ...base, name: 'Their rename' };
  assert.equal(mergeTrackerEdits(base, mine, theirs).name, 'Their rename');
});

check('a field they changed and I did not stays theirs', () => {
  const mine = { ...base, exhaustion: 2 };
  const theirs = { ...base, name: 'Their rename', hp: { current: 1, maximum: 30, temporary: 0 } };
  const merged = mergeTrackerEdits(base, mine, theirs);
  assert.equal(merged.name, 'Their rename');
  assert.equal(merged.hp.current, 1);
  assert.equal(merged.exhaustion, 2);
});

check('a Kids on Bikes adversity token merges too', () => {
  const kob = { id: 'k1', systemId: 'kids-on-bikes', name: 'Sam', adversityTokens: 3, notes: '' };
  const mine = { ...kob, adversityTokens: 1 };
  const theirs = { ...kob, notes: 'Found a key' };
  const merged = mergeTrackerEdits(kob, mine, theirs);
  assert.equal(merged.adversityTokens, 1);
  assert.equal(merged.notes, 'Found a key');
});

console.log(`\n${passed}/7 checks passed`);
process.exit(passed === 7 ? 0 : 1);
