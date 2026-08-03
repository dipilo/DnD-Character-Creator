import { z } from 'zod';
import type {
  AbilityScoreIncrease,
  AbilityScores,
  Background,
  Class,
  Equipment,
  EquipmentOption,
  Feat,
  Feature,
  FeatureOption,
  Monster,
  MonsterAction,
  Proficiency,
  Species,
  SpeciesSpell,
  SpeciesVariant,
  Spell,
  SpellcastingProgression,
  Subclass
} from '@/types/dnd';
import type {
  ContentSourceCategory,
  ImportedContentBucket,
  ImportedContentDocument,
  ImportedContentMeta,
  ImportedContentSection
} from '@/data/librarySources';

export const canonicalSchemaVersion = 'ddbcc-v1' as const;

export const contentBucketKeys = [
  'species',
  'classes',
  'subclasses',
  'backgrounds',
  'spells',
  'equipment',
  'feats',
  'monsters',
  'ua'
] as const;

export type ContentBucketKey = (typeof contentBucketKeys)[number];

export const contentBucketLabels: Record<ContentBucketKey, string> = {
  species: 'Species',
  classes: 'Classes',
  subclasses: 'Subclasses',
  backgrounds: 'Backgrounds',
  spells: 'Spells',
  equipment: 'Equipment',
  feats: 'Feats',
  monsters: 'Monsters',
  ua: 'UA / Notes'
};

const abilityScoreKeySchema = z.enum([
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma'
]);

const featureOptionSchema: z.ZodType<FeatureOption> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  prerequisites: z.object({
    text: z.string().min(1).optional(),
    minimumLevel: z.number().int().positive().optional(),
    requiredOptionIds: z.array(z.string().min(1)).optional(),
    requiredSpellIds: z.array(z.string().min(1)).optional()
  }).optional()
});

const proficiencySchema: z.ZodType<Proficiency> = z.object({
  name: z.string().min(1),
  type: z.enum(['skill', 'tool', 'weapon', 'armor', 'language', 'save']),
  category: z.string().optional()
});

const abilityScoreIncreaseSchema: z.ZodType<AbilityScoreIncrease> = z.object({
  ability: z.union([abilityScoreKeySchema, z.literal('choose')]),
  amount: z.number(),
  chooseFrom: z.array(abilityScoreKeySchema).optional(),
  chooseCount: z.number().int().positive().optional()
});

const featureSchema: z.ZodType<Feature> = z.object({
  id: z.string().min(1),
  // Feat benefits are often unnamed bullets in the source; inventing "<Feat> Benefit 1" for them
  // only adds noise, so a nameless feature is valid as long as it carries a description.
  name: z.string(),
  description: z.string().min(1),
  level: z.number().int().nonnegative(),
  source: z.string().min(1),
  options: z.array(featureOptionSchema).optional(),
  chooseCount: z.number().int().positive().optional(),
  requiresChoice: z.boolean().optional(),
  optional: z.boolean().optional(),
  replacesFeatureIds: z.array(z.string().min(1)).optional()
});

const spellcastingProgressionSchema: z.ZodType<SpellcastingProgression> = z.object({
  ability: abilityScoreKeySchema,
  cantripsKnown: z.array(z.number().int().nonnegative()).optional(),
  spellsKnown: z.array(z.number().int().nonnegative()).optional(),
  spellSlots: z.array(z.array(z.number().int().nonnegative())).optional(),
  ritualCasting: z.boolean().optional(),
  spellPreparation: z.boolean().optional()
});

const speciesSpellSchema: z.ZodType<SpeciesSpell> = z.object({
  name: z.string().min(1),
  level: z.number().int().nonnegative(),
  atWill: z.boolean().optional(),
  oncePerLongRest: z.boolean().optional(),
  oncePerShortRest: z.boolean().optional()
});

