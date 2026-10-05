// What a 5etools class entry is read to mean.
//
// This fails silently in the same way the document importers do: a shape the adapter stops
// recognising does not error, the class just arrives with no pool, no die column or no slot table,
// and a class nobody can build looks like a content gap rather than a parser one. The fixture below
// is in the published shape (`schema/site/class/class.json`), not a book's text.
//
//   node scripts/test/fiveEToolsClasses.mjs      (npm run test:5etools-classes)

import assert from 'node:assert/strict';
import { buildCanonicalContentFrom5eTools } from '../5etools-adapter.mjs';

const checks = [];
function check(name, run) {
  try {
    run();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, detail: e.message.split('\n')[0] });
  }
}

const EMPTY = {
  spell: [], monster: [], race: [], subrace: [], background: [], feat: [], item: [], baseitem: [],
  subclass: [], subclassFeature: [], class: [], classFeature: [], classFluff: []
};

const build = (overrides) => buildCanonicalContentFrom5eTools(
  { ...EMPTY, ...overrides },
  { sourceId: 'fixture', label: 'Fixture Book', sourceAbbr: 'FIX' }
);

const twenty = (value) => Array.from({ length: 20 }, () => value);
const dice = (faces) => ({ type: 'dice', toRoll: [{ number: 1, faces }] });

const classFeature = (name, className, level, entries) => ({
  name, className, classSource: 'FIX', source: 'FIX', level, entries: [entries]
});

const RAGE_TEXT = 'On your turn, you can enter a rage as a bonus action. You can enter your rage the number of times shown for your Barbarian level in the Rages column of the Barbarian table. You regain all expended uses when you finish a long rest.';
const KI_TEXT = 'Your access to this energy is represented by a number of ki points shown in the Ki Points column of the Monk table. You regain all expended ki points when you finish a short or long rest.';
const MARTIAL_ARTS_TEXT = 'You can roll a d4 in place of the normal damage of your unarmed strike. This die changes as you gain monk levels, as shown in the Martial Arts column of the Monk table.';

const barbarian = (overrides = {}) => ({
  name: 'Barbarian',
  source: 'FIX',
  hd: { number: 1, faces: 12 },
  proficiency: ['str', 'con'],
  primaryAbility: [{ str: true }],
  classFeatures: ['Rage|Barbarian|FIX|1', { classFeature: 'Path Feature|Barbarian|FIX|3', gainSubclassFeature: true }],
  ...overrides
});

const barbarianFeatures = [
  classFeature('Rage', 'Barbarian', 1, RAGE_TEXT),
  classFeature('Path Feature', 'Barbarian', 3, 'At 3rd level, you choose a path.')
];

const onlyClass = (cls, features = barbarianFeatures) => build({ class: [cls], classFeature: features }).classes[0];

check('a class with no positive hit die is dropped rather than shipped unbuildable', () => {
  const content = build({
    class: [barbarian(), { name: 'Optional Fighter Features', source: 'FIX', classFeatures: ['Style|Fighter|FIX|1'] }],
    classFeature: barbarianFeatures
  });
  assert.deepEqual(content.classes.map((cls) => cls.name), ['Barbarian']);
});

check('the hit die is the faces, not the count', () => {
  assert.equal(onlyClass(barbarian()).hitDie, 12);
});

check('a feature pointer resolves to the feature printed under that class and level', () => {
  const cls = onlyClass(barbarian());
  assert.deepEqual(cls.features.map((feature) => `${feature.name}@${feature.level}`), ['Rage@1', 'Path Feature@3']);
});

check('a pointer with no matching feature text contributes nothing', () => {
  const cls = onlyClass(barbarian({ classFeatures: ['Rage|Barbarian|FIX|1', 'Absent|Barbarian|FIX|2'] }));
  assert.deepEqual(cls.features.map((feature) => feature.name), ['Rage']);
});

check('the subclass level is the pointer that says it grants a subclass feature', () => {
  assert.equal(onlyClass(barbarian()).subclassLevel, 3);
});

check('a numeric column whose feature states a rest is a pool, and "Unlimited" stays null', () => {
  const cls = onlyClass(barbarian({
    classTableGroups: [{ colLabels: ['Rages'], rows: [...twenty(2).slice(0, 19).map((value) => [value]), [['Unlimited']]] }]
  }));
  assert.equal(cls.resources.length, 1);
  assert.equal(cls.resources[0].name, 'Rages');
  assert.equal(cls.resources[0].resetsOn, 'long');
  assert.equal(cls.resources[0].featureName, 'Rage');
  assert.equal(cls.resources[0].perLevel[19], null);
});

check('a column of bonuses is not a pool', () => {
  const cls = onlyClass(barbarian({
    classTableGroups: [{ colLabels: ['Rage Damage'], rows: twenty([{ type: 'bonus', value: 2 }]) }]
  }));
  assert.equal(cls.resources, undefined);
});

