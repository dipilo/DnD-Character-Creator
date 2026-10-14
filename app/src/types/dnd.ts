// D&D 5e Character Builder Types

export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export type CharacterSpeciesSize = 'Small' | 'Medium' | 'Large';

export interface AbilityScoreIncrease {
  ability: keyof AbilityScores | 'choose';
  amount: number;
  chooseFrom?: (keyof AbilityScores)[];
  chooseCount?: number;
  /** The ceiling the source states for this increase, if it states one. */
  maximum?: number;
}

export interface Proficiency {
  name: string;
  type: 'skill' | 'tool' | 'weapon' | 'armor' | 'language' | 'save';
  category?: string;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  level: number;
  source: string;
  options?: FeatureOption[];
  chooseCount?: number;
  requiresChoice?: boolean;
  optional?: boolean;
  replacesFeatureIds?: string[];
}

export interface CharacterFeatureSelection {
  featureId: string;
  optionId?: string;
}

/** Each book labels these its own way; nothing about them is written in the app. */
export interface CombatAction {
  id: string;
  name: string;
  /** 'action' | 'bonus-action' | 'reaction', as the book labels it. */
  timing: string;
  /** The book's own one-line summary from its Actions table; 2014 prints none. */
  summary?: string;
  description: string;
  source: string;
  sourceId?: string;
}

export interface LanguageOption {
  id: string;
  name: string;
  /** 'standard' | 'rare', as each printing files it; 2014 titles its second table Exotic. */
  rarity: string;
  /** The book's own second column: 2024 prints Origin, 2014 Typical Speakers. */
  origin?: string;
  script?: string;
  /** The table's footnote, for a row that carries its marker (Primordial's dialects). */
  note?: string;
  source: string;
  sourceId?: string;
}

export interface FeatureOptionPrerequisites {
  text?: string;
  minimumLevel?: number;
  requiredOptionIds?: string[];
  requiredSpellIds?: string[];
}

export interface FeatureOption {
  id: string;
  name: string;
  description: string;
  prerequisites?: FeatureOptionPrerequisites;
}

export interface Subclass {
  id: string;
  classId?: string;
  name: string;
  description: string;
  features: Feature[];
  spellcasting?: SpellcastingProgression;
  resources?: ClassResource[];
  source?: string;
  sourceId?: string;
}

export interface SpellcastingProgression {
  ability: keyof AbilityScores;
  cantripsKnown?: number[];
  spellsKnown?: number[];
  spellSlots?: number[][];
  ritualCasting?: boolean;
  spellPreparation?: boolean;
}

export interface SpeciesVariant {
  id: string;
  name: string;
  description: string;
  abilityScoreIncreases?: AbilityScoreIncrease[];
  features: Feature[];
  proficiencies?: Proficiency[];
  spells?: SpeciesSpell[];
  sizeOptions?: CharacterSpeciesSize[];
}

export interface Species {
  id: string;
  name: string;
  description: string;
  size: CharacterSpeciesSize;
  sizeOptions?: CharacterSpeciesSize[];
  speed: number;
  abilityScoreIncreases: AbilityScoreIncrease[];
  features: Feature[];
  proficiencies?: Proficiency[];
  languages: string[];
  variants?: SpeciesVariant[];
  spells?: SpeciesSpell[];
  source: string;
  sourceId?: string;
}

export interface SpeciesSpell {
  name: string;
  level: number;
  atWill?: boolean;
  oncePerLongRest?: boolean;
  oncePerShortRest?: boolean;
}

export interface ClassFeature extends Feature {
  subclassId?: string;
}

