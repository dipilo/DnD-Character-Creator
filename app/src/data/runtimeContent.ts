import type { Background, Class, Equipment, Feature, FeatureOption, Feat, Monster, Species, SpeciesVariant, Spell, Subclass } from '@/types/dnd';
import { backgrounds as staticBackgrounds } from './backgrounds';
import { classes as staticClasses } from './classes';
import { species as staticSpecies } from './species';
import { getImportedBucket, mergeCollectionsById } from './sourceHelpers';
import { useContentStore } from '@/store/contentStore';
import type { ImportedContentBucket } from '@/data/librarySources';
import { resolveSourceId } from '@/data/librarySources';
import type { ContentBucketKey } from '@/lib/canonicalContent';
import { getRulesEdition } from '@/lib/builderRules';

const getStoreBucket = <K extends ContentBucketKey>(bucket: K): ImportedContentBucket[K] => {
  const { importedPacks, homebrewLibrary } = useContentStore.getState();
  const importedEntries = importedPacks.reduce<ImportedContentBucket[K]>((entries, pack) => {
    return [...entries, ...pack.content[bucket]] as ImportedContentBucket[K];
  }, [] as ImportedContentBucket[K]);
  const homebrewEntries = homebrewLibrary[bucket];
  return [...importedEntries, ...homebrewEntries] as ImportedContentBucket[K];
};

const staticSpells = () => getImportedBucket('spells') as Spell[];
const staticFeats = () => getImportedBucket('feats') as Feat[];
const staticEquipment = () => getImportedBucket('equipment') as Equipment[];
const staticMonsters = () => getImportedBucket('monsters') as Monster[];
const staticSubclasses = () => getImportedBucket('subclasses') as Subclass[];
const unsupportedStaticSourceIds = new Set(['phb-2014', 'phb-2024']);
const isUnsupportedLegacyStaticEntry = (sourceId?: string) => {
  return sourceId ? unsupportedStaticSourceIds.has(sourceId) : false;
};
const runtimeStaticSpecies = staticSpecies.filter((entry) => !isUnsupportedLegacyStaticEntry(entry.sourceId));
const runtimeStaticClasses = staticClasses.filter((entry) => !isUnsupportedLegacyStaticEntry(entry.sourceId));
const runtimeStaticBackgrounds = staticBackgrounds.filter((entry) => !isUnsupportedLegacyStaticEntry(entry.sourceId));

const mergeDynamicBucket = <T extends { id: string }>(baseEntries: T[], bucket: ContentBucketKey): T[] => {
  return mergeCollectionsById(baseEntries, getStoreBucket(bucket) as T[]);
};