check('a column of distances is neither a pool nor a die', () => {
  const cls = onlyClass(barbarian({
    classTableGroups: [{ colLabels: ['Unarmored Movement'], rows: twenty([{ type: 'bonusSpeed', value: 10 }]) }]
  }));
  assert.equal(cls.resources, undefined);
  assert.equal(cls.featureDice, undefined);
});

check('a column of dice is a feature die column, claimed by its cross-reference', () => {
  const monk = {
    name: 'Monk',
    source: 'FIX',
    hd: { number: 1, faces: 8 },
    proficiency: ['str', 'dex'],
    classFeatures: ['Martial Arts|Monk|FIX|1'],
    classTableGroups: [{ colLabels: ['Martial Arts'], rows: [...twenty(null).slice(0, 10).map(() => [dice(4)]), ...twenty(null).slice(0, 10).map(() => [dice(8)])] }]
  };
  const cls = onlyClass(monk, [classFeature('Martial Arts', 'Monk', 1, MARTIAL_ARTS_TEXT)]);
  assert.equal(cls.featureDice.length, 1);
  assert.equal(cls.featureDice[0].name, 'Martial Arts');
  assert.equal(cls.featureDice[0].featureName, 'Martial Arts');
  assert.deepEqual([cls.featureDice[0].perLevel[0], cls.featureDice[0].perLevel[19]], ['1d4', '1d8']);
});

// A pool whose count the table states is the column's; this is the other half — a feature that
// states the count in its own prose and appears in no column at all.
check('a pool no column states is read from the feature\'s own sentences', () => {
  const fighter = {
    name: 'Fighter', source: 'FIX', hd: { number: 1, faces: 10 }, proficiency: ['str', 'con'],
    classFeatures: ['Second Wind|Fighter|FIX|1']
  };
  const cls = onlyClass(fighter, [classFeature('Second Wind', 'Fighter', 1,
    'You can use this feature twice. You regain one expended use when you finish a Short Rest, and you regain all expended uses when you finish a Long Rest.')]);
  assert.equal(cls.resources.length, 1);
  assert.equal(cls.resources[0].name, 'Second Wind');
  assert.equal(cls.resources[0].resetsOn, 'long');
  assert.equal(cls.resources[0].shortRestRegain, 1);
});

check('a feature that states a count but no rest is not a pool', () => {
  const fighter = {
    name: 'Fighter', source: 'FIX', hd: { number: 1, faces: 10 }, proficiency: ['str'],
    classFeatures: ['Ki|Fighter|FIX|2']
  };
  const cls = onlyClass(fighter, [classFeature('Ki', 'Fighter', 2, KI_TEXT.replace(/You regain.*$/, ''))]);
  assert.equal(cls.resources, undefined);
});

check('"or" requirements stay apart from "and" requirements', () => {
  const fighter = onlyClass(barbarian({ multiclassing: { requirements: { or: [{ str: 13 }, { dex: 13 }] } } }));
  assert.deepEqual(fighter.multiclassPrerequisites, [{ strength: 13 }, { dexterity: 13 }]);

  const monk = onlyClass(barbarian({ multiclassing: { requirements: { dex: 13, wis: 13 } } }));
  assert.deepEqual(monk.multiclassPrerequisites, [{ dexterity: 13, wisdom: 13 }]);
});

check('a class that states no multiclass rule carries neither field', () => {
  const cls = onlyClass(barbarian());
  assert.equal(cls.multiclassPrerequisites, undefined);
  assert.equal(cls.multiclassProficiencies, undefined);
});

check('a multiclass line that grants no skill is an empty list, not the whole one', () => {
  const cls = onlyClass(barbarian({
    multiclassing: { requirements: { str: 13 }, proficienciesGained: { armor: ['shield'], weapons: ['simple', 'martial'] } }
  }));
  assert.deepEqual(cls.multiclassProficiencies.skillChoices, []);
  assert.equal(cls.multiclassProficiencies.skillCount, 0);
  assert.deepEqual(cls.multiclassProficiencies.armorProficiencies, ['Shields']);
});

check('armour and weapon terms are expanded to the names the builder matches', () => {
  const cls = onlyClass(barbarian({
    startingProficiencies: { armor: ['light', 'medium', { proficiency: 'shield', full: 'shields' }], weapons: ['simple', 'martial', 'shortsword|FIX'] }
  }));
  assert.deepEqual(cls.armorProficiencies, ['Light armor', 'Medium armor', 'Shields']);
  assert.deepEqual(cls.weaponProficiencies, ['Simple weapons', 'Martial weapons', 'Shortsword']);
});

check('"any n" skills is the whole skill list, counted n', () => {
  const cls = onlyClass(barbarian({ startingProficiencies: { skills: [{ any: 3 }] } }));
  assert.equal(cls.skillCount, 3);
  assert.equal(cls.skillChoices.length, 18);
  assert.ok(cls.skillChoices.includes('Sleight of Hand'));
});

