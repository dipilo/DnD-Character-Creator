import { getCharacterProficiencyBonus, skillNames } from '@/lib/builderRules';
import type { DerivedSense } from '@/lib/sheetCombat';
import type { ResolvedRollEffect } from '@/lib/rollEffects';
import type { AbilityScores, Character } from '@/types/dnd';
import { ABILITY_ORDER, abilityModifier, deriveSpellcastingStats, type DerivedSpellcastingStats, type ResolvedClassLike } from '@/lib/sheetMath';
import type { DerivedCharacterProficiencies } from '@/lib/builderRules';

/** All derived: play state lives on the document and in `lib/sheetPlayState.ts`. */

export const ABILITY_ABBREVIATIONS: Record<keyof AbilityScores, string> = {
  strength: 'STR',
  dexterity: 'DEX',
  constitution: 'CON',
  intelligence: 'INT',
  wisdom: 'WIS',
  charisma: 'CHA',
};

/** Identical in both printings, so it sits beside `skillNames` rather than per source. */
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
  /** The feature's Expertise covers it, so the proficiency bonus counts twice. */
  expertise: boolean;
  modifier: number;
}

export interface DerivedSave {
  ability: keyof AbilityScores;
  proficient: boolean;
  modifier: number;
}

/** Matched on the canonical skill list, so a tool or a placeholder is not scored at +0. */
function proficientSkillSet(proficiencies: DerivedCharacterProficiencies): Set<string> {
  const normalised = new Set(proficiencies.skills.map((skill) => skill.trim().toLowerCase()));
  return new Set(skillNames.filter((name) => normalised.has(name.toLowerCase())));
}

export function deriveSkills(
  abilityScores: AbilityScores,
  proficiencies: DerivedCharacterProficiencies,
  proficiencyBonus: number,
  /** Folded proficiency names the character has Expertise in (`expertiseProficiencyKeys`). */
  expertiseKeys: ReadonlySet<string> = new Set(),
): DerivedSkill[] {
  const proficient = proficientSkillSet(proficiencies);
  return skillNames.map((name) => {
    const ability = SKILL_ABILITIES[name];
    const isProficient = proficient.has(name);
    // Expertise doubles a bonus the character already has, so a skill they are not proficient in
    // gains nothing from a stale pick.
    const hasExpertise = isProficient && expertiseKeys.has(name.toLowerCase());
    const multiplier = hasExpertise ? 2 : 1;
    return {
      name,
      ability,
      proficient: isProficient,
      expertise: hasExpertise,
      modifier: abilityModifier(abilityScores[ability]) + (isProficient ? proficiencyBonus * multiplier : 0),
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
  /** What those features do to a d20 test: Silver Tongue's floor, Brave's advantage. */
  rollEffects: readonly ResolvedRollEffect[];
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
  rollEffects = [],
  expertiseKeys,
}: {
  abilityScores: AbilityScores;
  proficiencies: DerivedCharacterProficiencies;
  resolvedClasses: readonly ResolvedClassLike[];
  /** The species' walking speed; 30 is the fallback when no species is chosen yet. */
  speed: number;
  totalLevel: number;
  /** Passed in: `sheetCombat` reads its modifiers from here, so importing back is a cycle. */
  senses?: DerivedSense[];
  /** Read from the features by `resolveCharacterRollEffects`, and passed in for the same reason. */
  rollEffects?: readonly ResolvedRollEffect[];
  /** Passed in for the same reason: this module must not reach into the content library. */
  expertiseKeys?: ReadonlySet<string>;
}): SheetVitals {
  const proficiencyBonus = getCharacterProficiencyBonus(totalLevel);
  const skills = deriveSkills(abilityScores, proficiencies, proficiencyBonus, expertiseKeys);
  return {
    proficiencyBonus,
    initiative: abilityModifier(abilityScores.dexterity),
    speed,
    passivePerception: passiveScore(skills, 'Perception'),
    passiveInvestigation: passiveScore(skills, 'Investigation'),
    passiveInsight: passiveScore(skills, 'Insight'),
    senses,
    rollEffects,
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
