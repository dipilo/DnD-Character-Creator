/**
 * What the character is carrying, and what it weighs.
 *
 * Derivation, not state: every weight comes from the catalogue entry the loadout already resolves,
 * and the purse is the one number a player types. Nothing here names an item — an entry the
 * catalogue does not know simply weighs nothing, the same way an unresolved spell prints only its
 * name.
 */
import type { ResolvedEquipmentSelection } from '@/lib/builderRules';
import type { Character, CoinUnit } from '@/types/dnd';
import { COIN_UNITS, getCoins } from '@/lib/sheetPlayState';

/** Both printings price a coin at a fiftieth of a pound, whichever metal it is struck from. */
export const COINS_PER_POUND = 50;

/** Carrying capacity is Strength times 15 in both printings. */
export const CAPACITY_PER_STRENGTH = 15;

/** The two marks the encumbrance rules state, as multiples of Strength. */
const ENCUMBERED_PER_STRENGTH = 5;
const HEAVILY_ENCUMBERED_PER_STRENGTH = 10;

export type EncumbranceLevel = 'unencumbered' | 'encumbered' | 'heavily-encumbered' | 'over-capacity';

export const ENCUMBRANCE_LABELS: Record<EncumbranceLevel, string> = {
  unencumbered: 'Unencumbered',
  encumbered: 'Encumbered',
  'heavily-encumbered': 'Heavily Encumbered',
  'over-capacity': 'Over capacity',
};

export interface DerivedEncumbrance {
  /** Pounds of equipment, before the purse. */
  gearWeight: number;
  coinWeight: number;
  totalWeight: number;
  capacity: number;
  encumberedAt: number;
  heavilyEncumberedAt: number;
  level: EncumbranceLevel;
}

const roundPounds = (pounds: number) => Math.round(pounds * 100) / 100;

/** One row's contribution: the catalogue weight, times however many of them are carried. */
export function deriveGearWeight(selections: readonly ResolvedEquipmentSelection[]): number {
  return roundPounds(
    selections.reduce((total, entry) => total + (entry.item?.weight ?? 0) * Math.max(0, entry.quantity), 0),
  );
}

export function countCoins(character: Pick<Character, 'currency'>): number {
  return COIN_UNITS.reduce((total, unit) => total + getCoins(character, unit), 0);
}

/** Total coins carried, converted to copper — what a purse is worth read as one number. */
const COPPER_VALUE: Record<CoinUnit, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };

/** The purse in gold pieces, which is the unit both books price things in. */
export function purseInGold(character: Pick<Character, 'currency'>): number {
  const copper = COIN_UNITS.reduce((total, unit) => total + getCoins(character, unit) * COPPER_VALUE[unit], 0);
  return roundPounds(copper / 100);
}

function levelFor(weight: number, strength: number): EncumbranceLevel {
  if (weight > strength * CAPACITY_PER_STRENGTH) return 'over-capacity';
  if (weight > strength * HEAVILY_ENCUMBERED_PER_STRENGTH) return 'heavily-encumbered';
  if (weight > strength * ENCUMBERED_PER_STRENGTH) return 'encumbered';
  return 'unencumbered';
}

export function deriveEncumbrance({
  character,
  selections,
  strength,
}: {
  character: Pick<Character, 'currency'>;
  selections: readonly ResolvedEquipmentSelection[];
  strength: number;
}): DerivedEncumbrance {
  const gearWeight = deriveGearWeight(selections);
  const coinWeight = roundPounds(countCoins(character) / COINS_PER_POUND);
  const totalWeight = roundPounds(gearWeight + coinWeight);
  return {
    gearWeight,
    coinWeight,
    totalWeight,
    capacity: strength * CAPACITY_PER_STRENGTH,
    encumberedAt: strength * ENCUMBERED_PER_STRENGTH,
    heavilyEncumberedAt: strength * HEAVILY_ENCUMBERED_PER_STRENGTH,
    level: levelFor(totalWeight, strength),
  };
}
