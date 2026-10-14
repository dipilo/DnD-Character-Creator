/** The modifier is the notation's, not a die's: dice-box resolves without it. */

export interface DiceNotationGroup {
  qty: number;
  sides: number;
}

export interface ParsedDiceNotation {
  groups: DiceNotationGroup[];
  /** The sum of every flat `+n` / `-n` term in the notation. */
  modifier: number;
}

export interface DiceRollResult {
  value?: number;
  sides?: number;
  modifier?: number;
  /** dice-box's handle on a die still on the surface. Absent on an instantly-resolved roll. */
  rollId?: number;
}

const MAX_DICE = 100;
const termPattern = /([+-]?)\s*(?:(\d*)\s*[dD]\s*(\d+|%)|(\d+))/g;

/** Returns null when the notation names no dice or asks for more than the surface can render. */
export function parseDiceNotation(notation: string): ParsedDiceNotation | null {
  const groups: DiceNotationGroup[] = [];
  let modifier = 0;
  let diceCount = 0;

  for (const match of notation.matchAll(termPattern)) {
    const [, sign, qtyText, sidesText, flatText] = match;
    const negative = sign === '-';

    if (flatText !== undefined) {
      modifier += negative ? -Number.parseInt(flatText, 10) : Number.parseInt(flatText, 10);
      continue;
    }

    // A leading minus on a die term ("1d20-1d4") is not something the 3D surface can throw, and
    // guessing at it would report a total the dice on screen do not add up to.
    if (negative) return null;

    const qty = qtyText ? Number.parseInt(qtyText, 10) : 1;
    const sides = sidesText === '%' ? 100 : Number.parseInt(sidesText, 10);
    if (!Number.isInteger(qty) || qty < 1 || !Number.isInteger(sides) || sides < 2) return null;

    diceCount += qty;
    if (diceCount > MAX_DICE) return null;
    groups.push({ qty, sides });
  }

  return groups.length > 0 ? { groups, modifier } : null;
}

/** Every die the notation asks for, flattened to a list of side counts. */
export function expandDiceNotation(notation: string): number[] | null {
  const parsed = parseDiceNotation(notation);
  if (!parsed) return null;

  const dice = parsed.groups.flatMap((group) => Array.from({ length: group.qty }, () => group.sides));
  return dice.length > 0 ? dice : null;
}

/** Not cryptographic on purpose: a dice roll gates nothing. */
export function rollDiceNotation(notation: string): DiceRollResult[] | null {
  const parsed = parseDiceNotation(notation);
  if (!parsed) return null;

  return parsed.groups.flatMap((group) =>
    Array.from({ length: group.qty }, () => ({
      value: 1 + Math.floor(Math.random() * group.sides),
      sides: group.sides,
    })),
  );
}

/** A bare `1d20` at zero, because "+0" reads as a bonus the character lacks. */
export function modifierNotation(sides: number, modifier: number, quantity = 1): string {
  const base = `${quantity}d${sides}`;
  if (modifier === 0) return base;
  return modifier > 0 ? `${base}+${modifier}` : `${base}${modifier}`;
}

/** The number to show under Total: the dice that settled, plus the notation's own modifier. */
export function totalDiceResults(results: DiceRollResult[], modifier: number): number {
  return results.reduce((sum, result) => sum + (result.value ?? 0), 0) + modifier;
}
