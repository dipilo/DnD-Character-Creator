import { create } from 'zustand';
import { parseDiceNotation, rollDiceNotation, type DiceRollResult } from '@/lib/diceNotation';

/**
 * One shared dice tray for every roll the app makes outside the roller page.
 *
 * A store rather than a context because the callers are leaves — a skill row, a relationship
 * question — and the tray itself is mounted once by `Layout`. `roll()` resolves with the outcome so
 * a caller that needs the number (rolling a relationship question against its list) can await it,
 * while a caller that just wants dice on screen can ignore it.
 *
 * Nothing here imports the physics surface; `DiceTray` loads that lazily and only when the
 * preference asks for it. See CLAUDE.md, "Boot Cost and the Bundle Graph".
 */

export interface DiceRollRequest {
  /** Dice notation to throw, e.g. `1d20+5`. */
  notation: string;
  /** What is being rolled: "Dexterity Save", "Rapier damage", "Relationship question". */
  label: string;
  /** A second line under the label — the modifier's provenance, usually. */
  detail?: string;
  /**
   * Kids on Bikes' Lucky Break: "If you roll the maximum value of the die, you get a Lucky
   * Break—meaning that you reroll the die and add the maximum value that you rolled the first time
   * to the new roll. You can get multiple Lucky Breaks on a single check." Single-die notation only.
   */
  explodeOnMax?: boolean;
  /**
   * A line the tray prints under the total, computed from the outcome. It is a callback so the
   * tray needs to know nothing about any game's rules — the caller reads its own difficulty table.
   */
  describeOutcome?: (outcome: DiceRollOutcome) => string | null;
}

export interface DiceRollOutcome {
  /** Every die that settled, in throw order. A Lucky Break appends to this. */
  results: DiceRollResult[];
  /** The flat `+n` the notation carried; the 3D surface never reports it. */
  modifier: number;
  total: number;
  /** The first die of the first throw — what a d20 check reads as a natural 20 or a 1. */
  natural: number | null;
  /** How many times the die landed on its maximum and was thrown again. */
  luckyBreaks: number;
}

export interface PendingRoll {
  id: string;
  request: DiceRollRequest;
  resolve: (outcome: DiceRollOutcome) => void;
}

export interface SettledRoll extends DiceRollOutcome {
  id: string;
  request: DiceRollRequest;
}

interface DiceTrayState {
  /** Rolls waiting for the tray. Serial: a second click queues rather than interrupting. */
  queue: PendingRoll[];
  active: PendingRoll | null;
  outcome: SettledRoll | null;
  /**
   * True from the first roll of the session. The tray mounts the physics surface on it rather than
   * on page load, so a route nobody rolls on never downloads the engine.
   */
  warm: boolean;

  roll: (request: DiceRollRequest) => Promise<DiceRollOutcome>;

  // Driven by DiceTray; not called from the components that request rolls.
  takeNext: () => PendingRoll | null;
  settle: (pending: PendingRoll, outcome: DiceRollOutcome) => void;
  dismiss: () => void;
}

/** A Lucky Break chain is unbounded in the book; the tray stops somewhere so a d4 cannot hang it. */
export const MAX_LUCKY_BREAKS = 20;

export function isMaximum(result: DiceRollResult | undefined): boolean {
  return Boolean(result?.sides && result.value === result.sides);
}

/** The total, and what a caller needs to read a check off it, from dice the surface settled. */
export function summarizeRoll(results: DiceRollResult[], modifier: number, luckyBreaks = 0): DiceRollOutcome {
  return {
    results,
    modifier,
    total: results.reduce((sum, result) => sum + (result.value ?? 0), 0) + modifier,
    natural: results[0]?.value ?? null,
    luckyBreaks,
  };
}

/** The instant path: the same outcome shape with no physics and no wait. */
export function rollInstantly(request: DiceRollRequest): DiceRollOutcome | null {
  const parsed = parseDiceNotation(request.notation);
  const first = rollDiceNotation(request.notation);
  if (!parsed || !first) return null;

  const results = [...first];
  let luckyBreaks = 0;
  while (request.explodeOnMax && isMaximum(results[results.length - 1]) && luckyBreaks < MAX_LUCKY_BREAKS) {
    const sides = results[results.length - 1].sides ?? 0;
    const again = rollDiceNotation(`1d${sides}`);
    if (!again) break;
    results.push(...again);
    luckyBreaks += 1;
  }

  return summarizeRoll(results, parsed.modifier, luckyBreaks);
}

export const useDiceTrayStore = create<DiceTrayState>()((set, get) => ({
  queue: [],
  active: null,
  outcome: null,
  warm: false,

  roll: (request) =>
    new Promise<DiceRollOutcome>((resolve) => {
      set((state) => ({
        queue: [...state.queue, { id: crypto.randomUUID(), request, resolve }],
        warm: true,
      }));
    }),

  takeNext: () => {
    const { active, queue } = get();
    if (active || queue.length === 0) return null;
    const [next, ...rest] = queue;
    set({ active: next, queue: rest, outcome: null });
    return next;
  },

  settle: (pending, outcome) => {
    set({ active: null, outcome: { ...outcome, id: pending.id, request: pending.request } });
    pending.resolve(outcome);
  },

  dismiss: () => set({ outcome: null }),
}));

/** Request a roll from anywhere. The tray decides whether it is thrown or resolved instantly. */
export function rollOnScreen(request: DiceRollRequest): Promise<DiceRollOutcome> {
  return useDiceTrayStore.getState().roll(request);
}
