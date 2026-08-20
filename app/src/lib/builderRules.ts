import type {
  AbilityScoreIncrease,
  AbilityScoreMethod,
  AbilityScores,
  Background,
  Character,
  CharacterClass,
  CharacterEquipment,
  CharacterSpell,
  Class,
  Equipment,
  Feat,
  Feature,
  Proficiency,
  Species,
  SpeciesVariant,
  Spell,
  SpellcastingProgression,
  Subclass
} from '@/types/dnd';
import { resolveSourceId } from '@/data/librarySources';
import { isEquipmentChoiceOption } from '@/lib/startingEquipment';

export type RulesEdition = '2014' | '2024' | 'unknown';

export interface SelectedClassWithLevel {
  cls: Class;
  level: number;
  subclassId?: string;
  subclass?: Subclass;
}

export interface ResolvedCharacterClass {
  entry: CharacterClass;
  cls: Class;
  subclass?: Subclass;
}

export interface ClassFeatSelectionSource {
  classId: string;
  className: string;
  sourceId?: string;
  source?: string;
  level: number;
  featureName: string;
}

export interface SpeciesFeatSelectionSource {
  featureId: string;
  featureName: string;
  sourceName: string;
  sourceId?: string;
  source?: string;
  featType: 'any' | 'origin';
  count: number;
}

export interface SpellcastingClassSummary {
  classId: string;
  className: string;
  level: number;
  subclassId?: string;
  subclassName?: string;
  cantripLimit: number;
  spellSelectionLimit?: number;
  usesPreparedSpells: boolean;
  maxKnownSpellLevel: number;
  spellListClassName: string;
  slotsByLevel: number[];
  pactSlotsByLevel: number[];
}

export interface SpellcastingRulesSummary {
  classes: SpellcastingClassSummary[];
  availableClassNames: Set<string>;
  cantripLimit: number;
  selectedCantrips: number;
  remainingCantrips: number;
  leveledSpellLimit?: number;
  selectedLeveledSpells: number;
  remainingLeveledSpells?: number;
  maxSelectableSpellLevel: number;
  maxSlotLevel: number;
  multiclassCasterLevel: number;
  slotsByLevel: number[];
  pactSlotsByLevel: number[];
  selectedCountsByLevel: number[];
}

export interface DerivedCharacterProficiencies {
  skills: string[];
  tools: string[];
  languages: string[];
  armor: string[];
  weapons: string[];
  saves: (keyof AbilityScores)[];
}

export interface ResolvedEquipmentSelection {
  equipmentId: string;
  quantity: number;
  equipped: boolean;
  name: string;
  type: CharacterEquipment['equipmentId'] extends string ? string : never;
  item?: Equipment;
  sourceLabel: string;
}

export interface DerivedArmorClass {
  value: number;
  source: string;
  armorName?: string;
  shieldName?: string;
  proficient: boolean;
}

export type AbilityScoreChoiceMode = 'background-specialized' | 'background-balanced';

export interface AbilityScoreChoiceConfig {
  id: string;
  label: string;
  sourceLabel: string;
  amount: number;
  chooseCount: number;
  options: (keyof AbilityScores)[];
  exclusiveGroupId?: string;
}

const normalizeName = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();

const editionSourceIds = new Map<string, RulesEdition>([
  ['phb-2014', '2014'],
  ['basic-rules-2014', '2014'],
  ['mm', '2014'],
  ['tashas', '2014'],
  ['xanathars', '2014'],
  ['mtof', '2014'],
  ['fizbans', '2014'],
  ['motm', '2014'],
  ['volos', '2014'],
  ['erlw', '2014'],
  ['phb-2024', '2024'],
  ['basic-rules-2024', '2024'],
  ['mm-2024', '2024']
]);

export const getRulesEdition = (sourceId?: string, sourceText?: string): RulesEdition => {
  const resolvedSourceId = resolveSourceId(sourceId, sourceText);

  if (resolvedSourceId) {
    const edition = editionSourceIds.get(resolvedSourceId);
    if (edition) {
      return edition;
    }
  }

  const normalizedSource = normalizeName(sourceText ?? '');
  if (normalizedSource.includes('2024') || normalizedSource.includes('5 5')) {
    return '2024';
  }
  if (normalizedSource.includes('2014') || normalizedSource.includes('5e') || normalizedSource.includes('player s handbook')) {
    return '2014';
  }

  return 'unknown';
};

const featSelectionLevelsByClassId: Record<string, number[]> = {
  barbarian: [4, 8, 12, 16, 19],
  bard: [4, 8, 12, 16, 19],
  cleric: [4, 8, 12, 16, 19],
  druid: [4, 8, 12, 16, 19],
  fighter: [4, 6, 8, 12, 14, 16, 19],
  monk: [4, 8, 12, 16, 19],
  paladin: [4, 8, 12, 16, 19],
  ranger: [4, 8, 12, 16, 19],
  rogue: [4, 8, 10, 12, 16, 19],
  sorcerer: [4, 8, 12, 16, 19],
  warlock: [4, 8, 12, 16, 19],
  wizard: [4, 8, 12, 16, 19]
};
const classAdvancementKeyPattern = /^(basic rules|player s handbook|phb)\s+(2014|2024)\s+/;

const abilityDisplayOrder: Array<keyof AbilityScores> = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma'
];

const defaultAbilityScores: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10
};

export const standardArrayScores = [15, 14, 13, 12, 10, 8];
export const pointBuyCosts: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const pointBuyTotal = 27;

const sortScoresDescending = (scores?: AbilityScores) => Object.values(scores ?? {}).sort((left, right) => right - left);

export const isStandardArrayAllocation = (scores?: AbilityScores) => {
  const sorted = sortScoresDescending(scores);
  const expected = [...standardArrayScores].sort((left, right) => right - left);
  return sorted.length === expected.length && sorted.every((value, index) => value === expected[index]);
};

export const isPointBuyAllocation = (scores?: AbilityScores) => {
  if (!scores) {
    return false;
  }

  return Object.values(scores).every((score) => score >= 8 && score <= 15)
    && Object.values(scores).reduce((total, score) => total + (pointBuyCosts[score] || 0), 0) <= pointBuyTotal;
};

export const skillNames = [
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
] as const;

export const defaultLanguageOptions = [
  'Abyssal',
  'Aquan',
  'Auran',
  'Celestial',
  'Common',
  'Deep Speech',
  'Draconic',
  'Druidic',
  'Dwarvish',
  'Elvish',
  'Giant',
  'Gnomish',
  'Goblin',
  'Halfling',
  'Ignan',
  'Infernal',
  'Orc',
  'Primordial',
  'Sylvan',
  'Terran',
  'Thieves\' Cant',
  'Undercommon'
] as const;

const skillNameSet = new Set<string>(skillNames);
const originFeatNameSet = new Set(['alert', 'crafter', 'healer', 'lucky', 'magic initiate', 'musician', 'savage attacker', 'skilled', 'tavern brawler']);
// Sources write an unmade choice as a proficiency: "One of your choice", "One skill of choice",
// "Any 2 of your choice". The bounded lazy spans keep the alternatives from backtracking.
const choicePlaceholderPattern = /\b(?:any|one|two|three|four|another|extra)\b[^.]{0,40}?\bof (?:your )?choice\b|\bchoose\b[^.]{0,40}?\blanguage\b|\blanguage of your choice\b/i;

const abilityNamePattern = /(strength|dexterity|constitution|intelligence|wisdom|charisma)/i;
const apostrophePattern = /['’]/g;
const armorFormulaPrefixPattern = /(base armor class equals|armor class equals|your ac equals|your ac is|ac equals|ac is)/i;
const plusOrAndPattern = /(?:\+|plus|and)/i;
const multiclassSpellSlotsTable: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1]
];

