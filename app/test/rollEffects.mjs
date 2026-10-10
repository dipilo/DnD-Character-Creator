// What `deriveRollEffects` reads out of a feature's own sentences, and what it refuses to read.
//
// Every input below is a feature's text as one of the packs carries it. A clause that names no d20
// test is dropped rather than applied to every roll — which is the silent half: nothing errors, the
// character simply rolls with an advantage no printing gives them.
//
// Run with `npm run test:roll-effects` from the workspace root.
import assert from 'node:assert/strict';

const { deriveRollEffects, applyRollEffects, resolveCharacterRollEffects } = await import('@/lib/rollEffects');

const read = (description, overrides = {}) =>
  deriveRollEffects({ id: 'f', name: 'Feature', description, ...overrides });

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, detail: e.message.split('\n')[0] });
  }
}

/* -------------------------------------------------------------------------- *
 * The floor
 * -------------------------------------------------------------------------- */

check('Silver Tongue floors the two Charisma skills it names', () => {
  const [effect] = read(
    'You are a master at saying the right thing at the right time. When you make a Charisma '
    + '(Persuasion) or Charisma (Deception) check, you can treat a d20 roll of 9 or lower as a 10.',
  );
  assert.equal(effect.kind, 'floor');
  assert.equal(effect.value, 10);
  assert.deepEqual(effect.scope.rolls, ['check']);
  assert.deepEqual([...effect.scope.skills].sort((a, b) => a.localeCompare(b)), ['Deception', 'Persuasion']);
});

check('Reliable Talent floors any check the proficiency bonus applies to', () => {
  const [effect] = read(
    'Whenever you make an ability check that lets you add your proficiency bonus, you can treat a '
    + 'd20 roll of 9 or lower as a 10.',
  );
  assert.equal(effect.kind, 'floor');
  assert.equal(effect.scope.requiresProficiency, true);
  assert.equal(effect.scope.skills, undefined);
});

check('a floor states no condition, because its whole sentence is its scope', () => {
  const [effect] = read(
    'Whenever you make an ability check that lets you add your proficiency bonus, you can treat a '
    + 'd20 roll of 9 or lower as a 10.',
  );
  assert.equal(effect.condition, undefined);
});

check("the 2024 Reliable Talent's wording reads the same way", () => {
  const [effect] = read(
    'Whenever you make an ability check that uses one of your skill or tool proficiencies, you can '
    + 'treat a d20 roll of 9 or lower as a 10.',
  );
  assert.equal(effect.scope.requiresProficiency, true);
});

/* -------------------------------------------------------------------------- *
 * Advantage and disadvantage
 * -------------------------------------------------------------------------- */

check('Brave carries the condition it states rather than dropping it', () => {
  const [effect] = read('You have advantage on saving throws against being frightened.');
  assert.equal(effect.kind, 'advantage');
  assert.deepEqual(effect.scope.rolls, ['save']);
  assert.equal(effect.condition, 'against being frightened');
});

check('Rage states two tests and one ability', () => {
  const [effect] = read('You have advantage on Strength checks and Strength saving throws.');
  assert.deepEqual([...effect.scope.rolls].sort((a, b) => a.localeCompare(b)), ['check', 'save']);
  assert.deepEqual(effect.scope.abilities, ['strength']);
});

check('Feral Instinct reads initiative apart from an ability check', () => {
  const [effect] = read('You have advantage on initiative rolls.');
  assert.deepEqual(effect.scope.rolls, ['initiative']);
});

check('Sunlight Sensitivity reads as a disadvantage, with its condition', () => {
  const [effect] = read(
    'You have disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight '
    + 'when you, the target of your attack, or whatever you are trying to perceive is in direct sunlight.',
  );
  assert.equal(effect.kind, 'disadvantage');
  assert.ok(effect.scope.rolls.includes('attack'));
  assert.ok(effect.condition);
});

check('a clause naming no d20 test grants nothing', () => {
  assert.deepEqual(read('You have advantage on the saving throw'), read('You have advantage on the saving throw'));
  assert.equal(read('You have advantage on your next turn against that creature.').length, 0);
});

