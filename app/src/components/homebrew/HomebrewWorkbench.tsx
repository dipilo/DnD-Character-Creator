import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  backgroundSchema,
  classSchema,
  equipmentSchema,
  featSchema,
  monsterSchema,
  speciesSchema,
  spellSchema,
  subclassSchema
} from '@/lib/canonicalContent';
import { useContentLibrary } from '@/data/runtimeContent';
import { useContentStore } from '@/store/contentStore';
import type {
  AbilityScores,
  Background,
  Class,
  Equipment,
  Feat,
  Feature,
  Monster,
  MonsterAction,
  MonsterTrait,
  Species,
  Spell,
  Subclass
} from '@/types/dnd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ComboboxInput } from '@/components/ui/combobox-input';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useHomebrewSuggestions } from '@/lib/homebrewSuggestions';
import { toast } from 'sonner';
import { Check, Plus, Trash2 } from 'lucide-react';

const abilityKeys: Array<keyof AbilityScores> = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma'
];

const isAbilityKey = (value: string): value is keyof AbilityScores => {
  return abilityKeys.includes(value as keyof AbilityScores);
};

// Fixed 5e rules vocabulary (not book-specific content) used to drive
// suggestions for the matching schema-enum fields below.
const weaponCategoryOptions: Array<NonNullable<Equipment['weaponCategory']>> = ['simple', 'martial'];
const weaponTypeOptions: Array<NonNullable<Equipment['weaponType']>> = ['melee', 'ranged'];
const armorCategoryOptions: Array<NonNullable<Equipment['armorCategory']>> = ['light', 'medium', 'heavy', 'shield'];
const spellComponentOptions = ['V', 'S', 'M'];

// Maps a real equipment item's type onto the narrower EquipmentOption type
// union used by background/class starting-equipment fields.
const toEquipmentOptionType = (type: Equipment['type']): 'weapon' | 'armor' | 'tool' | 'gear' | 'gold' | 'pack' => {
  if (type === 'shield') return 'armor';
  if (type === 'consumable') return 'gear';
  return type;
};

const surfaceSelectClassName = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/80';

type DraftSetter<T> = Dispatch<SetStateAction<T>>;

type BackgroundDraft = {
  id: string;
  name: string;
  description: string;
  skillProficiencies: string;
  toolProficiencies: string;
  languageCount: string;
  equipment: string;
  featureName: string;
  featureDescription: string;
  personalityTraits: string;
  ideals: string;
  bonds: string;
  flaws: string;
};

type SpellDraft = {
  id: string;
  name: string;
  level: string;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  higherLevels: string;
  classes: string;
  ritual: boolean;
  concentration: boolean;
};

type FeatDraft = {
  id: string;
  name: string;
  description: string;
  prerequisitesClass: string;
  prerequisitesRace: string;
  prerequisitesLevel: string;
  abilityIncreaseAbility: string;
  abilityIncreaseAmount: string;
  features: string;
};

type EquipmentDraft = {
  id: string;
  name: string;
  description: string;
  type: Equipment['type'];
  costAmount: string;
  costUnit: Equipment['cost']['unit'];
  weight: string;
  weaponCategory: string;
  weaponType: string;
  damage: string;
  damageType: string;
  properties: string;
  rangeNormal: string;
  rangeLong: string;
  armorCategory: string;
  ac: string;
  maxDexBonus: string;
  strengthRequirement: string;
  stealthDisadvantage: boolean;
};

type SpeciesDraft = {
  id: string;
  name: string;
  description: string;
  size: Species['size'];
  speed: string;
  languages: string;
  proficiencies: string;
  abilityScoreIncreases: string;
  features: string;
};

type ClassDraft = {
  id: string;
  name: string;
  description: string;
  hitDie: string;
  primaryAbility: string;
  savingThrows: string;
  armorProficiencies: string;
  weaponProficiencies: string;
  toolProficiencies: string;
  skillChoices: string;
  skillCount: string;
  subclassLevel: string;
  features: string;
  equipmentOptions: string;
  startingGold: string;
};

type SubclassDraft = {
  id: string;
  classId: string;
  name: string;
  description: string;
  features: string;
};

type MonsterDraft = {
  id: string;
  name: string;
  description: string;
  size: Monster['size'];
  type: string;
  alignment: string;
  ac: string;
  hpAverage: string;
  hpFormula: string;
  speed: string;
  strength: string;
  dexterity: string;
  constitution: string;
  intelligence: string;
  wisdom: string;
  charisma: string;
  challengeRating: string;
  savingThrows: string;
  skills: string;
  languages: string;
  senses: string;
  damageResistances: string;
  damageImmunities: string;
  conditionImmunities: string;
  traits: string;
  actions: string;
};

