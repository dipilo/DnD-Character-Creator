// What a feat's benefit lines are read to grant.
//
// This is the one piece of the feat work that fails *silently*: a sentence the parser stops
// matching does not error, the feat just quietly gives less than the book says — no ability score,
// no spell, no borrowed option. Every line below is one a source actually prints.
//
//   node scripts/test/featBenefits.mjs      (npm run test:feat-benefits)

import assert from 'node:assert/strict';
import { extractFeatBenefitStructures } from '../lib/featBenefits.mjs';

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, detail: e.message.split('\n')[0] });
  }
}

const read = (...lines) => extractFeatBenefitStructures('feat', lines);

check('a named increase with several abilities is a choice', () => {
  const out = read('Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 20.');
  assert.deepEqual(out.abilityScoreIncreases, [
    { ability: 'choose', amount: 1, chooseFrom: ['intelligence', 'wisdom', 'charisma'], chooseCount: 1 },
  ]);
});

check('a named increase with one ability is a grant', () => {
  const out = read('Increase your Constitution score by 1, to a maximum of 20.');
  assert.deepEqual(out.abilityScoreIncreases, [{ ability: 'constitution', amount: 1 }]);
});

check('Tasha’s printing without the word "score" still parses', () => {
  const out = read('Increase your Strength or Dexterity by 1, to a maximum of 20.');
  assert.deepEqual(out.abilityScoreIncreases, [
    { ability: 'choose', amount: 1, chooseFrom: ['strength', 'dexterity'], chooseCount: 1 },
  ]);
});

check('an open increase draws on every ability', () => {
  const out = read('Increase one ability score of your choice by 1, to a maximum of 30.');
  assert.equal(out.abilityScoreIncreases[0].chooseFrom.length, 6);
  assert.equal(out.abilityScoreIncreases[0].chooseCount, 1);
});

check('"by 2, or two scores by 1" is two alternatives, not two grants', () => {
  const out = read('Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1. This feat can’t increase an ability score above 20.');
  assert.equal(out.abilityScoreIncreases, undefined);
  assert.equal(out.abilityScoreIncreaseAlternatives.length, 2);
  assert.equal(out.abilityScoreIncreaseAlternatives[0][0].amount, 2);
  assert.equal(out.abilityScoreIncreaseAlternatives[1][0].chooseCount, 2);
});

check('a named spell is a grant and the open one is a choice', () => {
  const out = read(
    'You learn the misty step spell and one 1st-level spell of your choice. The 1st-level spell must be from the divination or enchantment school of magic.',
  );
  assert.deepEqual(out.grantedSpells, ['Misty Step']);
  assert.equal(out.spellChoices.length, 1);
  assert.equal(out.spellChoices[0].level, 1);
  assert.deepEqual(out.spellChoices[0].schools, ['Divination', 'Enchantment']);
});

check('two named spells in one sentence are both read', () => {
  const out = read('You also learn the longstrider and pass without trace spells, each of which you can cast once without expending a spell slot.');
  assert.deepEqual(out.grantedSpells, ['Longstrider', 'Pass Without Trace']);
});

check('"levitate and dispel magic, each of which" is read too', () => {
  const out = read('You also learn levitate and dispel magic, each of which you can cast once without expending a spell slot.');
  assert.deepEqual(out.grantedSpells, ['Levitate', 'Dispel Magic']);
});

check('a cantrip named outright is a grant, not a choice', () => {
  const out = read('You learn the mage hand cantrip. You can cast it without verbal or somatic components.');
  assert.deepEqual(out.grantedSpells, ['Mage Hand']);
  assert.equal(out.spellChoices, undefined);
});

check('learning a language is not learning a spell', () => {
  const out = read('You learn to speak, read, and write Sylvan.');
  assert.equal(out.grantedSpells, undefined);
});

check('a class spell list narrows the choice', () => {
  const out = read('You learn two cantrips of your choice from the Cleric, Druid, or Wizard spell list.');
  assert.equal(out.spellChoices[0].count, 2);
  assert.equal(out.spellChoices[0].level, 0);
  assert.deepEqual(out.spellChoices[0].classes, ['Cleric', 'Druid', 'Wizard']);
});

check('"from the same list" takes the list before it', () => {
  const out = read(
    'You learn two cantrips of your choice from the Cleric, Druid, or Wizard spell list.',
    "Choose a level 1 spell from the same list you selected for this feat's cantrips.",
  );
  assert.equal(out.spellChoices.length, 2);
  assert.equal(out.spellChoices[1].level, 1);
  assert.deepEqual(out.spellChoices[1].classes, ['Cleric', 'Druid', 'Wizard']);
});

check('two picks joined by "and you learn" are two choices', () => {
  const out = read('You learn one cantrip of your choice from the artificer spell list, and you learn one 1st-level spell of your choice from that list.');
  assert.equal(out.spellChoices.length, 2);
  assert.deepEqual(out.spellChoices[0].classes, ['Artificer']);
  assert.deepEqual(out.spellChoices[1].classes, ['Artificer']);
});

check('a single class named in the qualifier narrows it', () => {
  const out = read('You learn one druid cantrip of your choice.');
  assert.deepEqual(out.spellChoices[0].classes, ['Druid']);
  assert.equal(out.spellChoices[0].level, 0);
});

check('a borrowed pool names the class and the feature', () => {
  const out = read('Studying occult lore, you learn one Eldritch Invocation option of your choice from the warlock class.');
  assert.equal(out.optionChoices.length, 1);
  assert.equal(out.optionChoices[0].featureName, 'Eldritch Invocation');
  assert.equal(out.optionChoices[0].className, 'Warlock');
  assert.equal(out.optionChoices[0].count, 1);
});

check('a borrowed pool can grant more than one', () => {
  const out = read('You learn two Metamagic options of your choice from the sorcerer class.');
  assert.equal(out.optionChoices[0].count, 2);
  assert.equal(out.optionChoices[0].featureName, 'Metamagic');
});

check('a feat that grants none of these reports none of them', () => {
  const out = read("You've trained to deal particularly damaging strikes. Once per turn when you hit a target with a weapon, you can roll the weapon's damage dice twice and use either roll against the target.");
  assert.deepEqual(out, {
    abilityScoreIncreases: undefined,
    abilityScoreIncreaseAlternatives: undefined,
    grantedSpells: undefined,
    spellChoices: undefined,
    optionChoices: undefined,
  });
});

const failed = checks.filter((entry) => !entry.ok);
for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.ok ? '' : `  (${entry.detail})`}`);
}
console.log(`\nfeat benefits OK: ${checks.length - failed.length}/${checks.length} checks passed`);
if (failed.length > 0) process.exit(1);