check('a feature stating nothing about a roll gets no effect', () => {
  assert.equal(read('You can speak, read, and write Common and one other language.').length, 0);
});

/* -------------------------------------------------------------------------- *
 * Reading them against one roll
 * -------------------------------------------------------------------------- */

const silverTongue = {
  id: 'silver-tongue',
  name: 'Silver Tongue',
  level: 3,
  source: "Tasha's Cauldron of Everything",
  description:
    'When you make a Charisma (Persuasion) or Charisma (Deception) check, you can treat a d20 roll '
    + 'of 9 or lower as a 10.',
};

const rage = {
  id: 'rage',
  name: 'Rage',
  level: 1,
  source: 'Basic Rules (2014)',
  description: 'You have advantage on Strength checks and Strength saving throws.',
};

check('Silver Tongue floors Persuasion and leaves Intimidation alone', () => {
  const effects = resolveCharacterRollEffects([silverTongue]);
  const persuasion = applyRollEffects(effects, { kind: 'check', ability: 'charisma', skill: 'Persuasion' });
  assert.equal(persuasion.floor, 10);
  const intimidation = applyRollEffects(effects, { kind: 'check', ability: 'charisma', skill: 'Intimidation' });
  assert.equal(intimidation.floor, undefined);
});

check('Reliable Talent reaches a proficient skill and not an unproficient one', () => {
  const effects = resolveCharacterRollEffects([
    { ...silverTongue, id: 'rt', name: 'Reliable Talent', description: 'Whenever you make an ability check that lets you add your proficiency bonus, you can treat a d20 roll of 9 or lower as a 10.' },
  ]);
  assert.equal(applyRollEffects(effects, { kind: 'check', skill: 'Stealth', proficient: true }).floor, 10);
  assert.equal(applyRollEffects(effects, { kind: 'check', skill: 'Stealth', proficient: false }).floor, undefined);
});

check('a pool the character is not in grants nothing', () => {
  const inside = resolveCharacterRollEffects([rage]);
  assert.equal(applyRollEffects(inside, { kind: 'check', ability: 'strength' }).advantage, true);

  const outside = resolveCharacterRollEffects([rage], { dormantFeatureNames: new Set(['rage']) });
  assert.equal(applyRollEffects(outside, { kind: 'check', ability: 'strength' }).advantage, false);
});

check("Rage's advantage does not reach a Dexterity check", () => {
  const effects = resolveCharacterRollEffects([rage]);
  assert.equal(applyRollEffects(effects, { kind: 'check', ability: 'dexterity' }).advantage, false);
});

/* -------------------------------------------------------------------------- *
 * A flat bonus
 * -------------------------------------------------------------------------- */

const jackOfAllTrades = {
  id: 'joat',
  name: 'Jack of All Trades',
  source: 'Basic Rules (2014)',
  description:
    'Starting at 2nd level, you can add half your proficiency bonus, rounded down, to any ability '
    + "check you make that doesn’t already include your proficiency bonus.",
};

const remarkableAthlete = {
  id: 'ra',
  name: 'Remarkable Athlete',
  source: 'Basic Rules (2014)',
  description:
    'Starting at 3rd level, you can add half your proficiency bonus (round up) to any Strength, '
    + "Dexterity, or Constitution check you make that doesn’t already use your proficiency bonus.",
};

const alert = {
  id: 'alert',
  name: 'Initiative Proficiency',
  source: 'Basic Rules (2024)',
  description: 'When you roll Initiative, you can add your Proficiency Bonus to the roll.',
};

const flashOfGenius = {
  id: 'fog',
  name: 'Flash of Genius',
  source: "Tasha’s Cauldron of Everything",
  description:
    'When a creature you can see within 30 feet of you makes an ability check or a saving throw, '
    + 'you can use your reaction to add your Intelligence modifier to the roll.',
};

const context = { proficiencyBonus: 3, abilityModifiers: { charisma: 4, dexterity: 2 } };

check('Jack of All Trades is half the proficiency bonus, rounded down', () => {
  const [effect] = deriveRollEffects(jackOfAllTrades);
  assert.equal(effect.kind, 'bonus');
  assert.deepEqual(effect.scope.rolls, ['check']);
  assert.equal(effect.scope.excludesProficiency, true);
  assert.deepEqual(effect.bonus, { source: 'proficiency', ability: undefined, half: true, rounding: 'down', minimum: undefined });
});

