// What a spell's own text says its dice do as the caster grows.
//
// This fails the way `featBenefits` fails: silently. A cantrip whose table stops being read prints
// the die it was written at and nothing errors — an 11th-level wizard's Fire Bolt just quietly says
// 1d10. Every string below is one a source actually prints, in both printings' wording.
//
// The functions are pure and import only a type, so the source is stripped of types and imported
// directly rather than dragged in through Vite's alias graph. A source change that defeats the
// strip fails the import, which is loud.
//
// Run with `npm run test:spell-scaling` from the workspace root.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../src/lib/spellFacets.ts', import.meta.url), 'utf8');
const js = source
  .slice(source.indexOf('// Shillelagh'))
  .replaceAll(/^export /gm, '')
  .replaceAll(/^interface [\s\S]*?^}$/gm, '')
  .replace(/const normalizeDice = \(dice: string\) =>/, 'const normalizeDice = (dice) =>')
  .replace(/const isDigit = \(value: string, index: number\) =>/, 'const isDigit = (value, index) =>')
  .replace(/function trailingLevel\(before: string\): number \| null \{/, 'function trailingLevel(before) {')
  .replace(/function firstTierIndex\(description: string\): number \{/, 'function firstTierIndex(description) {')
  .replace(/const firstDice = \(text: string\) => \{/, 'const firstDice = (text) => {')
  .replace(
    /function deriveSpellScaling\(spell: Pick<Spell, 'description' \| 'higherLevels'>\): SpellScaling \{/,
    'function deriveSpellScaling(spell) {'
  )
  .replace(
    /function addDice\(base: string, step: string, times: number\): string \| undefined \{/,
    'function addDice(base, step, times) {'
  )
  .replace(
    /function deriveSpellDice\(\s*spell: Pick<Spell, 'description' \| 'higherLevels' \| 'level'>,\s*context: SpellDiceContext = \{\}\s*\): string \| undefined \{/,
    'function deriveSpellDice(spell, context = {}) {'
  )
  .replaceAll(/const tiers: SpellDamageTier\[\] = \[\];/g, 'const tiers = [];');

const { deriveSpellScaling, deriveSpellDice } = await import(
  'data:text/javascript,' + encodeURIComponent(`${js}\nexport { deriveSpellScaling, deriveSpellDice };`)
);

let passed = 0;
const check = (name, fn) => {
  try { fn(); console.log('ok   ' + name); passed += 1; }
  catch (e) { console.log('FAIL ' + name + '  ' + e.message.split('\n')[0]); }
};

const cantrip = (description) => ({ level: 0, description });
const levelled = (level, description, higherLevels) => ({ level, description, higherLevels });

check('the 2014 wording steps a cantrip at 5, 11 and 17', () => {
  const spell = cantrip(
    'You hurl a mote of fire. On a hit, the target takes 1d10 fire damage. This spell’s damage '
    + 'increases by 1d10 when you reach 5th level (2d10), 11th level (3d10), and 17th level (4d10).'
  );
  assert.equal(deriveSpellDice(spell, { characterLevel: 1 }), '1d10');
  assert.equal(deriveSpellDice(spell, { characterLevel: 4 }), '1d10');
  assert.equal(deriveSpellDice(spell, { characterLevel: 5 }), '2d10');
  assert.equal(deriveSpellDice(spell, { characterLevel: 16 }), '3d10');
  assert.equal(deriveSpellDice(spell, { characterLevel: 20 }), '4d10');
});

check('the 2024 wording states the levels without the ordinal', () => {
  const spell = cantrip(
    'The target takes 1d8 Radiant damage. Cantrip Upgrade. The damage increases by 1d8 when you '
    + 'reach levels 5 (2d8), 11 (3d8), and 17 (4d8).'
  );
  assert.equal(deriveSpellDice(spell, { characterLevel: 11 }), '3d8');
});

check('a table of bare dice keeps the die it was written at', () => {
  // Shillelagh: "the weapon's damage die becomes a d8 ... levels 5 (d10), 11 (d12), and 17 (2d6)".
  const spell = cantrip(
    'A Club or Quarterstaff you are holding is imbued with nature’s power, and the weapon’s '
    + 'damage die becomes a d8. Cantrip Upgrade. The damage die changes when you reach levels 5 '
    + '(d10), 11 (d12), and 17 (2d6).'
  );
  assert.equal(deriveSpellDice(spell, { characterLevel: 1 }), '1d8');
  assert.equal(deriveSpellDice(spell, { characterLevel: 5 }), '1d10');
  assert.equal(deriveSpellDice(spell, { characterLevel: 17 }), '2d6');
});

check('a bracket may list two dice, and the leading one is the throw', () => {
  // Toll the Dead brackets both branches of its own condition: "(2d8 and 2d12)".
  const spell = cantrip(
    'The target takes 1d8 necrotic damage. If the target is missing any of its hit points, it '
    + 'instead takes 1d12 necrotic damage. This spell’s damage increases by one die when you '
    + 'reach 5th level (2d8 and 2d12), 11th level (3d8 and 3d12), and 17th level (4d8 and 4d12).'
  );
  assert.equal(deriveSpellDice(spell, { characterLevel: 11 }), '3d8');
});

check('an upcast adds the step the text names, per slot level above', () => {
  const spell = levelled(
    3,
    'Each creature in a 20-foot-radius sphere must make a Dexterity saving throw, taking 8d6 fire damage.',
    'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 '
    + 'for each slot level above 3rd.'
  );
  assert.equal(deriveSpellDice(spell, { slotLevel: 3 }), '8d6');
  assert.equal(deriveSpellDice(spell, { slotLevel: 5 }), '10d6');
  assert.equal(deriveSpellDice(spell, { slotLevel: 9 }), '14d6');
});

check('an upcast the text states in the description is read too', () => {
  const spell = levelled(
    1,
    'A creature you touch regains hit points equal to 2d8 plus your spellcasting ability modifier. '
    + 'Using a Higher-Level Spell Slot. The healing increases by 2d8 for each spell slot level above 1.'
  );
  assert.equal(deriveSpellDice(spell, { slotLevel: 3 }), '6d8');
});

check('a spell whose upcast adds no dice keeps its written dice', () => {
  // Magic Missile gains a dart per slot level, not a die.
  const spell = levelled(
    1,
    'You create three glowing darts. Each dart hits a creature of your choice and deals 1d4 + 1 force damage.',
    'When you cast this spell using a spell slot of 2nd level or higher, the spell creates one more '
    + 'dart for each slot level above 1st.'
  );
  assert.equal(deriveSpellDice(spell, { slotLevel: 4 }), '1d4');
});

check('a bracketed die in ordinary prose is not a table', () => {
  const spell = cantrip('You conjure a spectral hand. It deals no damage and lasts 1 minute (concentration).');
  assert.deepEqual(deriveSpellScaling(spell).tiers, []);
  assert.equal(deriveSpellDice(spell, { characterLevel: 20 }), undefined);
});

check('a spell that states no dice at all reports none', () => {
  assert.equal(deriveSpellDice(cantrip('You create a floating, spectral hand.'), { characterLevel: 9 }), undefined);
});

console.log(`\nspell scaling OK: ${passed}/9 checks passed`);
if (passed !== 9) process.exit(1);
