// The parts of a book that are not a class: pointers, species, backgrounds, feats, items and
// monsters. A shape the adapter stops recognising reads as a content gap, not a parser one.
//
//   node scripts/test/fiveEToolsContent.mjs      (npm run test:5etools-content)

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
  subclass: [], subclassFeature: [], class: [], classFeature: [], classFluff: [],
  optionalfeature: [], language: [], action: []
};

const build = (overrides) => buildCanonicalContentFrom5eTools(
  { ...EMPTY, ...overrides },
  { sourceId: 'fixture', label: 'Fixture Book', sourceAbbr: 'FIX' }
);

const SPELLS = [
  { name: 'Faerie Fire', source: 'CORE', level: 1, school: 'V', entries: ['Light.'] },
  { name: 'Druidcraft', source: 'CORE', level: 0, school: 'T', entries: ['Nature.'] },
  { name: 'Silvery Barbs', source: 'FIX', level: 1, school: 'E', entries: ['You reroll.'] }
];

// --- pointers ------------------------------------------------------------------------------

const baseVampire = {
  name: 'Vampire',
  source: 'CORE',
  size: ['M'],
  type: 'undead',
  cr: '13',
  ac: [16],
  hp: { average: 144, formula: '17d8 + 68' },
  speed: { walk: 30 },
  trait: [{ name: 'Regeneration', entries: ['It regains 20 hit points.'] }],
  action: [{ name: 'Bite', entries: ['Melee attack with its fangs.'] }]
};

check('a _copy reprint is filled in from the book it copies, which is not the one imported', () => {
  const content = build({
    monster: [baseVampire, { name: 'Vampire', source: 'FIX', _copy: { name: 'Vampire', source: 'CORE' } }]
  });
  assert.equal(content.monsters.length, 1);
  assert.equal(content.monsters[0].hp.average, 144);
  assert.deepEqual(content.monsters[0].traits.map((entry) => entry.name), ['Regeneration']);
});

check('a _copy applies the _mod the pointer states', () => {
  const content = build({
    monster: [baseVampire, {
      name: 'Vampire',
      source: 'FIX',
      _copy: {
        name: 'Vampire',
        source: 'CORE',
        _mod: {
          trait: { mode: 'appendArr', items: { name: 'Sunlight Sensitivity', entries: ['It has disadvantage in sunlight.'] } },
          action: { mode: 'replaceTxt', replace: 'Melee attack', with: 'Melee weapon attack' }
        }
      }
    }]
  });
  const vampire = content.monsters[0];
  assert.deepEqual(vampire.traits.map((entry) => entry.name), ['Regeneration', 'Sunlight Sensitivity']);
  assert.match(vampire.actions[0].description, /Melee weapon attack/);
});

check('a _mod can remove and replace array members, and raise a scalar', () => {
  const content = build({
    monster: [baseVampire, {
      name: 'Vampire Spawn',
      source: 'FIX',
      _copy: {
        name: 'Vampire',
        source: 'CORE',
        _mod: {
          trait: { mode: 'removeArr', names: 'Regeneration' },
          action: { mode: 'replaceArr', replace: 'Bite', items: { name: 'Claws', entries: ['It slashes.'] } },
          cr: { mode: 'setProp', prop: 'cr', value: '5' }
        }
      }
    }]
  });
  const spawn = content.monsters.find((entry) => entry.name === 'Vampire Spawn');
  assert.deepEqual(spawn.traits, []);
  assert.deepEqual(spawn.actions.map((entry) => entry.name), ['Claws']);
  assert.equal(spawn.challengeRating, '5');
});

check('a _copy whose parent is not in the directory keeps the entry rather than dropping it', () => {
  const content = build({
    monster: [{ name: 'Vampire', source: 'FIX', cr: '13', hp: { average: 1, formula: '1d4' }, _copy: { name: 'Vampire', source: 'MISSING' } }]
  });
  assert.deepEqual(content.monsters.map((entry) => entry.name), ['Vampire']);
});