export interface Class {
  id: string;
  name: string;
  description: string;
  hitDie: number;
  primaryAbility: keyof AbilityScores | (keyof AbilityScores)[];
  savingThrows: (keyof AbilityScores)[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies?: string[];
  skillChoices: string[];
  skillCount: number;
  /** Absent when the source states nothing, in which case the starting proficiencies apply. */
  multiclassProficiencies?: MulticlassProficiencies;
  /** Alternatives, each every ability it names at its minimum; absent when unstated. */
  multiclassPrerequisites?: AbilityScoreRequirement[];
  features: ClassFeature[];
  subclasses: Subclass[];
  subclassLevel: number;
  /** Pools the class table states: Rages, Ki Points, Channel Divinity, Second Wind. */
  resources?: ClassResource[];
  /** Dice the class table states: the Monk's Martial Arts die, the Rogue's Sneak Attack. */
  featureDice?: ClassFeatureDice[];
  spellcasting?: SpellcastingProgression;
  equipmentOptions: EquipmentOption[][];
  startingGold?: number;
  source: string;
  sourceId?: string;
}

export type AbilityScoreRequirement = Partial<Record<keyof AbilityScores, number>>;

export interface MulticlassProficiencies {
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies?: string[];
  /** Empty when the line grants no skill; the whole skill list when it says "of your choice". */
  skillChoices: string[];
  skillCount: number;
}

/** A feature stating no count, or no rest that returns the uses, has no tracker. */
export interface ClassResource {
  id: string;
  /** The column heading or the feature's name, which is what the tracker is labelled. */
  name: string;
  /** Index 0 is level 1; `null` is the book's "Unlimited". */
  perLevel: (number | null)[];
  /** The rest that returns every use. Null when the source states no recovery. */
  resetsOn: 'short' | 'long' | null;
  /** How many come back on a short rest when everything comes back on a long one. */
  shortRestRegain?: number;
  /** The level from which every use also comes back on a short rest (Font of Inspiration). */
  shortRestFromLevel?: number;
  /** "A number of times equal to 1 + your Charisma modifier (a minimum of once)". */
  usesFromAbility?: { ability: keyof AbilityScores; bonus: number; minimum: number };
  /** "A number of times equal to your proficiency bonus". */
  usesFromProficiencyBonus?: boolean;
  /** The feature the pool belongs to, for the tracker's subtitle. */
  featureName?: string;
}

/** Without this a level-20 Monk's Martial Arts reads 1d4. */
export interface ClassFeatureDice {
  id: string;
  /** The column heading. */
  name: string;
  /** Index 0 is level 1; `null` is the book's "Unlimited". */
  perLevel: (string | null)[];
  /** The feature the column belongs to, by the book's own cross-reference. */
  featureName: string;
}

export interface EquipmentOption {
  name: string;
  type: 'weapon' | 'armor' | 'tool' | 'gear' | 'gold' | 'pack';
  count?: number;
  alternatives?: EquipmentOption[];
  contents?: EquipmentOption[];
}

export interface Background {
  id: string;
  name: string;
  description: string;
  skillProficiencies: string[];
  /** What a background's own skill choice draws from; the pick is `backgroundSkillSelections`. */
  skillChoices?: string[];
  skillChoiceCount?: number;
  toolProficiencies?: string[];
  languageCount?: number;
  abilityScoreIncreases?: AbilityScoreIncrease[];
  /** Feats the background grants outright, by name so they resolve in whichever printing is in use. */
  grantedFeatNames?: string[];
  equipment: EquipmentOption[];
  feature: {
    name: string;
    description: string;
  };
  personalityTraits: string[];
  ideals: string[];
  bonds: string[];
  flaws: string[];
  suggestedCharacteristics?: string[];
  source: string;
  sourceId?: string;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string[];
  duration: string;
  description: string;
  higherLevels?: string;
  ritual: boolean;
  concentration: boolean;
  classes: string[];
  source: string;
  sourceId?: string;
}

/** Narrowed by whatever the feat's own line states; read by `lib/featBenefits.mjs`. */
export interface FeatSpellChoice {
  id: string;
  count: number;
  /** 0 is a cantrip. */
  level: number;
  classes?: string[];
  schools?: string[];
  /** "from the same list": the restriction is the previous choice's, not restated here. */
  inheritsListFromPreviousChoice?: boolean;
  /** The source's own phrase, which is what the selector is labelled with. */
  label: string;
}

/** "one Eldritch Invocation option of your choice from the warlock class" — a borrowed pool. */
export interface FeatOptionChoice {
  id: string;
  count: number;
  featureName: string;
  className: string;
  label: string;
}

export interface Feat {
  id: string;
  name: string;
  description: string;
  prerequisites?: {
    ability?: Partial<Record<keyof AbilityScores, number>>;
    level?: number;
    class?: string[];
    race?: string[];
    spellcasting?: boolean;
    pactMagic?: boolean;
    text?: string;
  };
  abilityScoreIncreases?: AbilityScoreIncrease[];
  /** A mode, not two grants; `abilityScoreChoiceModes` records the pick. */
  abilityScoreIncreaseAlternatives?: AbilityScoreIncrease[][];
  /** Spells the feat names outright, by name so they resolve in whichever edition is in use. */
  grantedSpells?: string[];
  spellChoices?: FeatSpellChoice[];
  optionChoices?: FeatOptionChoice[];
  features: Feature[];
  source: string;
  sourceId?: string;
}

/** The five coins both printings mint, smallest first. */
export type CoinUnit = 'cp' | 'sp' | 'ep' | 'gp' | 'pp';

export interface Equipment {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'tool' | 'gear' | 'consumable';
  source: string;
  sourceId?: string;
  cost: { amount: number; unit: CoinUnit };
  weight: number;
  description?: string;
  // Weapon properties
  weaponCategory?: 'simple' | 'martial';
  weaponType?: 'melee' | 'ranged';
  // Tool properties: which family a "one type of <x>" proficiency choice draws from,
  // e.g. "Artisan's Tools", "Gaming Sets", "Musical Instruments".
  toolCategory?: string;
  /** Without it "an arcane focus" has no candidates to offer. */
  gearCategory?: string;
  damage?: string;
  damageType?: string;
  /** Versatile's two-handed die, when the source states one. Never inferred from the die size. */
  versatileDamage?: string;
  properties?: string[];
  range?: { normal: number; long?: number };
  // Armor properties
  armorCategory?: 'light' | 'medium' | 'heavy' | 'shield';
  ac?: number;
  maxDexBonus?: number;
  strengthRequirement?: number;
  stealthDisadvantage?: boolean;
}

export interface MonsterTrait {
  id: string;
  name: string;
  description: string;
}

export interface MonsterAction extends MonsterTrait {
  attackBonus?: number;
  damage?: string;
}

export interface Monster {
  id: string;
  name: string;
  description: string;
  size: 'Tiny' | 'Small' | 'Medium' | 'Large' | 'Huge' | 'Gargantuan';
  type: string;
  alignment: string;
  ac: number;
  hp: {
    average: number;
    formula: string;
  };
  speed: string;
  abilityScores: AbilityScores;
  savingThrows?: string[];
  skills?: string[];
  damageVulnerabilities?: string[];
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses?: string[];
  languages?: string[];
  challengeRating: string;
  proficiencyBonus?: number;
  traits: MonsterTrait[];
  actions: MonsterAction[];
  bonusActions?: MonsterAction[];
  reactions?: MonsterAction[];
  legendaryActions?: MonsterAction[];
  source: string;
  sourceId?: string;
}

export interface CharacterClass {
  classId: string;
  subclassId?: string;
  level: number;
  hitDiceUsed: number;
  spellsKnown?: string[];
  preparedSpells?: string[];
  spellSlotsUsed?: number[];
}

export interface CharacterEquipment {
  equipmentId: string;
  quantity: number;
  equipped: boolean;
}

export interface CharacterSpell {
  spellId: string;
  prepared: boolean;
  alwaysPrepared?: boolean;
}

export interface CharacterFaction {
  name?: string;
  symbolImageDataUrl?: string;
}

export interface CharacterPortrait {
  imageDataUrl?: string;
}

export interface Character {
  id: string;
  name: string;
  avatar?: string;
  speciesId: string;
  variantId?: string;
  size?: CharacterSpeciesSize;
  backgroundId: string;
  classes: CharacterClass[];
  abilityScores: AbilityScores;
  abilityScoreBonuses: Partial<Record<keyof AbilityScores, number>>;
  abilityScoreChoiceModes?: Record<string, string>;
  abilityScoreChoiceSelections?: Record<string, (keyof AbilityScores)[]>;
  backgroundLanguageSelections?: string[];
  /** The skills picked for a background that states a choice rather than a pair of grants. */
  backgroundSkillSelections?: string[];
  speciesLanguageSelections?: string[];
  // Tool proficiencies granted as a choice ("One type of gaming set"), keyed by the choice's
  // stable slot id so background and class grants stay independent.
  toolProficiencySelections?: Record<string, string[]>;
  /** `proficiencies.skills` stays the starting class's picks. */
  multiclassSkillSelections?: Record<string, string[]>;
  /** The table has waived the multiclassing ability score minimums for this character. */
  multiclassPrerequisitesWaived?: boolean;
  /** The feat's, not a class's, so they count against no known or prepared limit. */
  featSpellSelections?: Record<string, string[]>;
  /** Apart from `proficiencies.skills`, or Expertise reads as a second grant. */
  expertiseSelections?: Record<string, string[]>;
  proficiencies: {
    skills: string[];
    tools: string[];
    languages: string[];
    armor: string[];
    weapons: string[];
    saves: (keyof AbilityScores)[];
  };
  equipment: CharacterEquipment[];
  spells: CharacterSpell[];
  feats: string[];
  features: CharacterFeatureSelection[];
  hp: {
    current: number;
    maximum: number;
    temporary: number;
  };
  /** Play state: lives on the document, so it round-trips through the builder and server. */
  deathSaves?: { successes: number; failures: number };
  inspiration?: boolean;
  /** 0–6; the 2014 and 2024 rules disagree on what a level does, not on how many there are. */
  exhaustion?: number;
  conditions?: string[];
  /** Character-level, not per class: a multiclass caster has one shared pool. */
  spellSlotsUsed?: number[];
  pactSlotsUsed?: number[];
  /** Keyed `<classId>::<resourceId>`; play state, so `buildReviewCharacter` must carry it. */
  classResourcesUsed?: Record<string, number>;
  /** Whether a pool can be entered is read from its feature's text, never named here. */
  activeEffects?: string[];
  /** One at a time: starting a second ends the first. */
  concentration?: { spellId: string; spellName: string; slotLevel: number };
  /** The purse, by coin. Absent means none of that coin, so a new character carries nothing. */
  currency?: Partial<Record<CoinUnit, number>>;
  personality?: {
    traits: string;
    ideals: string;
    bonds: string;
    flaws: string;
    appearance?: string;
    backstory?: string;
  };
  appearance?: {
    age?: string;
    height?: string;
    weight?: string;
    eyes?: string;
    skin?: string;
    hair?: string;
  };
  faction?: CharacterFaction;
  portrait?: CharacterPortrait;
  notes?: string;
  // How the base ability scores were generated, kept so reopening the character in the builder
  // restores the same entry mode instead of guessing from the numbers.
  abilityScoreMethod?: AbilityScoreMethod;
  rolledScores?: number[];
  rolledScoreAssignments?: Partial<Record<keyof AbilityScores, number>>;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterSummary {
  id: string;
  name: string;
  avatar?: string;
  speciesName: string;
  classSummary: string;
  level: number;
  createdAt: string;
  updatedAt: string;
}

export type BuilderStep = 
  | 'start'
  | 'species'
  | 'species-details'
  | 'class'
  | 'class-details'
  | 'subclass'
  | 'background'
  | 'background-details'
  | 'ability-scores'
  | 'spells'
  | 'equipment'
  | 'feats'
  // The rail's name for the Feats step, which is the route it actually navigates to. The builder
  // shell records the step here as the route changes, so a recovered draft resumes where it was.
  | 'advancements'
  | 'description'
  | 'review';

export type AbilityScoreMethod = 'standard' | 'point-buy' | 'rolled' | 'manual';

export interface RemoteEditTarget {
  id: string;
  version: number;
  /** The campaign whose party page it was opened from, and where saving returns to. */
  campaignId: number;
}

export interface BuilderState {
  currentStep: BuilderStep;
  character: Partial<Character>;
  // Set while the builder is editing a saved character; saving updates that character in place.
  editingCharacterId?: string;
  /** No local copy to write, so Review `PUT`s against the version it read. */
  remoteEditing?: RemoteEditTarget;
  /** Seeds `selectedSourceIds`; saving records the seat as pending for the sync layer. */
  forCampaignId?: number;
  forPlayerId?: number;
  forCampaignName?: string;
  selectedSourceIds: string[];
  selectedSpeciesId?: string;
  selectedVariantId?: string;
  selectedClassId?: string;
  selectedSubclassId?: string;
  selectedBackgroundId?: string;
  abilityScoreMethod: AbilityScoreMethod;
  rolledScores?: number[];
  rolledScoreAssignments?: Partial<Record<keyof AbilityScores, number>>;
  pointBuyRemaining?: number;
}