const splitCsv = (value: string) => {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const splitLines = (value: string) => {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const slugify = (value: string) => {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
};

const getValidationError = (message: string, issues?: Array<{ message?: string }>) => {
  return issues?.[0]?.message ?? message;
};

const parseFeatureLines = (value: string, sourceLabel: string, prefix: string): Feature[] => {
  return splitLines(value).map((line, index) => {
    const separatorIndex = line.indexOf(':');
    const hasNamedDescription = separatorIndex > 0;
    const name = hasNamedDescription ? line.slice(0, separatorIndex).trim() : `Feature ${index + 1}`;
    const description = hasNamedDescription ? line.slice(separatorIndex + 1).trim() : line;

    return {
      id: `${prefix}-${index + 1}`,
      name,
      description,
      level: 1,
      source: sourceLabel
    };
  });
};

const serializeFeatureLines = (features: Feature[]) => {
  return features.map((feature) => `${feature.name}: ${feature.description}`).join('\n');
};

const parseAbilityScoreIncreaseLines = (value: string) => {
  return splitLines(value).map((line) => {
    const [abilityPart, amountPart, chooseFromPart, chooseCountPart] = line.split('|').map((part) => part.trim());
    const isChoiceEntry = abilityPart === 'choose';
    if (isChoiceEntry) {
      return {
        ability: 'choose' as const,
        amount: Number(amountPart || '0'),
        chooseFrom: splitCsv(chooseFromPart || '').filter(isAbilityKey),
        chooseCount: chooseCountPart ? Number(chooseCountPart) : undefined
      };
    }

    if (!isAbilityKey(abilityPart)) {
      throw new Error(`Unknown ability score entry: ${abilityPart}`);
    }

    return {
      ability: abilityPart,
      amount: Number(amountPart || '0'),
      chooseFrom: undefined,
      chooseCount: undefined
    };
  });
};

const serializeAbilityScoreIncreaseLines = (entries: Species['abilityScoreIncreases']) => {
  return entries
    .map((entry) => [
      entry.ability,
      String(entry.amount),
      entry.chooseFrom?.join(', ') ?? '',
      entry.chooseCount ? String(entry.chooseCount) : ''
    ].filter(Boolean).join(' | '))
    .join('\n');
};

const parseLevelFeatureLines = (value: string, sourceLabel: string, prefix: string): Feature[] => {
  return splitLines(value).map((line, index) => {
    const [levelPart, remainder = ''] = line.includes('|')
      ? [line.slice(0, line.indexOf('|')).trim(), line.slice(line.indexOf('|') + 1).trim()]
      : ['1', line];
    const separatorIndex = remainder.indexOf(':');
    const hasNamedDescription = separatorIndex > 0;
    const name = hasNamedDescription ? remainder.slice(0, separatorIndex).trim() : `Feature ${index + 1}`;
    const description = hasNamedDescription ? remainder.slice(separatorIndex + 1).trim() : remainder;

    return {
      id: `${prefix}-${index + 1}`,
      name,
      description,
      level: Number(levelPart || '1'),
      source: sourceLabel
    };
  });
};

const serializeLevelFeatureLines = (features: Feature[]) => {
  return features.map((feature) => `${feature.level} | ${feature.name}: ${feature.description}`).join('\n');
};

const parseEquipmentOptionGroups = (value: string): Class['equipmentOptions'] => {
  return splitLines(value)
    .map((line) => line.split('||').map((chunk) => chunk.trim()).filter(Boolean))
    .map((group) => group.map((option) => {
      const [namePart, typePart, countPart] = option.split('|').map((part) => part.trim());
      return {
        name: namePart,
        type: ['weapon', 'armor', 'tool', 'gear', 'gold', 'pack'].includes(typePart) ? typePart as Class['equipmentOptions'][number][number]['type'] : 'gear',
        count: countPart ? Number(countPart) : undefined
      };
    }))
    .filter((group) => group.length > 0);
};

const serializeEquipmentOptionGroups = (groups: Class['equipmentOptions']) => {
  return groups
    .map((group) => group.map((option) => [option.name, option.type, option.count ? String(option.count) : ''].filter(Boolean).join(' | ')).join(' || '))
    .join('\n');
};

const parseMonsterLines = <T extends MonsterTrait | MonsterAction>(value: string, prefix: string): T[] => {
  return splitLines(value).map((line, index) => {
    const separatorIndex = line.indexOf(':');
    const name = separatorIndex > 0 ? line.slice(0, separatorIndex).trim() : `Entry ${index + 1}`;
    const description = separatorIndex > 0 ? line.slice(separatorIndex + 1).trim() : line;
    return {
      id: `${prefix}-${index + 1}`,
      name,
      description
    } as T;
  });
};

const serializeMonsterLines = (entries: MonsterTrait[] | MonsterAction[]) => {
  return entries.map((entry) => `${entry.name}: ${entry.description}`).join('\n');
};

const parseBackgroundEquipment = (value: string): Background['equipment'] => {
  return splitLines(value).map((line) => {
    const [namePart, typePart, countPart] = line.split('|').map((part) => part?.trim() ?? '');
    let normalizedType: Background['equipment'][number]['type'] = 'gear';
    if (['weapon', 'armor', 'tool', 'gear', 'gold', 'pack'].includes(typePart)) {
      normalizedType = typePart as Background['equipment'][number]['type'];
    } else if (/\b(cp|sp|ep|gp|pp)\b/i.test(namePart)) {
      normalizedType = 'gold';
    }

    return {
      name: namePart,
      type: normalizedType,
      count: countPart ? Number(countPart) : undefined
    };
  });
};

const serializeBackgroundEquipment = (equipment: Background['equipment']) => {
  return equipment
    .map((item) => [item.name, item.type === 'gear' ? '' : item.type, item.count ? String(item.count) : ''].filter(Boolean).join(' | '))
    .join('\n');
};

const FieldHeading = ({ children }: Readonly<{ children: string }>) => {
  return <p className="text-sm font-medium">{children}</p>;
};

// Search-to-insert helper placed under a line-oriented Textarea: picking a
// suggestion appends one formatted line rather than editing the raw text,
// since these fields use a "name | type" / "name: description" line syntax
// that plain CSV autocomplete can't target.
const QuickAddLine = ({
  suggestions,
  placeholder,
  buildLine,
  appendTo
}: Readonly<{
  suggestions: readonly string[];
  placeholder: string;
  buildLine: (selected: string) => string;
  appendTo: (line: string) => void;
}>) => {
  const [query, setQuery] = useState('');
  return (
    <ComboboxInput
      value={query}
      onChange={setQuery}
      suggestions={suggestions}
      multiValue={false}
      placeholder={placeholder}
      onSelect={(selected) => {
        appendTo(buildLine(selected));
        setQuery('');
      }}
    />
  );
};

const appendLine = (existing: string, line: string) => (existing ? `${existing}\n${line}` : line);

const createEmptyBackgroundDraft = (): BackgroundDraft => ({
  id: '',
  name: '',
  description: '',
  skillProficiencies: '',
  toolProficiencies: '',
  languageCount: '',
  equipment: '',
  featureName: '',
  featureDescription: '',
  personalityTraits: '',
  ideals: '',
  bonds: '',
  flaws: ''
});

const createBackgroundDraft = (entry?: Background): BackgroundDraft => {
  if (!entry) return createEmptyBackgroundDraft();
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    skillProficiencies: entry.skillProficiencies.join(', '),
    toolProficiencies: entry.toolProficiencies?.join(', ') ?? '',
    languageCount: entry.languageCount ? String(entry.languageCount) : '',
    equipment: serializeBackgroundEquipment(entry.equipment),
    featureName: entry.feature.name,
    featureDescription: entry.feature.description,
    personalityTraits: entry.personalityTraits.join('\n'),
    ideals: entry.ideals.join('\n'),
    bonds: entry.bonds.join('\n'),
    flaws: entry.flaws.join('\n')
  };
};

const backgroundDraftToEntry = (draft: BackgroundDraft): Background => {
  const candidate: Background = {
    id: draft.id.trim() || slugify(draft.name),
    name: draft.name.trim(),
    description: draft.description.trim(),
    skillProficiencies: splitCsv(draft.skillProficiencies),
    toolProficiencies: splitCsv(draft.toolProficiencies),
    languageCount: draft.languageCount ? Number(draft.languageCount) : undefined,
    equipment: parseBackgroundEquipment(draft.equipment),
    feature: {
      name: draft.featureName.trim(),
      description: draft.featureDescription.trim()
    },
    personalityTraits: splitLines(draft.personalityTraits),
    ideals: splitLines(draft.ideals),
    bonds: splitLines(draft.bonds),
    flaws: splitLines(draft.flaws),
    source: 'Homebrew',
    sourceId: 'homebrew'
  };

  const result = backgroundSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(getValidationError('Background validation failed.', result.error.issues));
  }

  return result.data;
};

const createEmptySpellDraft = (): SpellDraft => ({
  id: '',
  name: '',
  level: '0',
  school: '',
  castingTime: '',
  range: '',
  components: '',
  duration: '',
  description: '',
  higherLevels: '',
  classes: '',
  ritual: false,
  concentration: false
});

const createSpellDraft = (entry?: Spell): SpellDraft => {
  if (!entry) return createEmptySpellDraft();
  return {
    id: entry.id,
    name: entry.name,
    level: String(entry.level),
    school: entry.school,
    castingTime: entry.castingTime,
    range: entry.range,
    components: entry.components.join(', '),
    duration: entry.duration,
    description: entry.description,
    higherLevels: entry.higherLevels ?? '',
    classes: entry.classes.join(', '),
    ritual: entry.ritual,
    concentration: entry.concentration
  };
};

const spellDraftToEntry = (draft: SpellDraft): Spell => {
  const candidate: Spell = {
    id: draft.id.trim() || slugify(draft.name),
    name: draft.name.trim(),
    level: Number(draft.level),
    school: draft.school.trim(),
    castingTime: draft.castingTime.trim(),
    range: draft.range.trim(),
    components: splitCsv(draft.components),
    duration: draft.duration.trim(),
    description: draft.description.trim(),
    higherLevels: draft.higherLevels.trim() || undefined,
    ritual: draft.ritual,
    concentration: draft.concentration,
    classes: splitCsv(draft.classes),
    source: 'Homebrew',
    sourceId: 'homebrew'
  };

  const result = spellSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(getValidationError('Spell validation failed.', result.error.issues));
  }

  return result.data;
};

const createEmptyFeatDraft = (): FeatDraft => ({
  id: '',
  name: '',
  description: '',
  prerequisitesClass: '',
  prerequisitesRace: '',
  prerequisitesLevel: '',
  abilityIncreaseAbility: '',
  abilityIncreaseAmount: '',
  features: ''
});

const createFeatDraft = (entry?: Feat): FeatDraft => {
  if (!entry) return createEmptyFeatDraft();
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    prerequisitesClass: entry.prerequisites?.class?.join(', ') ?? '',
    prerequisitesRace: entry.prerequisites?.race?.join(', ') ?? '',
    prerequisitesLevel: entry.prerequisites?.level ? String(entry.prerequisites.level) : '',
    abilityIncreaseAbility: entry.abilityScoreIncreases?.[0]?.ability === 'choose'
      ? ''
      : entry.abilityScoreIncreases?.[0]?.ability ?? '',
    abilityIncreaseAmount: entry.abilityScoreIncreases?.[0]?.amount ? String(entry.abilityScoreIncreases[0].amount) : '',
    features: serializeFeatureLines(entry.features)
  };
};