check('a _versions template is expanded into one entry per implementation, variables resolved', () => {
  const content = build({
    race: [{
      name: 'Dragonborn',
      source: 'FIX',
      size: ['M'],
      speed: 30,
      entries: [{ type: 'entries', name: 'Breath Weapon', entries: ['You exhale {{color}} damage.'] }],
      _versions: [{
        _abstract: { name: 'Dragonborn ({{title}})' },
        _implementations: [
          { _variables: { title: 'Black', color: 'acid' } },
          { _variables: { title: 'Blue', color: 'lightning' } }
        ]
      }]
    }]
  });
  assert.deepEqual(
    content.species.map((entry) => entry.name),
    ['Dragonborn', 'Dragonborn (Black)', 'Dragonborn (Blue)']
  );
  const black = content.species.find((entry) => entry.name === 'Dragonborn (Black)');
  assert.match(black.features[0].description, /exhale acid damage/);
});

// --- species -------------------------------------------------------------------------------

const centaur = {
  name: 'Centaur',
  source: 'FIX',
  size: ['M'],
  speed: 40,
  ability: [{ str: 2, wis: 1 }],
  skillProficiencies: [{ survival: true }],
  toolProficiencies: [{ anyArtisansTool: 1 }],
  weaponProficiencies: [{ 'longsword|phb': true }],
  armorProficiencies: [{ light: true }],
  languageProficiencies: [{ common: true, anyStandard: 2 }],
  entries: [{ type: 'entries', name: 'Charge', entries: ['You can move 30 feet.'] }]
};

check('a species carries the proficiencies it states, and a choice as the phrase that offers one', () => {
  const species = build({ race: [centaur] }).species[0];
  assert.deepEqual(species.proficiencies, [
    { name: 'Survival', type: 'skill' },
    { name: "One type of artisan's tools", type: 'tool' },
    { name: 'Longsword', type: 'weapon' },
    { name: 'Light armor', type: 'armor' }
  ]);
});

check('a language a species picks is a slot each, not a language named "any"', () => {
  const species = build({ race: [centaur] }).species[0];
  assert.deepEqual(species.languages, ['Common', 'One of your choice', 'One of your choice']);
});

check('a species that states two sizes offers both', () => {
  const species = build({ race: [{ ...centaur, size: ['S', 'M'] }] }).species[0];
  assert.deepEqual(species.sizeOptions, ['Small', 'Medium']);
  assert.equal(species.size, 'Small');
});

check('a species with one size states no options at all', () => {
  assert.equal(build({ race: [centaur] }).species[0].sizeOptions, undefined);
});

check('the spells a species grants are read from additionalSpells, with the level the book states', () => {
  const species = build({
    spell: SPELLS,
    race: [{
      ...centaur,
      additionalSpells: [{
        innate: { 3: { daily: { '1e': ['faerie fire|core'] } } },
        known: { _: ['druidcraft|core'] }
      }]
    }]
  }).species[0];
  assert.deepEqual(species.spells, [
    { name: 'Faerie Fire', level: 1, oncePerLongRest: true },
    { name: 'Druidcraft', level: 0 }
  ]);
});

check('a spell a species leaves open reaches the sheet as the pick it is', () => {
  const species = build({
    spell: SPELLS,
    race: [{ ...centaur, additionalSpells: [{ known: { _: [{ choose: 'level=0|class=Wizard' }] } }] }]
  }).species[0];
  assert.deepEqual(species.spells, [{ name: 'Choose one cantrip from the Wizard spell list', level: 0 }]);
});

check('a lineage carries its own proficiencies and spells', () => {
  const content = build({
    spell: SPELLS,
    race: [centaur],
    subrace: [{
      name: 'Plains',
      raceName: 'Centaur',
      raceSource: 'FIX',
      source: 'FIX',
      skillProficiencies: [{ athletics: true }],
      additionalSpells: [{ known: { _: ['druidcraft|core'] } }],
      entries: [{ type: 'entries', name: 'Plains Stride', entries: ['You ignore difficult terrain.'] }]
    }]
  });
  const variant = content.species[0].variants[0];
  assert.deepEqual(variant.proficiencies, [{ name: 'Athletics', type: 'skill' }]);
  assert.deepEqual(variant.spells, [{ name: 'Druidcraft', level: 0 }]);
});

