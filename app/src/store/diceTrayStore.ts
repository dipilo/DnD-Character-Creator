import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createDebouncedLocalStorage } from '@/lib/debouncedStorage';
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
   * Throw every die the notation asks for and count only some of them. 5e's advantage is two d20s
   * of which the higher counts, and plenty of systems roll-and-drop, so the tray takes the rule as
   * "keep this many, from this end" rather than knowing what advantage is.
   */
  keep?: DiceKeepRule;
  /**
   * A line the tray prints under the total, computed from the outcome. It is a callback so the
   * tray needs to know nothing about any game's rules — the caller reads its own difficulty table.
   */
  describeOutcome?: (outcome: DiceRollOutcome) => string | null;
}

export interface DiceKeepRule {
  count: number;
  mode: 'highest' | 'lowest';
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
  /**
   * Which entries of `results` counted toward the total. Absent when every die did — a dropped
   * die is still on the surface and still in the log, so the reader can see what was discarded.
   */
  keptIndexes?: number[];
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

/**
 * A settled roll flattened for the log. `describeOutcome` is a callback, so its line is resolved
 * here rather than stored — that is also what keeps an entry serializable.
 */
export interface DiceRollLogEntry extends DiceRollOutcome {
  id: string;
  label: string;
  detail?: string;
  notation: string;
  note: string | null;
  at: number;
}

/** How many rolls the log keeps. Older ones fall off the end. */
export const DICE_LOG_LIMIT = 60;

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
  /** Every roll the app has settled, newest first, wherever it was thrown from. */
  log: DiceRollLogEntry[];

  roll: (request: DiceRollRequest) => Promise<DiceRollOutcome>;
  /** Add a roll the tray did not throw itself. Returns the log entry's id. */
  record: (request: DiceRollRequest, outcome: DiceRollOutcome) => string;
  /** Rewrite one entry in place, for a die thrown again on a surface the caller owns. */
  reviseLogEntry: (id: string, outcome: DiceRollOutcome) => void;
  clearLog: () => void;

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

/**
 * Which dice a keep rule counts. Only the first group is subject to it — the rule exists for the
 * pair of d20s in an advantage roll, and a `2d20+1d4` would still add the d4.
 */
function resolveKeptIndexes(results: DiceRollResult[], keep: DiceKeepRule | undefined): number[] | undefined {
  if (!keep || keep.count >= results.length) return undefined;

  const sides = results[0]?.sides;
  const candidates = results
    .map((result, index) => ({ index, value: result.value ?? 0, sides: result.sides }))
    .filter((entry) => entry.sides === sides);
  if (candidates.length <= keep.count) return undefined;

  const ordered = [...candidates].sort((left, right) =>
    keep.mode === 'highest' ? right.value - left.value : left.value - right.value);
  const kept = new Set(ordered.slice(0, keep.count).map((entry) => entry.index));

  return results
    .map((_, index) => index)
    .filter((index) => kept.has(index) || candidates.every((entry) => entry.index !== index));
}

/** The total, and what a caller needs to read a check off it, from dice the surface settled. */
export function summarizeRoll(
  results: DiceRollResult[],
  modifier: number,
  luckyBreaks = 0,
  keep?: DiceKeepRule,
): DiceRollOutcome {
  const keptIndexes = resolveKeptIndexes(results, keep);
  const counted = keptIndexes ? keptIndexes.map((index) => results[index]) : results;

  return {
    results,
    modifier,
    total: counted.reduce((sum, result) => sum + (result.value ?? 0), 0) + modifier,
    natural: counted[0]?.value ?? null,
    luckyBreaks,
    keptIndexes,
  };
}

function toLogEntry(id: string, request: DiceRollRequest, outcome: DiceRollOutcome): DiceRollLogEntry {
  return {
    ...outcome,
    id,
    label: request.label,
    detail: request.detail,
    notation: request.notation,
    note: request.describeOutcome?.(outcome) ?? null,
    at: Date.now(),
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

  return summarizeRoll(results, parsed.modifier, luckyBreaks, request.keep);
}

export const useDiceTrayStore = create<DiceTrayState>()(
  persist(
    (set, get) => ({
      queue: [],
      active: null,
      outcome: null,
      warm: false,
      log: [],

      roll: (request) =>
        new Promise<DiceRollOutcome>((resolve) => {
          set((state) => ({
            queue: [...state.queue, { id: crypto.randomUUID(), request, resolve }],
            warm: true,
          }));
        }),

      record: (request, outcome) => {
        const entry = toLogEntry(crypto.randomUUID(), request, outcome);
        set((state) => ({ log: [entry, ...state.log].slice(0, DICE_LOG_LIMIT) }));
        return entry.id;
      },

      reviseLogEntry: (id, outcome) =>
        set((state) => ({
          log: state.log.map((entry) =>
            entry.id === id ? { ...entry, ...outcome, note: entry.note } : entry,
          ),
        })),

      clearLog: () => set({ log: [] }),

      takeNext: () => {
        const { active, queue } = get();
        if (active || queue.length === 0) return null;
        const [next, ...rest] = queue;
        set({ active: next, queue: rest, outcome: null });
        return next;
      },

      settle: (pending, outcome) => {
        set((state) => ({
          active: null,
          outcome: { ...outcome, id: pending.id, request: pending.request },
          log: [toLogEntry(pending.id, pending.request, outcome), ...state.log].slice(0, DICE_LOG_LIMIT),
        }));
        pending.resolve(outcome);
      },

      dismiss: () => set({ outcome: null }),
    }),
    {
      name: 'dnd-dice-log',
      storage: createDebouncedLocalStorage<Pick<DiceTrayState, 'log'>>(),
      // The queue holds a live `resolve` for each waiting caller and the surface is torn down on
      // reload; only the log outlives the session.
      partialize: (state) => ({ log: state.log }),
    },
  ),
);

/** Request a roll from anywhere. The tray decides whether it is thrown or resolved instantly. */
export function rollOnScreen(request: DiceRollRequest): Promise<DiceRollOutcome> {
  return useDiceTrayStore.getState().roll(request);
}

/** Log a roll thrown on a surface of the caller's own, so one history covers every page. */
export function recordRoll(request: DiceRollRequest, outcome: DiceRollOutcome): string {
  return useDiceTrayStore.getState().record(request, outcome);
}
