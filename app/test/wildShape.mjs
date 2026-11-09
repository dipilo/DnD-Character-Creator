// The Beast Shapes table and the Rules While Shape-Shifted paragraphs, read out of the feature's
// own text. The descriptions below are the regenerated packs' own, abbreviated only where the
// omitted sentences state nothing this module reads.
// Run with `npm run test:wild-shape`.
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  eligibleForms,
  isEligibleForm,
  parseChallengeRating,
  readBeastShapeTable,
  readWildShapeRules,
  shiftHitPoints,
  shiftedAbilityScores,
  wildShapeLimits
} = await import('@/lib/wildShape');

const WILD_SHAPE_2024 = {
  id: 'wild-shape',
  name: 'Wild Shape',
  level: 2,
  source: 'Basic Rules (2024)',
  description: [
    'The power of nature allows you to assume the form of an animal.',
    'Known Forms. You know four Beast forms for this feature, chosen from among Beast stat blocks that have a maximum Challenge Rating of 1/4 and that lack a Fly Speed.',
    'Druid Level | Known Forms | Max CR | Fly Speed',
    '2 | 4 | 1/4 | No',
    '4 | 6 | 1/2 | No',
    '8 | 8 | 1 | Yes',
    'Temporary Hit Points. When you assume a Wild Shape form, you gain a number of Temporary Hit Points equal to your Druid level.',
    'Game Statistics. Your game statistics are replaced by the Beast’s stat block, but you retain your creature type; Hit Points; Hit Point Dice; Intelligence, Wisdom, and Charisma scores; class features; languages; and feats.',
    'No Spellcasting. You can’t cast spells, but shape-shifting doesn’t break your Concentration.'
  ].join('\n')
};

const WILD_SHAPE_2014 = {
  id: 'wild-shape-2014',
  name: 'Wild Shape',
  level: 2,
  source: 'Basic Rules (2014)',
  description: [
    'Starting at 2nd level, you can use your action to magically assume the shape of a beast that you have seen before.',
    'Beast Shapes',
    'Level | Max. CR | Limitations | Example',
    '2nd | 1/4 | No flying or swimming speed | Wolf',
    '4th | 1/2 | No flying speed | Crocodile',
    '8th | 1 | — | Giant eagle',
    'Your game statistics are replaced by the statistics of the beast, but you retain your alignment, personality, and Intelligence, Wisdom, and Charisma scores.',
    'When you transform, you assume the beast’s hit points and Hit Dice. When you revert to your normal form, you return to the number of hit points you had before you transformed.',
    'You can’t cast spells, and your ability to speak or take any action that requires hands is limited to the capabilities of your beast form.'
  ].join('\n')
};

const beast = (name, challengeRating, speed, overrides = {}) => ({
  id: name.toLowerCase(),
  name,
  description: name,
  size: 'Medium',
  type: 'Beast',
  alignment: 'Unaligned',
  ac: 13,
  hp: { average: 11, formula: '2d8+2' },
  speed,
  abilityScores: { strength: 12, dexterity: 15, constitution: 12, intelligence: 3, wisdom: 12, charisma: 6 },
  challengeRating,
  traits: [],
  actions: [],
  source: 'test',
  ...overrides
});

test('a fraction, a decimal and a whole number are all challenge ratings', () => {
  assert.equal(parseChallengeRating('1/4'), 0.25);
  assert.equal(parseChallengeRating('0.5'), 0.5);
  assert.equal(parseChallengeRating('1'), 1);
  assert.equal(parseChallengeRating(0.125), 0.125);
  assert.equal(parseChallengeRating('—'), undefined);
  assert.equal(parseChallengeRating(undefined), undefined);
});

test("the 2024 table's own columns are read, Known Forms included", () => {
  assert.deepEqual(readBeastShapeTable(WILD_SHAPE_2024.description), [
    { level: 2, maxChallengeRating: 0.25, knownForms: 4, flySpeed: false, swimSpeed: true },
    { level: 4, maxChallengeRating: 0.5, knownForms: 6, flySpeed: false, swimSpeed: true },
    { level: 8, maxChallengeRating: 1, knownForms: 8, flySpeed: true, swimSpeed: true }
  ]);
});