const speciesVariantSchema: z.ZodType<SpeciesVariant> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  abilityScoreIncreases: z.array(abilityScoreIncreaseSchema).optional(),
  features: z.array(featureSchema),
  proficiencies: z.array(proficiencySchema).optional(),
  spells: z.array(speciesSpellSchema).optional()
});

export const speciesSchema: z.ZodType<Species> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  size: z.enum(['Small', 'Medium', 'Large']),
  speed: z.number().positive(),
  abilityScoreIncreases: z.array(abilityScoreIncreaseSchema),
  features: z.array(featureSchema),
  proficiencies: z.array(proficiencySchema).optional(),
  languages: z.array(z.string().min(1)),
  variants: z.array(speciesVariantSchema).optional(),
  spells: z.array(speciesSpellSchema).optional(),
  source: z.string().min(1),
  sourceId: z.string().min(1).optional()
});

const equipmentOptionSchema: z.ZodType<EquipmentOption> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    type: z.enum(['weapon', 'armor', 'tool', 'gear', 'gold', 'pack']),
    count: z.number().int().positive().optional(),
    alternatives: z.array(equipmentOptionSchema).optional()
  })
);

export const subclassSchema: z.ZodType<Subclass> = z.object({
  id: z.string().min(1),
  classId: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().min(1),
  features: z.array(featureSchema),
  spellcasting: spellcastingProgressionSchema.optional(),
  source: z.string().min(1).optional(),
  sourceId: z.string().min(1).optional()
});

export const classSchema: z.ZodType<Class> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  hitDie: z.number().int().positive(),
  primaryAbility: z.union([abilityScoreKeySchema, z.array(abilityScoreKeySchema)]),
  savingThrows: z.array(abilityScoreKeySchema),
  armorProficiencies: z.array(z.string().min(1)),
  weaponProficiencies: z.array(z.string().min(1)),
  toolProficiencies: z.array(z.string().min(1)).optional(),
  skillChoices: z.array(z.string().min(1)),
  skillCount: z.number().int().nonnegative(),
  features: z.array(featureSchema),
  subclasses: z.array(subclassSchema),
  subclassLevel: z.number().int().nonnegative(),
  spellcasting: spellcastingProgressionSchema.optional(),
  equipmentOptions: z.array(z.array(equipmentOptionSchema)),
  startingGold: z.number().nonnegative().optional(),
  source: z.string().min(1),
  sourceId: z.string().min(1).optional()
});

export const backgroundSchema: z.ZodType<Background> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  skillProficiencies: z.array(z.string().min(1)),
  toolProficiencies: z.array(z.string().min(1)).optional(),
  languageCount: z.number().int().nonnegative().optional(),
  abilityScoreIncreases: z.array(abilityScoreIncreaseSchema).optional(),
  equipment: z.array(equipmentOptionSchema),
  feature: z.object({
    name: z.string().min(1),
    description: z.string().min(1)
  }),
  personalityTraits: z.array(z.string().min(1)),
  ideals: z.array(z.string().min(1)),
  bonds: z.array(z.string().min(1)),
  flaws: z.array(z.string().min(1)),
  suggestedCharacteristics: z.array(z.string().min(1)).optional(),
  source: z.string().min(1),
  sourceId: z.string().min(1).optional()
});

export const spellSchema: z.ZodType<Spell> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  level: z.number().int().nonnegative(),
  school: z.string().min(1),
  castingTime: z.string().min(1),
  range: z.string().min(1),
  components: z.array(z.string().min(1)),
  duration: z.string().min(1),
  description: z.string().min(1),
  higherLevels: z.string().optional(),
  ritual: z.boolean(),
  concentration: z.boolean(),
  classes: z.array(z.string().min(1)),
  source: z.string().min(1),
  sourceId: z.string().min(1).optional()
});

