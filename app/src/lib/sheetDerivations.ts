import { getCharacterProficiencyBonus, skillNames } from '@/lib/builderRules';
import type { DerivedSense } from '@/lib/sheetCombat';
import type { AbilityScores, Character } from '@/types/dnd';
import { ABILITY_ORDER, abilityModifier, deriveSpellcastingStats, type DerivedSpellcastingStats, type ResolvedClassLike } from '@/lib/sheetMath';
import type { DerivedCharacterProficiencies } from '@/lib/builderRules';

/**
 * The numbers a play-facing sheet leads with — skills, saving throws, initiative, the passive
 * scores, spell save DC — none of which the sheet showed before.
 *
 * All of it is derived. Nothing here is state: a value a player *changes* during play (current hit
 * points, death saves, spent slots) lives on the `Character` document and is manipulated by
 * `lib/sheetPlayState.ts`. Keep the two apart — a derivation that reads spent slots, or a tracker
 * that recomputes a modifier, is how the two halves start disagreeing.
 */

export const ABILITY_ABBREVIATIONS: Record<keyof AbilityScores, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

/**
 * Which ability each skill keys off. Fixed in both the 2014 and 2024 rules and identical between
 * them, so it lives beside `skillNames` in the same shape rather than being read per source.
 */
export const SKILL_ABILITIES: Record<string, keyof AbilityScores> = {
  Acrobatics: 'dexterity',
  'Animal Handling': 'wisdom',
  Arcana: 'intelligence',
  Athletics: 'strength',
  Deception: 'charisma',
  History: 'intelligence',
  Insight: 'wisdom',
  Intimidation: 'charisma',
  Investigation: 'intelligence',
  Medicine: 'wisdom',
  Nature: 'intelligence',
  Perception: 'wisdom',
  Performance: 'charisma',
  Persuasion: 'charisma',
  Religion: 'intelligence',
  'Sleight of Hand': 'dexterity',
  Stealth: 'dexterity',
  Survival: 'wisdom',
};

export {
  ABILITY_ORDER,
  abilityModifier,
  formatModifier,
  deriveAttacks,
  deriveSpellcastingStats,
  type DerivedAttack,
  type DerivedSpellcastingStats,
  type ResolvedClassLike,
  type ResolvedWeaponLike,
} from '@/lib/sheetMath';

export interface DerivedSkill {
  name: string;
  ability: keyof AbilityScores;
  proficient: boolean;
  modifier: number;
}

export interface DerivedSave {
  ability: keyof AbilityScores;
  proficient: boolean;
  modifier: number;
}

/**
 * A proficiency list carries entries the sheet cannot score — "One skill of your choice" if a
 * pending choice ever leaks through, or a tool name. Matching on the canonical skill list keeps
 * those out of the skill table instead of scoring them at +0.
 */
function proficientSkillSet(proficiencies: DerivedCharacterProficiencies): Set<string> {
  const normalised = new Set(proficiencies.skills.map((skill) => skill.trim().toLowerCase()));
  return new Set(skillNames.filter((name) => normalised.has(name.toLowerCase())));
}

export function deriveSkills(
  abilityScores: AbilityScores,
  proficiencies: DerivedCharacterProficiencies,
  proficiencyBonus: number,
): DerivedSkill[] {
  const proficient = proficientSkillSet(proficiencies);
  return skillNames.map((name) => {
    const ability = SKILL_ABILITIES[name];
    const isProficient = proficient.has(name);
    return {
      name,
      ability,
      proficient: isProficient,
      modifier: abilityModifier(abilityScores[ability]) + (isProficient ? proficiencyBonus : 0),
    };
  });
}

export function deriveSaves(
  abilityScores: AbilityScores,
  proficiencies: DerivedCharacterProficiencies,
  proficiencyBonus: number,
): DerivedSave[] {
  const proficient = new Set(proficiencies.saves);
  return ABILITY_ORDER.map((ability) => {
    const isProficient = proficient.has(ability);
    return {
      ability,
      proficient: isProficient,
      modifier: abilityModifier(abilityScores[ability]) + (isProficient ? proficiencyBonus : 0),
    };
  });
}

/** Passive score = 10 + the skill's modifier. Advantage is situational, so it is not applied. */
export function passiveScore(skills: DerivedSkill[], skillName: string): number {
  const skill = skills.find((entry) => entry.name === skillName);
  return 10 + (skill?.modifier ?? 0);
}

export interface DerivedHitDie {
  /** 'd8', from the class's hit die. */
  die: string;
  count: number;
  className: string;
}


/** One entry per class, because a multiclassed character rolls different dice on a short rest. */
export function deriveHitDice(resolvedClasses: readonly ResolvedClassLike[]): DerivedHitDie[] {
  return resolvedClasses
    .filter((entry) => entry.cls.hitDie > 0)
    .map((entry) => ({
      die: `d${entry.cls.hitDie}`,
      count: entry.entry.level,
      className: entry.cls.name,
    }));
}


export interface SheetVitals {
  proficiencyBonus: number;
  initiative: number;
  speed: number;
  passivePerception: number;
  passiveInvestigation: number;
  passiveInsight: number;
  /** Darkvision and its siblings, read from the character's own features. */
  senses: DerivedSense[];
  skills: DerivedSkill[];
  saves: DerivedSave[];
  hitDice: DerivedHitDie[];
  spellcasting: DerivedSpellcastingStats[];
}

export function deriveSheetVitals({
  abilityScores,
  proficiencies,
  resolvedClasses,
  speed,
  totalLevel,
  senses = [],
}: {
  abilityScores: AbilityScores;
  proficiencies: DerivedCharacterProficiencies;
  resolvedClasses: readonly ResolvedClassLike[];
  /** The species' walking speed; 30 is the fallback when no species is chosen yet. */
  speed: number;
  totalLevel: number;
  /**
   * Read from the features by `deriveSenses`, and passed in rather than derived here: this module
   * is what `sheetCombat` reads its modifiers from, so importing it back would be a cycle.
   */
  senses?: DerivedSense[];
}): SheetVitals {
  const proficiencyBonus = getCharacterProficiencyBonus(totalLevel);
  const skills = deriveSkills(abilityScores, proficiencies, proficiencyBonus);
  return {
    proficiencyBonus,
    initiative: abilityModifier(abilityScores.dexterity),
    speed,
    passivePerception: passiveScore(skills, 'Perception'),
    passiveInvestigation: passiveScore(skills, 'Investigation'),
    passiveInsight: passiveScore(skills, 'Insight'),
    senses,
    skills,
    saves: deriveSaves(abilityScores, proficiencies, proficiencyBonus),
    hitDice: deriveHitDice(resolvedClasses),
    spellcasting: deriveSpellcastingStats(abilityScores, proficiencyBonus, resolvedClasses),
  };
}

/** Total character level across every class — what the proficiency bonus keys off. */
export function totalCharacterLevel(character: Pick<Character, 'classes'>): number {
  return character.classes.reduce((total, entry) => total + entry.level, 0);
}