const featDraftToEntry = (draft: FeatDraft): Feat => {
  const normalizedAbility = abilityKeys.find((ability) => ability === draft.abilityIncreaseAbility);
  const candidate: Feat = {
    id: draft.id.trim() || slugify(draft.name),
    name: draft.name.trim(),
    description: draft.description.trim(),
    prerequisites: {
      class: splitCsv(draft.prerequisitesClass),
      race: splitCsv(draft.prerequisitesRace),
      level: draft.prerequisitesLevel ? Number(draft.prerequisitesLevel) : undefined
    },
    abilityScoreIncreases: normalizedAbility && draft.abilityIncreaseAmount
      ? [{ ability: normalizedAbility, amount: Number(draft.abilityIncreaseAmount) }]
      : undefined,
    features: parseFeatureLines(draft.features || draft.description, 'Homebrew', `${slugify(draft.name)}-feature`),
    source: 'Homebrew',
    sourceId: 'homebrew'
  };

  if (!candidate.prerequisites?.class?.length && !candidate.prerequisites?.race?.length && !candidate.prerequisites?.level) {
    delete candidate.prerequisites;
  }

  const result = featSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(getValidationError('Feat validation failed.', result.error.issues));
  }

  return result.data;
};

const createEmptyEquipmentDraft = (): EquipmentDraft => ({
  id: '',
  name: '',
  description: '',
  type: 'gear',
  costAmount: '0',
  costUnit: 'gp',
  weight: '0',
  weaponCategory: '',
  weaponType: '',
  damage: '',
  damageType: '',
  properties: '',
  rangeNormal: '',
  rangeLong: '',
  armorCategory: '',
  ac: '',
  maxDexBonus: '',
  strengthRequirement: '',
  stealthDisadvantage: false
});

const createEquipmentDraft = (entry?: Equipment): EquipmentDraft => {
  if (!entry) return createEmptyEquipmentDraft();
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description ?? '',
    type: entry.type,
    costAmount: String(entry.cost.amount),
    costUnit: entry.cost.unit,
    weight: String(entry.weight),
    weaponCategory: entry.weaponCategory ?? '',
    weaponType: entry.weaponType ?? '',
    damage: entry.damage ?? '',
    damageType: entry.damageType ?? '',
    properties: entry.properties?.join(', ') ?? '',
    rangeNormal: entry.range?.normal ? String(entry.range.normal) : '',
    rangeLong: entry.range?.long ? String(entry.range.long) : '',
    armorCategory: entry.armorCategory ?? '',
    ac: entry.ac ? String(entry.ac) : '',
    maxDexBonus: entry.maxDexBonus ? String(entry.maxDexBonus) : '',
    strengthRequirement: entry.strengthRequirement ? String(entry.strengthRequirement) : '',
    stealthDisadvantage: Boolean(entry.stealthDisadvantage)
  };
};

const equipmentDraftToEntry = (draft: EquipmentDraft): Equipment => {
  const candidate: Equipment = {
    id: draft.id.trim() || slugify(draft.name),
    name: draft.name.trim(),
    description: draft.description.trim() || undefined,
    type: draft.type,
    source: 'Homebrew',
    sourceId: 'homebrew',
    cost: {
      amount: Number(draft.costAmount),
      unit: draft.costUnit
    },
    weight: Number(draft.weight),
    weaponCategory: draft.weaponCategory ? draft.weaponCategory as Equipment['weaponCategory'] : undefined,
    weaponType: draft.weaponType ? draft.weaponType as Equipment['weaponType'] : undefined,
    damage: draft.damage.trim() || undefined,
    damageType: draft.damageType.trim() || undefined,
    properties: splitCsv(draft.properties),
    range: draft.rangeNormal ? { normal: Number(draft.rangeNormal), long: draft.rangeLong ? Number(draft.rangeLong) : undefined } : undefined,
    armorCategory: draft.armorCategory ? draft.armorCategory as Equipment['armorCategory'] : undefined,
    ac: draft.ac ? Number(draft.ac) : undefined,
    maxDexBonus: draft.maxDexBonus ? Number(draft.maxDexBonus) : undefined,
    strengthRequirement: draft.strengthRequirement ? Number(draft.strengthRequirement) : undefined,
    stealthDisadvantage: draft.stealthDisadvantage || undefined
  };

  if (!candidate.properties?.length) {
    delete candidate.properties;
  }

  const result = equipmentSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(getValidationError('Equipment validation failed.', result.error.issues));
  }

  return result.data;
};

const createEmptySpeciesDraft = (): SpeciesDraft => ({
  id: '',
  name: '',
  description: '',
  size: 'Medium',
  speed: '30',
  languages: '',
  proficiencies: '',
  abilityScoreIncreases: '',
  features: ''
});

const createSpeciesDraft = (entry?: Species): SpeciesDraft => {
  if (!entry) return createEmptySpeciesDraft();
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    size: entry.size,
    speed: String(entry.speed),
    languages: entry.languages.join(', '),
    proficiencies: entry.proficiencies?.map((prof) => `${prof.name}|${prof.type}`).join('\n') ?? '',
    abilityScoreIncreases: serializeAbilityScoreIncreaseLines(entry.abilityScoreIncreases),
    features: serializeFeatureLines(entry.features)
  };
};

const speciesDraftToEntry = (draft: SpeciesDraft): Species => {
  const candidate: Species = {
    id: draft.id.trim() || slugify(draft.name),
    name: draft.name.trim(),
    description: draft.description.trim(),
    size: draft.size,
    speed: Number(draft.speed),
    abilityScoreIncreases: parseAbilityScoreIncreaseLines(draft.abilityScoreIncreases),
    features: parseFeatureLines(draft.features, 'Homebrew', `${slugify(draft.name)}-feature`),
    proficiencies: splitLines(draft.proficiencies).map((line) => {
      const [name, type = 'skill'] = line.split('|').map((part) => part.trim());
      return {
        name,
        type: ['skill', 'tool', 'weapon', 'armor', 'language', 'save'].includes(type)
          ? type as 'skill' | 'tool' | 'weapon' | 'armor' | 'language' | 'save'
          : 'skill'
      };
    }),
    languages: splitCsv(draft.languages),
    variants: [],
    source: 'Homebrew',
    sourceId: 'homebrew'
  };

  if (!candidate.proficiencies?.length) {
    delete candidate.proficiencies;
  }

  const result = speciesSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(getValidationError('Species validation failed.', result.error.issues));
  }

  return result.data;
};

const createEmptyClassDraft = (): ClassDraft => ({
  id: '',
  name: '',
  description: '',
  hitDie: '8',
  primaryAbility: '',
  savingThrows: '',
  armorProficiencies: '',
  weaponProficiencies: '',
  toolProficiencies: '',
  skillChoices: '',
  skillCount: '2',
  subclassLevel: '3',
  features: '',
  equipmentOptions: '',
  startingGold: ''
});

const createClassDraft = (entry?: Class): ClassDraft => {
  if (!entry) return createEmptyClassDraft();
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    hitDie: String(entry.hitDie),
    primaryAbility: Array.isArray(entry.primaryAbility) ? entry.primaryAbility.join(', ') : entry.primaryAbility,
    savingThrows: entry.savingThrows.join(', '),
    armorProficiencies: entry.armorProficiencies.join(', '),
    weaponProficiencies: entry.weaponProficiencies.join(', '),
    toolProficiencies: entry.toolProficiencies?.join(', ') ?? '',
    skillChoices: entry.skillChoices.join(', '),
    skillCount: String(entry.skillCount),
    subclassLevel: String(entry.subclassLevel),
    features: serializeLevelFeatureLines(entry.features),
    equipmentOptions: serializeEquipmentOptionGroups(entry.equipmentOptions),
    startingGold: entry.startingGold ? String(entry.startingGold) : ''
  };
};