// --- backgrounds ---------------------------------------------------------------------------

const loreholdStudent = {
  name: 'Lorehold Student',
  source: 'FIX',
  skillProficiencies: [{ history: true, religion: true }],
  toolProficiencies: [{ anyArtisansTool: 1 }],
  languageProficiencies: [{ any: 2 }],
  feats: [{ 'strixhaven initiate|fix': true }],
  entries: [
    {
      type: 'list',
      style: 'list-hang-notitle',
      items: [
        { type: 'item', name: 'Skill Proficiencies:', entry: 'History, Religion' },
        { type: 'item', name: 'Equipment:', entry: "A set of traveler's clothes, a scholar's pack, and 10 gp" }
      ]
    },
    {
      type: 'table',
      caption: 'Personality Trait',
      colLabels: ['d6', 'Personality Trait'],
      rows: [['1', 'I quote ancient texts at every chance.'], ['2', 'I am certain the past repeats itself.']]
    },
    { type: 'table', caption: 'Ideal', colLabels: ['d6', 'Ideal'], rows: [['1', 'Knowledge. The past is a teacher.']] }
  ]
};

check('a background grants the feat its source states, and the feat is named as its feature', () => {
  const background = build({ background: [loreholdStudent] }).backgrounds[0];
  assert.deepEqual(background.grantedFeatNames, ['Strixhaven Initiate']);
  assert.equal(background.feature.name, 'Strixhaven Initiate');
});

check("a background's equipment line is grants, one slot each", () => {
  const background = build({ background: [loreholdStudent] }).backgrounds[0];
  assert.deepEqual(background.equipment.map((entry) => [entry.name, entry.type]), [
    ["A set of traveler's clothes", 'gear'],
    ["A scholar's pack", 'pack'],
    ['10 GP', 'gold']
  ]);
});

check('the suggested characteristics are the rows of the tables the book rolls them on', () => {
  const background = build({ background: [loreholdStudent] }).backgrounds[0];
  assert.deepEqual(background.personalityTraits, [
    'I quote ancient texts at every chance.',
    'I am certain the past repeats itself.'
  ]);
  assert.deepEqual(background.ideals, ['Knowledge. The past is a teacher.']);
  assert.equal(background.suggestedCharacteristics.length, 3);
});

check('every language a background leaves open is counted, whichever table it draws from', () => {
  assert.equal(build({ background: [loreholdStudent] }).backgrounds[0].languageCount, 2);
  assert.equal(
    build({ background: [{ ...loreholdStudent, languageProficiencies: [{ anyStandard: 1 }] }] }).backgrounds[0].languageCount,
    1
  );
});

check('a tool family a background picks from is the phrase the builder offers a selector for', () => {
  const background = build({ background: [loreholdStudent] }).backgrounds[0];
  assert.deepEqual(background.toolProficiencies, ["One type of artisan's tools"]);
});

check("a background's skill choice is kept apart from the skills it grants outright", () => {
  const background = build({
    background: [{
      ...loreholdStudent,
      skillProficiencies: [{ history: true, choose: { from: ['arcana', 'nature', 'animal handling'], count: 2 } }]
    }]
  }).backgrounds[0];
  assert.deepEqual(background.skillProficiencies, ['History']);
  assert.deepEqual(background.skillChoices, ['Arcana', 'Nature', 'Animal Handling']);
  assert.equal(background.skillChoiceCount, 2);
});

check('"any" skills on a background are the whole list', () => {
  const background = build({
    background: [{ ...loreholdStudent, skillProficiencies: [{ any: 2 }] }]
  }).backgrounds[0];
  assert.deepEqual(background.skillProficiencies, []);
  assert.equal(background.skillChoiceCount, 2);
  assert.ok(background.skillChoices.includes('Arcana') && background.skillChoices.includes('Stealth'));
});