const slugify = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '');
const humanizeFallbackId = (value: string) => value.split('-').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
const quantityWords = new Map<string, number>([
  ['a', 1],
  ['an', 1],
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['twenty', 20]
]);
const replaceEquipmentChoicePlaceholder = (label: string, resolvedName: string) => {
  // "Any simple weapon" is the whole label, so splicing into it leaves the phrase the player was
  // trying to replace. The picked weapon *is* the item — say so, and let the source label carry
  // the provenance.
  if (isEquipmentChoiceOption(label)) {
    return resolvedName;
  }

  const replacedChoiceGroup = label.replace(/Choose\s+1\s+from\s+[^,]+/i, resolvedName);
  if (replacedChoiceGroup !== label) {
    return replacedChoiceGroup;
  }

  const replacedChoiceItem = label.replace(/\b(?:an?|one|1)\s+[^,]+?\s+of your choice\b/i, resolvedName);
  if (replacedChoiceItem !== label) {
    return replacedChoiceItem;
  }

  return `${label} (${resolvedName})`;
};

/**
 * The bundled part an id's fourth segment names. A slot that grants several picks appends
 * `--<n>` to its slug (the Equipment step's `PICK_SEPARATOR`), so match the bare slug too — the
 * two picks of "Two martial weapons" are the same line of the kit.
 */
const findBundledEquipmentOption = (
  option: { contents?: Array<{ name: string; type: string }> } | undefined,
  childSlug: string | undefined
) => {
  if (!option?.contents?.length || !childSlug) {
    return undefined;
  }

  const bareSlug = childSlug.replace(/--\d+$/, '');
  return option.contents.find((candidate) => {
    const candidateSlug = slugify(candidate.name);
    return candidateSlug === childSlug || candidateSlug === bareSlug;
  });
};

const stripQuantityPrefix = (value: string) => {
  const trimmed = value.trim();
  const numericPrefix = /^(\d+)\s+(.+)$/i.exec(trimmed);
  if (numericPrefix) {
    return numericPrefix[2].trim();
  }

  const wordPrefix = /^([a-z]+)\s+(.+)$/i.exec(trimmed);
  if (wordPrefix && quantityWords.has(wordPrefix[1].toLowerCase())) {
    return wordPrefix[2].trim();
  }

  return trimmed;
};

const singularizeEquipmentCandidate = (value: string) => {
  if (/axes$/i.test(value)) {
    return value.replace(/axes$/i, 'axe');
  }

  if (/ies$/i.test(value)) {
    return value.replace(/ies$/i, 'y');
  }

  if (/s$/i.test(value) && !/ss$/i.test(value)) {
    return value.replace(/s$/i, '');
  }

  return value;
};

