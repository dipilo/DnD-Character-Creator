// The ceiling a feat states on the ability score it raises.
//
// This failed silently: nothing capped an increase, so the 2024 Ability Score Improvement feat
// took a Charisma of 20 to 22 and every number derived from it — the spell save DC, the attack
// bonus, the skill modifiers — was wrong with no error anywhere. The ceiling is the source's own
// ("This feat can't increase an ability score above 20", "to a maximum of 30"), so a feat that
// states none is still applied whole.
//
// Run with `npm run test:ability-ceilings` from the workspace root.
import assert from 'node:assert/strict';

const { applyAbilityScoreBonuses, deriveAbilityScoreBonuses } = await import('@/lib/builderRules');

const baseScores = (charisma) => ({
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma
});

const abilityScoreImprovement = {
  id: 'asi',
  name: 'Ability Score Improvement',
  description: '',
  features: [],
  abilityScoreIncreaseAlternatives: [
    [{ ability: 'choose', amount: 2, chooseFrom: ['charisma'], chooseCount: 1, maximum: 20 }],
    [{ ability: 'choose', amount: 1, chooseFrom: ['charisma', 'dexterity'], chooseCount: 2, maximum: 20 }]
  ]
};

const epicBoon = {
  id: 'boon-of-fate',
  name: 'Boon of Fate',
  description: '',
  features: [],
  abilityScoreIncreases: [{ ability: 'charisma', amount: 1, maximum: 30 }]
};

const noStatedCeiling = {
  id: 'uncapped',
  name: 'A feat that states no ceiling',
  description: '',
  features: [],
  abilityScoreIncreases: [{ ability: 'charisma', amount: 2 }]
};

const charismaAfter = (charisma, feats, abilityScoreChoiceSelections) => {
  const abilityScores = baseScores(charisma);
  const bonuses = deriveAbilityScoreBonuses({ abilityScores, feats, abilityScoreChoiceSelections });
  return applyAbilityScoreBonuses(abilityScores, bonuses).charisma;
};

const chooseCharisma = { 'feat:asi:alternative:0:choice:0': ['charisma'] };
const chooseBoth = { 'feat:asi:alternative:1:choice:0': ['charisma', 'dexterity'] };

let passed = 0;
assert.equal(charismaAfter(20, [abilityScoreImprovement], chooseCharisma), 20, 'a score already at 20 gains nothing');
passed += 1;
assert.equal(charismaAfter(19, [abilityScoreImprovement], chooseCharisma), 20, '19 + 2 stops at the stated 20');
passed += 1;
assert.equal(charismaAfter(16, [abilityScoreImprovement], chooseCharisma), 18, 'below the ceiling the whole increase applies');
passed += 1;
assert.equal(charismaAfter(20, [abilityScoreImprovement], chooseBoth), 20, 'the other alternative is capped too');
passed += 1;
assert.equal(charismaAfter(20, [epicBoon]), 21, 'an epic boon states 30, so 20 is not its ceiling');
passed += 1;
assert.equal(charismaAfter(20, [noStatedCeiling]), 22, 'a feat stating no ceiling is applied whole');
passed += 1;
assert.equal(
  charismaAfter(19, [epicBoon, abilityScoreImprovement], chooseCharisma),
  20,
  'each increase sees what the one before it already added'
);
passed += 1;

console.log(`ability score ceilings: ${passed}/${passed} passed`);