check('a background that states no choice states no choice fields', () => {
  const background = build({
    background: [{ ...loreholdStudent, skillProficiencies: [{ history: true, religion: true }] }]
  }).backgrounds[0];
  assert.equal(background.skillChoiceCount, undefined);
  assert.equal(background.skillChoices, undefined);
});

check('a structured starting-equipment group with alternatives is one choice line', () => {
  const background = build({
    item: [{ name: 'Dagger', source: 'FIX', type: 'M', value: 200, weight: 1 }],
    background: [{
      ...loreholdStudent,
      startingEquipment: [
        { _: [{ item: 'dagger|fix', quantity: 2 }] },
        { a: [{ item: 'dagger|fix' }, { value: 500 }], b: [{ value: 5000 }] }
      ]
    }]
  }).backgrounds[0];
  assert.deepEqual(background.equipment.map((entry) => entry.name), ['Dagger', 'Choose 1']);
  assert.equal(background.equipment[0].count, 2);
  assert.deepEqual(background.equipment[1].alternatives.map((entry) => entry.name), ['Dagger, 5 gp', '50 gp']);
});

check("a background's own Feature entry still wins over the feat it grants", () => {
  const background = build({
    background: [{
      ...loreholdStudent,
      feats: undefined,
      entries: [...loreholdStudent.entries, { type: 'entries', name: 'Feature: Shelter of the Faithful', entries: ['You can call on a temple.'] }]
    }]
  }).backgrounds[0];
  assert.equal(background.feature.name, 'Feature: Shelter of the Faithful');
  assert.match(background.feature.description, /call on a temple/);
});

// --- feats ---------------------------------------------------------------------------------

check('a feat grants the spells its data names and offers the picks it leaves open', () => {
  const feat = build({
    spell: SPELLS,
    feat: [{
      name: 'Strixhaven Initiate',
      source: 'FIX',
      entries: ['You learn two cantrips of your choice and one 1st-level spell.'],
      additionalSpells: [{
        known: { _: ['silvery barbs|fix', { choose: 'level=0|class=Wizard', count: 2 }] }
      }]
    }]
  }).feats[0];
  assert.deepEqual(feat.grantedSpells, ['Silvery Barbs']);
  assert.equal(feat.spellChoices.length, 1);
  assert.deepEqual(
    [feat.spellChoices[0].count, feat.spellChoices[0].level, feat.spellChoices[0].classes],
    [2, 0, ['Wizard']]
  );
});

check("a feat's structured prerequisites are enforceable fields, not only a sentence", () => {
  const feat = build({
    feat: [{
      name: 'Fey Teleportation',
      source: 'FIX',
      prerequisite: [{ ability: [{ int: 13 }], level: 4, spellcasting: true, race: [{ name: 'elf' }] }],
      entries: ['You learn to step between places.']
    }]
  }).feats[0];
  assert.deepEqual(feat.prerequisites.ability, { intelligence: 13 });
  assert.equal(feat.prerequisites.level, 4);
  assert.equal(feat.prerequisites.spellcasting, true);
  assert.deepEqual(feat.prerequisites.race, ['elf']);
  assert.ok(feat.prerequisites.text.includes('Level 4'));
});

// --- equipment and monsters -----------------------------------------------------------------

check('a tool carries the family a "one type of" choice draws from', () => {
  const content = build({
    item: [
      { name: "Smith's Tools", source: 'FIX', type: 'AT', value: 2000, weight: 8 },
      { name: 'Lute', source: 'FIX', type: 'INS', value: 3500, weight: 2 },
      { name: 'Dice Set', source: 'FIX', type: 'GS', value: 10, weight: 0 },
      { name: 'Orb', source: 'FIX', type: 'SCF', scfType: 'arcane', value: 2000, weight: 3 }
    ]
  });
  assert.deepEqual(
    content.equipment.map((entry) => [entry.name, entry.toolCategory ?? entry.gearCategory]),
    [["Smith's Tools", "Artisan's Tools"], ['Lute', 'Musical Instruments'], ['Dice Set', 'Gaming Sets'], ['Orb', 'Arcane Foci']]
  );
});