test("the 2014 table states its limits in prose, and swimming is one of them", () => {
  assert.deepEqual(readBeastShapeTable(WILD_SHAPE_2014.description), [
    { level: 2, maxChallengeRating: 0.25, knownForms: undefined, flySpeed: false, swimSpeed: false },
    { level: 4, maxChallengeRating: 0.5, knownForms: undefined, flySpeed: false, swimSpeed: true },
    { level: 8, maxChallengeRating: 1, knownForms: undefined, flySpeed: true, swimSpeed: true }
  ]);
});

test('the row in force is the last one at or below the level held', () => {
  assert.equal(wildShapeLimits(WILD_SHAPE_2024, 2)?.maxChallengeRating, 0.25);
  assert.equal(wildShapeLimits(WILD_SHAPE_2024, 7)?.maxChallengeRating, 0.5);
  assert.equal(wildShapeLimits(WILD_SHAPE_2024, 20)?.knownForms, 8);
  assert.equal(wildShapeLimits(WILD_SHAPE_2024, 1), undefined, 'below 2nd the table states no row');
});

test('a feature with no table grants no forms rather than a guessed set', () => {
  assert.deepEqual(readBeastShapeTable('You can turn into an animal.'), []);
  assert.equal(wildShapeLimits({ ...WILD_SHAPE_2024, description: 'You can turn into an animal.' }, 20), undefined);
});

test('eligibility is the row: type, rating, and the speeds it rules out', () => {
  const limits = wildShapeLimits(WILD_SHAPE_2014, 2);
  assert.equal(isEligibleForm(beast('Wolf', '1/4', '40 ft.'), limits), true);
  assert.equal(isEligibleForm(beast('Giant Eagle', '1', '10 ft., fly 80 ft.'), limits), false, 'over the rating');
  assert.equal(isEligibleForm(beast('Hawk', '0', '10 ft., fly 60 ft.'), limits), false, '2nd rules out flying');
  assert.equal(isEligibleForm(beast('Octopus', '0', '5 ft., swim 30 ft.'), limits), false, '2nd rules out swimming');
  assert.equal(
    isEligibleForm(beast('Commoner', '0', '30 ft.', { type: 'Humanoid' }), limits),
    false,
    'only a Beast is a form'
  );
});

test('a 4th-level Druid may swim but not fly, which is the row the table states', () => {
  const limits = wildShapeLimits(WILD_SHAPE_2014, 4);
  assert.equal(isEligibleForm(beast('Octopus', '0', '5 ft., swim 30 ft.'), limits), true);
  assert.equal(isEligibleForm(beast('Hawk', '0', '10 ft., fly 60 ft.'), limits), false);
});

test('the list is ordered by rating, then by name', () => {
  const forms = eligibleForms([
    beast('Wolf', '1/4', '40 ft.'),
    beast('Badger', '0', '20 ft.'),
    beast('Axe Beak', '1/4', '50 ft.')
  ], wildShapeLimits(WILD_SHAPE_2024, 2));
  assert.deepEqual(forms.map((form) => form.name), ['Badger', 'Axe Beak', 'Wolf']);
});

test('what the form replaces is read from the feature, not assumed per edition', () => {
  assert.deepEqual(readWildShapeRules(WILD_SHAPE_2024), {
    retainsMentalAbilities: true,
    temporaryHitPoints: true,
    assumesBeastHitPoints: false,
    forbidsSpellcasting: true
  });
  assert.deepEqual(readWildShapeRules(WILD_SHAPE_2014), {
    retainsMentalAbilities: true,
    temporaryHitPoints: false,
    assumesBeastHitPoints: true,
    forbidsSpellcasting: true
  });
});

test("the beast's body replaces the three physical scores and leaves the three mental ones", () => {
  const own = { strength: 8, dexterity: 10, constitution: 14, intelligence: 13, wisdom: 17, charisma: 11 };
  const shifted = shiftedAbilityScores(own, beast('Wolf', '1/4', '40 ft.'), readWildShapeRules(WILD_SHAPE_2024));
  assert.deepEqual(shifted, {
    strength: 12, dexterity: 15, constitution: 12,
    intelligence: 13, wisdom: 17, charisma: 11
  });
});

test('2024 grants temporary hit points sized by the class level and keeps the real ones', () => {
  const own = { current: 9, maximum: 20, temporary: 0 };
  const { hp, restore } = shiftHitPoints(own, beast('Wolf', '1/4', '40 ft.'), readWildShapeRules(WILD_SHAPE_2024), 5);
  assert.deepEqual(hp, { current: 9, maximum: 20, temporary: 5 });
  assert.deepEqual(restore, own);
});

