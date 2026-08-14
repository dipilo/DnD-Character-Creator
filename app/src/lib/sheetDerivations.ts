import { getCharacterProficiencyBonus, skillNames } from '@/lib/builderRules';
import type { AbilityScores, Character } from '@/types/dnd';
import type { DerivedCharacterProficiencies } from '@/lib/builderRules';

/**
 * The numbers a play-facing sheet leads with — skills, saving throws, initiative, the passive
 * scores, spell save DC — none of which the sheet showed before.
 *
 * All of it is derived. Nothing here is state: a value a player *changes* during play (current hit
 * points, death saves, spent slots) belongs on the `Character` document, and is deliberately not
 * invented here. See KIDS_ON_BIKES.md / SHEET_PARITY.md for the tracker work that needs those.
 */

export const ABILITY_ORDER: ReadonlyArray<keyof AbilityScores> = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];

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

export const abilityModifier = (score: number): number => Math.floor((score - 10) / 2);
export const formatModifier = (modifier: number): string =>
  modifier >= 0 ? `+${modifier}` : `${modifier}`;

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

/**
 * The shape this module needs out of `ResolvedCharacterClass` — the level lives on `entry`, not
 * on the class, because the class is the printing and the entry is this character's take on it.
 */
export interface ResolvedClassLike {
  entry: { level: number };
  cls: { name: string; hitDie: number; spellcasting?: { ability?: string } | null };
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

export interface DerivedSpellcastingStats {
  className: string;
  ability: keyof AbilityScores;
  saveDc: number;
  attackBonus: number;
}

/**
 * Save DC and attack bonus per spellcasting class. Two casting classes have two of each, which is
 * why this is a list — a single "spell save DC" on the sheet is wrong for a multiclass caster.
 */
export function deriveSpellcastingStats(
  abilityScores: AbilityScores,
  proficiencyBonus: number,
  resolvedClasses: readonly ResolvedClassLike[],
): DerivedSpellcastingStats[] {
  const stats: DerivedSpellcastingStats[] = [];
  for (const entry of resolvedClasses) {
    const abilityName = entry.cls.spellcasting?.ability?.toLowerCase();
    if (!abilityName) continue;
    const ability = ABILITY_ORDER.find((candidate) => candidate === abilityName);
    if (!ability) continue;
    const modifier = abilityModifier(abilityScores[ability]);
    stats.push({
      className: entry.cls.name,
      ability,
      saveDc: 8 + proficiencyBonus + modifier,
      attackBonus: proficiencyBonus + modifier,
    });
  }
  return stats;
}

export interface SheetVitals {
  proficiencyBonus: number;
  initiative: number;
  speed: number;
  passivePerception: number;
  passiveInvestigation: number;
  passiveInsight: number;
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
}: {
  abilityScores: AbilityScores;
  proficiencies: DerivedCharacterProficiencies;
  resolvedClasses: readonly ResolvedClassLike[];
  /** The species' walking speed; 30 is the fallback when no species is chosen yet. */
  speed: number;
  totalLevel: number;
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