check("a versatile weapon's two-handed die is the one the source states", () => {
  const sword = build({
    item: [{ name: 'Longsword', source: 'FIX', type: 'M', weaponCategory: 'martial', dmg1: '1d8', dmg2: '1d10', dmgType: 'S', property: ['V'], value: 1500, weight: 3 }]
  }).equipment[0];
  assert.equal(sword.damage, '1d8');
  assert.equal(sword.versatileDamage, '1d10');
});

check('armor carries the Strength the source requires', () => {
  const mail = build({
    item: [{ name: 'Chain Mail', source: 'FIX', type: 'HA', ac: 16, strength: '13', stealth: true, value: 7500, weight: 55 }]
  }).equipment[0];
  assert.equal(mail.strengthRequirement, 13);
  assert.equal(mail.stealthDisadvantage, true);
});

check("a monster's saves, skills, resistances and senses are read, note included", () => {
  const monster = build({
    monster: [{
      ...baseVampire,
      source: 'FIX',
      save: { dex: '+9', wis: '+7' },
      skill: { perception: '+7', 'sleight of hand': '+9' },
      resist: [{ resist: ['necrotic'], note: 'from nonmagical attacks', cond: true }],
      immune: ['poison'],
      conditionImmune: ['charmed'],
      senses: ['darkvision 120 ft.'],
      passive: 17
    }]
  }).monsters[0];
  assert.deepEqual(monster.savingThrows, ['Dex +9', 'Wis +7']);
  assert.deepEqual(monster.skills, ['Perception +7', 'Sleight of Hand +9']);
  assert.deepEqual(monster.damageResistances, ['necrotic', 'from nonmagical attacks']);
  assert.deepEqual(monster.damageImmunities, ['poison']);
  assert.deepEqual(monster.conditionImmunities, ['charmed']);
  assert.deepEqual(monster.senses, ['darkvision 120 ft., passive Perception 17']);
});

// --- a lineage of another book's race ------------------------------------------------------

const ELF = {
  name: 'Elf',
  source: 'OTHER',
  size: ['M'],
  speed: 30,
  ability: [{ dex: 2 }],
  languageProficiencies: [{ common: true, elvish: true }],
  entries: [
    { type: 'entries', name: 'Darkvision', entries: ['You see in the dark.'] },
    { type: 'entries', name: 'Ancestral Legacy', entries: ['You know a cantrip.'] }
  ],
  additionalSpells: [{ known: { 1: ['dancing lights#c'] } }]
};

check('a lineage whose race another book printed ships as a species of its own', () => {
  const species = build({
    race: [ELF],
    subrace: [{ name: 'Sea', source: 'FIX', raceName: 'Elf', raceSource: 'OTHER', ability: [{ con: 1 }] }]
  }).species;
  assert.deepEqual(species.map((entry) => entry.name), ['Elf (Sea)']);
  // The base race's own traits come along, or the lineage is unplayable.
  assert.deepEqual(species[0].features.map((entry) => entry.name), ['Darkvision', 'Ancestral Legacy']);
  assert.equal(species[0].speed, 30);
});

check('a lineage adds to the base ability increases, and replaces only what it restates', () => {
  const [sea] = build({
    race: [ELF],
    subrace: [{ name: 'Sea', source: 'FIX', raceName: 'Elf', raceSource: 'OTHER', ability: [{ con: 1 }] }]
  }).species;
  assert.deepEqual(sea.abilityScoreIncreases, [
    { ability: 'dexterity', amount: 2 },
    { ability: 'constitution', amount: 1 }
  ]);

  const [swapped] = build({
    race: [ELF],
    subrace: [{ name: 'Grey', source: 'FIX', raceName: 'Elf', raceSource: 'OTHER', ability: [{ dex: 1, int: 2 }] }]
  }).species;
  assert.deepEqual(swapped.abilityScoreIncreases, [
    { ability: 'dexterity', amount: 1 },
    { ability: 'intelligence', amount: 2 }
  ]);
});

