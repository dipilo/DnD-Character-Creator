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
  features: ClassFeature[];
  subclasses: Subclass[];
  subclassLevel: number;
  spellcasting?: SpellcastingProgression;
  equipmentOptions: EquipmentOption[][];
  startingGold?: number;
  source: string;
  sourceId?: string;
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
  features: Feature[];
  source: string;
  sourceId?: string;
}

export interface Equipment {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'shield' | 'tool' | 'gear' | 'consumable';
  source: string;
  sourceId?: string;
  cost: { amount: number; unit: 'cp' | 'sp' | 'ep' | 'gp' | 'pp' };
  weight: number;
  description?: string;
  // Weapon properties
  weaponCategory?: 'simple' | 'martial';
  weaponType?: 'melee' | 'ranged';
  // Tool properties: which family a "one type of <x>" proficiency choice draws from,
  // e.g. "Artisan's Tools", "Gaming Sets", "Musical Instruments".
  toolCategory?: string;
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

export interface BuilderState {
  currentStep: BuilderStep;
  character: Partial<Character>;
  // Set while the builder is editing a saved character; saving updates that character in place.
  editingCharacterId?: string;
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