const classDraftToEntry = (draft: ClassDraft): Class => {
  const primaryAbilities = splitCsv(draft.primaryAbility).filter((ability): ability is keyof AbilityScores => abilityKeys.includes(ability as keyof AbilityScores));
  if (primaryAbilities.length === 0) {
    throw new Error('Add at least one primary ability.');
  }

  const candidate: Class = {
    id: draft.id.trim() || slugify(draft.name),
    name: draft.name.trim(),
    description: draft.description.trim(),
    hitDie: Number(draft.hitDie),
    primaryAbility: primaryAbilities.length === 1 ? primaryAbilities[0] : primaryAbilities,
    savingThrows: splitCsv(draft.savingThrows).filter((ability): ability is keyof AbilityScores => abilityKeys.includes(ability as keyof AbilityScores)),
    armorProficiencies: splitCsv(draft.armorProficiencies),
    weaponProficiencies: splitCsv(draft.weaponProficiencies),
    toolProficiencies: splitCsv(draft.toolProficiencies),
    skillChoices: splitCsv(draft.skillChoices),
    skillCount: Number(draft.skillCount),
    features: parseLevelFeatureLines(draft.features, 'Homebrew', `${slugify(draft.name)}-feature`),
    subclasses: [],
    subclassLevel: Number(draft.subclassLevel),
    equipmentOptions: parseEquipmentOptionGroups(draft.equipmentOptions),
    startingGold: draft.startingGold ? Number(draft.startingGold) : undefined,
    source: 'Homebrew',
    sourceId: 'homebrew'
  };

  if (!candidate.toolProficiencies?.length) {
    delete candidate.toolProficiencies;
  }

  const result = classSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(getValidationError('Class validation failed.', result.error.issues));
  }

  return result.data;
};

const createEmptySubclassDraft = (): SubclassDraft => ({
  id: '',
  classId: '',
  name: '',
  description: '',
  features: ''
});

const createSubclassDraft = (entry?: Subclass): SubclassDraft => {
  if (!entry) return createEmptySubclassDraft();
  return {
    id: entry.id,
    classId: entry.classId ?? '',
    name: entry.name,
    description: entry.description,
    features: serializeLevelFeatureLines(entry.features)
  };
};

const subclassDraftToEntry = (draft: SubclassDraft): Subclass => {
  if (!draft.classId.trim()) {
    throw new Error('Subclass entries need a parent class ID.');
  }

  const candidate: Subclass = {
    id: draft.id.trim() || slugify(draft.name),
    classId: draft.classId.trim(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    features: parseLevelFeatureLines(draft.features, 'Homebrew', `${slugify(draft.name)}-feature`),
    source: 'Homebrew',
    sourceId: 'homebrew'
  };

  const result = subclassSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(getValidationError('Subclass validation failed.', result.error.issues));
  }

  return result.data;
};

const createEmptyMonsterDraft = (): MonsterDraft => ({
  id: '',
  name: '',
  description: '',
  size: 'Medium',
  type: '',
  alignment: '',
  ac: '10',
  hpAverage: '1',
  hpFormula: '1d8',
  speed: '30 ft.',
  strength: '10',
  dexterity: '10',
  constitution: '10',
  intelligence: '10',
  wisdom: '10',
  charisma: '10',
  challengeRating: '0',
  savingThrows: '',
  skills: '',
  languages: '',
  senses: '',
  damageResistances: '',
  damageImmunities: '',
  conditionImmunities: '',
  traits: '',
  actions: ''
});

const createMonsterDraft = (entry?: Monster): MonsterDraft => {
  if (!entry) return createEmptyMonsterDraft();
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    size: entry.size,
    type: entry.type,
    alignment: entry.alignment,
    ac: String(entry.ac),
    hpAverage: String(entry.hp.average),
    hpFormula: entry.hp.formula,
    speed: entry.speed,
    strength: String(entry.abilityScores.strength),
    dexterity: String(entry.abilityScores.dexterity),
    constitution: String(entry.abilityScores.constitution),
    intelligence: String(entry.abilityScores.intelligence),
    wisdom: String(entry.abilityScores.wisdom),
    charisma: String(entry.abilityScores.charisma),
    challengeRating: entry.challengeRating,
    savingThrows: entry.savingThrows?.join(', ') ?? '',
    skills: entry.skills?.join(', ') ?? '',
    languages: entry.languages?.join(', ') ?? '',
    senses: entry.senses?.join(', ') ?? '',
    damageResistances: entry.damageResistances?.join(', ') ?? '',
    damageImmunities: entry.damageImmunities?.join(', ') ?? '',
    conditionImmunities: entry.conditionImmunities?.join(', ') ?? '',
    traits: serializeMonsterLines(entry.traits),
    actions: serializeMonsterLines(entry.actions)
  };
};

const monsterDraftToEntry = (draft: MonsterDraft): Monster => {
  const candidate: Monster = {
    id: draft.id.trim() || slugify(draft.name),
    name: draft.name.trim(),
    description: draft.description.trim(),
    size: draft.size,
    type: draft.type.trim(),
    alignment: draft.alignment.trim(),
    ac: Number(draft.ac),
    hp: {
      average: Number(draft.hpAverage),
      formula: draft.hpFormula.trim()
    },
    speed: draft.speed.trim(),
    abilityScores: {
      strength: Number(draft.strength),
      dexterity: Number(draft.dexterity),
      constitution: Number(draft.constitution),
      intelligence: Number(draft.intelligence),
      wisdom: Number(draft.wisdom),
      charisma: Number(draft.charisma)
    },
    savingThrows: splitCsv(draft.savingThrows),
    skills: splitCsv(draft.skills),
    damageResistances: splitCsv(draft.damageResistances),
    damageImmunities: splitCsv(draft.damageImmunities),
    conditionImmunities: splitCsv(draft.conditionImmunities),
    senses: splitCsv(draft.senses),
    languages: splitCsv(draft.languages),
    challengeRating: draft.challengeRating.trim(),
    traits: parseMonsterLines<MonsterTrait>(draft.traits, `${slugify(draft.name)}-trait`),
    actions: parseMonsterLines<MonsterAction>(draft.actions, `${slugify(draft.name)}-action`),
    source: 'Homebrew',
    sourceId: 'homebrew'
  };

  if (!candidate.savingThrows?.length) delete candidate.savingThrows;
  if (!candidate.skills?.length) delete candidate.skills;
  if (!candidate.damageResistances?.length) delete candidate.damageResistances;
  if (!candidate.damageImmunities?.length) delete candidate.damageImmunities;
  if (!candidate.conditionImmunities?.length) delete candidate.conditionImmunities;
  if (!candidate.senses?.length) delete candidate.senses;
  if (!candidate.languages?.length) delete candidate.languages;

  const result = monsterSchema.safeParse(candidate);
  if (!result.success) {
    throw new Error(getValidationError('Monster validation failed.', result.error.issues));
  }

  return result.data;
};

interface EditorPanelProps<T extends { id: string; name: string }, D> {
  title: string;
  description: string;
  entries: T[];
  createEmptyDraft: () => D;
  createDraft: (entry?: T) => D;
  saveDraft: (draft: D) => T;
  onSave: (entry: T) => void;
  onDelete: (id: string) => void;
  renderFields: (draft: D, setDraft: DraftSetter<D>) => ReactNode;
}