check('a lineage that states `overwrite` drops the base increases rather than adding to them', () => {
  const [lineage] = build({
    race: [ELF],
    subrace: [{
      name: 'Zariel', source: 'FIX', raceName: 'Elf', raceSource: 'OTHER',
      ability: [{ str: 1, cha: 2 }], overwrite: { ability: true }
    }]
  }).species;
  assert.deepEqual(lineage.abilityScoreIncreases, [
    { ability: 'strength', amount: 1 },
    { ability: 'charisma', amount: 2 }
  ]);
});

check('a lineage restating the base languages is granted each one once', () => {
  const [lineage] = build({
    race: [ELF],
    subrace: [{
      name: 'Sea', source: 'FIX', raceName: 'Elf', raceSource: 'OTHER',
      languageProficiencies: [{ common: true, elvish: true, aquan: true }]
    }]
  }).species;
  assert.deepEqual(lineage.languages, ['Common', 'Elvish', 'Aquan']);
});

check('a lineage with spells of its own replaces the base grant, never adds a second', () => {
  const [lineage] = build({
    race: [ELF],
    subrace: [{
      name: 'Avernus', source: 'FIX', raceName: 'Elf', raceSource: 'OTHER',
      additionalSpells: [{ known: { 1: ['light#c'] }, innate: { 3: { daily: { 1: ['hellish rebuke#2'] } } } }]
    }]
  }).species;
  assert.deepEqual(lineage.spells, [
    { name: 'Hellish Rebuke', level: 2, oncePerLongRest: true },
    { name: 'Light', level: 0 }
  ]);
});

check('a lineage entry replaces the race trait its `data.overwrite` names', () => {
  const [lineage] = build({
    race: [ELF],
    subrace: [{
      name: 'Avernus', source: 'FIX', raceName: 'Elf', raceSource: 'OTHER',
      entries: [{ type: 'entries', name: 'Legacy of Avernus', entries: ['Other spells.'], data: { overwrite: 'Ancestral Legacy' } }]
    }]
  }).species;
  assert.deepEqual(lineage.features.map((entry) => entry.name), ['Darkvision', 'Legacy of Avernus']);
});