check('a stated "choose from" list is offered as itself', () => {
  const cls = onlyClass(barbarian({
    startingProficiencies: { skills: [{ choose: { from: ['animal handling', 'athletics', 'intimidation'], count: 2 } }] }
  }));
  assert.equal(cls.skillCount, 2);
  assert.deepEqual(cls.skillChoices, ['Animal Handling', 'Athletics', 'Intimidation']);
});

check('a spell slot table is read from the progression group', () => {
  const bard = onlyClass(barbarian({
    spellcastingAbility: 'cha',
    cantripProgression: twenty(2),
    spellsKnownProgression: twenty(4),
    classTableGroups: [{ title: 'Spell Slots per Spell Level', colLabels: ['1st', '2nd'], rowsSpellProgression: [...twenty([2]).slice(0, 19), [4, 3]] }]
  }));
  assert.equal(bard.spellcasting.ability, 'charisma');
  assert.deepEqual(bard.spellcasting.spellSlots[19], [4, 3]);
  assert.deepEqual(bard.spellcasting.cantripsKnown.length, 20);
});

check('a class that states no spellcasting ability gets no spellcasting block', () => {
  assert.equal(onlyClass(barbarian()).spellcasting, undefined);
});

check('a category the player still resolves is written as the phrase the builder reads', () => {
  const cls = onlyClass(barbarian({
    startingEquipment: {
      default: [''],
      defaultData: [
        { a: [{ item: 'greataxe|FIX' }], b: [{ equipmentType: 'weaponMartialMelee' }] },
        { a: [{ item: 'lute|FIX' }], b: [{ equipmentType: 'instrumentMusical' }] }
      ]
    }
  }));
  assert.deepEqual(cls.equipmentOptions[0].map((option) => option.name), ['Greataxe', 'Any martial melee weapon']);
  assert.deepEqual(cls.equipmentOptions[1].map((option) => option.name), ['Lute', 'Any musical instrument']);
});

check('several alternatives keep their pairing, so a multi-item alternative nests as contents', () => {
  const cls = onlyClass(barbarian({
    startingEquipment: {
      default: [''],
      defaultData: [{ a: [{ item: 'longsword|FIX' }, { item: 'shield|FIX' }], b: [{ equipmentType: 'weaponSimple' }] }]
    }
  }));
  assert.equal(cls.equipmentOptions[0].length, 2);
  assert.deepEqual(cls.equipmentOptions[0][0].contents.map((option) => option.name), ['Shield']);
});

check('items granted outright are separate slots, not contents of the first', () => {
  const cls = onlyClass(barbarian({
    startingEquipment: {
      default: [''],
      defaultData: [{ _: [{ item: "explorer's pack|FIX" }, { item: 'javelin|FIX', quantity: 4 }] }]
    }
  }));
  assert.deepEqual(cls.equipmentOptions.map((group) => group[0].name), ["Explorer's pack", 'Javelin']);
  assert.equal(cls.equipmentOptions[1][0].count, 4);
  assert.ok(cls.equipmentOptions.every((group) => group[0].contents === undefined));
});

check('a coin value is gold, in gold pieces', () => {
  const cls = onlyClass(barbarian({ startingEquipment: { default: [''], defaultData: [{ _: [{ value: 1000 }] }] } }));
  assert.deepEqual(cls.equipmentOptions[0][0], { name: '10 gp', type: 'gold' });
});

check('a single primary ability is a value and two are a list', () => {
  assert.equal(onlyClass(barbarian()).primaryAbility, 'strength');
  assert.deepEqual(onlyClass(barbarian({ primaryAbility: [{ dex: true }, { wis: true }] })).primaryAbility, ['dexterity', 'wisdom']);
});

check('the class description is the book\'s own fluff where it states any', () => {
  const content = build({
    class: [barbarian()],
    classFeature: barbarianFeatures,
    classFluff: [{ name: 'Barbarian', source: 'FIX', entries: ['A fierce warrior who can enter a battle rage.'] }]
  });
  assert.equal(content.classes[0].description, 'A fierce warrior who can enter a battle rage.');
});

check('an item referenced from another book still resolves, because items are not source-filtered', () => {
  const content = build({
    class: [barbarian({ startingEquipment: { default: [''], defaultData: [{ _: [{ item: 'greataxe|phb' }] }] } })],
    classFeature: barbarianFeatures,
    baseitem: [{ name: 'Greataxe', source: 'PHB', type: 'M', weaponCategory: 'martial', dmg1: '1d12' }]
  });
  assert.deepEqual(content.classes[0].equipmentOptions[0][0], { name: 'Greataxe', type: 'weapon' });
});

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? `\n       ${entry.detail}` : ''}`);
}
const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed > 0 ? 1 : 0);