export const featSchema: z.ZodType<Feat> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  prerequisites: z.object({
    ability: z.object({
      strength: z.number().optional(),
      dexterity: z.number().optional(),
      constitution: z.number().optional(),
      intelligence: z.number().optional(),
      wisdom: z.number().optional(),
      charisma: z.number().optional()
    }).optional(),
    level: z.number().int().nonnegative().optional(),
    class: z.array(z.string().min(1)).optional(),
    race: z.array(z.string().min(1)).optional(),
    spellcasting: z.boolean().optional(),
    pactMagic: z.boolean().optional(),
    text: z.string().min(1).optional()
  }).optional(),
  abilityScoreIncreases: z.array(abilityScoreIncreaseSchema).optional(),
  features: z.array(featureSchema),
  source: z.string().min(1),
  sourceId: z.string().min(1).optional()
});

export const equipmentSchema: z.ZodType<Equipment> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['weapon', 'armor', 'shield', 'tool', 'gear', 'consumable']),
  source: z.string().min(1),
  sourceId: z.string().min(1).optional(),
  cost: z.object({
    amount: z.number().nonnegative(),
    unit: z.enum(['cp', 'sp', 'ep', 'gp', 'pp'])
  }),
  weight: z.number().nonnegative(),
  description: z.string().optional(),
  weaponCategory: z.enum(['simple', 'martial']).optional(),
  weaponType: z.enum(['melee', 'ranged']).optional(),
  toolCategory: z.string().min(1).optional(),
  damage: z.string().optional(),
  damageType: z.string().optional(),
  properties: z.array(z.string().min(1)).optional(),
  range: z.object({ normal: z.number().nonnegative(), long: z.number().nonnegative().optional() }).optional(),
  armorCategory: z.enum(['light', 'medium', 'heavy', 'shield']).optional(),
  ac: z.number().nonnegative().optional(),
  maxDexBonus: z.number().nonnegative().optional(),
  strengthRequirement: z.number().nonnegative().optional(),
  stealthDisadvantage: z.boolean().optional()
});

const monsterTraitSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1)
});

const monsterActionSchema: z.ZodType<MonsterAction> = monsterTraitSchema.extend({
  attackBonus: z.number().optional(),
  damage: z.string().optional()
});

const abilityScoresSchema: z.ZodType<AbilityScores> = z.object({
  strength: z.number(),
  dexterity: z.number(),
  constitution: z.number(),
  intelligence: z.number(),
  wisdom: z.number(),
  charisma: z.number()
});

export const monsterSchema: z.ZodType<Monster> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  size: z.enum(['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan']),
  type: z.string().min(1),
  alignment: z.string().min(1),
  ac: z.number().nonnegative(),
  hp: z.object({
    average: z.number().nonnegative(),
    formula: z.string().min(1)
  }),
  speed: z.string().min(1),
  abilityScores: abilityScoresSchema,
  savingThrows: z.array(z.string().min(1)).optional(),
  skills: z.array(z.string().min(1)).optional(),
  damageVulnerabilities: z.array(z.string().min(1)).optional(),
  damageResistances: z.array(z.string().min(1)).optional(),
  damageImmunities: z.array(z.string().min(1)).optional(),
  conditionImmunities: z.array(z.string().min(1)).optional(),
  senses: z.array(z.string().min(1)).optional(),
  languages: z.array(z.string().min(1)).optional(),
  challengeRating: z.string().min(1),
  proficiencyBonus: z.number().nonnegative().optional(),
  traits: z.array(monsterTraitSchema),
  actions: z.array(monsterActionSchema),
  bonusActions: z.array(monsterActionSchema).optional(),
  reactions: z.array(monsterActionSchema).optional(),
  legendaryActions: z.array(monsterActionSchema).optional(),
  source: z.string().min(1),
  sourceId: z.string().min(1).optional()
});

export const importedContentBucketSchema: z.ZodType<ImportedContentBucket> = z.object({
  species: z.array(speciesSchema),
  classes: z.array(classSchema),
  subclasses: z.array(subclassSchema),
  backgrounds: z.array(backgroundSchema),
  spells: z.array(spellSchema),
  equipment: z.array(equipmentSchema),
  feats: z.array(featSchema),
  monsters: z.array(monsterSchema),
  ua: z.array(z.record(z.string(), z.unknown()))
});