function EditorPanel<T extends { id: string; name: string }, D>({
  title,
  description,
  entries,
  createEmptyDraft,
  createDraft,
  saveDraft,
  onSave,
  onDelete,
  renderFields
}: Readonly<EditorPanelProps<T, D>>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<D>(createEmptyDraft());

  const sortedEntries = useMemo(() => {
    return [...entries].sort((left, right) => left.name.localeCompare(right.name));
  }, [entries]);

  const selectEntry = (entry?: T) => {
    if (!entry) {
      setSelectedId(null);
      setDraft(createEmptyDraft());
      return;
    }

    setSelectedId(entry.id);
    setDraft(createDraft(entry));
  };

  const handleSave = () => {
    try {
      const entry = saveDraft(draft);
      onSave(entry);
      setSelectedId(entry.id);
      setDraft(createDraft(entry));
      toast.success(`${entry.name} saved to homebrew.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save entry.');
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    onDelete(selectedId);
    toast.success('Homebrew entry removed.');
    selectEntry();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
            <Badge variant="secondary">{entries.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button type="button" className="w-full gap-2" onClick={() => selectEntry()}>
            <Plus className="h-4 w-4" />
            New Entry
          </Button>
          <div className="space-y-2">
            {sortedEntries.length > 0 ? (
              sortedEntries.map((entry) => {
                const active = entry.id === selectedId;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${active ? 'border-primary bg-primary/5' : 'hover:border-primary/40'}`}
                    onClick={() => selectEntry(entry)}
                  >
                    <div className="font-medium">{entry.name}</div>
                    <div className="text-xs text-muted-foreground">{entry.id}</div>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No entries yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{selectedId ? 'Edit Entry' : 'Create Entry'}</CardTitle>
          <CardDescription>All entries are saved into the persisted homebrew library immediately after validation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderFields(draft, setDraft)}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="button" className="gap-2" onClick={handleSave}>
              <Check className="h-4 w-4" />
              Save Entry
            </Button>
            {selectedId && (
              <Button type="button" variant="destructive" className="gap-2" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" />
                Delete Entry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const DraftCheckbox = ({
  checked,
  onCheckedChange,
  label
}: Readonly<{ checked: boolean; onCheckedChange: (next: boolean) => void; label: string }>) => {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
      {label}
    </label>
  );
};

export function HomebrewWorkbench() {
  const homebrewLibrary = useContentStore((state) => state.homebrewLibrary);
  const upsertHomebrewEntry = useContentStore((state) => state.upsertHomebrewEntry);
  const removeHomebrewEntry = useContentStore((state) => state.removeHomebrewEntry);
  const suggestions = useHomebrewSuggestions();
  const equipmentLibrary = useContentLibrary().equipment;
  const equipmentByName = useMemo(() => new Map(equipmentLibrary.map((entry) => [entry.name, entry])), [equipmentLibrary]);

  return (
    <Tabs defaultValue="backgrounds" className="space-y-4">
      {/* Eight labels never share a phone's width; without `flex-none` each one is centre-clipped
          into an unreadable fragment rather than the list scrolling. */}
      <TabsList className="flex h-auto w-full justify-start overscroll-x-contain whitespace-nowrap [&>*]:flex-none">
        <TabsTrigger value="backgrounds">Backgrounds</TabsTrigger>
        <TabsTrigger value="species">Species</TabsTrigger>
        <TabsTrigger value="classes">Classes</TabsTrigger>
        <TabsTrigger value="subclasses">Subclasses</TabsTrigger>
        <TabsTrigger value="spells">Spells</TabsTrigger>
        <TabsTrigger value="feats">Feats</TabsTrigger>
        <TabsTrigger value="equipment">Equipment</TabsTrigger>
        <TabsTrigger value="monsters">Monsters</TabsTrigger>
      </TabsList>

      <TabsContent value="backgrounds">
        <EditorPanel
          title="Backgrounds"
          description="Lowest-complexity builder content with direct runtime wiring into the existing background flow."
          entries={homebrewLibrary.backgrounds}
          createEmptyDraft={createEmptyBackgroundDraft}
          createDraft={createBackgroundDraft}
          saveDraft={backgroundDraftToEntry}
          onSave={(entry) => upsertHomebrewEntry('backgrounds', entry)}
          onDelete={(id) => removeHomebrewEntry('backgrounds', id)}
          renderFields={(draft, setDraft) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Name</FieldHeading>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>ID</FieldHeading>
                  <Input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="Auto-generated from name if empty" />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Description</FieldHeading>
                <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Skill Proficiencies</FieldHeading>
                  <ComboboxInput value={draft.skillProficiencies} onChange={(value) => setDraft((current) => ({ ...current, skillProficiencies: value }))} suggestions={suggestions.skills} placeholder="Insight, Persuasion" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Tool Proficiencies</FieldHeading>
                  <ComboboxInput value={draft.toolProficiencies} onChange={(value) => setDraft((current) => ({ ...current, toolProficiencies: value }))} suggestions={suggestions.toolProficiencies} placeholder="Thieves' tools, Herbalism kit" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Language Count</FieldHeading>
                  <Input type="number" value={draft.languageCount} onChange={(event) => setDraft((current) => ({ ...current, languageCount: event.target.value }))} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Background Feature Name</FieldHeading>
                  <Input value={draft.featureName} onChange={(event) => setDraft((current) => ({ ...current, featureName: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Background Feature Description</FieldHeading>
                <Textarea value={draft.featureDescription} onChange={(event) => setDraft((current) => ({ ...current, featureDescription: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldHeading>Equipment</FieldHeading>
                <Textarea value={draft.equipment} onChange={(event) => setDraft((current) => ({ ...current, equipment: event.target.value }))} placeholder="Traveler's clothes | gear&#10;10 gp | gold" />
                <QuickAddLine
                  suggestions={suggestions.equipmentNames}
                  placeholder="Search equipment to add a line…"
                  buildLine={(name) => `${name} | ${toEquipmentOptionType(equipmentByName.get(name)?.type ?? 'gear')}`}
                  appendTo={(line) => setDraft((current) => ({ ...current, equipment: appendLine(current.equipment, line) }))}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Personality Traits</FieldHeading>
                  <Textarea value={draft.personalityTraits} onChange={(event) => setDraft((current) => ({ ...current, personalityTraits: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Ideals</FieldHeading>
                  <Textarea value={draft.ideals} onChange={(event) => setDraft((current) => ({ ...current, ideals: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Bonds</FieldHeading>
                  <Textarea value={draft.bonds} onChange={(event) => setDraft((current) => ({ ...current, bonds: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Flaws</FieldHeading>
                  <Textarea value={draft.flaws} onChange={(event) => setDraft((current) => ({ ...current, flaws: event.target.value }))} />
                </div>
              </div>
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="species">
        <EditorPanel
          title="Species"
          description="Species entries feed directly into the runtime builder once saved. Variants can come in a later pass."
          entries={homebrewLibrary.species}
          createEmptyDraft={createEmptySpeciesDraft}
          createDraft={createSpeciesDraft}
          saveDraft={speciesDraftToEntry}
          onSave={(entry) => upsertHomebrewEntry('species', entry)}
          onDelete={(id) => removeHomebrewEntry('species', id)}
          renderFields={(draft, setDraft) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Name</FieldHeading>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>ID</FieldHeading>
                  <Input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="Auto-generated from name if empty" />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Description</FieldHeading>
                <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Size</FieldHeading>
                  <Select value={draft.size} onValueChange={(value) => setDraft((current) => ({ ...current, size: value as Species['size'] }))}>
                    <SelectTrigger className={surfaceSelectClassName}>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Small">Small</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldHeading>Speed</FieldHeading>
                  <Input type="number" min="0" value={draft.speed} onChange={(event) => setDraft((current) => ({ ...current, speed: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Languages</FieldHeading>
                  <ComboboxInput value={draft.languages} onChange={(value) => setDraft((current) => ({ ...current, languages: value }))} suggestions={suggestions.languages} placeholder="Common, Elvish" />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Ability Score Increases</FieldHeading>
                <Textarea value={draft.abilityScoreIncreases} onChange={(event) => setDraft((current) => ({ ...current, abilityScoreIncreases: event.target.value }))} placeholder="dexterity | 2&#10;choose | 1 | intelligence, wisdom | 1" />
                <QuickAddLine
                  suggestions={[...abilityKeys, 'choose']}
                  placeholder="Search an ability to add a line…"
                  buildLine={(ability) => (ability === 'choose' ? 'choose | 1 | ' : `${ability} | 1`)}
                  appendTo={(line) => setDraft((current) => ({ ...current, abilityScoreIncreases: appendLine(current.abilityScoreIncreases, line) }))}
                />
              </div>
              <div className="space-y-2">
                <FieldHeading>Proficiencies</FieldHeading>
                <Textarea value={draft.proficiencies} onChange={(event) => setDraft((current) => ({ ...current, proficiencies: event.target.value }))} placeholder="Perception | skill&#10;Longsword | weapon" />
                <QuickAddLine
                  suggestions={suggestions.proficiencyNames}
                  placeholder="Search a skill, tool, weapon, armor, or language to add a line…"
                  buildLine={(name) => `${name} | ${suggestions.resolveProficiencyType(name)}`}
                  appendTo={(line) => setDraft((current) => ({ ...current, proficiencies: appendLine(current.proficiencies, line) }))}
                />
              </div>
              <div className="space-y-2">
                <FieldHeading>Features</FieldHeading>
                <Textarea value={draft.features} onChange={(event) => setDraft((current) => ({ ...current, features: event.target.value }))} placeholder="Darkvision: You can see in dim light within 60 feet..." />
                <QuickAddLine
                  suggestions={suggestions.featureNames}
                  placeholder="Search existing feature names to add a line…"
                  buildLine={(name) => `${name}: `}
                  appendTo={(line) => setDraft((current) => ({ ...current, features: appendLine(current.features, line) }))}
                />
              </div>
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="classes">
        <EditorPanel
          title="Classes"
          description="Classes define the runtime builder shell. Subclasses are edited separately and attached by class ID."
          entries={homebrewLibrary.classes}
          createEmptyDraft={createEmptyClassDraft}
          createDraft={createClassDraft}
          saveDraft={classDraftToEntry}
          onSave={(entry) => upsertHomebrewEntry('classes', entry)}
          onDelete={(id) => removeHomebrewEntry('classes', id)}
          renderFields={(draft, setDraft) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Name</FieldHeading>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>ID</FieldHeading>
                  <Input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="Auto-generated from name if empty" />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Description</FieldHeading>
                <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Hit Die</FieldHeading>
                  <Input type="number" min="1" value={draft.hitDie} onChange={(event) => setDraft((current) => ({ ...current, hitDie: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Primary Ability</FieldHeading>
                  <ComboboxInput value={draft.primaryAbility} onChange={(value) => setDraft((current) => ({ ...current, primaryAbility: value }))} suggestions={abilityKeys} placeholder="strength or wisdom, charisma" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Saving Throws</FieldHeading>
                  <ComboboxInput value={draft.savingThrows} onChange={(value) => setDraft((current) => ({ ...current, savingThrows: value }))} suggestions={abilityKeys} placeholder="strength, constitution" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Armor Proficiencies</FieldHeading>
                  <ComboboxInput value={draft.armorProficiencies} onChange={(value) => setDraft((current) => ({ ...current, armorProficiencies: value }))} suggestions={suggestions.armorProficiencies} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Weapon Proficiencies</FieldHeading>
                  <ComboboxInput value={draft.weaponProficiencies} onChange={(value) => setDraft((current) => ({ ...current, weaponProficiencies: value }))} suggestions={suggestions.weaponProficiencies} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Tool Proficiencies</FieldHeading>
                  <ComboboxInput value={draft.toolProficiencies} onChange={(value) => setDraft((current) => ({ ...current, toolProficiencies: value }))} suggestions={suggestions.toolProficiencies} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Skill Choices</FieldHeading>
                  <ComboboxInput value={draft.skillChoices} onChange={(value) => setDraft((current) => ({ ...current, skillChoices: value }))} suggestions={suggestions.skills} placeholder="Arcana, History" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Skill Count</FieldHeading>
                  <Input type="number" min="0" value={draft.skillCount} onChange={(event) => setDraft((current) => ({ ...current, skillCount: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Subclass Level</FieldHeading>
                  <Input type="number" min="1" value={draft.subclassLevel} onChange={(event) => setDraft((current) => ({ ...current, subclassLevel: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Features</FieldHeading>
                <Textarea value={draft.features} onChange={(event) => setDraft((current) => ({ ...current, features: event.target.value }))} placeholder="1 | Fighting Style: Choose a style.&#10;2 | Action Surge: Push yourself beyond normal limits." />
                <QuickAddLine
                  suggestions={suggestions.featureNames}
                  placeholder="Search existing feature names to add a line…"
                  buildLine={(name) => `1 | ${name}: `}
                  appendTo={(line) => setDraft((current) => ({ ...current, features: appendLine(current.features, line) }))}
                />
              </div>
              <div className="space-y-2">
                <FieldHeading>Equipment Options</FieldHeading>
                <Textarea value={draft.equipmentOptions} onChange={(event) => setDraft((current) => ({ ...current, equipmentOptions: event.target.value }))} placeholder="Longsword | weapon || Battleaxe | weapon&#10;Explorer's Pack | pack || Dungeoneer's Pack | pack" />
                <QuickAddLine
                  suggestions={suggestions.equipmentNames}
                  placeholder="Search equipment to add a line…"
                  buildLine={(name) => `${name} | ${toEquipmentOptionType(equipmentByName.get(name)?.type ?? 'gear')}`}
                  appendTo={(line) => setDraft((current) => ({ ...current, equipmentOptions: appendLine(current.equipmentOptions, line) }))}
                />
              </div>
              <div className="space-y-2">
                <FieldHeading>Starting Gold</FieldHeading>
                <Input type="number" min="0" value={draft.startingGold} onChange={(event) => setDraft((current) => ({ ...current, startingGold: event.target.value }))} />
              </div>
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="subclasses">
        <EditorPanel
          title="Subclasses"
          description="Subclass entries attach to runtime classes by their class ID, which keeps them compatible with imported base classes too."
          entries={homebrewLibrary.subclasses}
          createEmptyDraft={createEmptySubclassDraft}
          createDraft={createSubclassDraft}
          saveDraft={subclassDraftToEntry}
          onSave={(entry) => upsertHomebrewEntry('subclasses', entry)}
          onDelete={(id) => removeHomebrewEntry('subclasses', id)}
          renderFields={(draft, setDraft) => (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Name</FieldHeading>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>ID</FieldHeading>
                  <Input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="Auto-generated from name if empty" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Parent Class ID</FieldHeading>
                  <ComboboxInput value={draft.classId} onChange={(value) => setDraft((current) => ({ ...current, classId: value }))} suggestions={suggestions.classIds} multiValue={false} placeholder="wizard" />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Description</FieldHeading>
                <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldHeading>Features</FieldHeading>
                <Textarea value={draft.features} onChange={(event) => setDraft((current) => ({ ...current, features: event.target.value }))} placeholder="3 | Awakened Spellbook: Your spellbook becomes arcane focus..." />
                <QuickAddLine
                  suggestions={suggestions.featureNames}
                  placeholder="Search existing feature names to add a line…"
                  buildLine={(name) => `1 | ${name}: `}
                  appendTo={(line) => setDraft((current) => ({ ...current, features: appendLine(current.features, line) }))}
                />
              </div>
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="spells">
        <EditorPanel
          title="Spells"
          description="Spell entries can be created now and are ready for future builder lookups and pack exports."
          entries={homebrewLibrary.spells}
          createEmptyDraft={createEmptySpellDraft}
          createDraft={createSpellDraft}
          saveDraft={spellDraftToEntry}
          onSave={(entry) => upsertHomebrewEntry('spells', entry)}
          onDelete={(id) => removeHomebrewEntry('spells', id)}
          renderFields={(draft, setDraft) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Name</FieldHeading>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>ID</FieldHeading>
                  <Input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="Auto-generated from name if empty" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Level</FieldHeading>
                  <Input type="number" min="0" value={draft.level} onChange={(event) => setDraft((current) => ({ ...current, level: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>School</FieldHeading>
                  <ComboboxInput value={draft.school} onChange={(value) => setDraft((current) => ({ ...current, school: value }))} suggestions={suggestions.spellSchools} multiValue={false} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Range</FieldHeading>
                  <ComboboxInput value={draft.range} onChange={(value) => setDraft((current) => ({ ...current, range: value }))} suggestions={suggestions.spellRanges} multiValue={false} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Casting Time</FieldHeading>
                  <ComboboxInput value={draft.castingTime} onChange={(value) => setDraft((current) => ({ ...current, castingTime: value }))} suggestions={suggestions.castingTimes} multiValue={false} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Duration</FieldHeading>
                  <ComboboxInput value={draft.duration} onChange={(value) => setDraft((current) => ({ ...current, duration: value }))} suggestions={suggestions.spellDurations} multiValue={false} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Components</FieldHeading>
                  <ComboboxInput value={draft.components} onChange={(value) => setDraft((current) => ({ ...current, components: value }))} suggestions={spellComponentOptions} placeholder="V, S, M" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Classes</FieldHeading>
                  <ComboboxInput value={draft.classes} onChange={(value) => setDraft((current) => ({ ...current, classes: value }))} suggestions={suggestions.classNames} placeholder="Wizard, Bard" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <DraftCheckbox checked={draft.ritual} onCheckedChange={(next) => setDraft((current) => ({ ...current, ritual: next }))} label="Ritual" />
                <DraftCheckbox checked={draft.concentration} onCheckedChange={(next) => setDraft((current) => ({ ...current, concentration: next }))} label="Concentration" />
              </div>
              <div className="space-y-2">
                <FieldHeading>Description</FieldHeading>
                <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <FieldHeading>Higher Levels</FieldHeading>
                <Textarea value={draft.higherLevels} onChange={(event) => setDraft((current) => ({ ...current, higherLevels: event.target.value }))} />
              </div>
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="feats">
        <EditorPanel
          title="Feats"
          description="Feat editing starts with prerequisites, optional ability boosts, and a simple feature list." 
          entries={homebrewLibrary.feats}
          createEmptyDraft={createEmptyFeatDraft}
          createDraft={createFeatDraft}
          saveDraft={featDraftToEntry}
          onSave={(entry) => upsertHomebrewEntry('feats', entry)}
          onDelete={(id) => removeHomebrewEntry('feats', id)}
          renderFields={(draft, setDraft) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Name</FieldHeading>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>ID</FieldHeading>
                  <Input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="Auto-generated from name if empty" />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Description</FieldHeading>
                <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Class Prerequisites</FieldHeading>
                  <ComboboxInput value={draft.prerequisitesClass} onChange={(value) => setDraft((current) => ({ ...current, prerequisitesClass: value }))} suggestions={suggestions.classNames} placeholder="Fighter, Ranger" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Race Prerequisites</FieldHeading>
                  <ComboboxInput value={draft.prerequisitesRace} onChange={(value) => setDraft((current) => ({ ...current, prerequisitesRace: value }))} suggestions={suggestions.speciesNames} placeholder="Elf, Dwarf" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Minimum Level</FieldHeading>
                  <Input type="number" min="0" value={draft.prerequisitesLevel} onChange={(event) => setDraft((current) => ({ ...current, prerequisitesLevel: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Ability Increase Ability</FieldHeading>
                  <ComboboxInput value={draft.abilityIncreaseAbility} onChange={(value) => setDraft((current) => ({ ...current, abilityIncreaseAbility: value }))} suggestions={abilityKeys} multiValue={false} placeholder="strength" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Ability Increase Amount</FieldHeading>
                  <Input type="number" min="1" value={draft.abilityIncreaseAmount} onChange={(event) => setDraft((current) => ({ ...current, abilityIncreaseAmount: event.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Features</FieldHeading>
                <Textarea value={draft.features} onChange={(event) => setDraft((current) => ({ ...current, features: event.target.value }))} placeholder="Guardian's Mark: When you hit a foe..." />
                <QuickAddLine
                  suggestions={suggestions.featureNames}
                  placeholder="Search existing feature names to add a line…"
                  buildLine={(name) => `${name}: `}
                  appendTo={(line) => setDraft((current) => ({ ...current, features: appendLine(current.features, line) }))}
                />
              </div>
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="equipment">
        <EditorPanel
          title="Equipment"
          description="Basic equipment authoring covers weapons, armor, tools, and general gear with source metadata." 
          entries={homebrewLibrary.equipment}
          createEmptyDraft={createEmptyEquipmentDraft}
          createDraft={createEquipmentDraft}
          saveDraft={equipmentDraftToEntry}
          onSave={(entry) => upsertHomebrewEntry('equipment', entry)}
          onDelete={(id) => removeHomebrewEntry('equipment', id)}
          renderFields={(draft, setDraft) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Name</FieldHeading>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>ID</FieldHeading>
                  <Input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="Auto-generated from name if empty" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Type</FieldHeading>
                  <Select value={draft.type} onValueChange={(value) => setDraft((current) => ({ ...current, type: value as Equipment['type'] }))}>
                    <SelectTrigger className={surfaceSelectClassName}>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gear">Gear</SelectItem>
                      <SelectItem value="weapon">Weapon</SelectItem>
                      <SelectItem value="armor">Armor</SelectItem>
                      <SelectItem value="shield">Shield</SelectItem>
                      <SelectItem value="tool">Tool</SelectItem>
                      <SelectItem value="consumable">Consumable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldHeading>Cost Amount</FieldHeading>
                  <Input type="number" min="0" value={draft.costAmount} onChange={(event) => setDraft((current) => ({ ...current, costAmount: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Cost Unit</FieldHeading>
                  <Select value={draft.costUnit} onValueChange={(value) => setDraft((current) => ({ ...current, costUnit: value as Equipment['cost']['unit'] }))}>
                    <SelectTrigger className={surfaceSelectClassName}>
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cp">cp</SelectItem>
                      <SelectItem value="sp">sp</SelectItem>
                      <SelectItem value="ep">ep</SelectItem>
                      <SelectItem value="gp">gp</SelectItem>
                      <SelectItem value="pp">pp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Weight</FieldHeading>
                  <Input type="number" min="0" value={draft.weight} onChange={(event) => setDraft((current) => ({ ...current, weight: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Weapon Category</FieldHeading>
                  <ComboboxInput value={draft.weaponCategory} onChange={(value) => setDraft((current) => ({ ...current, weaponCategory: value }))} suggestions={weaponCategoryOptions} multiValue={false} placeholder="simple or martial" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Weapon Type</FieldHeading>
                  <ComboboxInput value={draft.weaponType} onChange={(value) => setDraft((current) => ({ ...current, weaponType: value }))} suggestions={weaponTypeOptions} multiValue={false} placeholder="melee or ranged" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Damage</FieldHeading>
                  <Input value={draft.damage} onChange={(event) => setDraft((current) => ({ ...current, damage: event.target.value }))} placeholder="1d8" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Damage Type</FieldHeading>
                  <ComboboxInput value={draft.damageType} onChange={(value) => setDraft((current) => ({ ...current, damageType: value }))} suggestions={suggestions.damageTypes} multiValue={false} placeholder="slashing" />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Properties</FieldHeading>
                  <ComboboxInput value={draft.properties} onChange={(value) => setDraft((current) => ({ ...current, properties: value }))} suggestions={suggestions.weaponProperties} placeholder="light, finesse" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Range Normal</FieldHeading>
                  <Input type="number" min="0" value={draft.rangeNormal} onChange={(event) => setDraft((current) => ({ ...current, rangeNormal: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Range Long</FieldHeading>
                  <Input type="number" min="0" value={draft.rangeLong} onChange={(event) => setDraft((current) => ({ ...current, rangeLong: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Armor Category</FieldHeading>
                  <ComboboxInput value={draft.armorCategory} onChange={(value) => setDraft((current) => ({ ...current, armorCategory: value }))} suggestions={armorCategoryOptions} multiValue={false} placeholder="light, medium, heavy, shield" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldHeading>Armor Class</FieldHeading>
                  <Input type="number" min="0" value={draft.ac} onChange={(event) => setDraft((current) => ({ ...current, ac: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Max Dex Bonus</FieldHeading>
                  <Input type="number" min="0" value={draft.maxDexBonus} onChange={(event) => setDraft((current) => ({ ...current, maxDexBonus: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Strength Requirement</FieldHeading>
                  <Input type="number" min="0" value={draft.strengthRequirement} onChange={(event) => setDraft((current) => ({ ...current, strengthRequirement: event.target.value }))} />
                </div>
              </div>
              <DraftCheckbox checked={draft.stealthDisadvantage} onCheckedChange={(next) => setDraft((current) => ({ ...current, stealthDisadvantage: next }))} label="Stealth Disadvantage" />
              <div className="space-y-2">
                <FieldHeading>Description</FieldHeading>
                <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </div>
            </>
          )}
        />
      </TabsContent>

      <TabsContent value="monsters">
        <EditorPanel
          title="Monsters"
          description="Monster editing covers core stat block structure, traits, and actions for encounter notes and future builder tools."
          entries={homebrewLibrary.monsters}
          createEmptyDraft={createEmptyMonsterDraft}
          createDraft={createMonsterDraft}
          saveDraft={monsterDraftToEntry}
          onSave={(entry) => upsertHomebrewEntry('monsters', entry)}
          onDelete={(id) => removeHomebrewEntry('monsters', id)}
          renderFields={(draft, setDraft) => (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldHeading>Name</FieldHeading>
                  <Input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>ID</FieldHeading>
                  <Input value={draft.id} onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} placeholder="Auto-generated from name if empty" />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Description</FieldHeading>
                <Textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <FieldHeading>Size</FieldHeading>
                  <Select value={draft.size} onValueChange={(value) => setDraft((current) => ({ ...current, size: value as Monster['size'] }))}>
                    <SelectTrigger className={surfaceSelectClassName}>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Tiny">Tiny</SelectItem>
                      <SelectItem value="Small">Small</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Large">Large</SelectItem>
                      <SelectItem value="Huge">Huge</SelectItem>
                      <SelectItem value="Gargantuan">Gargantuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldHeading>Type</FieldHeading>
                  <ComboboxInput value={draft.type} onChange={(value) => setDraft((current) => ({ ...current, type: value }))} suggestions={suggestions.monsterTypes} multiValue={false} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Alignment</FieldHeading>
                  <ComboboxInput value={draft.alignment} onChange={(value) => setDraft((current) => ({ ...current, alignment: value }))} suggestions={suggestions.alignments} multiValue={false} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>Challenge Rating</FieldHeading>
                  <Input value={draft.challengeRating} onChange={(event) => setDraft((current) => ({ ...current, challengeRating: event.target.value }))} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <FieldHeading>Armor Class</FieldHeading>
                  <Input type="number" min="0" value={draft.ac} onChange={(event) => setDraft((current) => ({ ...current, ac: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <FieldHeading>HP Average</FieldHeading>
                  <Input type="number" min="1" value={draft.hpAverage} onChange={(event) => setDraft((current) => ({ ...current, hpAverage: event.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <FieldHeading>HP Formula</FieldHeading>
                  <Input value={draft.hpFormula} onChange={(event) => setDraft((current) => ({ ...current, hpFormula: event.target.value }))} placeholder="8d8 + 16" />
                </div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Speed</FieldHeading>
                <Input value={draft.speed} onChange={(event) => setDraft((current) => ({ ...current, speed: event.target.value }))} placeholder="30 ft., fly 60 ft." />
              </div>
              <div className="grid gap-4 md:grid-cols-6">
                <div className="space-y-2"><FieldHeading>STR</FieldHeading><Input type="number" value={draft.strength} onChange={(event) => setDraft((current) => ({ ...current, strength: event.target.value }))} /></div>
                <div className="space-y-2"><FieldHeading>DEX</FieldHeading><Input type="number" value={draft.dexterity} onChange={(event) => setDraft((current) => ({ ...current, dexterity: event.target.value }))} /></div>
                <div className="space-y-2"><FieldHeading>CON</FieldHeading><Input type="number" value={draft.constitution} onChange={(event) => setDraft((current) => ({ ...current, constitution: event.target.value }))} /></div>
                <div className="space-y-2"><FieldHeading>INT</FieldHeading><Input type="number" value={draft.intelligence} onChange={(event) => setDraft((current) => ({ ...current, intelligence: event.target.value }))} /></div>
                <div className="space-y-2"><FieldHeading>WIS</FieldHeading><Input type="number" value={draft.wisdom} onChange={(event) => setDraft((current) => ({ ...current, wisdom: event.target.value }))} /></div>
                <div className="space-y-2"><FieldHeading>CHA</FieldHeading><Input type="number" value={draft.charisma} onChange={(event) => setDraft((current) => ({ ...current, charisma: event.target.value }))} /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><FieldHeading>Saving Throws</FieldHeading><ComboboxInput value={draft.savingThrows} onChange={(value) => setDraft((current) => ({ ...current, savingThrows: value }))} suggestions={suggestions.monsterSavingThrows} /></div>
                <div className="space-y-2"><FieldHeading>Skills</FieldHeading><ComboboxInput value={draft.skills} onChange={(value) => setDraft((current) => ({ ...current, skills: value }))} suggestions={suggestions.monsterSkills} /></div>
                <div className="space-y-2"><FieldHeading>Languages</FieldHeading><ComboboxInput value={draft.languages} onChange={(value) => setDraft((current) => ({ ...current, languages: value }))} suggestions={suggestions.languages} /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><FieldHeading>Senses</FieldHeading><ComboboxInput value={draft.senses} onChange={(value) => setDraft((current) => ({ ...current, senses: value }))} suggestions={suggestions.senses} /></div>
                <div className="space-y-2"><FieldHeading>Damage Resistances</FieldHeading><ComboboxInput value={draft.damageResistances} onChange={(value) => setDraft((current) => ({ ...current, damageResistances: value }))} suggestions={suggestions.damageResistances} /></div>
                <div className="space-y-2"><FieldHeading>Damage Immunities</FieldHeading><ComboboxInput value={draft.damageImmunities} onChange={(value) => setDraft((current) => ({ ...current, damageImmunities: value }))} suggestions={suggestions.damageImmunities} /></div>
              </div>
              <div className="space-y-2">
                <FieldHeading>Condition Immunities</FieldHeading>
                <ComboboxInput value={draft.conditionImmunities} onChange={(value) => setDraft((current) => ({ ...current, conditionImmunities: value }))} suggestions={suggestions.conditionImmunities} />
              </div>
              <div className="space-y-2">
                <FieldHeading>Traits</FieldHeading>
                <Textarea value={draft.traits} onChange={(event) => setDraft((current) => ({ ...current, traits: event.target.value }))} placeholder="Magic Resistance: The monster has advantage on saving throws against spells..." />
                <QuickAddLine
                  suggestions={suggestions.monsterTraitNames}
                  placeholder="Search existing trait names to add a line…"
                  buildLine={(name) => `${name}: `}
                  appendTo={(line) => setDraft((current) => ({ ...current, traits: appendLine(current.traits, line) }))}
                />
              </div>
              <div className="space-y-2">
                <FieldHeading>Actions</FieldHeading>
                <Textarea value={draft.actions} onChange={(event) => setDraft((current) => ({ ...current, actions: event.target.value }))} placeholder="Multiattack: The monster makes two attacks.&#10;Bite: Melee Weapon Attack..." />
                <QuickAddLine
                  suggestions={suggestions.monsterActionNames}
                  placeholder="Search existing action names to add a line…"
                  buildLine={(name) => `${name}: `}
                  appendTo={(line) => setDraft((current) => ({ ...current, actions: appendLine(current.actions, line) }))}
                />
              </div>
            </>
          )}
        />
      </TabsContent>
    </Tabs>
  );
}