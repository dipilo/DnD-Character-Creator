import { getCharacterProficiencyBonus, skillNames } from '@/lib/builderRules';
import type { AbilityScores, Character } from '@/types/dnd';
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

/* ------------------------------------------------------------------------- *
 * Attacks (NEXT_STEPS.md §5.4)
 *
 * Derivation, not new state: every input is already on the document or in the
 * equipment catalogue, so nothing here needs a schema change. Weapon *use* —
 * ammunition spent, a thrown dagger's whereabouts — is state and is not here.
 * ------------------------------------------------------------------------- */

export interface DerivedAttack {
  name: string;
  /** 'Melee Weapon Attack' / 'Ranged Weapon Attack', in the books' own words. */
  kind: string;
  /** To-hit, already including proficiency when the character has it. */
  attackBonus: number;
  /** '1d8+3 slashing', or '1d8 slashing' when the ability modifier is 0. */
  damage: string;
  /** Versatile's two-handed line, when the weapon has one. */
  versatileDamage?: string;
  /** Which ability the attack uses, after finesse has picked the better of the two. */
  ability: keyof AbilityScores;
  proficient: boolean;
  /** '20/60 ft.' for a ranged or thrown weapon. */
  range?: string;
  properties: string[];
}

/** The shape this module needs out of `ResolvedEquipmentSelection`. */
export interface ResolvedWeaponLike {
  name: string;
  equipped: boolean;
  item?: {
    name: string;
    type: string;
    weaponCategory?: 'simple' | 'martial';
    weaponType?: 'melee' | 'ranged';
    damage?: string;
    damageType?: string;
    versatileDamage?: string;
    properties?: string[];
    range?: { normal: number; long?: number };
  };
}

const hasProperty = (properties: string[] | undefined, name: string) =>
  (properties ?? []).some((entry) => entry.toLowerCase().includes(name));

/**
 * Which ability a weapon attacks with. Finesse is the only rule that lets the player choose, and
 * the choice is always "whichever is better", so it needs no stored decision.
 */
function attackAbility(item: NonNullable<ResolvedWeaponLike['item']>, abilityScores: AbilityScores): keyof AbilityScores {
  const strength = abilityModifier(abilityScores.strength);
  const dexterity = abilityModifier(abilityScores.dexterity);
  if (hasProperty(item.properties, 'finesse')) {
    return dexterity > strength ? 'dexterity' : 'strength';
  }
  // A thrown melee weapon still uses Strength; only a true ranged weapon switches to Dexterity.
  return item.weaponType === 'ranged' ? 'dexterity' : 'strength';
}

/** "1d8" plus a modifier, plus the damage type — the line the books print. */
function damageLine(dice: string | undefined, modifier: number, damageType: string | undefined): string {
  const base = dice?.trim() || '—';
  const withModifier = modifier === 0 ? base : `${base}${formatModifier(modifier)}`;
  return damageType ? `${withModifier} ${damageType.toLowerCase()}` : withModifier;
}

/**
 * Versatile's two-handed die. The SRD records it as `two_handed_damage` and the generator now
 * carries it through as `versatileDamage`; some imported HTML packs instead put it in the property
 * text ("Versatile (1d10)"). Both are read. Nothing is inferred from the one-handed die — a weapon
 * whose source never stated the larger die simply shows no two-handed line.
 */
function versatileDice(item: NonNullable<ResolvedWeaponLike['item']>): string | undefined {
  if (item.versatileDamage?.trim()) return item.versatileDamage.trim();
  for (const property of item.properties ?? []) {
    const match = /versatile\s*\(([^)]+)\)/i.exec(property);
    if (match) return match[1].trim();
  }
  return undefined;
}

/**
 * Whether the character is proficient with a weapon. Class weapon proficiencies are printed as
 * categories ("Simple weapons", "Martial weapons") and as individual names ("Longsword"), so both
 * have to be matched — a Bard proficient in longswords by name is not proficient in martial ones.
 */
function isProficientWithWeapon(item: NonNullable<ResolvedWeaponLike['item']>, weaponProficiencies: string[]): boolean {
  const normalised = weaponProficiencies.map((entry) => entry.toLowerCase());
  const itemName = item.name.toLowerCase();
  if (normalised.some((entry) => entry === itemName || entry === `${itemName}s`)) return true;
  if (!item.weaponCategory) return false;
  return normalised.some((entry) => entry.includes(item.weaponCategory as string) && entry.includes('weapon'));
}

function formatRange(item: NonNullable<ResolvedWeaponLike['item']>): string | undefined {
  if (!item.range?.normal) return undefined;
  return item.range.long ? `${item.range.normal}/${item.range.long} ft.` : `${item.range.normal} ft.`;
}

/**
 * One row per equipped weapon. Only equipped weapons: an attack panel listing the spare shortbow
 * in the pack is the thing that makes D&D Beyond's own panel hard to read.
 */
export function deriveAttacks({
  equipment,
  abilityScores,
  proficiencyBonus,
  weaponProficiencies,
}: {
  equipment: readonly ResolvedWeaponLike[];
  abilityScores: AbilityScores;
  proficiencyBonus: number;
  weaponProficiencies: string[];
}): DerivedAttack[] {
  const attacks: DerivedAttack[] = [];

  for (const selection of equipment) {
    const item = selection.item;
    if (!item || item.type !== 'weapon' || !selection.equipped) continue;

    const ability = attackAbility(item, abilityScores);
    const modifier = abilityModifier(abilityScores[ability]);
    const proficient = isProficientWithWeapon(item, weaponProficiencies);
    const twoHanded = versatileDice(item);

    attacks.push({
      name: selection.name || item.name,
      kind: item.weaponType === 'ranged' ? 'Ranged Weapon Attack' : 'Melee Weapon Attack',
      attackBonus: modifier + (proficient ? proficiencyBonus : 0),
      damage: damageLine(item.damage, modifier, item.damageType),
      versatileDamage: twoHanded ? damageLine(twoHanded, modifier, item.damageType) : undefined,
      ability,
      proficient,
      range: formatRange(item),
      properties: item.properties ?? [],
    });
  }

  return attacks.sort((left, right) => left.name.localeCompare(right.name));
}