export const importedContentSectionSchema: z.ZodType<ImportedContentSection> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  level: z.number().int().positive(),
  href: z.string().optional(),
  text: z.string().optional()
});

export const importedContentDocumentSchema: z.ZodType<ImportedContentDocument> = z.object({
  type: z.enum(['html', 'text', 'json']),
  title: z.string().min(1),
  path: z.string().optional(),
  contentExcerpt: z.string().optional(),
  sectionCount: z.number().int().nonnegative().optional()
});

export const importedContentMetaSchema: z.ZodType<ImportedContentMeta> = z.object({
  origin: z.enum(['manual', 'imported-json', 'parsed-html', 'generated', 'homebrew']).optional(),
  importedAt: z.string().optional(),
  parser: z.string().optional(),
  visibility: z.enum(['private', 'shared']).optional()
});

export const canonicalSourcePackageSchema = z.object({
  schemaVersion: z.literal(canonicalSchemaVersion),
  source: z.object({
    sourceId: z.string().min(1),
    label: z.string().min(1),
    category: z.enum(['core', 'supplement', 'expansion', 'basic', 'ua', 'homebrew'] satisfies [ContentSourceCategory, ...ContentSourceCategory[]]),
    aliases: z.array(z.string().min(1)).optional(),
    description: z.string().optional(),
    origin: z.enum(['manual', 'imported-json', 'parsed-html', 'generated', 'homebrew']).default('manual'),
    importedAt: z.string().optional(),
    parser: z.string().optional(),
    visibility: z.enum(['private', 'shared']).default('private')
  }),
  content: importedContentBucketSchema,
  sections: z.array(importedContentSectionSchema).default([]),
  documents: z.array(importedContentDocumentSchema).default([]),
  notes: z.array(z.string()).default([])
});

export type CanonicalSourcePackage = z.infer<typeof canonicalSourcePackageSchema>;

export const createEmptyImportedContentBucket = (): ImportedContentBucket => ({
  species: [],
  classes: [],
  subclasses: [],
  backgrounds: [],
  spells: [],
  equipment: [],
  feats: [],
  monsters: [],
  ua: []
});

export const createEmptyCanonicalSourcePackage = (
  source: Partial<CanonicalSourcePackage['source']> & Pick<CanonicalSourcePackage['source'], 'sourceId' | 'label'>
): CanonicalSourcePackage => ({
  schemaVersion: canonicalSchemaVersion,
  source: {
    sourceId: source.sourceId,
    label: source.label,
    category: source.category ?? 'supplement',
    aliases: source.aliases ?? [],
    description: source.description,
    origin: source.origin ?? 'manual',
    importedAt: source.importedAt,
    parser: source.parser,
    visibility: source.visibility ?? 'private'
  },
  content: createEmptyImportedContentBucket(),
  sections: [],
  documents: [],
  notes: []
});

export const createHomebrewSourcePackage = (
  label = 'Homebrew Library',
  overrides: Partial<CanonicalSourcePackage['source']> = {}
): CanonicalSourcePackage => {
  return createEmptyCanonicalSourcePackage({
    sourceId: overrides.sourceId ?? 'homebrew',
    label,
    category: 'homebrew',
    origin: 'homebrew',
    visibility: 'private',
    ...overrides
  });
};

export const countCanonicalPackEntries = (pack: Pick<CanonicalSourcePackage, 'content'>) => {
  return contentBucketKeys.reduce((total, bucket) => total + pack.content[bucket].length, 0);
};

export const summarizeCanonicalPack = (pack: Pick<CanonicalSourcePackage, 'content'>) => {
  return contentBucketKeys
    .map((bucket) => ({ bucket, count: pack.content[bucket].length }))
    .filter(({ count }) => count > 0);
};