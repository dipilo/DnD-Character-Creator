// Sheet arithmetic; every import must stay a `type` import or the bot's load breaks.
import type { AbilityScores } from '@/types/dnd';

export const ABILITY_ORDER: ReadonlyArray<keyof AbilityScores> = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];

export const abilityModifier = (score: number): number => Math.floor((score - 10) / 2);
export const formatModifier = (modifier: number): string =>
  modifier >= 0 ? `+${modifier}` : `${modifier}`;

/** Both printings: +2 at 1st, +1 every four levels. */
export const getCharacterProficiencyBonus = (totalLevel: number): number => Math.ceil(totalLevel / 4) + 1;

/** The level lives on `entry`: the class is the printing, the entry this character's take. */
export interface ResolvedClassLike {
  entry: { level: number };
  cls: { name: string; hitDie: number; spellcasting?: { ability?: string } | null };
}

export interface DerivedSpellcastingStats {
  className: string;
  ability: keyof AbilityScores;
  saveDc: number;
  attackBonus: number;
}

/** A list: one "spell save DC" is wrong for a multiclass caster. */
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

/** Derived, not an item to remember: both printings state the same damage. */
export function deriveUnarmedStrike(
  abilityScores: AbilityScores,
  proficiencyBonus: number
): DerivedAttack {
  const strength = abilityModifier(abilityScores.strength);
  return {
    name: 'Unarmed Strike',
    kind: 'Melee Weapon Attack',
    attackBonus: strength + proficiencyBonus,
    damage: `${1 + strength} bludgeoning`,
    ability: 'strength',
    proficient: true,
    properties: []
  };
}

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

/** Finesse is the only choice, and it is always "whichever is better", so nothing is stored. */
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

/** Both the structured field and the property text are read; nothing is inferred. */
function versatileDice(item: NonNullable<ResolvedWeaponLike['item']>): string | undefined {
  if (item.versatileDamage?.trim()) return item.versatileDamage.trim();
  for (const property of item.properties ?? []) {
    const match = /versatile\s*\(([^)]+)\)/i.exec(property);
    if (match) return match[1].trim();
  }
  return undefined;
}

/** Categories and individual names both have to match. */
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

/** Equipped only: listing the spare shortbow is what makes DDB's panel hard to read. */
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
