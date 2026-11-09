// The texts are the books' own, copied from the canonical packs: a derivation read from wording
// has to be tested against the wording.
import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveUnarmedStrike } from '@/lib/sheetCombat';

const scores = (overrides = {}) => ({
  strength: 10, dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10, charisma: 10, ...overrides
});

const feature = (name, description) => ({ id: name.toLowerCase(), name, description, level: 1, source: 'test' });

const MARTIAL_ARTS_2024 = feature('Martial Arts',
  'Your practice of martial arts gives you mastery of combat styles that use your Unarmed Strike and Monk weapons. '
  + 'You gain the following benefits while you are unarmed or wielding only Monk weapons and you aren’t wearing armor or wielding a Shield. '
  + 'Bonus Unarmed Strike. You can make an Unarmed Strike as a Bonus Action. '
  + 'Martial Arts Die. You can roll 1d6 in place of the normal damage of your Unarmed Strike or Monk weapons. '
  + 'This die changes as you gain Monk levels, as shown in the Martial Arts column of the Monk Features table. '
  + 'Dexterous Attacks. You can use your Dexterity modifier instead of your Strength modifier for the attack and damage rolls of your Unarmed Strikes and Monk weapons.');

const CATS_CLAWS = feature("Cat's Claws",
  'Because of your claws, you have a climbing speed of 20 feet. In addition, your claws are natural weapons, '
  + 'which you can use to make unarmed strikes. If you hit with them, you deal slashing damage equal to '
  + '1d4 + your Strength modifier, instead of the bludgeoning damage normal for an unarmed strike.');

const TORTLE_CLAWS = feature('Claws',
  'You have claws that you can use to make unarmed strikes. When you hit with them, the strike deals '
  + '1d6 + your Strength modifier slashing damage, instead of the bludgeoning damage normal for an unarmed strike.');

test('a character with no relevant feature punches for 1 + Strength, with no throw offered', () => {
  const strike = deriveUnarmedStrike(scores({ strength: 16 }), 2);
  assert.equal(strike.damage, '4 bludgeoning');
  assert.equal(strike.ability, 'strength');
  assert.equal(strike.attackBonus, 5);
  assert.deepEqual(strike.alternateDamages, []);
});

test("Cat's Claws is offered beside the bare line, not instead of it", () => {
  const strike = deriveUnarmedStrike(scores({ strength: 14 }), 2, { features: [CATS_CLAWS] });
  assert.equal(strike.damage, '3 bludgeoning');
  assert.deepEqual(strike.alternateDamages, [
    { notation: '1d4+2', damage: '1d4+2 slashing', source: "Cat's Claws" }
  ]);
});

test('a trait that states its own die and type keeps both', () => {
  const strike = deriveUnarmedStrike(scores({ strength: 18 }), 3, { features: [TORTLE_CLAWS] });
  assert.deepEqual(strike.alternateDamages, [
    { notation: '1d6+4', damage: '1d6+4 slashing', source: 'Claws' }
  ]);
});

test("the Monk's die replaces the damage alone, so the strike stays bludgeoning", () => {
  const strike = deriveUnarmedStrike(scores({ strength: 12, dexterity: 12 }), 2, { features: [MARTIAL_ARTS_2024] });
  assert.deepEqual(strike.alternateDamages, [
    { notation: '1d6+1', damage: '1d6+1 bludgeoning', source: 'Martial Arts' }
  ]);
});

test('the class table states the die, so a level 11 Monk reads 1d10 and not the sentence 1d6', () => {
  const perLevel = ['1d6','1d6','1d6','1d6','1d8','1d8','1d8','1d8','1d8','1d8','1d10','1d10'];
  const strike = deriveUnarmedStrike(scores({ dexterity: 18, strength: 10 }), 4, {
    features: [MARTIAL_ARTS_2024],
    featureContext: { tableDice: { 'martial arts': { perLevel, level: 11 } } }
  });
  assert.equal(strike.ability, 'dexterity', 'Dexterous Attacks is the better of the two here');
  assert.equal(strike.attackBonus, 8);
  assert.equal(strike.damage, '5 bludgeoning');
  assert.deepEqual(strike.alternateDamages, [
    { notation: '1d10+4', damage: '1d10+4 bludgeoning', source: 'Martial Arts' }
  ]);
});

test('Dexterity is not taken when Strength is the better score', () => {
  const strike = deriveUnarmedStrike(scores({ strength: 18, dexterity: 10 }), 2, { features: [MARTIAL_ARTS_2024] });
  assert.equal(strike.ability, 'strength');
  assert.deepEqual(strike.properties, []);
});
