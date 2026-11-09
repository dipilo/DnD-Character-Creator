// A stored species id is a pointer that can go stale, the way a class id can: the app's own
// hand-written Kenku was retired in favour of the Volo's pack, and a character holding `kenku`
// must still resolve rather than reading as "Unknown Species".
// Run with `npm run test:species-resolution`.
import assert from 'node:assert/strict';
import test from 'node:test';

const { resolveSpeciesById } = await import('@/lib/speciesLookup');
const { normalizeCharacterSpeciesId } = await import('@/lib/builderRules');

const printing = (id, name, source, sourceId) => ({
  id,
  name,
  description: name,
  size: 'Medium',
  speed: 30,
  abilityScoreIncreases: [],
  features: [],
  languages: [],
  source,
  sourceId
});

const LIBRARY = [
  printing('volos-kenku', 'Kenku', "Volo's Guide to Monsters", 'volos'),
  printing('motm-kenku', 'Kenku', 'Mordenkainen Presents: Monsters of the Multiverse', 'motm'),
  printing('basic-rules-2014-elf', 'Elf', 'Basic Rules (2014)', 'basic-rules-2014'),
  printing('basic-rules-2024-elf', 'Elf', 'Basic Rules (2024)', 'basic-rules-2024')
];

test('an id the library still holds resolves to itself', () => {
  assert.equal(resolveSpeciesById(LIBRARY, 'motm-kenku')?.id, 'motm-kenku');
});

test('a retired id resolves on the printed name', () => {
  assert.equal(resolveSpeciesById(LIBRARY, 'kenku')?.name, 'Kenku');
});

test('a bare id prefers the 2014 printing, which is what a bare id was', () => {
  assert.equal(resolveSpeciesById(LIBRARY, 'elf')?.id, 'basic-rules-2014-elf');
});

test('an id naming the 2024 printing gets it', () => {
  assert.equal(resolveSpeciesById(LIBRARY, 'phb-2024-elf')?.id, 'basic-rules-2024-elf');
  assert.equal(resolveSpeciesById(LIBRARY, 'some-pack-2024-elf')?.id, 'basic-rules-2024-elf');
});

test('an id naming nothing in the library resolves to nothing, never to a guess', () => {
  assert.equal(resolveSpeciesById(LIBRARY, 'warforged'), undefined);
  assert.equal(resolveSpeciesById(LIBRARY, ''), undefined);
});

test('the longest name wins, so a Half-Elf is not resolved to an Elf', () => {
  const library = [...LIBRARY, printing('basic-rules-2014-half-elf', 'Half-Elf', 'Basic Rules (2014)', 'basic-rules-2014')];
  assert.equal(resolveSpeciesById(library, 'half-elf')?.name, 'Half-Elf');
  assert.equal(resolveSpeciesById(library, 'basic-rules-2014-half-elf')?.name, 'Half-Elf');
  assert.equal(resolveSpeciesById(library, 'elf')?.name, 'Elf');
});

test('a name is matched on a word boundary, so "elf" does not match "Shelf"', () => {
  const library = [printing('pack-shelf', 'Shelf', 'Homebrew', 'homebrew')];
  assert.equal(resolveSpeciesById(library, 'elf'), undefined);
});

test('the builder repairs the pointer so its own `===` checks keep matching', () => {
  const getSpeciesById = (id) => resolveSpeciesById(LIBRARY, id);
  assert.equal(normalizeCharacterSpeciesId('kenku', getSpeciesById), 'volos-kenku');
  assert.equal(normalizeCharacterSpeciesId('motm-kenku', getSpeciesById), 'motm-kenku');
  // An id nothing resolves is left alone: the draft still round-trips, and the step says so.
  assert.equal(normalizeCharacterSpeciesId('warforged', getSpeciesById), 'warforged');
  assert.equal(normalizeCharacterSpeciesId(undefined, getSpeciesById), undefined);
});
