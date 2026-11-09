// A reprint renames the traits it carries over, so a merge keyed on trait name grants both.
// Run with `npm run test:species-reprints`.
import assert from 'node:assert/strict';
import test from 'node:test';

const { fallbackTraits, isSupersededBy } = await import('@/lib/speciesReprints');

const printing = (sourceId, source, traits, extra = {}) => ({
  id: `${sourceId}-kenku`,
  name: 'Kenku',
  description: 'Kenku are wingless, feathered folk.',
  size: 'Medium',
  speed: 30,
  abilityScoreIncreases: [],
  features: traits.map((name) => ({ id: `${sourceId}-${name}`, name, description: name, level: 1, source })),
  languages: [],
  source,
  sourceId,
  ...extra
});

// The trait names are the books' own: Volo's and Monsters of the Multiverse print the same two
// traits under different names, which is what made a Kenku show all four.
const VOLOS = printing('vgm', "Volo's Guide to Monsters", ['Expert Forgery', 'Kenku Training', 'Mimicry'], {
  reprintedAs: ['Kenku|MPMM']
});
const MULTIVERSE = printing('motm', 'Mordenkainen Presents: Monsters of the Multiverse', [
  'Expert Duplication',
  'Kenku Recall',
  'Mimicry'
]);

const names = (traits) => traits.features.map((feature) => feature.name);

test('the reprint contributes no traits to the printing it superseded', () => {
  assert.equal(isSupersededBy(VOLOS, MULTIVERSE), true);
  assert.deepEqual(names(fallbackTraits(VOLOS, MULTIVERSE)), []);
});

test('the reprint takes no traits from the printing it superseded either', () => {
  assert.equal(isSupersededBy(MULTIVERSE, VOLOS), false);
  assert.deepEqual(names(fallbackTraits(MULTIVERSE, VOLOS)), []);
});

// The app's own hand-written Kenku carries no reprint note and no book at all, so the reprint note
// alone never reached it — and it is the entry the player actually had on screen.
test('a printing with no reprint note is still held apart from another book', () => {
  const handWritten = { ...VOLOS, sourceId: undefined, source: 'Kenku', reprintedAs: undefined };
  assert.deepEqual(names(fallbackTraits(handWritten, MULTIVERSE)), []);
});

test('a second copy of the same book is not a reprint of itself, and does fill gaps', () => {
  const sameBook = { ...MULTIVERSE, sourceId: 'vgm' };
  assert.equal(isSupersededBy(VOLOS, sameBook), false);
  assert.deepEqual(names(fallbackTraits(VOLOS, sameBook)), [
    'Expert Duplication',
    'Kenku Recall',
    'Mimicry'
  ]);
});

test('a primary holding no traits at all is a real gap and still gets filled', () => {
  const empty = { ...VOLOS, features: [], reprintedAs: undefined };
  assert.deepEqual(names(fallbackTraits(empty, MULTIVERSE)), [
    'Expert Duplication',
    'Kenku Recall',
    'Mimicry'
  ]);
});

test('a variant list is held back with the traits', () => {
  const withVariants = { ...MULTIVERSE, variants: [{ id: 'v', name: 'Lineage', description: 'x', features: [] }] };
  assert.equal(fallbackTraits(VOLOS, withVariants).variants, undefined);
  assert.equal(fallbackTraits({ ...VOLOS, reprintedAs: undefined }, withVariants).variants?.length, 1);
});