check('Jack of All Trades reaches an unproficient check and not a proficient one', () => {
  const effects = resolveCharacterRollEffects([jackOfAllTrades], { bonusContext: context });
  assert.equal(applyRollEffects(effects, { kind: 'check', skill: 'Arcana', proficient: false }).bonus, 1);
  assert.equal(applyRollEffects(effects, { kind: 'check', skill: 'Persuasion', proficient: true }).bonus, undefined);
});

check('Remarkable Athlete rounds up and is held to the three abilities it names', () => {
  const effects = resolveCharacterRollEffects([remarkableAthlete], { bonusContext: context });
  assert.equal(applyRollEffects(effects, { kind: 'check', ability: 'strength' }).bonus, 2);
  assert.equal(applyRollEffects(effects, { kind: 'check', ability: 'charisma' }).bonus, undefined);
});

check('the Alert feat states its scope before the figure, not after', () => {
  const effects = resolveCharacterRollEffects([alert], { bonusContext: context });
  assert.equal(applyRollEffects(effects, { kind: 'initiative', ability: 'dexterity' }).bonus, 3);
  assert.equal(applyRollEffects(effects, { kind: 'check', ability: 'dexterity' }).bonus, undefined);
});

check("Flash of Genius adds to somebody else's roll, so it grants nothing here", () => {
  assert.deepEqual(deriveRollEffects(flashOfGenius), []);
});

check('a bonus whose figure cannot be placed is left off', () => {
  const effects = resolveCharacterRollEffects([jackOfAllTrades]);
  assert.equal(effects.length, 0);
});

check('a clause adding a die is a throw, not a bonus', () => {
  assert.deepEqual(
    read('When you fail an ability check, you can add a d10 to your roll.').filter((e) => e.kind === 'bonus'),
    [],
  );
});

/* -------------------------------------------------------------------------- *
 * A clause the sheet cannot check
 * -------------------------------------------------------------------------- */

const expertDuplication = {
  id: 'kenku-expert-duplication',
  name: 'Expert Duplication',
  source: 'Mordenkainen Presents: Monsters of the Multiverse',
  description:
    'When you copy writing or craftwork produced by yourself or someone else, you have advantage '
    + 'on any ability checks you make to produce an exact duplicate.',
};

check('Expert Duplication is offered, not applied, on every check it reaches', () => {
  const effects = resolveCharacterRollEffects([expertDuplication]);
  const athletics = applyRollEffects(effects, { kind: 'check', ability: 'strength', skill: 'Athletics' });
  assert.equal(athletics.advantage, false);
  assert.equal(athletics.applied.length, 0);
  assert.equal(athletics.conditional.length, 1);
  assert.equal(athletics.conditional[0].condition, 'to produce an exact duplicate');
});

check("a conditional disadvantage is not rolled either", () => {
  const effects = resolveCharacterRollEffects([{
    id: 'sunlight',
    name: 'Sunlight Sensitivity',
    source: 'Basic Rules (2014)',
    description:
      'You have disadvantage on attack rolls and on Wisdom (Perception) checks that rely on sight '
      + 'when you, the target of your attack, or whatever you are trying to perceive is in direct sunlight.',
  }]);
  const perception = applyRollEffects(effects, { kind: 'check', ability: 'wisdom', skill: 'Perception' });
  assert.equal(perception.disadvantage, false);
  assert.equal(perception.conditional.length, 1);
});

check('an unconditional clause still applies, and reports no condition', () => {
  const effects = resolveCharacterRollEffects([rage]);
  const strength = applyRollEffects(effects, { kind: 'check', ability: 'strength' });
  assert.equal(strength.advantage, true);
  assert.deepEqual(strength.conditional, []);
});

/* -------------------------------------------------------------------------- *
 * Report
 * -------------------------------------------------------------------------- */

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.ok ? '' : ` — ${entry.detail}`}`);
}
const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
if (failed > 0) process.exitCode = 1;