test('temporary hit points do not stack, so the larger of the two stands', () => {
  const own = { current: 9, maximum: 20, temporary: 8 };
  const { hp } = shiftHitPoints(own, beast('Wolf', '1/4', '40 ft.'), readWildShapeRules(WILD_SHAPE_2024), 5);
  assert.equal(hp.temporary, 8);
});

test("2014 takes the beast's hit points and remembers what to put back", () => {
  const own = { current: 9, maximum: 20, temporary: 0 };
  const { hp, restore } = shiftHitPoints(own, beast('Wolf', '1/4', '40 ft.'), readWildShapeRules(WILD_SHAPE_2014), 5);
  assert.deepEqual(hp, { current: 11, maximum: 11, temporary: 0 });
  assert.deepEqual(restore, own);
});

const { assumeFormPatch, revertFormPatch, setKnownFormsPatch } = await import('@/lib/wildShape');

const druid = (overrides = {}) => ({
  id: 'd', name: 'Keth', speciesId: 'elf', classes: [{ classId: 'druid', level: 5, hitDiceUsed: 0 }],
  abilityScores: { strength: 8, dexterity: 14, constitution: 14, intelligence: 12, wisdom: 17, charisma: 10 },
  hp: { current: 9, maximum: 38, temporary: 0 },
  features: [], feats: [], spells: [], equipment: [], proficiencies: { skills: [] },
  ...overrides
});

test('known forms are capped by the table, not by the picker', () => {
  const patch = setKnownFormsPatch(druid(), ['a', 'b', 'c', 'd', 'e', 'f'], wildShapeLimits(WILD_SHAPE_2024, 2));
  assert.deepEqual(patch.wildShape.knownFormIds, ['a', 'b', 'c', 'd']);
});

test('a printing stating no Known Forms column caps nothing', () => {
  const patch = setKnownFormsPatch(druid(), ['a', 'b', 'c', 'd', 'e', 'f'], wildShapeLimits(WILD_SHAPE_2014, 8));
  assert.equal(patch.wildShape.knownFormIds.length, 6);
});

test('shifting twice remembers the body, not the last beast', () => {
  const rules = readWildShapeRules(WILD_SHAPE_2014);
  const wolf = beast('Wolf', '1/4', '40 ft.');
  const first = assumeFormPatch(druid(), wolf, rules, 5);
  assert.deepEqual(first.hp, { current: 11, maximum: 11, temporary: 0 });
  assert.deepEqual(first.wildShape.restoreHp, { current: 9, maximum: 38, temporary: 0 });

  const shifted = druid({ ...first, hp: first.hp });
  const second = assumeFormPatch(shifted, beast('Cat', '0', '40 ft.', { hp: { average: 2, formula: '1d4' } }), rules, 5);
  assert.deepEqual(second.wildShape.restoreHp, { current: 9, maximum: 38, temporary: 0 });
});

test('reverting under 2014 puts the remembered hit points back', () => {
  const rules = readWildShapeRules(WILD_SHAPE_2014);
  const shifted = druid({ hp: { current: 4, maximum: 11, temporary: 0 }, wildShape: { activeFormId: 'wolf', restoreHp: { current: 9, maximum: 38, temporary: 0 } } });
  const patch = revertFormPatch(shifted, rules);
  assert.deepEqual(patch.hp, { current: 9, maximum: 38, temporary: 0 });
  assert.equal(patch.wildShape.activeFormId, undefined);
});

test('excess damage carries over to the normal form, as the feature states', () => {
  const rules = readWildShapeRules(WILD_SHAPE_2014);
  const shifted = druid({ hp: { current: -9, maximum: 11, temporary: 0 }, wildShape: { activeFormId: 'wolf', restoreHp: { current: 9, maximum: 38, temporary: 0 } } });
  assert.equal(revertFormPatch(shifted, rules).hp.current, 0);
});

test('reverting under 2024 drops the form and leaves the hit points alone', () => {
  const rules = readWildShapeRules(WILD_SHAPE_2024);
  const shifted = druid({ hp: { current: 9, maximum: 38, temporary: 5 }, wildShape: { activeFormId: 'wolf', restoreHp: { current: 9, maximum: 38, temporary: 0 } } });
  const patch = revertFormPatch(shifted, rules);
  assert.equal(patch.hp, undefined);
  assert.equal(patch.wildShape.activeFormId, undefined);
});