check('a `_versions` lineage is not prefixed with the race a second time', () => {
  const species = build({
    race: [{ ...ELF, name: 'Dragonborn' }],
    subrace: [{
      name: 'Draconblood', source: 'FIX', raceName: 'Dragonborn', raceSource: 'OTHER',
      _versions: [{ name: 'Dragonborn (Draconblood; Black)', source: 'FIX' }]
    }]
  }).species;
  assert.ok(species.some((entry) => entry.name === 'Dragonborn (Draconblood; Black)'));
  assert.ok(!species.some((entry) => /Dragonborn \(Dragonborn/.test(entry.name)));
});

check('a granted spell keeps the level the entry states it is cast at', () => {
  const [race] = build({
    race: [{
      name: 'Tiefling', source: 'FIX', size: ['M'], speed: 30,
      additionalSpells: [{ known: { 1: ['thaumaturgy#c'] }, innate: { 3: { daily: { 1: ['hellish rebuke#2'] } } } }]
    }]
  }).species;
  // The suffix is a casting level, not part of the name: "Thaumaturgy#c" resolves to nothing.
  assert.deepEqual(race.spells, [
    { name: 'Hellish Rebuke', level: 2, oncePerLongRest: true },
    { name: 'Thaumaturgy', level: 0 }
  ]);
});

check('a legacy subclass listed once per printing of its class is one subclass', () => {
  const subclasses = build({
    subclass: [
      { name: 'Path of the Giant', shortName: 'Giant', source: 'FIX', className: 'Barbarian', classSource: 'PHB', subclassFeatures: ['Giant|Barbarian||FIX|3'] },
      { name: 'Path of the Giant', shortName: 'Giant', source: 'FIX', className: 'Barbarian', classSource: 'XPHB', subclassFeatures: [] }
    ],
    subclassFeature: [{
      name: 'Giant Power', source: 'FIX', className: 'Barbarian', subclassShortName: 'Giant',
      subclassSource: 'FIX', level: 3, entries: ['You grow.']
    }]
  }).subclasses;
  assert.deepEqual(subclasses.map((entry) => entry.name), ['Path of the Giant']);
  assert.deepEqual(subclasses[0].features.map((entry) => entry.name), ['Giant Power']);
});

check('a starting-equipment line under one gold piece is left off, not shown as "0 gp"', () => {
  const [background] = build({
    background: [{
      name: 'Haunted One', source: 'FIX',
      startingEquipment: [{ _: ['common clothes|phb', { value: 10 }] }]
    }]
  }).backgrounds;
  assert.ok(!background.equipment.some((entry) => entry.type === 'gold'));
  assert.deepEqual(background.equipment.map((entry) => entry.name), ['Common clothes']);
});

check('a lineage version mod runs after the race is merged in, so a replace replaces', () => {
  const species = build({
    race: [{
      name: 'Dragonborn', source: 'OTHER', size: ['M'], speed: 30,
      entries: [
        { type: 'entries', name: 'Draconic Ancestry', entries: ['Choose a dragon.'] },
        { type: 'entries', name: 'Breath Weapon', entries: ['Your ancestry decides the shape.'] }
      ]
    }],
    subrace: [{
      name: 'Draconblood', source: 'FIX', raceName: 'Dragonborn', raceSource: 'OTHER',
      _versions: [{
        name: 'Dragonborn (Draconblood; Black)', source: 'FIX',
        _mod: {
          entries: [
            { mode: 'removeArr', names: 'Draconic Ancestry' },
            { mode: 'replaceArr', replace: 'Breath Weapon', items: { type: 'entries', name: 'Breath Weapon', entries: ['A 30-foot line.'] } }
          ]
        }
      }]
    }]
  }).species;
  const black = species.find((entry) => entry.name === 'Dragonborn (Draconblood; Black)');
  assert.ok(black, 'the version should ship');
  // Expanding before the merge appends what was meant to replace, leaving two Breath Weapons.
  assert.deepEqual(black.features.map((entry) => entry.name), ['Breath Weapon']);
  assert.match(black.features[0].description, /30-foot line/);
});

check('a `_mod` replace targeting a position replaces that entry, not nothing', () => {
  const [feat] = build({
    feat: [{
      name: 'Strike of the Giants', source: 'FIX',
      entries: [
        'Choose one of the benefits below:',
        { type: 'entries', name: 'Fire Strike', entries: ['Extra fire damage.'] },
        { type: 'entries', name: 'Frost Strike', entries: ['Extra cold damage.'] }
      ],
      _versions: [{
        name: 'Strike of the Giants; Fire', source: 'FIX',
        _mod: {
          entries: [
            { mode: 'replaceArr', replace: { index: 0 }, items: ['You imbue one effect:'] },
            { mode: 'removeArr', names: ['Frost Strike'] }
          ]
        }
      }]
    }]
  }).feats.filter((entry) => entry.name === 'Strike of the Giants; Fire');
  assert.ok(feat, 'the version should ship');
  assert.match(feat.description, /^You imbue one effect:/);
  assert.ok(!/Choose one of the benefits below/.test(feat.description), 'the replaced opening must not survive');
  assert.ok(!/cold damage/.test(feat.description), 'the removed option must not survive');
});

for (const entry of checks) {
  console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.detail ? `\n       ${entry.detail}` : ''}`);
}
const failed = checks.filter((entry) => !entry.ok).length;
console.log(`\n${checks.length - failed}/${checks.length} passed`);
process.exit(failed > 0 ? 1 : 0);