const normalizeIdentifier = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();
const classIdPrefixPattern = /^(basic rules|player s handbook|phb)\s+(2014|2024)\s+/;
const getCanonicalClassKey = (value: string) => normalizeIdentifier(value).replace(classIdPrefixPattern, '');
const getClassKeyFromClass = (cls: Class) => getCanonicalClassKey(cls.name || cls.id);
const getClassKeyFromSubclass = (subclass: Subclass) => getCanonicalClassKey(subclass.classId ?? '');
const getCanonicalSubclassKey = (subclass: Subclass) => `${getClassKeyFromSubclass(subclass)}::${normalizeIdentifier(subclass.name)}`;
const getCanonicalBackgroundKey = (background: Background) => normalizeIdentifier(background.name || background.id);
const getCanonicalSpeciesKey = (species: Species) => normalizeIdentifier(species.name || species.id);
const getCanonicalEquipmentKey = (equipment: Equipment) => normalizeIdentifier(equipment.name || equipment.id);
const isPlaceholderText = (value?: string) => !value || /from the basic rules|available in the source data/i.test(value);
const choosePreferredText = (primary?: string, fallback?: string) => {
  if (isPlaceholderText(primary) && fallback) {
    return fallback;
  }

  if ((primary?.trim().length ?? 0) >= (fallback?.trim().length ?? 0)) {
    return primary;
  }

  return fallback;
};
const choosePreferredArray = <T,>(primary?: T[], fallback?: T[]) => (primary && primary.length > 0 ? primary : (fallback ?? []));
const choosePreferredNumber = (primary?: number, fallback?: number) => primary ?? fallback;
const normalizeFeatureName = (value: string) => normalizeIdentifier(value).replaceAll(/\s*\([^)]*\)/g, '').trim();
const chromeNoisePatterns = [
  /\/\/\s*<!\[CDATA\[[\s\S]*$/i,
  /Waterdeep\.CompendiumPage\.initialize[\s\S]*$/i,
  /\/\/\s*This site works best with JavaScript enabled\.[\s\S]*$/i,
  /\bMy Characters\b[\s\S]*$/i,
  /\bHomebrew Classes Backgrounds Species Feats Spells Equipment\b[\s\S]*$/i,
  /\bTools Character Builder Sigil 3D VTT\b[\s\S]*$/i,
  /\bBrowse Spells Browse Monsters Browse Magic Items Browse Backgrounds Browse Feats Browse Species Browse Subclasses\b[\s\S]*$/i,
  /\bnew URLSearchParams\(document\.location\.search\)[\s\S]*$/i,
  /Hexblade\. What a cool name![\s\S]*$/i,
  /\bThis section presents the [^.]+ spell list\.[\s\S]*$/i,
  /\b[A-Z][^.]+ subclass is a specialization that grants you features at certain [^.]+ levels, as specified in the subclass\.[\s\S]*$/i
];

const sanitizeImportedText = (value?: string) => {
  if (!value) {
    return value;
  }

  return chromeNoisePatterns.reduce((current, pattern) => current.replace(pattern, ' '), value)
    .replaceAll(/[“"]\s+/g, (match) => match.trimEnd())
    .replaceAll(/\s+[”"]/g, (match) => match.trimStart())
    .replaceAll(/\s+/g, ' ')
    .trim();
};

const getClassFallbackScore = (cls: Class) => {
  const equipmentScore = cls.equipmentOptions.reduce((total, group) => total + group.length, 0);
  const skillScore = cls.skillChoices.length + cls.skillCount;
  const spellcastingScore = cls.spellcasting ? 10 : 0;
  const featureChoiceScore = cls.features.reduce((total, feature) => {
    return total + ((feature.options?.length ?? 0) * 50) + (feature.chooseCount ?? 0);
  }, 0);
  return (equipmentScore * 100) + (skillScore * 10) + spellcastingScore + cls.features.length + featureChoiceScore;
};

const getClassFallbackLookupKey = (cls: Class) => `${getClassKeyFromClass(cls)}::${getRulesEdition(cls.sourceId, cls.source)}`;

const classEquipmentSupplements: Partial<Record<string, Class['equipmentOptions']>> = {};

const sanitizeFeature = <T extends Feature>(feature: T): T => ({
  ...feature,
  name: sanitizeImportedText(feature.name) ?? feature.name,
  description: sanitizeImportedText(feature.description) ?? feature.description,
  options: feature.options?.map((option) => ({
    ...option,
    name: sanitizeImportedText(option.name) ?? option.name,
    description: sanitizeImportedText(option.description) ?? option.description,
    prerequisites: option.prerequisites
      ? {
          ...option.prerequisites,
          text: sanitizeImportedText(option.prerequisites.text)
        }
      : undefined
  }))
});

const mergeFeatureOptions = (primary?: FeatureOption[], fallback?: FeatureOption[]) => {
  if (!primary?.length) {
    return fallback;
  }

  if (!fallback?.length) {
    return primary;
  }

  const merged = new Map<string, FeatureOption>();

  [...primary, ...fallback].forEach((option) => {
    const key = option.id || normalizeIdentifier(option.name);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, option);
      return;
    }

    merged.set(key, {
      ...existing,
      description: choosePreferredText(sanitizeImportedText(existing.description), sanitizeImportedText(option.description)) ?? existing.description,
      prerequisites: existing.prerequisites ?? option.prerequisites
    });
  });

  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
};

const sanitizeSubclass = (subclass: Subclass): Subclass => applySubclassDescriptionSupplements({
  ...subclass,
  name: sanitizeImportedText(subclass.name) ?? subclass.name,
  description: sanitizeImportedText(subclass.description) ?? subclass.description,
  features: subclass.features.map(sanitizeFeature)
});

const sanitizeClass = (cls: Class): Class => ({
  ...cls,
  name: sanitizeImportedText(cls.name) ?? cls.name,
  description: sanitizeImportedText(cls.description) ?? cls.description,
  features: cls.features.map(sanitizeFeature),
  subclasses: cls.subclasses.map(sanitizeSubclass)
});

const sanitizeBackground = (background: Background): Background => ({
  ...background,
  name: sanitizeImportedText(background.name) ?? background.name,
  description: sanitizeImportedText(background.description) ?? background.description,
  feature: {
    name: sanitizeImportedText(background.feature.name) ?? background.feature.name,
    description: sanitizeImportedText(background.feature.description) ?? background.feature.description
  }
});

const sanitizeSpell = (spell: Spell): Spell => ({
  ...spell,
  name: sanitizeImportedText(spell.name) ?? spell.name,
  description: sanitizeImportedText(spell.description) ?? spell.description,
  higherLevels: sanitizeImportedText(spell.higherLevels)
});

const sanitizeFeat = (feat: Feat): Feat => ({
  ...feat,
  name: sanitizeImportedText(feat.name) ?? feat.name,
  description: sanitizeImportedText(feat.description) ?? feat.description,
  prerequisites: feat.prerequisites
    ? {
        ...feat.prerequisites,
        text: sanitizeImportedText(feat.prerequisites.text)
      }
    : undefined,
  features: feat.features.map(sanitizeFeature)
});

const sanitizeSpeciesVariant = (variant: SpeciesVariant): SpeciesVariant => ({
  ...variant,
  name: sanitizeImportedText(variant.name) ?? variant.name,
  description: sanitizeImportedText(variant.description) ?? variant.description,
  features: variant.features.map(sanitizeFeature)
});

const sanitizeSpecies = (species: Species): Species => ({
  ...species,
  name: sanitizeImportedText(species.name) ?? species.name,
  description: sanitizeImportedText(species.description) ?? species.description,
  languages: species.languages.map((entry) => sanitizeImportedText(entry) ?? entry),
  features: species.features.map(sanitizeFeature),
  variants: species.variants?.map(sanitizeSpeciesVariant)
});

const sanitizeMonster = (monster: Monster): Monster => ({
  ...monster,
  name: sanitizeImportedText(monster.name) ?? monster.name,
  description: sanitizeImportedText(monster.description) ?? monster.description,
  traits: monster.traits.map((trait) => ({
    ...trait,
    name: sanitizeImportedText(trait.name) ?? trait.name,
    description: sanitizeImportedText(trait.description) ?? trait.description
  })),
  actions: monster.actions.map((action) => ({
    ...action,
    name: sanitizeImportedText(action.name) ?? action.name,
    description: sanitizeImportedText(action.description) ?? action.description
  })),
  bonusActions: monster.bonusActions?.map((action) => ({
    ...action,
    name: sanitizeImportedText(action.name) ?? action.name,
    description: sanitizeImportedText(action.description) ?? action.description
  })),
  reactions: monster.reactions?.map((action) => ({
    ...action,
    name: sanitizeImportedText(action.name) ?? action.name,
    description: sanitizeImportedText(action.description) ?? action.description
  })),
  legendaryActions: monster.legendaryActions?.map((action) => ({
    ...action,
    name: sanitizeImportedText(action.name) ?? action.name,
    description: sanitizeImportedText(action.description) ?? action.description
  }))
});

type OptionalFeatureSupplement = Omit<Feature, 'replacesFeatureIds'> & {
  replacesFeatureNames?: string[];
};

type FeatureChoiceSupplement = Pick<Feature, 'options' | 'chooseCount' | 'requiresChoice'>;

const optionalClassFeatureSupplements: Partial<Record<string, OptionalFeatureSupplement[]>> = {
  bard: [
    {
      id: 'tashas-magical-inspiration',
      name: 'Magical Inspiration',
      description: 'If a creature has a Bardic Inspiration die from you and casts a spell that restores hit points or deals damage, the creature can roll that die and choose a target affected by the spell. Add the number rolled as a bonus to the hit points regained or the damage dealt.',
      level: 2,
      source: "Tasha's Cauldron of Everything",
      optional: true
    },
    {
      id: 'tashas-bardic-versatility',
      name: 'Bardic Versatility',
      description: 'Whenever you reach a level in this class that grants the Ability Score Improvement feature, you can replace one cantrip you learned from this class\'s Spellcasting feature with another cantrip from the bard spell list. You can also replace one skill in which you have Expertise with another skill proficiency that is not benefiting from Expertise.',
      level: 4,
      source: "Tasha's Cauldron of Everything",
      optional: true
    }
  ],
  ranger: [
    {
      id: 'tashas-deft-explorer',
      name: 'Deft Explorer',
      description: 'This feature replaces Natural Explorer. You gain Canny at 1st level, Roving at 6th level, and Tireless at 10th level.',
      level: 1,
      source: "Tasha's Cauldron of Everything",
      optional: true,
      replacesFeatureNames: ['Natural Explorer']
    },
    {
      id: 'tashas-favored-foe',
      name: 'Favored Foe',
      description: 'This feature replaces Favored Enemy. When you hit a creature with an attack roll, you can mark it as your favored enemy for 1 minute or until you lose your concentration. The first time on each of your turns that you hit the favored enemy and deal damage to it, including when you mark it, you can increase that damage by 1d4.',
      level: 1,
      source: "Tasha's Cauldron of Everything",
      optional: true,
      replacesFeatureNames: ['Favored Enemy']
    },
    {
      id: 'tashas-primal-awareness',
      name: 'Primal Awareness',
      description: 'This feature replaces Primeval Awareness. You gain additional ranger spells at certain levels in this class, and each of these spells counts as a ranger spell for you but doesn\'t count against the number of ranger spells you know.',
      level: 3,
      source: "Tasha's Cauldron of Everything",
      optional: true,
      replacesFeatureNames: ['Primeval Awareness']
    }
  ],
  cleric: [
    {
      id: 'tashas-harness-divine-power-cleric',
      name: 'Harness Divine Power',
      description: 'You can expend a use of your Channel Divinity to fuel your spells. As a Bonus Action, you touch your Holy Symbol, utter a prayer, and regain one expended spell slot, the level of which can be no higher than half your Proficiency Bonus (rounded up). You can use this feature a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.',
      level: 2,
      source: "Tasha's Cauldron of Everything",
      optional: true
    }
  ],
  druid: [
    {
      id: 'tashas-wild-companion',
      name: 'Wild Companion',
      description: 'You can summon a spirit that assumes an animal form by expending a use of Wild Shape. As an action, you can cast Find Familiar, without material components. When you cast the spell in this way, the familiar is a Fey instead of a Beast, and the familiar disappears after a number of hours equal to half your druid level.',
      level: 2,
      source: "Tasha's Cauldron of Everything",
      optional: true
    },
    {
      id: 'tashas-cantrip-versatility-druid',
      name: 'Cantrip Versatility',
      description: 'Whenever you reach a level in this class that grants the Ability Score Improvement feature, you can replace one cantrip you learned from this class’s Spellcasting feature with another cantrip from the druid spell list.',
      level: 4,
      source: "Tasha's Cauldron of Everything",
      optional: true
    }
  ],
  paladin: [
    {
      id: 'tashas-harness-divine-power-paladin',
      name: 'Harness Divine Power',
      description: 'You can expend a use of your Channel Divinity to fuel your spells. As a Bonus Action, you touch your Holy Symbol, utter a prayer, and regain one expended spell slot, the level of which can be no higher than half your Proficiency Bonus (rounded up). You can use this feature a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest.',
      level: 3,
      source: "Tasha's Cauldron of Everything",
      optional: true
    },
    {
      id: 'tashas-martial-versatility-paladin',
      name: 'Martial Versatility',
      description: 'Whenever you reach a level in this class that grants the Ability Score Improvement feature, you can replace a Fighting Style option you know with another Fighting Style available to paladins.',
      level: 4,
      source: "Tasha's Cauldron of Everything",
      optional: true
    }
  ],
  sorcerer: [
    {
      id: 'tashas-sorcerous-versatility',
      name: 'Sorcerous Versatility',
      description: 'Whenever you reach a level in this class that grants the Ability Score Improvement feature, you can replace one cantrip you learned from this class’s Spellcasting feature with another cantrip from the sorcerer spell list. You can also replace one Metamagic option you know with another one available to you.',
      level: 4,
      source: "Tasha's Cauldron of Everything",
      optional: true
    },
    {
      id: 'tashas-magical-guidance',
      name: 'Magical Guidance',
      description: 'You can tap into your inner wellspring of magic to try to conjure success from failure. When you make an ability check that fails, you can spend 1 Sorcery Point to reroll the d20, and you must use the new roll, potentially turning the failure into a success.',
      level: 5,
      source: "Tasha's Cauldron of Everything",
      optional: true
    }
  ],
  warlock: [
    {
      id: 'tashas-eldritch-versatility',
      name: 'Eldritch Versatility',
      description: 'Whenever you reach a level in this class that grants the Ability Score Improvement feature, you can do one of the following: replace one cantrip you learned from this class’s Pact Magic feature with another cantrip from the warlock spell list; replace the option you chose for the Pact Boon feature with another Pact Boon option for which you qualify; or replace one Eldritch Invocation with another one for which you qualify.',
      level: 4,
      source: "Tasha's Cauldron of Everything",
      optional: true
    }
  ]
};

const allSkillFeatureOptions = [
  'Acrobatics',
  'Animal Handling',
  'Arcana',
  'Athletics',
  'Deception',
  'History',
  'Insight',
  'Intimidation',
  'Investigation',
  'Medicine',
  'Nature',
  'Perception',
  'Performance',
  'Persuasion',
  'Religion',
  'Sleight of Hand',
  'Stealth',
  'Survival'
].map((name) => ({
  id: normalizeIdentifier(name).replaceAll(' ', '-'),
  name,
  description: `${name} skill`
}));

const createFeatureOption = (name: string, description: string, id?: string) => ({
  id: id ?? normalizeIdentifier(name).replaceAll(' ', '-'),
  name,
  description
});

const getNamedFeatureOptions = (options: { name: string; id: string; description: string }[], names: string[]) => {
  const optionsByName = new Map(options.map((option) => [normalizeIdentifier(option.name), option]));
  return names
    .map((name) => optionsByName.get(normalizeIdentifier(name)))
    .filter((option): option is { name: string; id: string; description: string } => Boolean(option));
};

const allMartialWeaponFeatureOptions = Array.from(
  new Map(
    mergeDynamicBucket(staticEquipment(), 'equipment')
      .filter((entry) => entry.type === 'weapon' && entry.weaponCategory === 'martial')
      .map((entry) => [
        normalizeIdentifier(entry.name),
        createFeatureOption(entry.name, entry.description ?? 'Martial weapon proficiency', entry.id)
      ])
  ).values()
).sort((left, right) => left.name.localeCompare(right.name));

const wizardCantripFeatureOptions = Array.from(
  new Map(
    mergeDynamicBucket(staticSpells(), 'spells')
      .filter((entry) => entry.level === 0 && entry.classes.includes('Wizard'))
      .map((entry) => [
        normalizeIdentifier(entry.name),
        createFeatureOption(entry.name, entry.description ?? 'Wizard cantrip', entry.id)
      ])
  ).values()
).sort((left, right) => left.name.localeCompare(right.name));

const draconicAncestorFeatureOptions = [
  createFeatureOption('Black', 'Acid damage ancestor'),
  createFeatureOption('Blue', 'Lightning damage ancestor'),
  createFeatureOption('Brass', 'Fire damage ancestor'),
  createFeatureOption('Bronze', 'Lightning damage ancestor'),
  createFeatureOption('Copper', 'Acid damage ancestor'),
  createFeatureOption('Gold', 'Fire damage ancestor'),
  createFeatureOption('Green', 'Poison damage ancestor'),
  createFeatureOption('Red', 'Fire damage ancestor'),
  createFeatureOption('Silver', 'Cold damage ancestor'),
  createFeatureOption('White', 'Cold damage ancestor')
];

const fighterStyleFeatureOptions = [
  createFeatureOption('Archery', 'You gain a +2 bonus to attack rolls you make with ranged weapons.'),
  createFeatureOption('Defense', 'While you are wearing armor, you gain a +1 bonus to AC.'),
  createFeatureOption('Dueling', 'When you are wielding a melee weapon in one hand and no other weapons, you gain a +2 bonus to damage rolls with that weapon.'),
  createFeatureOption('Great Weapon Fighting', 'When you roll a 1 or 2 on a damage die for an attack with a melee weapon wielded with two hands, you can reroll the die and must use the new roll.'),
  createFeatureOption('Protection', 'When a creature you can see attacks a target other than you within 5 feet, you can use your reaction to impose disadvantage if you are wielding a shield.'),
  createFeatureOption('Two-Weapon Fighting', 'When you engage in two-weapon fighting, you can add your ability modifier to the damage of the second attack.')
];

const rangerFavoredEnemyFeatureOptions = [
  'Aberrations',
  'Beasts',
  'Celestials',
  'Constructs',
  'Dragons',
  'Elementals',
  'Fey',
  'Fiends',
  'Giants',
  'Monstrosities',
  'Oozes',
  'Plants',
  'Undead'
].map((name) => createFeatureOption(name, `${name} favored enemy`));

const rangerNaturalExplorerFeatureOptions = [
  'Arctic',
  'Coast',
  'Desert',
  'Forest',
  'Grassland',
  'Mountain',
  'Swamp',
  'Underdark'
].map((name) => createFeatureOption(name, `${name} favored terrain`));

const hunterPreyFeatureOptions = [
  createFeatureOption('Colossus Slayer', 'Once per turn, deal extra damage to a wounded target.'),
  createFeatureOption('Giant Killer', 'Use your reaction to attack a Large or larger creature that misses or hits you.'),
  createFeatureOption('Horde Breaker', 'Once per turn, make an extra attack against a different nearby creature.')
];

const defensiveTacticsFeatureOptions = [
  createFeatureOption('Escape the Horde', 'Opportunity attacks against you are made with disadvantage.'),
  createFeatureOption('Multiattack Defense', 'A creature that hits you with an attack has disadvantage on later attacks against you that turn.'),
  createFeatureOption('Steel Will', 'You have advantage on saving throws against being frightened.')
];

const multiattackFeatureOptions = [
  createFeatureOption('Volley', 'Use your action to make a ranged attack against any number of creatures in a 10-foot-radius point.'),
  createFeatureOption('Whirlwind Attack', 'Use your action to make melee attacks against any number of creatures within 5 feet.')
];

const superiorHuntersDefenseFeatureOptions = [
  createFeatureOption('Evasion', 'Take no damage on a successful Dexterity save and half on a failed one for certain effects.'),
  createFeatureOption('Stand Against the Tide', 'Force a missed melee attack to target another creature.'),
  createFeatureOption('Uncanny Dodge', 'Use your reaction to halve damage from an attacker you can see.')
];

const swordsFightingStyleFeatureOptions = getNamedFeatureOptions(fighterStyleFeatureOptions, ['Dueling', 'Two-Weapon Fighting']);
const paladinFightingStyleFeatureOptions = getNamedFeatureOptions(fighterStyleFeatureOptions, ['Defense', 'Dueling', 'Great Weapon Fighting', 'Protection']);
const rangerFightingStyleFeatureOptions = getNamedFeatureOptions(fighterStyleFeatureOptions, ['Archery', 'Defense', 'Dueling', 'Two-Weapon Fighting']);
const kenkuTrainingFeatureOptions = getNamedFeatureOptions(allSkillFeatureOptions, ['Acrobatics', 'Deception', 'Sleight of Hand', 'Stealth']);
const huntersLoreFeatureOptions = getNamedFeatureOptions(allSkillFeatureOptions, ['Animal Handling', 'Nature', 'Perception', 'Stealth', 'Survival']);

const pactBoonFeatureOptions = [
  createFeatureOption('Pact of the Blade', 'Use your action to create a pact weapon in your empty hand.'),
  createFeatureOption('Pact of the Chain', 'Learn Find Familiar and allow it to take special forms.'),
  createFeatureOption('Pact of the Tome', 'Receive a grimoire with three cantrips from any class list.')
];

const koboldLegacyFeatureOptions = [
  createFeatureOption('Defiance', 'You have advantage on saving throws to avoid or end the frightened condition on yourself.'),
  createFeatureOption('Draconic Sorcery', 'You know one sorcerer cantrip of your choice, and you can choose its draconic theme or damage type when applicable.')
];

const classFeatureChoiceSupplements: Partial<Record<string, Record<string, FeatureChoiceSupplement>>> = {
  fighter: {
    'fighting style': { requiresChoice: true, chooseCount: 1, options: fighterStyleFeatureOptions }
  },
  paladin: {
    'fighting style': { requiresChoice: true, chooseCount: 1, options: paladinFightingStyleFeatureOptions }
  },
  ranger: {
    'favored enemy': { requiresChoice: true, chooseCount: 1, options: rangerFavoredEnemyFeatureOptions },
    'natural explorer': { requiresChoice: true, chooseCount: 1, options: rangerNaturalExplorerFeatureOptions },
    'fighting style': { requiresChoice: true, chooseCount: 1, options: rangerFightingStyleFeatureOptions }
  },
  warlock: {
    'pact boon': { requiresChoice: true, chooseCount: 1, options: pactBoonFeatureOptions }
  }
};

const subclassFeatureChoiceSupplements: Partial<Record<string, Record<string, FeatureChoiceSupplement>>> = {
  'bard::college of swords': {
    'fighting style': { requiresChoice: true, chooseCount: 1, options: swordsFightingStyleFeatureOptions }
  },
  'ranger::hunter': {
    'hunter s prey': { requiresChoice: true, chooseCount: 1, options: hunterPreyFeatureOptions },
    'defensive tactics': { requiresChoice: true, chooseCount: 1, options: defensiveTacticsFeatureOptions },
    multiattack: { requiresChoice: true, chooseCount: 1, options: multiattackFeatureOptions },
    'superior hunter s defense': { requiresChoice: true, chooseCount: 1, options: superiorHuntersDefenseFeatureOptions }
  },
  'sorcerer::draconic bloodline': {
    'dragon ancestor': { requiresChoice: true, chooseCount: 1, options: draconicAncestorFeatureOptions }
  }
};

const speciesFeatureChoiceSupplements: Partial<Record<string, Record<string, FeatureChoiceSupplement>>> = {
  kobold: {
    'kobold legacy': { requiresChoice: true, chooseCount: 1, options: koboldLegacyFeatureOptions }
  },
  kenku: {
    'kenku training': { requiresChoice: true, chooseCount: 2, options: kenkuTrainingFeatureOptions }
  },
  lizardfolk: {
    'hunter s lore': { requiresChoice: true, chooseCount: 2, options: huntersLoreFeatureOptions }
  },
  hobgoblin: {
    'martial training': { requiresChoice: true, chooseCount: 2, options: allMartialWeaponFeatureOptions }
  }
};

const speciesVariantFeatureChoiceSupplements: Partial<Record<string, Record<string, FeatureChoiceSupplement>>> = {
  'elf::high elf': {
    cantrip: { requiresChoice: true, chooseCount: 1, options: wizardCantripFeatureOptions }
  }
};

const speciesSupplements: Partial<Record<string, Partial<Species>>> = {
  human: {
    variants: [
      {
        id: 'variant-human',
        name: 'Variant Human',
        description: 'If your campaign uses the optional feat rules from Chapter 6 of the Player\'s Handbook, your Dungeon Master might allow this variant.',
        features: [
          {
            id: 'skills',
            name: 'Skills',
            description: 'You gain proficiency in one skill of your choice.',
            level: 1,
            source: 'Variant Human',
            requiresChoice: true,
            chooseCount: 1,
            options: allSkillFeatureOptions
          },
          {
            id: 'feat',
            name: 'Feat',
            description: 'You gain one feat of your choice.',
            level: 1,
            source: 'Variant Human',
            requiresChoice: true
          }
        ]
      }
    ]
  },
  'custom lineage': {
    sizeOptions: ['Medium', 'Small']
  }
};

const getEditionSpecificSpeciesSupplement = (species: Species): Partial<Species> | undefined => {
  const edition = getRulesEdition(species.sourceId, species.source);
  const key = getCanonicalSpeciesKey(species);

  if (key === 'human' && edition === '2024') {
    return {
      sizeOptions: ['Medium', 'Small'],
      languages: ['Common', 'One of your choice'],
      features: [
        {
          id: 'human-skillful',
          name: 'Skillful',
          description: 'You gain proficiency in one skill of your choice.',
          level: 1,
          source: 'Basic Rules (2024)',
          requiresChoice: true,
          chooseCount: 1,
          options: allSkillFeatureOptions
        },
        {
          id: 'human-versatile',
          name: 'Versatile',
          description: 'You gain an Origin feat of your choice (see Feats). Skilled is recommended.',
          level: 1,
          source: 'Basic Rules (2024)',
          requiresChoice: true
        }
      ]
    };
  }

  return undefined;
};

const subclassFeatureDescriptionSupplements: Partial<Record<string, Record<string, string>>> = {
  'warlock::the celestial': {
    'expanded spell list': 'The Celestial lets you choose from an expanded list of spells when you learn a warlock spell. The following spells are added to the warlock spell list for you. 1st level: Cure Wounds, Guiding Bolt. 2nd level: Flaming Sphere, Lesser Restoration. 3rd level: Daylight, Revivify. 4th level: Guardian of Faith, Wall of Fire. 5th level: Flame Strike, Greater Restoration.'
  },
  'warlock::the hexblade': {
    'expanded spell list': 'The Hexblade lets you choose from an expanded list of spells when you learn a warlock spell. The following spells are added to the warlock spell list for you. 1st level: Shield, Wrathful Smite. 2nd level: Blur, Branding Smite. 3rd level: Blink, Elemental Weapon. 4th level: Phantasmal Killer, Staggering Smite. 5th level: Banishing Smite, Cone of Cold.'
  }
};

const getSpeciesFallbackScore = (species: Species) => {
  const variantScore = species.variants?.length ?? 0;
  const featureOptionScore = species.features.reduce((total, feature) => total + (feature.options?.length ?? 0), 0);
  return (species.features.length * 100) + (variantScore * 10) + featureOptionScore + (species.languages.length * 5);
};

const getSubclassFallbackScore = (subclass: Subclass) => {
  const featureOptionScore = subclass.features.reduce((total, feature) => total + (feature.options?.length ?? 0), 0);
  return (subclass.features.length * 100) + (featureOptionScore * 50) + (subclass.description.trim().length > 0 ? 10 : 0);
};

type SubclassCompatibilityTrack = 'core-2014' | 'core-2024' | 'shared';

const core2014SourceIds = new Set(['phb-2014', 'basic-rules-2014']);
const core2024SourceIds = new Set(['phb-2024', 'basic-rules-2024']);

const getSubclassCompatibilityTrack = (sourceId?: string, sourceText?: string): SubclassCompatibilityTrack => {
  const resolvedSourceId = resolveSourceId(sourceId, sourceText);
  if (resolvedSourceId && core2014SourceIds.has(resolvedSourceId)) {
    return 'core-2014';
  }

  if (resolvedSourceId && core2024SourceIds.has(resolvedSourceId)) {
    return 'core-2024';
  }

  return 'shared';
};

const isSubclassTrackCompatible = (subclass: Subclass, targetTrack: SubclassCompatibilityTrack) => {
  if (targetTrack === 'shared') {
    return true;
  }

  const subclassTrack = getSubclassCompatibilityTrack(subclass.sourceId, subclass.source);
  return subclassTrack === 'shared' || subclassTrack === targetTrack;
};

const mergeSubclassCandidatesById = (subclasses: Subclass[]) => {
  const grouped = subclasses.reduce<Map<string, Subclass[]>>((entries, subclass) => {
    const collection = entries.get(subclass.id);
    if (collection) {
      collection.push(subclass);
    } else {
      entries.set(subclass.id, [subclass]);
    }
    return entries;
  }, new Map<string, Subclass[]>());

  return Array.from(grouped.values()).map((candidates) => {
    const primary = candidates.reduce((best, candidate) => {
      if (!best || getSubclassFallbackScore(candidate) > getSubclassFallbackScore(best)) {
        return candidate;
      }

      return best;
    }, undefined as Subclass | undefined) ?? candidates[0];

    return candidates.reduce((current, candidate) => {
      if (candidate === primary) {
        return current;
      }

      return {
        ...current,
        classId: current.classId || candidate.classId,
        source: choosePreferredText(sanitizeImportedText(current.source), sanitizeImportedText(candidate.source)) ?? current.source,
        sourceId: current.sourceId ?? candidate.sourceId,
        description: choosePreferredText(sanitizeImportedText(current.description), sanitizeImportedText(candidate.description)) ?? current.description,
        features: mergeFeatureCollections(current.features, candidate.features)
      };
    }, primary);
  }).map(sanitizeSubclass);
};

const mergeFeatureCollections = (primary: Feature[], fallback?: Feature[]) => {
  const fallbackByName = new Map((fallback ?? []).map((feature) => [normalizeFeatureName(feature.name), feature]));
  const mergedPrimary = primary.map((feature) => {
    const fallbackFeature = fallbackByName.get(normalizeFeatureName(feature.name));
    return sanitizeFeature({
      ...feature,
      description: choosePreferredText(sanitizeImportedText(feature.description), sanitizeImportedText(fallbackFeature?.description)) ?? feature.description,
      options: mergeFeatureOptions(feature.options, fallbackFeature?.options),
      chooseCount: feature.chooseCount ?? fallbackFeature?.chooseCount,
      requiresChoice: feature.requiresChoice ?? fallbackFeature?.requiresChoice,
      optional: feature.optional ?? fallbackFeature?.optional,
      replacesFeatureIds: feature.replacesFeatureIds ?? fallbackFeature?.replacesFeatureIds
    });
  });

  const mergedNames = new Set(mergedPrimary.map((feature) => normalizeFeatureName(feature.name)));
  const supplementalFallback = (fallback ?? [])
    .filter((feature) => !mergedNames.has(normalizeFeatureName(feature.name)))
    .map(sanitizeFeature);

  return [...mergedPrimary, ...supplementalFallback];
};

const mergeSpeciesVariants = (primary: SpeciesVariant[] | undefined, fallback: SpeciesVariant[] | undefined) => {
  if (!primary?.length) {
    return fallback?.map(sanitizeSpeciesVariant);
  }

  const fallbackByName = new Map((fallback ?? []).map((variant) => [normalizeIdentifier(variant.name), variant]));
  const mergedPrimary = primary.map((variant) => {
    const fallbackVariant = fallbackByName.get(normalizeIdentifier(variant.name));
    return sanitizeSpeciesVariant({
      ...variant,
      description: choosePreferredText(sanitizeImportedText(variant.description), sanitizeImportedText(fallbackVariant?.description)) ?? variant.description,
      abilityScoreIncreases: choosePreferredArray(variant.abilityScoreIncreases, fallbackVariant?.abilityScoreIncreases),
      features: mergeFeatureCollections(variant.features, fallbackVariant?.features),
      proficiencies: choosePreferredArray(variant.proficiencies, fallbackVariant?.proficiencies),
      spells: choosePreferredArray(variant.spells, fallbackVariant?.spells),
      sizeOptions: choosePreferredArray(variant.sizeOptions, fallbackVariant?.sizeOptions)
    });
  });

  const mergedNames = new Set(mergedPrimary.map((variant) => normalizeIdentifier(variant.name)));
  const supplementalFallback = (fallback ?? [])
    .filter((variant) => !mergedNames.has(normalizeIdentifier(variant.name)))
    .map(sanitizeSpeciesVariant);

  return [...mergedPrimary, ...supplementalFallback];
};

const enrichSpecies = (primary: Species, fallback?: Species, supplement?: Partial<Species>): Species => {
  const combinedFallback = fallback
    ? {
        ...fallback,
        ...supplement,
        features: mergeFeatureCollections(fallback.features, supplement?.features),
        variants: mergeSpeciesVariants(fallback.variants, supplement?.variants)
      }
    : supplement;

  return sanitizeSpecies(applySpeciesFeatureChoiceSupplements({
    ...primary,
    description: choosePreferredText(sanitizeImportedText(primary.description), sanitizeImportedText(combinedFallback?.description)) ?? primary.description,
    size: primary.size ?? combinedFallback?.size ?? 'Medium',
    sizeOptions: choosePreferredArray(primary.sizeOptions, combinedFallback?.sizeOptions),
    speed: choosePreferredNumber(primary.speed, combinedFallback?.speed) ?? 30,
    abilityScoreIncreases: choosePreferredArray(primary.abilityScoreIncreases, combinedFallback?.abilityScoreIncreases),
    features: mergeFeatureCollections(primary.features, combinedFallback?.features),
    proficiencies: choosePreferredArray(primary.proficiencies, combinedFallback?.proficiencies),
    languages: choosePreferredArray(primary.languages, combinedFallback?.languages),
    variants: mergeSpeciesVariants(primary.variants, combinedFallback?.variants),
    spells: choosePreferredArray(primary.spells, combinedFallback?.spells)
  }));
};

const applySubclassDescriptionSupplements = (subclass: Subclass): Subclass => {
  const featureSupplements = subclassFeatureDescriptionSupplements[getCanonicalSubclassKey(subclass)];
  if (!featureSupplements) {
    return subclass;
  }

  return {
    ...subclass,
    features: subclass.features.map((feature) => {
      const supplementedDescription = featureSupplements[normalizeFeatureName(feature.name)];
      if (!supplementedDescription) {
        return feature;
      }

      return {
        ...feature,
        description: choosePreferredText(sanitizeImportedText(feature.description), supplementedDescription) ?? feature.description
      };
    })
  };
};

const applyOptionalFeatureSupplements = (cls: Class): Class => {
  if (getRulesEdition(cls.sourceId, cls.source) !== '2014') {
    return cls;
  }

  const supplements = optionalClassFeatureSupplements[getClassKeyFromClass(cls)];
  if (!supplements || supplements.length === 0) {
    return cls;
  }

  const existingNames = new Set(cls.features.map((feature) => normalizeFeatureName(feature.name)));
  const supplementalFeatures = supplements
    .filter((feature) => !existingNames.has(normalizeFeatureName(feature.name)))
    .map(({ replacesFeatureNames, ...feature }) => ({
      ...feature,
      replacesFeatureIds: replacesFeatureNames
        ?.map((featureName) => cls.features.find((candidate) => normalizeFeatureName(candidate.name) === normalizeFeatureName(featureName))?.id)
        .filter((value): value is string => Boolean(value))
    }));

  if (supplementalFeatures.length === 0) {
    return cls;
  }

  return {
    ...cls,
    features: [...cls.features, ...supplementalFeatures]
  };
};

const applyFeatureChoiceSupplements = (features: Feature[], supplements?: Record<string, FeatureChoiceSupplement>) => {
  if (!supplements) {
    return features;
  }

  const normalizedSupplements = new Map(
    Object.entries(supplements).map(([featureName, supplement]) => [normalizeFeatureName(featureName), supplement])
  );

  return features.map((feature) => {
    const supplement = normalizedSupplements.get(normalizeFeatureName(feature.name));
    if (!supplement) {
      return feature;
    }

    return {
      ...feature,
      options: choosePreferredArray(feature.options, supplement.options),
      chooseCount: feature.chooseCount ?? supplement.chooseCount,
      requiresChoice: feature.requiresChoice ?? supplement.requiresChoice
    };
  });
};

const applyClassFeatureChoiceSupplements = (cls: Class): Class => {
  const classSupplements = classFeatureChoiceSupplements[getClassKeyFromClass(cls)];
  return {
    ...cls,
    features: applyFeatureChoiceSupplements(cls.features, classSupplements),
    subclasses: cls.subclasses.map((subclass) => ({
      ...subclass,
      features: applyFeatureChoiceSupplements(
        subclass.features,
        subclassFeatureChoiceSupplements[getCanonicalSubclassKey(subclass)]
      )
    }))
  };
};

const applySpeciesFeatureChoiceSupplements = (species: Species): Species => {
  const speciesKey = getCanonicalSpeciesKey(species);

  return {
    ...species,
    features: applyFeatureChoiceSupplements(species.features, speciesFeatureChoiceSupplements[speciesKey]),
    variants: species.variants?.map((variant) => ({
      ...variant,
      features: applyFeatureChoiceSupplements(
        variant.features,
        speciesVariantFeatureChoiceSupplements[`${speciesKey}::${normalizeIdentifier(variant.name || variant.id)}`]
      )
    }))
  };
};

const enrichClass = (primary: Class, fallback?: Class): Class => {
  const equipmentSupplement = classEquipmentSupplements[getClassFallbackLookupKey(primary)];
  const enriched = {
    ...primary,
    description: choosePreferredText(sanitizeImportedText(primary.description), sanitizeImportedText(fallback?.description)) ?? primary.description,
    armorProficiencies: choosePreferredArray(primary.armorProficiencies, fallback?.armorProficiencies),
    weaponProficiencies: choosePreferredArray(primary.weaponProficiencies, fallback?.weaponProficiencies),
    toolProficiencies: choosePreferredArray(primary.toolProficiencies, fallback?.toolProficiencies),
    skillChoices: choosePreferredArray(primary.skillChoices, fallback?.skillChoices),
    skillCount: primary.skillCount || fallback?.skillCount || 0,
    features: mergeFeatureCollections(primary.features, fallback?.features),
    spellcasting: primary.spellcasting ?? fallback?.spellcasting,
    equipmentOptions: choosePreferredArray(primary.equipmentOptions, equipmentSupplement ?? fallback?.equipmentOptions),
    startingGold: choosePreferredNumber(primary.startingGold, fallback?.startingGold)
  } satisfies Class;

  return sanitizeClass(applyClassFeatureChoiceSupplements(applyOptionalFeatureSupplements(enriched)));
};

const mergeClassCandidates = (candidates: Class[]) => {
  const primary = candidates.reduce((best, candidate) => {
    if (!best || getClassFallbackScore(candidate) > getClassFallbackScore(best)) {
      return candidate;
    }

    return best;
  }, undefined as Class | undefined) ?? candidates[0];

  return candidates.reduce((current, candidate) => {
    if (candidate.id === primary.id) {
      return current;
    }

    return {
      ...current,
      description: choosePreferredText(sanitizeImportedText(current.description), sanitizeImportedText(candidate.description)) ?? current.description,
      armorProficiencies: choosePreferredArray(current.armorProficiencies, candidate.armorProficiencies),
      weaponProficiencies: choosePreferredArray(current.weaponProficiencies, candidate.weaponProficiencies),
      toolProficiencies: choosePreferredArray(current.toolProficiencies, candidate.toolProficiencies),
      skillChoices: choosePreferredArray(current.skillChoices, candidate.skillChoices),
      skillCount: choosePreferredNumber(current.skillCount, candidate.skillCount) ?? 0,
      features: mergeFeatureCollections(current.features, candidate.features),
      subclasses: mergeCollectionsById(current.subclasses, candidate.subclasses),
      subclassLevel: choosePreferredNumber(current.subclassLevel, candidate.subclassLevel) ?? current.subclassLevel,
      spellcasting: current.spellcasting ?? candidate.spellcasting,
      equipmentOptions: choosePreferredArray(current.equipmentOptions, candidate.equipmentOptions),
      startingGold: choosePreferredNumber(current.startingGold, candidate.startingGold)
    } satisfies Class;
  }, primary);
};

const mergeClassCollections = (classes: Class[]) => {
  const grouped = classes.reduce<Map<string, Class[]>>((entries, cls) => {
    const key = getClassFallbackLookupKey(cls);
    const collection = entries.get(key);
    if (collection) {
      collection.push(cls);
    } else {
      entries.set(key, [cls]);
    }
    return entries;
  }, new Map<string, Class[]>());

  return Array.from(grouped.values()).map((candidates) => mergeClassCandidates(candidates));
};

const enrichBackground = (primary: Background, fallback?: Background): Background => {
  return sanitizeBackground({
    ...primary,
    description: choosePreferredText(sanitizeImportedText(primary.description), sanitizeImportedText(fallback?.description)) ?? primary.description,
    skillProficiencies: choosePreferredArray(primary.skillProficiencies, fallback?.skillProficiencies),
    toolProficiencies: choosePreferredArray(primary.toolProficiencies, fallback?.toolProficiencies),
    languageCount: choosePreferredNumber(primary.languageCount, fallback?.languageCount),
    equipment: choosePreferredArray(primary.equipment, fallback?.equipment),
    feature: {
      name: choosePreferredText(sanitizeImportedText(primary.feature?.name), sanitizeImportedText(fallback?.feature?.name)) ?? primary.feature.name,
      description: choosePreferredText(sanitizeImportedText(primary.feature?.description), sanitizeImportedText(fallback?.feature?.description)) ?? primary.feature.description
    },
    personalityTraits: choosePreferredArray(primary.personalityTraits, fallback?.personalityTraits),
    ideals: choosePreferredArray(primary.ideals, fallback?.ideals),
    bonds: choosePreferredArray(primary.bonds, fallback?.bonds),
    flaws: choosePreferredArray(primary.flaws, fallback?.flaws),
    suggestedCharacteristics: choosePreferredArray(primary.suggestedCharacteristics, fallback?.suggestedCharacteristics)
  });
};

const enrichEquipment = (primary: Equipment, fallback?: Equipment): Equipment => ({
  ...primary,
  name: sanitizeImportedText(primary.name) ?? primary.name,
  description: choosePreferredText(sanitizeImportedText(primary.description), sanitizeImportedText(fallback?.description)),
  type: primary.type === 'gear' && fallback?.type ? fallback.type : primary.type,
  source: sanitizeImportedText(primary.source) ?? primary.source,
  weaponCategory: primary.weaponCategory ?? fallback?.weaponCategory,
  weaponType: primary.weaponType ?? fallback?.weaponType,
  damage: primary.damage ?? fallback?.damage,
  damageType: primary.damageType ?? fallback?.damageType,
  properties: choosePreferredArray(primary.properties, fallback?.properties),
  range: primary.range ?? fallback?.range,
  armorCategory: primary.armorCategory ?? fallback?.armorCategory,
  ac: primary.ac ?? fallback?.ac,
  maxDexBonus: primary.maxDexBonus ?? fallback?.maxDexBonus,
  strengthRequirement: primary.strengthRequirement ?? fallback?.strengthRequirement,
  stealthDisadvantage: primary.stealthDisadvantage ?? fallback?.stealthDisadvantage
});

const selectPreferredSubclass = (subclasses: Subclass[], targetClass: Class) => {
  const targetTrack = getSubclassCompatibilityTrack(targetClass.sourceId, targetClass.source);
  const grouped = subclasses.reduce<Map<string, Subclass[]>>((entries, subclass) => {
    // Candidates here are already scoped to a single class, so dedupe by subclass name only.
    // Using the classId-based canonical key would leave a built-in subclass (no classId, e.g.
    // "The Fiend" from the static class list) ungrouped from the same subclass imported from a
    // source pack (classId set), causing it to appear twice.
    const key = normalizeIdentifier(subclass.name);
    const collection = entries.get(key);
    if (collection) {
      collection.push(subclass);
    } else {
      entries.set(key, [subclass]);
    }
    return entries;
  }, new Map<string, Subclass[]>());

  return Array.from(grouped.values()).map((candidates) => {
    const compatibleCandidates = candidates.filter((candidate) => isSubclassTrackCompatible(candidate, targetTrack));
    const hasTrackSpecificCandidate = candidates.some((candidate) => getSubclassCompatibilityTrack(candidate.sourceId, candidate.source) !== 'shared');

    if (targetTrack !== 'shared' && compatibleCandidates.length === 0 && hasTrackSpecificCandidate) {
      return undefined;
    }

    const availableCandidates = compatibleCandidates.length > 0 ? compatibleCandidates : candidates;
    const primary = availableCandidates.reduce((best, candidate) => {
      const candidateTrack = getSubclassCompatibilityTrack(candidate.sourceId, candidate.source);
      const score = (candidate.classId === targetClass.id ? 100 : 0)
        + (candidateTrack === targetTrack ? 50 : 0)
        + (candidateTrack === 'shared' ? 25 : 0)
        + getSubclassFallbackScore(candidate);

      if (!best || score > best.score || (score === best.score && candidate.id.localeCompare(best.subclass.id) < 0)) {
        return { subclass: candidate, score };
      }

      return best;
    }, undefined as { subclass: Subclass; score: number } | undefined)?.subclass;

    const fallback = availableCandidates.reduce((best, candidate) => {
      if (!best || getSubclassFallbackScore(candidate) > getSubclassFallbackScore(best)) {
        return candidate;
      }

      return best;
    }, undefined as Subclass | undefined);

    if (!primary || !fallback || primary.id === fallback.id) {
      return primary ?? fallback ?? candidates[0];
    }

    return sanitizeSubclass({
      ...primary,
      description: choosePreferredText(sanitizeImportedText(primary.description), sanitizeImportedText(fallback.description)) ?? primary.description,
      features: mergeFeatureCollections(primary.features, fallback.features)
    });
  }).filter((entry): entry is Subclass => Boolean(entry));
};

const mergeSubclassCollections = (classes: Class[], subclasses: Subclass[]) => {
  const subclassesByExactClassId = subclasses.reduce<Record<string, Subclass[]>>((groups, subclass) => {
    if (!subclass.classId) {
      return groups;
    }

    if (!groups[subclass.classId]) {
      groups[subclass.classId] = [];
    }

    groups[subclass.classId].push(subclass);
    return groups;
  }, {});

  const subclassesByCanonicalClassKey = subclasses.reduce<Record<string, Subclass[]>>((groups, subclass) => {
    const classKey = getClassKeyFromSubclass(subclass);
    if (!classKey) {
      return groups;
    }

    if (!groups[classKey]) {
      groups[classKey] = [];
    }

    groups[classKey].push(subclass);
    return groups;
  }, {});

  const builtInSubclassesByCanonicalClassKey = classes.reduce<Record<string, Subclass[]>>((groups, cls) => {
    const classKey = getClassKeyFromClass(cls);
    if (!groups[classKey]) {
      groups[classKey] = [];
    }

    groups[classKey].push(...cls.subclasses);
    return groups;
  }, {});

  return classes.map((cls) => {
    const canonicalKey = getClassKeyFromClass(cls);
    const compatibleSubclasses = [
      ...(subclassesByExactClassId[cls.id] ?? []),
      ...(subclassesByCanonicalClassKey[canonicalKey] ?? []),
      ...(builtInSubclassesByCanonicalClassKey[canonicalKey] ?? [])
    ];
    const mergedSubclasses = selectPreferredSubclass(mergeCollectionsById(cls.subclasses, compatibleSubclasses), cls);
    return sanitizeClass({ ...cls, subclasses: mergedSubclasses });
  });
};

// Fallback enrichment must never cross rules editions: keying by name alone let the 2014
// Dwarf's longer description and 2014-only traits (e.g. Tool Proficiency) leak into the
// 2024 Dwarf, so the fallback key pairs the canonical name with the entry's edition.
const getSpeciesFallbackLookupKey = (species: Species) => {
  return `${getCanonicalSpeciesKey(species)}::${getRulesEdition(species.sourceId, species.source)}`;
};

export const getRuntimeSpecies = () => {
  const mergedSpecies = mergeDynamicBucket(runtimeStaticSpecies, 'species');
  const fallbackSpecies = runtimeStaticSpecies.reduce<Record<string, Species>>((groups, species) => {
    const key = getSpeciesFallbackLookupKey(species);
    const current = groups[key];
    if (!current || getSpeciesFallbackScore(species) > getSpeciesFallbackScore(current)) {
      groups[key] = species;
    }
    return groups;
  }, {});

  return mergedSpecies.map((species) => {
    const key = getCanonicalSpeciesKey(species);
    const supplement = speciesSupplements[key];
    const editionSupplement = getEditionSpecificSpeciesSupplement(species);
    const combinedSupplement = supplement || editionSupplement
      ? {
          ...supplement,
          ...editionSupplement,
          features: mergeFeatureCollections(supplement?.features ?? [], editionSupplement?.features),
          variants: mergeSpeciesVariants(supplement?.variants, editionSupplement?.variants)
        }
      : undefined;

    return enrichSpecies(species, fallbackSpecies[getSpeciesFallbackLookupKey(species)], combinedSupplement);
  });
};

export const getRuntimeSubclasses = () => {
  return mergeSubclassCandidatesById([
    ...staticSubclasses(),
    ...getStoreBucket('subclasses')
  ]);
};

export const getRuntimeClasses = () => {
  const mergedClasses = mergeClassCollections(mergeDynamicBucket(runtimeStaticClasses, 'classes'));
  const fallbackClasses = mergedClasses.reduce<Record<string, Class>>((groups, cls) => {
    const key = getClassFallbackLookupKey(cls);
    const current = groups[key];
    if (!current || getClassFallbackScore(cls) > getClassFallbackScore(current)) {
      groups[key] = cls;
    }
    return groups;
  }, {});
  const enrichedClasses = mergedClasses.map((cls) => enrichClass(cls, fallbackClasses[getClassFallbackLookupKey(cls)]));
  // A real class always has a positive hit die. Sources that reprint optional class features
  // (e.g. Tasha's Sorcerer/Warlock feature pages) can be misparsed into placeholder classes with
  // a zero hit die; drop those so they never appear as broken, unbuildable options.
  const buildableClasses = enrichedClasses.filter((cls) => cls.hitDie > 0);
  return mergeSubclassCollections(buildableClasses, getRuntimeSubclasses());
};

// Backgrounds share names across editions (Acolyte, Criminal, ...), so the fallback key
// is edition-scoped for the same reason as species.
const getBackgroundFallbackLookupKey = (background: Background) => {
  return `${getCanonicalBackgroundKey(background)}::${getRulesEdition(background.sourceId, background.source)}`;
};

export const getRuntimeBackgrounds = () => {
  const mergedBackgrounds = mergeDynamicBucket(runtimeStaticBackgrounds, 'backgrounds');
  const fallbackBackgrounds = runtimeStaticBackgrounds.reduce<Record<string, Background>>((groups, background) => {
    groups[getBackgroundFallbackLookupKey(background)] = background;
    return groups;
  }, {});
  return mergedBackgrounds.map((background) => enrichBackground(background, fallbackBackgrounds[getBackgroundFallbackLookupKey(background)]));
};

export const getRuntimeSpells = () => mergeDynamicBucket(staticSpells(), 'spells').map(sanitizeSpell);

export const getRuntimeFeats = () => mergeDynamicBucket(staticFeats(), 'feats').map(sanitizeFeat);

export const getRuntimeEquipment = () => {
  const mergedEquipment = mergeDynamicBucket(staticEquipment(), 'equipment');
  const fallbackEquipment = staticEquipment().reduce<Record<string, Equipment>>((groups, entry) => {
    const key = getCanonicalEquipmentKey(entry);
    const current = groups[key];
    if (!current || (current.type === 'gear' && entry.type !== 'gear')) {
      groups[key] = entry;
    }
    return groups;
  }, {});

  return mergedEquipment.map((entry) => enrichEquipment(entry, fallbackEquipment[getCanonicalEquipmentKey(entry)]));
};

export const getRuntimeMonsters = () => mergeDynamicBucket(staticMonsters(), 'monsters').map(sanitizeMonster);

export const getRuntimeSpeciesById = (id: string) => getRuntimeSpecies().find((entry) => entry.id === id);

export const getRuntimeSpeciesVariant = (speciesId: string, variantId: string) => {
  return getRuntimeSpeciesById(speciesId)?.variants?.find((variant) => variant.id === variantId);
};

export const getRuntimeClassById = (id: string) => getRuntimeClasses().find((entry) => entry.id === id);

export const getRuntimeSubclass = (classId: string, subclassId: string) => {
  return getRuntimeClassById(classId)?.subclasses.find((entry) => entry.id === subclassId);
};

export const getRuntimeBackgroundById = (id: string) => getRuntimeBackgrounds().find((entry) => entry.id === id);

export const getRuntimeSpellById = (id: string) => getRuntimeSpells().find((entry) => entry.id === id);

export const getRuntimeFeatById = (id: string) => getRuntimeFeats().find((entry) => entry.id === id);

export const getRuntimeEquipmentById = (id: string) => getRuntimeEquipment().find((entry) => entry.id === id);

export const getRuntimeMonsterById = (id: string) => getRuntimeMonsters().find((entry) => entry.id === id);

export const useContentLibrary = () => {
  useContentStore((state) => state.importedPacks);
  useContentStore((state) => state.homebrewLibrary);

  return {
    species: getRuntimeSpecies(),
    classes: getRuntimeClasses(),
    subclasses: getRuntimeSubclasses(),
    backgrounds: getRuntimeBackgrounds(),
    spells: getRuntimeSpells(),
    feats: getRuntimeFeats(),
    equipment: getRuntimeEquipment(),
    monsters: getRuntimeMonsters()
  };
};