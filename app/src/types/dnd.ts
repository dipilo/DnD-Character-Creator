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

/**
 * One of the actions every character can take, as the book lists them: the 2024 rules glossary
 * labels each with its own timing ("Dodge [Action]"), and the 2014 combat chapter collects them
 * under "Actions in Combat". Nothing about them is written in the app.
 */
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
  /**
   * What the class grants when it is not the character's first, read from the book's own
   * statement (the 2014 Multiclassing Proficiencies table; 2024's "As a Multiclass <Class>").
   * Absent when the source states nothing, in which case the starting proficiencies apply.
   */
  multiclassProficiencies?: MulticlassProficiencies;
  /**
   * Who may take the class after their first: alternatives, each every ability it names at its
   * minimum (Fighter: Strength 13 or Dexterity 13; Monk: Dexterity 13 and Wisdom 13). Read from
   * the 2014 table, 2024's primary-ability rule, or Tasha's sentence; absent when a source states
   * none.
   */
  multiclassPrerequisites?: AbilityScoreRequirement[];
  features: ClassFeature[];
  subclasses: Subclass[];
  subclassLevel: number;
  /** Pools the class table states: Rages, Ki Points, Channel Divinity, Second Wind. */
  resources?: ClassResource[];
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

/**
 * A pool a class or subclass states, read by the importer from a table column
 * (`extractClassResources`) or from the feature's own sentences (`scripts/lib/classResources.mjs`).
 * Nothing about these is written in the app: a feature whose text states no count, or no rest that
 * returns the uses, simply has no tracker.
 */
export interface ClassResource {
  id: string;
  /** The column heading or the feature's name, which is what the tracker is labelled. */
  name: string;
  /**
   * One entry per class level, index 0 being level 1. `null` is the book's "Unlimited". For a pool
   * sized by an ability or the proficiency bonus the entry only says whether it exists yet.
   */
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
  toolProficiencies?: string[];
  languageCount?: number;
  abilityScoreIncreases?: AbilityScoreIncrease[];
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

/**
 * A spell the feat leaves the player to pick, narrowed by whatever its own line states — a level,
 * a class's spell list, a school. Read out of the source by `scripts/lib/featBenefits.mjs`.
 */
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
  /**
   * Alternative increases the feat states as an either/or ("Increase one ability score by 2, or
   * increase two ability scores by 1"). The player picks which applies; `abilityScoreChoiceModes`
   * records it.
   */
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
  /**
   * The gear family a starting-equipment line can name instead of an item — "Arcane Foci",
   * "Druidic Foci", "Holy Symbols". 2014 states it as `gear_category`, 2024 lists it among
   * `equipment_categories`; without it "an arcane focus" has no candidates to offer.
   */
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
  speciesLanguageSelections?: string[];
  // Tool proficiencies granted as a choice ("One type of gaming set"), keyed by the choice's
  // stable slot id so background and class grants stay independent.
  toolProficiencySelections?: Record<string, string[]>;
  /**
   * The skill picked for a class taken after the first ("one skill from the class's skill list"),
   * keyed by class id. `proficiencies.skills` stays the starting class's picks.
   */
  multiclassSkillSelections?: Record<string, string[]>;
  /** The table has waived the multiclassing ability score minimums for this character. */
  multiclassPrerequisitesWaived?: boolean;
  /**
   * The spells picked for a feat's own spell lines ("one 1st-level spell of your choice"), keyed
   * by `FeatSpellChoice.id`. Kept apart from `spells` because these are the feat's, not the
   * class's: they do not count against a class's known or prepared limits.
   */
  featSpellSelections?: Record<string, string[]>;
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
  /*
   * Play state — what a player changes at the table rather than in the builder. It lives on the
   * document like everything else, so it round-trips through `loadCharacterIntoBuilder` and the
   * server, and a campaign-mate opening the sheet sees the same numbers.
   */
  deathSaves?: { successes: number; failures: number };
  inspiration?: boolean;
  /** 0–6; the 2014 and 2024 rules disagree on what a level does, not on how many there are. */
  exhaustion?: number;
  conditions?: string[];
  /**
   * Slots spent, indexed by slot level - 1 to match `slotsByLevel`. Character-level rather than
   * per class because a multiclass caster has one shared pool — which is exactly what
   * `getSpellcastingRulesSummary` computes. Pact slots are the separate pool the Warlock keeps.
   */
  spellSlotsUsed?: number[];
  pactSlotsUsed?: number[];
  /**
   * How much of each class resource is spent, keyed `<classId>::<resourceId>`. Play state, so the
   * sheet writes it and `buildReviewCharacter` has to carry it.
   */
  classResourcesUsed?: Record<string, number>;
  /**
   * Class resources the character is currently *in* rather than merely has left — a Barbarian's
   * Rage. Keyed the same way as `classResourcesUsed`. Whether a pool can be entered at all is read
   * from its feature's own text, so nothing here names a class feature.
   */
  activeEffects?: string[];
  /**
   * The spell this character is concentrating on. One at a time, which is the rule the field
   * exists to keep: starting a second ends the first.
   */
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
  /**
   * Set instead when the builder is editing someone else's character on a grant. There is no local
   * copy to write, so Review pushes a `PUT` against the version it read rather than going through
   * `characterStore`.
   */
  remoteEditing?: RemoteEditTarget;
  /**
   * The campaign this character is being built for (MERGE_PLAN.md Phase 5). Set by "new character
   * for this campaign", which also seeds `selectedSourceIds` from that campaign's allowed sources.
   * Saving records the seat as pending; the sync layer takes it once the server has the character.
   */
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