const getEquipmentLookupCandidates = (label: string) => {
  const segments = label
    .split(/,|\sand\s/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

  const candidates = new Set<string>();

  [label, ...segments].forEach((candidate) => {
    const stripped = stripQuantityPrefix(candidate);
    if (!stripped) {
      return;
    }

    candidates.add(stripped);
    candidates.add(singularizeEquipmentCandidate(stripped));
  });

  return Array.from(candidates).filter(Boolean);
};

const resolveReferencedEquipmentItem = ({
  optionName,
  resolvedItemId,
  getEquipmentById,
  findEquipmentByName
}: {
  optionName?: string;
  resolvedItemId?: string;
  getEquipmentById: (equipmentId: string) => Equipment | undefined;
  findEquipmentByName?: (equipmentName: string) => Equipment | undefined;
}) => {
  // The fourth id segment is a chosen equipment id for some shapes and a bundled part's slug for
  // others, so a miss here is not a failure — fall through to the name lookup rather than
  // returning nothing, which is what left every 2024 kit item unresolved (no AC, no attacks).
  if (resolvedItemId) {
    const byId = getEquipmentById(resolvedItemId);
    if (byId) {
      return byId;
    }
  }

  if (!optionName || !findEquipmentByName) {
    return undefined;
  }

  for (const candidate of getEquipmentLookupCandidates(optionName)) {
    const resolved = findEquipmentByName(candidate);
    if (resolved) {
      return resolved;
    }
  }

  return undefined;
};

const isDefined = <T,>(value: T | null | undefined): value is T => Boolean(value);

export const isChoicePlaceholderLabel = (value?: string) => Boolean(value && choicePlaceholderPattern.test(value));

// Tool proficiencies are printed as an unresolved choice far more often than as a named tool:
// "One type of gaming set", "Three musical instruments of your choice", "Choose one type of
// artisan's tools or one musical instrument". Those are picks the character still has to make,
// so they are matched to the tool families in the equipment catalogue (Equipment.toolCategory)
// and offered as selectors instead of being written onto the sheet verbatim.
const toolChoiceFamilyKeywords: Array<{ pattern: RegExp; category: RegExp }> = [
  { pattern: /artisan/i, category: /artisan/i },
  { pattern: /gaming set/i, category: /gaming/i },
  { pattern: /musical instrument/i, category: /musical instrument/i }
];
const toolChoiceIntentPattern = /\bof your choice\b|\bone type of\b|^choose\b|\bany\b/i;
const countWordValues = new Map([['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6]]);

const parseChoiceCount = (label: string) => {
  const digitMatch = /\b(\d+)\b/.exec(label);
  if (digitMatch) {
    return Number(digitMatch[1]);
  }

  const wordMatch = /\b(one|two|three|four|five|six)\b/i.exec(label);
  return wordMatch ? (countWordValues.get(wordMatch[1].toLowerCase()) ?? 1) : 1;
};

export interface ToolProficiencyChoice {
  id: string;
  label: string;
  chooseCount: number;
  options: string[];
}

// The 2014 and 2024 books print the same tool under different names — "Dice Set" became "Dice",
// "Playing Card Set" became "Playing Cards" — and a set keyed on the exact string offered both,
// so "One type of gaming set" listed six options for four tools. Collapse the collection noun and
// the plural so the two printings land on one key; distinct tools ("Dragonchess", "Three-Dragon
// Ante") are untouched because only the trailing noun is dropped.
const equipmentCollectionNouns = new Set(['set', 'sets', 'tools', 'supplies', 'utensils', 'kit', 'kits']);
const singularizeWord = (word: string) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);

export const getCanonicalEquipmentName = (name: string) => {
  const words = name
    .toLowerCase()
    .replaceAll(/['’]s\b/g, '')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const kept = words.filter((word) => !equipmentCollectionNouns.has(word)).map(singularizeWord);
  // A tool actually named for its collection noun ("Tools") keeps it rather than becoming empty.
  return (kept.length > 0 ? kept : words).join(' ');
};

/** How well a printing matches the edition the character is being built in. Highest wins. */
const getEquipmentEditionRank = (entry: Equipment, preferredEdition: RulesEdition) => {
  const edition = getRulesEdition(entry.sourceId, entry.source);
  if (preferredEdition !== 'unknown' && edition === preferredEdition) return 3;
  if (edition === '2024') return 2;
  if (edition === 'unknown') return 1;
  return 0;
};

export const getToolChoiceIdPrefix = (ownerKind: 'background' | 'class', ownerId: string) => `${ownerKind}:${ownerId}:tool`;

export const isToolProficiencyChoiceLabel = (label: string) => {
  return toolChoiceIntentPattern.test(label) && toolChoiceFamilyKeywords.some((family) => family.pattern.test(label));
};

export const getToolProficiencyChoice = (
  label: string,
  slotId: string,
  toolEquipment: Equipment[],
  preferredEdition: RulesEdition = 'unknown'
): ToolProficiencyChoice | undefined => {
  const families = toolChoiceFamilyKeywords.filter((family) => family.pattern.test(label));
  if (families.length === 0 || !toolChoiceIntentPattern.test(label)) {
    return undefined;
  }

  const preferredByName = new Map<string, Equipment>();
  for (const entry of toolEquipment) {
    if (!families.some((family) => family.category.test(entry.toolCategory ?? ''))) {
      continue;
    }

    const key = getCanonicalEquipmentName(entry.name);
    const current = preferredByName.get(key);
    if (!current || getEquipmentEditionRank(entry, preferredEdition) > getEquipmentEditionRank(current, preferredEdition)) {
      preferredByName.set(key, entry);
    }
  }

  const options = Array.from(preferredByName.values())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (options.length === 0) {
    return undefined;
  }

  return {
    id: slotId,
    label,
    chooseCount: parseChoiceCount(label),
    options
  };
};

export const getSelectedToolProficiencies = (
  character: Pick<Character, 'toolProficiencySelections'> | undefined,
  choiceId: string
) => character?.toolProficiencySelections?.[choiceId] ?? [];

export const updateToolProficiencySelection = (
  current: Character['toolProficiencySelections'],
  choiceId: string,
  slotIndex: number,
  value: string | undefined,
  chooseCount: number
) => {
  const selections = [...(current?.[choiceId] ?? [])];
  if (value) {
    selections[slotIndex] = value;
  } else {
    selections.splice(slotIndex, 1);
  }

  return {
    ...current,
    [choiceId]: selections.filter(Boolean).slice(0, chooseCount)
  };
};

export const isOriginFeat = (feat: Feat) => {
  return originFeatNameSet.has(normalizeName(feat.name));
};

const applyFeatureOptionDerivedProficiency = ({
  feature,
  optionName,
  optionDescription,
  skills,
  tools,
  languages,
  armor,
  weapons
}: {
  feature: Feature;
  optionName: string;
  optionDescription?: string;
  skills: Set<string>;
  tools: Set<string>;
  languages: Set<string>;
  armor: Set<string>;
  weapons: Set<string>;
}) => {
  const context = normalizeName(`${feature.name} ${feature.description} ${optionDescription ?? ''}`);

  if (skillNameSet.has(optionName) && context.includes('skill')) {
    skills.add(optionName);
    return;
  }

  if (context.includes('language')) {
    languages.add(optionName);
    return;
  }

  if (context.includes('tool')) {
    tools.add(optionName);
    return;
  }

  if (context.includes('weapon')) {
    weapons.add(optionName);
    return;
  }

  if (context.includes('armor') || context.includes('shield')) {
    armor.add(optionName);
  }
};

const getAbilityModifier = (score = 10) => Math.floor((score - 10) / 2);
const getAverageHitPointGain = (hitDie: number) => Math.floor(hitDie / 2) + 1;
const getPerLevelHitPointGain = (hitDie: number, constitutionModifier: number, isFirstCharacterLevel: boolean) => {
  const baseHitPoints = isFirstCharacterLevel ? hitDie : getAverageHitPointGain(hitDie);
  return Math.max(1, baseHitPoints + constitutionModifier);
};

const getProgressionValue = (values: number[] | undefined, level: number) => {
  if (!values || level <= 0) {
    return 0;
  }

  return values[Math.max(0, level - 1)] ?? 0;
};

const getProgressionSlots = (values: number[][] | undefined, level: number) => {
  if (!values || level <= 0) {
    return [];
  }

  return values[Math.max(0, level - 1)] ?? [];
};

const getPreparedSpellLimit = (spellcasting: SpellcastingProgression | undefined, level: number, abilityScores: Partial<AbilityScores> | undefined) => {
  if (!spellcasting?.spellPreparation) {
    return undefined;
  }

  const spellcastingAbilities: (keyof AbilityScores)[] = Array.isArray(spellcasting.ability)
    ? spellcasting.ability
    : [spellcasting.ability];
  const highestModifier = spellcastingAbilities.reduce((best, ability) => {
    return Math.max(best, getAbilityModifier(abilityScores?.[ability] ?? 10));
  }, Number.NEGATIVE_INFINITY);

  return Math.max(1, level + (Number.isFinite(highestModifier) ? highestModifier : 0));
};

const getHighestUnlockedSpellLevel = (slotsByLevel: number[]) => {
  return slotsByLevel.reduce((highestLevel, slotCount, index) => {
    return slotCount > 0 ? index + 1 : highestLevel;
  }, 0);
};

const getClassLookupKey = (cls: Class) => `${normalizeName(cls.id)} ${normalizeName(cls.name)}`;
const classMatches = (cls: Class, token: string) => getClassLookupKey(cls).includes(token);

const getSpellListClassName = (cls: Class) => {
  if (classMatches(cls, 'fighter') || classMatches(cls, 'rogue')) {
    return 'Wizard';
  }
  return cls.name;
};

const getSubclassSpellcasting = (entry: SelectedClassWithLevel) => {
  if (!entry.subclass?.spellcasting) {
    return undefined;
  }

  if (entry.cls.spellcasting) {
    return entry.cls.spellcasting;
  }

  return entry.subclass.spellcasting;
};

const getSpellcastingSource = (entry: SelectedClassWithLevel) => {
  return entry.cls.spellcasting ?? getSubclassSpellcasting(entry);
};

const getCasterContribution = (entry: SelectedClassWithLevel) => {
  const spellcasting = getSpellcastingSource(entry);
  if (!spellcasting) {
    return { kind: 'none' as const, slotsByLevel: [] as number[] };
  }

  if (classMatches(entry.cls, 'warlock')) {
    return {
      kind: 'pact' as const,
      slotsByLevel: getProgressionSlots(spellcasting.spellSlots, entry.level)
    };
  }

  if (classMatches(entry.cls, 'paladin') || classMatches(entry.cls, 'ranger')) {
    return {
      kind: 'half' as const,
      slotsByLevel: getProgressionSlots(spellcasting.spellSlots, entry.level)
    };
  }

  if ((classMatches(entry.cls, 'fighter') || classMatches(entry.cls, 'rogue')) && entry.subclass?.spellcasting) {
    return {
      kind: 'third' as const,
      slotsByLevel: getProgressionSlots(entry.subclass.spellcasting.spellSlots, entry.level)
    };
  }

  return {
    kind: 'full' as const,
    slotsByLevel: getProgressionSlots(spellcasting.spellSlots, entry.level)
  };
};

const toSortedArray = (values: Iterable<string>) => {
  return Array.from(new Set(Array.from(values).filter(Boolean))).sort((left, right) => left.localeCompare(right));
};

const toSortedSaves = (values: Iterable<keyof AbilityScores>) => {
  const unique = new Set(values);
  return abilityDisplayOrder.filter((ability) => unique.has(ability));
};

const addProficiencyEntries = (entries: Proficiency[] | undefined, type: Proficiency['type'], bucket: Set<string>) => {
  entries?.forEach((entry) => {
    // "One skill of choice" describes a pick the player still owes, not a proficiency they have.
    // The matching feature already offers a selector, so writing the placeholder onto the sheet
    // just prints an unresolved choice next to real proficiencies.
    if (entry.type === type && entry.name.trim() && !isChoicePlaceholderLabel(entry.name)) {
      bucket.add(entry.name.trim());
    }
  });
};

const addAbilityScoreBonus = (
  bonuses: Partial<Record<keyof AbilityScores, number>>,
  ability: keyof AbilityScores,
  amount: number
) => {
  bonuses[ability] = (bonuses[ability] ?? 0) + amount;
};

const getChoiceConfigId = (prefix: string, index: number) => `${prefix}:choice:${index}`;

const applyFixedAbilityScoreIncreases = (
  bonuses: Partial<Record<keyof AbilityScores, number>>,
  increases: AbilityScoreIncrease[] | undefined
) => {
  increases?.forEach((increase) => {
    if (increase.ability === 'choose') {
      return;
    }

    addAbilityScoreBonus(bonuses, increase.ability, increase.amount);
  });
};

const getChoiceConfigsFromIncreases = ({
  increases,
  prefix,
  sourceLabel
}: {
  increases: AbilityScoreIncrease[] | undefined;
  prefix: string;
  sourceLabel: string;
}) => {
  return (increases ?? []).flatMap((increase, index) => {
    if (increase.ability !== 'choose') {
      return [];
    }

    const chooseCount = Math.max(1, increase.chooseCount ?? 1);
    const options = increase.chooseFrom?.length ? increase.chooseFrom : abilityDisplayOrder;
    const amountLabel = increase.amount >= 0 ? `+${increase.amount}` : String(increase.amount);
    const label = chooseCount === 1
      ? `Choose one ability to increase by ${amountLabel}`
      : `Choose ${chooseCount} abilities to increase by ${amountLabel}`;

    return [{
      id: getChoiceConfigId(prefix, index),
      label,
      sourceLabel,
      amount: increase.amount,
      chooseCount,
      options
    } satisfies AbilityScoreChoiceConfig];
  });
};

export const getBackgroundAbilityScoreModeKey = (background: Background) => `background:${background.id}:origin-asi-mode`;

const getBackgroundAbilityScoreChoiceConfigs = (
  background: Background,
  abilityScoreChoiceModes?: Record<string, string>
) => {
  const mode = abilityScoreChoiceModes?.[getBackgroundAbilityScoreModeKey(background)] === 'background-balanced'
    ? 'background-balanced'
    : 'background-specialized';
  const sourceLabel = `${background.name} background`;

  if (background.abilityScoreIncreases?.length) {
    return getChoiceConfigsFromIncreases({
      increases: background.abilityScoreIncreases,
      prefix: `background:${background.id}`,
      sourceLabel
    });
  }

  if (getRulesEdition(background.sourceId, background.source) !== '2024') {
    return [] as AbilityScoreChoiceConfig[];
  }

  if (mode === 'background-balanced') {
    return [{
      id: `background:${background.id}:origin-asi:balanced`,
      label: 'Choose three different abilities to increase by +1',
      sourceLabel,
      amount: 1,
      chooseCount: 3,
      options: abilityDisplayOrder
    } satisfies AbilityScoreChoiceConfig];
  }

  const exclusiveGroupId = `background:${background.id}:origin-asi:specialized`;
  return [
    {
      id: `background:${background.id}:origin-asi:major`,
      label: 'Choose one ability to increase by +2',
      sourceLabel,
      amount: 2,
      chooseCount: 1,
      options: abilityDisplayOrder,
      exclusiveGroupId
    },
    {
      id: `background:${background.id}:origin-asi:minor`,
      label: 'Choose a different ability to increase by +1',
      sourceLabel,
      amount: 1,
      chooseCount: 1,
      options: abilityDisplayOrder,
      exclusiveGroupId
    }
  ] satisfies AbilityScoreChoiceConfig[];
};

export const getAbilityScoreChoiceConfigs = ({
  background,
  species,
  variant,
  feats,
  abilityScoreChoiceModes
}: {
  background?: Background;
  species?: Species;
  variant?: SpeciesVariant;
  feats?: Feat[];
  abilityScoreChoiceModes?: Record<string, string>;
}) => {
  const configs: AbilityScoreChoiceConfig[] = [];

  if (background) {
    configs.push(...getBackgroundAbilityScoreChoiceConfigs(background, abilityScoreChoiceModes));
  }

  if (species) {
    configs.push(...getChoiceConfigsFromIncreases({
      increases: species.abilityScoreIncreases,
      prefix: `species:${species.id}`,
      sourceLabel: species.name
    }));
  }

  if (variant) {
    configs.push(...getChoiceConfigsFromIncreases({
      increases: variant.abilityScoreIncreases,
      prefix: `variant:${variant.id}`,
      sourceLabel: variant.name
    }));
  }

  feats?.forEach((feat) => {
    configs.push(...getChoiceConfigsFromIncreases({
      increases: feat.abilityScoreIncreases,
      prefix: `feat:${feat.id}`,
      sourceLabel: feat.name
    }));
  });

  return configs;
};

export const deriveAbilityScoreBonuses = ({
  background,
  species,
  variant,
  feats,
  abilityScoreChoiceModes,
  abilityScoreChoiceSelections
}: {
  background?: Background;
  species?: Species;
  variant?: SpeciesVariant;
  feats?: Feat[];
  abilityScoreChoiceModes?: Record<string, string>;
  abilityScoreChoiceSelections?: Record<string, (keyof AbilityScores)[]>;
}) => {
  const bonuses: Partial<Record<keyof AbilityScores, number>> = {};
  const usedAbilitiesByExclusiveGroup = new Map<string, Set<keyof AbilityScores>>();

  if (background?.abilityScoreIncreases?.length) {
    applyFixedAbilityScoreIncreases(bonuses, background.abilityScoreIncreases);
  }

  applyFixedAbilityScoreIncreases(bonuses, species?.abilityScoreIncreases);
  applyFixedAbilityScoreIncreases(bonuses, variant?.abilityScoreIncreases);
  feats?.forEach((feat) => applyFixedAbilityScoreIncreases(bonuses, feat.abilityScoreIncreases));

  getAbilityScoreChoiceConfigs({ background, species, variant, feats, abilityScoreChoiceModes }).forEach((config) => {
    const selectedAbilities = (abilityScoreChoiceSelections?.[config.id] ?? [])
      .filter((ability): ability is keyof AbilityScores => config.options.includes(ability))
      .slice(0, config.chooseCount);

    const uniqueSelections = selectedAbilities.filter((ability, index, values) => values.indexOf(ability) === index);
    const exclusiveGroup = config.exclusiveGroupId
      ? (usedAbilitiesByExclusiveGroup.get(config.exclusiveGroupId) ?? new Set<keyof AbilityScores>())
      : undefined;

    uniqueSelections
      .filter((ability) => !exclusiveGroup?.has(ability))
      .forEach((ability) => {
        addAbilityScoreBonus(bonuses, ability, config.amount);
        exclusiveGroup?.add(ability);
      });

    if (config.exclusiveGroupId && exclusiveGroup) {
      usedAbilitiesByExclusiveGroup.set(config.exclusiveGroupId, exclusiveGroup);
    }
  });

  return bonuses;
};

export const applyAbilityScoreBonuses = (
  abilityScores: Partial<AbilityScores> | undefined,
  bonuses: Partial<Record<keyof AbilityScores, number>> | undefined
): AbilityScores => {
  return abilityDisplayOrder.reduce<AbilityScores>((scores, ability) => {
    scores[ability] = (abilityScores?.[ability] ?? defaultAbilityScores[ability]) + (bonuses?.[ability] ?? 0);
    return scores;
  }, { ...defaultAbilityScores });
};

const parseArmorFormula = (text: string) => {
  const prefixMatch = armorFormulaPrefixPattern.exec(text);
  if (!prefixMatch) {
    return null;
  }

  const formulaText = text.slice(prefixMatch.index + prefixMatch[0].length).trim();
  const baseMatch = /(\d+)/.exec(formulaText);
  const firstAbilityMatch = /your\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)/i.exec(formulaText);
  if (!baseMatch || !firstAbilityMatch) {
    return null;
  }

  const remainingFormulaText = formulaText.slice(firstAbilityMatch.index + firstAbilityMatch[0].length);
  const secondAbilityMatch = new RegExp(String.raw`${plusOrAndPattern.source}\s*your\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)`, 'i').exec(remainingFormulaText);

  return {
    base: Number(baseMatch[1]),
    firstAbility: firstAbilityMatch[1].toLowerCase() as keyof AbilityScores,
    secondAbility: secondAbilityMatch?.[1]?.toLowerCase() as keyof AbilityScores | undefined
  };
};

const parseFeatureArmorCandidate = ({
  feature,
  abilityScores,
  hasBodyArmorEquipped,
  shieldBonus,
  hasShieldEquipped
}: {
  feature: Feature;
  abilityScores: AbilityScores;
  hasBodyArmorEquipped: boolean;
  shieldBonus: number;
  hasShieldEquipped: boolean;
}): DerivedArmorClass | null => {
  const combinedText = `${feature.name}. ${feature.description}`.replaceAll(apostrophePattern, "'");
  const lowered = combinedText.toLowerCase();
  const requiresNoArmor = /aren't wearing armor|are not wearing armor|not wearing any armor/.test(lowered);
  const allowsShield = /can use a shield and still gain this benefit/.test(lowered);
  const forbidsShield = /wielding a shield|without a shield/.test(lowered);
  const availableWithArmor = /if the armor you wear would leave you with a lower ac/.test(lowered);

  if (hasBodyArmorEquipped && requiresNoArmor && !availableWithArmor) {
    return null;
  }

  if (hasShieldEquipped && forbidsShield) {
    return null;
  }

  const formula = parseArmorFormula(combinedText);
  const base = formula?.base ?? 0;
  const firstAbility = formula?.firstAbility;
  const secondAbility = formula?.secondAbility;

  if (!base || !firstAbility) {
    return null;
  }

  const value = base
    + getAbilityModifier(abilityScores[firstAbility])
    + (secondAbility ? getAbilityModifier(abilityScores[secondAbility]) : 0)
    + ((hasShieldEquipped && (allowsShield || !forbidsShield)) ? shieldBonus : 0);

  return {
    value,
    source: feature.name,
    shieldName: hasShieldEquipped && (allowsShield || !forbidsShield) ? 'Shield' : undefined,
    proficient: true
  };
};

const getEquippedArmorSelections = (equipmentEntries: ResolvedEquipmentSelection[]) => {
  const equippedPhysicalItems = equipmentEntries.filter((entry) => entry.equipped && entry.item);
  const bodyArmor = equippedPhysicalItems
    .filter((entry) => entry.item?.armorCategory && entry.item.armorCategory !== 'shield')
    .sort((left, right) => (right.item?.ac ?? 0) - (left.item?.ac ?? 0))[0];
  const shield = equippedPhysicalItems
    .filter((entry) => entry.item?.armorCategory === 'shield' || entry.item?.type === 'shield')
    .sort((left, right) => (right.item?.ac ?? 0) - (left.item?.ac ?? 0))[0];

  return { bodyArmor, shield };
};

const getArmorValueFromItem = (armor: Equipment, dexterityModifier: number) => {
  if (!armor.armorCategory || armor.armorCategory === 'shield') {
    return armor.ac ?? 10;
  }

  if (armor.armorCategory === 'light') {
    return (armor.ac ?? 10) + dexterityModifier;
  }

  if (armor.armorCategory === 'medium') {
    return (armor.ac ?? 10) + Math.min(armor.maxDexBonus ?? 2, dexterityModifier);
  }

  return armor.ac ?? 10;
};

const hasNamedProficiency = (proficiencies: string[], equipment: Equipment | undefined) => {
  if (!equipment) {
    return true;
  }

  if (equipment.armorCategory === 'shield' || equipment.type === 'shield') {
    return proficiencies.includes('Shields');
  }

  if (equipment.armorCategory === 'light') {
    return proficiencies.includes('Light Armor');
  }
  if (equipment.armorCategory === 'medium') {
    return proficiencies.includes('Medium Armor');
  }
  if (equipment.armorCategory === 'heavy') {
    return proficiencies.includes('Heavy Armor');
  }
  return true;
};

export const getRulesEditionLabel = (sourceId?: string, sourceText?: string) => {
  const edition = getRulesEdition(sourceId, sourceText);
  if (edition === '2014') {
    return '2014 Rules';
  }
  if (edition === '2024') {
    return '2024 Rules';
  }
  return 'Unspecified';
};

export const getSelectedClassEdition = (selectedClasses: SelectedClassWithLevel[]) => {
  for (const entry of selectedClasses) {
    const edition = getRulesEdition(entry.cls.sourceId, entry.cls.source);
    if (edition !== 'unknown') {
      return edition;
    }
  }

  return 'unknown' as const;
};

export const canMixClassEditions = (selectedClasses: SelectedClassWithLevel[], candidateClass: Class) => {
  const lockedEdition = getSelectedClassEdition(selectedClasses);
  const candidateEdition = getRulesEdition(candidateClass.sourceId, candidateClass.source);
  return lockedEdition === 'unknown' || candidateEdition === 'unknown' || lockedEdition === candidateEdition;
};

export const getClassFeatSelectionCount = (classId: string, level: number) => {
  const advancementKey = normalizeName(classId).replace(classAdvancementKeyPattern, '');
  return (featSelectionLevelsByClassId[advancementKey] ?? []).filter((requiredLevel) => level >= requiredLevel).length;
};

const getFeatSelectionFeatureName = (cls: Class, level: number) => {
  const edition = getRulesEdition(cls.sourceId, cls.source);
  if (edition === '2024' && level >= 19) {
    return 'Epic Boon';
  }

  return 'Ability Score Improvement';
};

export const getClassFeatSelectionSources = (entry: SelectedClassWithLevel): ClassFeatSelectionSource[] => {
  const advancementKey = normalizeName(entry.cls.id).replace(classAdvancementKeyPattern, '');
  return (featSelectionLevelsByClassId[advancementKey] ?? [])
    .filter((requiredLevel) => entry.level >= requiredLevel)
    .map((requiredLevel) => ({
      classId: entry.cls.id,
      className: entry.cls.name,
      sourceId: entry.cls.sourceId,
      source: entry.cls.source,
      level: requiredLevel,
      featureName: getFeatSelectionFeatureName(entry.cls, requiredLevel)
    }));
};

export const resolveBackgroundGrantedFeat = (background: Background | undefined, feats: Feat[]) => {
  if (!background?.feature?.name) {
    return undefined;
  }

  const normalizedFeatureName = normalizeName(background.feature.name);
  return feats.find((feat) => normalizeName(feat.name) === normalizedFeatureName);
};

export const getSpeciesFeatSelectionSources = ({
  species,
  variant
}: {
  species?: Species;
  variant?: SpeciesVariant;
}): SpeciesFeatSelectionSource[] => {
  const sources: SpeciesFeatSelectionSource[] = [];

  const collectFromFeatures = (features: Feature[] | undefined, sourceName: string, sourceId?: string, source?: string) => {
    features?.forEach((feature) => {
      const description = normalizeName(feature.description);
      if (!description.includes('feat') || !description.includes('your choice')) {
        return;
      }

      sources.push({
        featureId: feature.id,
        featureName: feature.name,
        sourceName,
        sourceId,
        source,
        featType: description.includes('origin feat') ? 'origin' : 'any',
        count: feature.chooseCount ?? 1
      });
    });
  };

  collectFromFeatures(species?.features, species?.name ?? 'Species', species?.sourceId, species?.source);
  collectFromFeatures(variant?.features, variant?.name ?? 'Variant', species?.sourceId, species?.source);

  return sources;
};

export const getAdditionalFeatSelectionLimit = (selectedClasses: SelectedClassWithLevel[]) => {
  return selectedClasses.reduce((total, entry) => total + getClassFeatSelectionCount(entry.cls.id, entry.level), 0);
};

export const getCharacterProficiencyBonus = (totalLevel: number) => Math.ceil(totalLevel / 4) + 1;

export const resolveCharacterClasses = ({
  classes,
  getClassById,
  getSubclassById
}: {
  classes: CharacterClass[];
  getClassById: (classId: string) => Class | undefined;
  getSubclassById?: (classId: string, subclassId: string) => Subclass | undefined;
}): ResolvedCharacterClass[] => {
  return classes
    .map((entry) => {
      const cls = getClassById(entry.classId);
      if (!cls) {
        return undefined;
      }

      const subclass = entry.subclassId && getSubclassById ? getSubclassById(cls.id, entry.subclassId) : undefined;
      return subclass ? { entry, cls, subclass } : { entry, cls };
    })
    .filter(isDefined);
};

/**
 * A character stores whichever class id was current when it was saved, and merged class ids move
 * as source packs improve — `getRuntimeClassById` is what resolves an older id back to the class
 * it names. Matching a stored entry on the raw string instead silently drops the class: the
 * Spells step reported "select a spellcasting class" for a level-4 Warlock and the Equipment step
 * counted "0 class kits", both for a character whose class the Class step resolved perfectly well.
 * Every read *and* write of a class entry goes through these.
 */
export const matchesCharacterClassEntry = (
  entry: CharacterClass,
  classId: string,
  getClassById: (classId: string) => Class | undefined
) => {
  if (entry.classId === classId) {
    return true;
  }

  const target = getClassById(classId);
  return Boolean(target && getClassById(entry.classId)?.id === target.id);
};

export const findCharacterClassEntry = (
  classes: CharacterClass[] | undefined,
  classId: string,
  getClassById: (classId: string) => Class | undefined
) => (classes ?? []).find((entry) => matchesCharacterClassEntry(entry, classId, getClassById));

/** Apply `updater` to the entry `classId` names; returning undefined removes it. */
export const updateCharacterClassEntry = (
  classes: CharacterClass[] | undefined,
  classId: string,
  getClassById: (classId: string) => Class | undefined,
  updater: (entry: CharacterClass) => CharacterClass | undefined
): CharacterClass[] => {
  const next: CharacterClass[] = [];
  for (const entry of classes ?? []) {
    if (!matchesCharacterClassEntry(entry, classId, getClassById)) {
      next.push(entry);
      continue;
    }

    const updated = updater(entry);
    if (updated) {
      next.push(updated);
    }
  }

  return next;
};

/**
 * Rewrite stored class ids to the ids the content library uses now. Nothing else in the document
 * changes, so a character still round-trips — this only repairs the pointer, which is what
 * `getStableClassId` exists to keep still in the first place.
 */
export const normalizeCharacterClassIds = (
  classes: CharacterClass[] | undefined,
  getClassById: (classId: string) => Class | undefined
): CharacterClass[] => {
  return (classes ?? []).map((entry) => {
    const cls = getClassById(entry.classId);
    return cls && cls.id !== entry.classId ? { ...entry, classId: cls.id } : entry;
  });
};

export const sortFeaturesByLevel = (features: Feature[]) => {
  return [...features].sort((left, right) => {
    if (left.level !== right.level) {
      return left.level - right.level;
    }

    return left.name.localeCompare(right.name);
  });
};

export const deriveCharacterHitPoints = ({
  classes,
  abilityScores,
  previousHp,
  getClassById
}: {
  classes: CharacterClass[];
  abilityScores?: Partial<AbilityScores>;
  previousHp?: Character['hp'];
  getClassById: (classId: string) => Class | undefined;
}) => {
  const constitutionModifier = getAbilityModifier(abilityScores?.constitution ?? 10);
  let maximum = 0;

  classes.forEach((entry, index) => {
    const cls = getClassById(entry.classId);
    if (!cls || entry.level <= 0) {
      return;
    }

    maximum += getPerLevelHitPointGain(cls.hitDie, constitutionModifier, index === 0);

    const remainingLevels = Math.max(0, entry.level - (index === 0 ? 1 : 0));
    maximum += remainingLevels * getPerLevelHitPointGain(cls.hitDie, constitutionModifier, false);
  });

  if (maximum <= 0) {
    return {
      current: 0,
      maximum: 0,
      temporary: previousHp?.temporary ?? 0
    };
  }

  const previousMaximum = previousHp?.maximum ?? 0;
  const previousCurrent = previousHp?.current ?? previousMaximum;
  const current = previousMaximum > 0
    ? Math.min(maximum, Math.max(0, previousCurrent + (maximum - previousMaximum)))
    : maximum;

  return {
    current,
    maximum,
    temporary: previousHp?.temporary ?? 0
  };
};

export const deriveCharacterProficiencies = ({
  character,
  resolvedClasses,
  background,
  species,
  variant
}: {
  character: Partial<Character>;
  resolvedClasses: ResolvedCharacterClass[];
  background?: Background;
  species?: Species;
  variant?: SpeciesVariant;
}): DerivedCharacterProficiencies => {
  const selectedFeatures = character.features ?? [];
  const skills = new Set(character.proficiencies?.skills ?? []);
  const tools = new Set(character.proficiencies?.tools ?? []);
  const languages = new Set([
    ...(character.proficiencies?.languages ?? []),
    ...(character.backgroundLanguageSelections ?? []),
    ...(character.speciesLanguageSelections ?? []),
    ...((species?.languages ?? []).filter((entry) => !isChoicePlaceholderLabel(entry)))
  ]);
  const armor = new Set(character.proficiencies?.armor ?? []);
  const weapons = new Set(character.proficiencies?.weapons ?? []);
  const saves = new Set<keyof AbilityScores>(character.proficiencies?.saves ?? []);

  // An unresolved tool choice ("One type of gaming set") is not a proficiency; the tools the
  // player actually picked for it are. Keep the placeholder off the sheet either way.
  const addToolProficiency = (choiceIdPrefix: string) => (label: string, index: number) => {
    const choiceId = `${choiceIdPrefix}-${index}`;
    const selections = character.toolProficiencySelections?.[choiceId];
    if (selections?.length) {
      selections.forEach((entry) => tools.add(entry));
      return;
    }

    if (!isToolProficiencyChoiceLabel(label)) {
      tools.add(label);
    }
  };

  background?.skillProficiencies.forEach((skill) => skills.add(skill));
  background?.toolProficiencies?.forEach(addToolProficiency(getToolChoiceIdPrefix('background', background.id)));

  addProficiencyEntries(species?.proficiencies, 'skill', skills);
  addProficiencyEntries(species?.proficiencies, 'tool', tools);
  addProficiencyEntries(species?.proficiencies, 'armor', armor);
  addProficiencyEntries(species?.proficiencies, 'weapon', weapons);
  addProficiencyEntries(species?.proficiencies, 'language', languages);
  species?.proficiencies?.forEach((entry) => {
    if (entry.type === 'save' && abilityNamePattern.test(entry.name)) {
      saves.add(entry.name.toLowerCase() as keyof AbilityScores);
    }
  });

  addProficiencyEntries(variant?.proficiencies, 'skill', skills);
  addProficiencyEntries(variant?.proficiencies, 'tool', tools);
  addProficiencyEntries(variant?.proficiencies, 'armor', armor);
  addProficiencyEntries(variant?.proficiencies, 'weapon', weapons);
  addProficiencyEntries(variant?.proficiencies, 'language', languages);
  variant?.proficiencies?.forEach((entry) => {
    if (entry.type === 'save' && abilityNamePattern.test(entry.name)) {
      saves.add(entry.name.toLowerCase() as keyof AbilityScores);
    }
  });

  resolvedClasses.forEach(({ cls }) => {
    cls.savingThrows.forEach((save) => saves.add(save));
    cls.armorProficiencies.forEach((entry) => armor.add(entry));
    cls.weaponProficiencies.forEach((entry) => weapons.add(entry));
    cls.toolProficiencies?.forEach(addToolProficiency(getToolChoiceIdPrefix('class', cls.id)));
  });

  const featurePool = [
    ...(species?.features ?? []),
    ...(variant?.features ?? []),
    ...resolvedClasses.flatMap(({ entry, cls, subclass }) => [
      ...cls.features.filter((feature) => feature.level <= entry.level),
      ...(subclass?.features.filter((feature) => feature.level <= entry.level) ?? [])
    ])
  ];
  const featureLookup = new Map(featurePool.map((feature) => [feature.id, feature]));

  selectedFeatures.forEach((selection) => {
    if (!selection.optionId) {
      return;
    }

    const feature = featureLookup.get(selection.featureId);
    const option = feature?.options?.find((entry) => entry.id === selection.optionId);
    if (!feature || !option) {
      return;
    }

    applyFeatureOptionDerivedProficiency({
      feature,
      optionName: option.name,
      optionDescription: option.description,
      skills,
      tools,
      languages,
      armor,
      weapons
    });
  });

  return {
    skills: toSortedArray(skills),
    tools: toSortedArray(tools),
    languages: toSortedArray(languages),
    armor: toSortedArray(armor),
    weapons: toSortedArray(weapons),
    saves: toSortedSaves(saves)
  };
};

const emptyCharacterProficiencies = (): Character['proficiencies'] => ({
  skills: [],
  tools: [],
  languages: [],
  armor: [],
  weapons: [],
  saves: []
});

/**
 * A saved character stores the merged proficiency list (picks plus everything species, background,
 * and class grant), but the builder's `character.proficiencies` holds only the player's own picks —
 * `ClassDetails` counts those against `skillCount`. Re-deriving the grants and subtracting them
 * recovers the pick layer so reopening a character does not present granted skills as class picks.
 */
export const extractSelectedProficiencies = ({
  character,
  resolvedClasses,
  background,
  species,
  variant
}: {
  character: Partial<Character>;
  resolvedClasses: ResolvedCharacterClass[];
  background?: Background;
  species?: Species;
  variant?: SpeciesVariant;
}): Character['proficiencies'] => {
  // `??` catches a missing block but not a wrong-shaped one, and a document read from the server
  // was not necessarily written by this version — an array here made every list undefined.
  const storedValue = character.proficiencies;
  const stored = storedValue && !Array.isArray(storedValue) && typeof storedValue === 'object'
    ? { ...emptyCharacterProficiencies(), ...storedValue }
    : emptyCharacterProficiencies();
  const granted = deriveCharacterProficiencies({
    character: { ...character, proficiencies: emptyCharacterProficiencies() },
    resolvedClasses,
    background,
    species,
    variant
  });

  const withoutGranted = <T extends string>(values: T[], grantedValues: T[]): T[] => {
    const grantedSet = new Set<string>(grantedValues);
    return values.filter((value) => !grantedSet.has(value));
  };

  return {
    skills: withoutGranted(stored.skills, granted.skills),
    tools: withoutGranted(stored.tools, granted.tools),
    languages: withoutGranted(stored.languages, granted.languages),
    armor: withoutGranted(stored.armor, granted.armor),
    weapons: withoutGranted(stored.weapons, granted.weapons),
    saves: withoutGranted(stored.saves, granted.saves)
  };
};

export interface AbilityScoreEntryState {
  abilityScoreMethod: AbilityScoreMethod;
  rolledScores: number[];
  rolledScoreAssignments: Partial<Record<keyof AbilityScores, number>>;
}

/**
 * Restores the ability score entry mode for a saved character. Characters saved before the mode was
 * recorded are classified from their scores; anything that is neither the standard array nor a legal
 * point buy is treated as rolled, with the stored scores standing in for the rolled pool.
 */
export const resolveAbilityScoreEntryState = (character: Partial<Character>): AbilityScoreEntryState => {
  const scores = character.abilityScores;

  if (character.abilityScoreMethod) {
    return {
      abilityScoreMethod: character.abilityScoreMethod,
      rolledScores: character.rolledScores ?? [],
      rolledScoreAssignments: character.rolledScoreAssignments ?? {}
    };
  }

  if (isStandardArrayAllocation(scores)) {
    return { abilityScoreMethod: 'standard', rolledScores: [], rolledScoreAssignments: {} };
  }

  if (isPointBuyAllocation(scores)) {
    return { abilityScoreMethod: 'point-buy', rolledScores: [], rolledScoreAssignments: {} };
  }

  const resolvedScores = scores ?? defaultAbilityScores;
  return {
    abilityScoreMethod: 'rolled',
    rolledScores: sortScoresDescending(resolvedScores),
    rolledScoreAssignments: abilityDisplayOrder.reduce<Partial<Record<keyof AbilityScores, number>>>((assignments, ability) => {
      assignments[ability] = resolvedScores[ability];
      return assignments;
    }, {})
  };
};

export const resolveCharacterEquipment = ({
  equipment,
  getEquipmentById,
  getClassById,
  getBackgroundById,
  findEquipmentByName
}: {
  equipment: CharacterEquipment[];
  getEquipmentById: (equipmentId: string) => Equipment | undefined;
  getClassById: (classId: string) => Class | undefined;
  getBackgroundById?: (backgroundId: string) => Background | undefined;
  findEquipmentByName?: (equipmentName: string) => Equipment | undefined;
}): ResolvedEquipmentSelection[] => {
  return equipment.map((entry) => {
    const directItem = getEquipmentById(entry.equipmentId);
    if (directItem) {
      return {
        equipmentId: entry.equipmentId,
        quantity: entry.quantity,
        equipped: entry.equipped,
        name: directItem.name,
        type: directItem.type,
        item: directItem,
        sourceLabel: directItem.source
      };
    }

    if (entry.equipmentId.includes('::')) {
      const parts = entry.equipmentId.split('::');
      const [scopeOrClassId] = parts;

      if (scopeOrClassId === 'background') {
        const backgroundId = parts[1] ?? '';
        const groupIndex = Number(parts[2]);
        const optionSlug = parts[3];
        const resolvedItemId = parts[4];
        const background = getBackgroundById?.(backgroundId);
        const backgroundEntry = Number.isFinite(groupIndex) ? background?.equipment[groupIndex] : undefined;
        const option = backgroundEntry?.alternatives?.find((candidate) => slugify(candidate.name) === optionSlug) ?? backgroundEntry;
        const resolvedItem = resolveReferencedEquipmentItem({
          optionName: option?.name,
          resolvedItemId,
          getEquipmentById,
          findEquipmentByName
        });

        if (resolvedItem) {
          let resolvedName = resolvedItem.name;
          if (option?.name) {
            resolvedName = resolvedItemId
              ? replaceEquipmentChoicePlaceholder(option.name, resolvedItem.name)
              : option.name;
          }

          return {
            equipmentId: entry.equipmentId,
            quantity: entry.quantity,
            equipped: entry.equipped,
            name: resolvedName,
            type: resolvedItem.type,
            item: resolvedItem,
            sourceLabel: background?.name ? `${background.name} Background Equipment` : 'Background Equipment'
          };
        }

        return {
          equipmentId: entry.equipmentId,
          quantity: entry.quantity,
          equipped: entry.equipped,
          name: option?.name ?? humanizeFallbackId(optionSlug || entry.equipmentId),
          type: option?.type ?? 'gear',
          sourceLabel: background?.name ? `${background.name} Background Equipment` : 'Background Equipment'
        };
      }

      const classId = scopeOrClassId;
      const groupIndex = Number(parts[1]);
      const optionSlug = parts[2];
      const childSlug = parts[3];
      const cls = getClassById(classId);
      const option = Number.isFinite(groupIndex)
        ? cls?.equipmentOptions[groupIndex]?.find((candidate) => slugify(candidate.name) === optionSlug)
        : undefined;
      const bundledEntry = findBundledEquipmentOption(option, childSlug);
      const optionLabel = bundledEntry?.name ?? option?.name;
      // Only a five-segment id — or the older four-segment shape on an option with no contents —
      // carries an item the player picked. On an option that *has* contents the fourth segment is
      // the part's own slug, and reading it as a pick relabelled every fixed grant.
      const chosenItemId = parts[4] ?? (option?.contents?.length ? undefined : parts[3]);
      const resolvedItem = resolveReferencedEquipmentItem({
        optionName: optionLabel,
        resolvedItemId: chosenItemId,
        getEquipmentById,
        findEquipmentByName
      });
      const sourceLabel = cls?.name ? `${cls.name} Starting Equipment` : 'Starting Equipment';

      if (resolvedItem) {
        let resolvedName = resolvedItem.name;
        if (optionLabel) {
          // A line the player resolved shows what they picked, not the phrase they picked it from.
          resolvedName = chosenItemId && getEquipmentById(chosenItemId)
            ? replaceEquipmentChoicePlaceholder(optionLabel, resolvedItem.name)
            : optionLabel;
        }

        return {
          equipmentId: entry.equipmentId,
          quantity: entry.quantity,
          equipped: entry.equipped,
          name: resolvedName,
          type: resolvedItem.type,
          item: resolvedItem,
          sourceLabel
        };
      }

      return {
        equipmentId: entry.equipmentId,
        quantity: entry.quantity,
        equipped: entry.equipped,
        name: optionLabel ?? humanizeFallbackId(childSlug || optionSlug || entry.equipmentId),
        type: bundledEntry?.type ?? option?.type ?? 'gear',
        sourceLabel
      };
    }

    return {
      equipmentId: entry.equipmentId,
      quantity: entry.quantity,
      equipped: entry.equipped,
      name: humanizeFallbackId(entry.equipmentId),
      type: 'gear',
      sourceLabel: 'Unknown Source'
    };
  });
};

export const canEquipSelection = (entry: ResolvedEquipmentSelection) => {
  return Boolean(entry.item && (
    entry.item.type === 'armor'
    || entry.item.type === 'shield'
    || entry.item.type === 'weapon'
    || entry.item.armorCategory
    || entry.item.weaponCategory
    || entry.item.damage
  ));
};

export const deriveArmorClass = ({
  abilityScores,
  proficiencies,
  equipment,
  activeFeatures
}: {
  abilityScores: AbilityScores;
  proficiencies: DerivedCharacterProficiencies;
  equipment: ResolvedEquipmentSelection[];
  activeFeatures: Feature[];
}): DerivedArmorClass => {
  const dexterityModifier = getAbilityModifier(abilityScores.dexterity);
  const { bodyArmor, shield } = getEquippedArmorSelections(equipment);
  const shieldBonus = shield?.item ? getArmorValueFromItem(shield.item, dexterityModifier) : 0;
  const candidates: DerivedArmorClass[] = [
    {
      value: 10 + dexterityModifier + shieldBonus,
      source: shieldBonus > 0 ? 'Unarmored + Shield' : 'Unarmored',
      shieldName: shield?.name,
      proficient: !shield || hasNamedProficiency(proficiencies.armor, shield.item)
    }
  ];

  if (bodyArmor?.item) {
    candidates.push({
      value: getArmorValueFromItem(bodyArmor.item, dexterityModifier) + shieldBonus,
      source: bodyArmor.name,
      armorName: bodyArmor.name,
      shieldName: shield?.name,
      proficient: hasNamedProficiency(proficiencies.armor, bodyArmor.item) && (!shield || hasNamedProficiency(proficiencies.armor, shield.item))
    });
  }

  activeFeatures.forEach((feature) => {
    const candidate = parseFeatureArmorCandidate({
      feature,
      abilityScores,
      hasBodyArmorEquipped: Boolean(bodyArmor),
      shieldBonus,
      hasShieldEquipped: Boolean(shield)
    });

    if (candidate) {
      candidates.push(candidate);
    }
  });

  candidates.sort((left, right) => {
    if (right.value !== left.value) {
      return right.value - left.value;
    }
    if (left.proficient !== right.proficient) {
      return left.proficient ? -1 : 1;
    }
    return left.source.localeCompare(right.source);
  });

  return candidates[0] ?? {
    value: 10 + dexterityModifier,
    source: 'Unarmored',
    proficient: true
  };
};

export const getActiveFeatures = ({
  species,
  variant,
  resolvedClasses,
  feats,
  selectedFeatures = []
}: {
  species?: Species;
  variant?: SpeciesVariant;
  resolvedClasses: ResolvedCharacterClass[];
  feats?: Feat[];
  selectedFeatures?: Character['features'];
}) => {
  const features: Feature[] = [];
  const selectedFeatureIds = new Set(
    selectedFeatures.map((entry) => entry.featureId)
  );

  const addFeature = (feature: Feature) => {
    if (feature.optional && !selectedFeatureIds.has(feature.id)) {
      return;
    }

    features.push(feature);
  };

  species?.features.forEach(addFeature);
  variant?.features.forEach(addFeature);
  feats?.forEach((feat) => feat.features.forEach(addFeature));
  resolvedClasses.forEach(({ entry, cls, subclass }) => {
    cls.features.filter((feature) => feature.level <= entry.level).forEach(addFeature);
    subclass?.features.filter((feature) => feature.level <= entry.level).forEach(addFeature);
  });

  const replacedFeatureIds = new Set(features.flatMap((feature) => feature.replacesFeatureIds ?? []));
  return features.filter((feature) => !replacedFeatureIds.has(feature.id) || Boolean(feature.replacesFeatureIds?.length));
};

export const getSpellcastingRulesSummary = ({
  selectedClasses,
  abilityScores,
  selectedSpells,
  getSpellById
}: {
  selectedClasses: SelectedClassWithLevel[];
  abilityScores?: Partial<AbilityScores>;
  selectedSpells: CharacterSpell[];
  getSpellById: (spellId: string) => Spell | undefined;
}): SpellcastingRulesSummary => {
  const spellcastingClasses = selectedClasses
    .map<SpellcastingClassSummary | null>((entry) => {
      const spellcasting = getSpellcastingSource(entry);
      if (!spellcasting) {
        return null;
      }

      const contribution = getCasterContribution(entry);
      const cantripLimit = getProgressionValue(spellcasting.cantripsKnown, entry.level);
      const knownSpellLimit = getProgressionValue(spellcasting.spellsKnown, entry.level);
      const preparedSpellLimit = getPreparedSpellLimit(spellcasting, entry.level, abilityScores);
      const classSlotsByLevel = contribution.kind === 'pact' ? [] : contribution.slotsByLevel;
      const pactSlotsByLevel = contribution.kind === 'pact' ? contribution.slotsByLevel : [];

      return {
        classId: entry.cls.id,
        className: entry.cls.name,
        level: entry.level,
        subclassId: entry.subclass?.id,
        subclassName: entry.subclass?.name,
        cantripLimit,
        spellSelectionLimit: spellcasting.spellsKnown ? knownSpellLimit : preparedSpellLimit,
        usesPreparedSpells: Boolean(spellcasting.spellPreparation && !spellcasting.spellsKnown),
        maxKnownSpellLevel: getHighestUnlockedSpellLevel(contribution.slotsByLevel),
        spellListClassName: getSpellListClassName(entry.cls),
        slotsByLevel: classSlotsByLevel,
        pactSlotsByLevel
      };
    })
    .filter((entry): entry is SpellcastingClassSummary => Boolean(entry));

  const multiclassCasterLevel = selectedClasses.reduce((total, entry) => {
    const contribution = getCasterContribution(entry);
    if (contribution.kind === 'full') {
      return total + entry.level;
    }
    if (contribution.kind === 'half') {
      return total + Math.floor(entry.level / 2);
    }
    if (contribution.kind === 'third') {
      return total + Math.floor(entry.level / 3);
    }
    return total;
  }, 0);

  const nonPactSpellcastingClasses = spellcastingClasses.filter((entry) => entry.slotsByLevel.length > 0);
  const slotsByLevel = nonPactSpellcastingClasses.length <= 1
    ? (nonPactSpellcastingClasses[0]?.slotsByLevel ?? [])
    : (multiclassSpellSlotsTable[Math.max(0, multiclassCasterLevel - 1)] ?? []);
  const pactSlotsByLevel = spellcastingClasses.reduce<number[]>((slots, entry) => {
    entry.pactSlotsByLevel.forEach((slotCount, index) => {
      slots[index] = (slots[index] ?? 0) + slotCount;
    });
    return slots;
  }, []);

  const selectedCountsByLevel: number[] = [];
  let selectedCantrips = 0;
  let selectedLeveledSpells = 0;

  for (const entry of selectedSpells) {
    const spell = getSpellById(entry.spellId);
    if (!spell) {
      continue;
    }

    if (spell.level === 0) {
      selectedCantrips += 1;
      continue;
    }

    const levelIndex = spell.level - 1;
    selectedCountsByLevel[levelIndex] = (selectedCountsByLevel[levelIndex] ?? 0) + 1;
    selectedLeveledSpells += 1;
  }

  const availableClassNames = new Set(spellcastingClasses.map((entry) => entry.spellListClassName));
  const cantripLimit = spellcastingClasses.reduce((total, entry) => total + entry.cantripLimit, 0);
  const leveledSelectionLimit = spellcastingClasses.length > 0 && spellcastingClasses.every((entry) => entry.spellSelectionLimit !== undefined)
    ? spellcastingClasses.reduce((total, entry) => total + (entry.spellSelectionLimit ?? 0), 0)
    : undefined;
  const maxSelectableSpellLevel = spellcastingClasses.reduce((highestLevel, entry) => Math.max(highestLevel, entry.maxKnownSpellLevel), 0);
  const maxSlotLevel = Math.max(getHighestUnlockedSpellLevel(slotsByLevel), getHighestUnlockedSpellLevel(pactSlotsByLevel));

  return {
    classes: spellcastingClasses,
    availableClassNames,
    cantripLimit,
    selectedCantrips,
    remainingCantrips: Math.max(0, cantripLimit - selectedCantrips),
    leveledSpellLimit: leveledSelectionLimit,
    selectedLeveledSpells,
    remainingLeveledSpells: leveledSelectionLimit === undefined ? undefined : Math.max(0, leveledSelectionLimit - selectedLeveledSpells),
    maxSelectableSpellLevel,
    maxSlotLevel,
    multiclassCasterLevel,
    slotsByLevel,
    pactSlotsByLevel,
    selectedCountsByLevel
  };
};
