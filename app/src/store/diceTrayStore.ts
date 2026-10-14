import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createDebouncedLocalStorage } from '@/lib/debouncedStorage';
import { parseDiceNotation, rollDiceNotation, type DiceRollResult } from '@/lib/diceNotation';

// One shared tray, mounted once by `Layout`; the physics surface loads lazily.

export interface DiceRollRequest {
  /** Dice notation to throw, e.g. `1d20+5`. */
  notation: string;
  /** What is being rolled: "Dexterity Save", "Rapier damage", "Relationship question". */
  label: string;
  /** A second line under the label — the modifier's provenance, usually. */
  detail?: string;
  /** Lucky Break: a maximum roll rerolls and adds. Single-die notation only. */
  explodeOnMax?: boolean;
  /** "Keep this many, from this end", so the tray need not know what advantage is. */
  keep?: DiceKeepRule;
  /** Counts low dice as n without changing what settled on the surface. */
  floor?: number;
  /** A callback, so the tray knows nothing about any game's rules. */
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
  /** Absent when every die did; a dropped die stays on the surface and in the log. */
  keptIndexes?: number[];
  /** The floor the total was counted under, where one applied. The dice on screen are unchanged. */
  floor?: number;
  /** Which entries of `results` the floor raised, so the reader can see the die it overrode. */
  raisedIndexes?: number[];
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

/** `describeOutcome` resolves here, which is what keeps an entry serializable. */
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
  /** So a route nobody rolls on never downloads the engine. */
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

/** First group only: the rule exists for an advantage pair, so `2d20+1d4` keeps the d4. */
function resolveKeptIndexes(
  results: DiceRollResult[],
  counts: readonly number[],
  keep: DiceKeepRule | undefined,
): number[] | undefined {
  if (!keep || keep.count >= results.length) return undefined;

  const sides = results[0]?.sides;
  const candidates = results
    .map((result, index) => ({ index, value: counts[index], sides: result.sides }))
    .filter((entry) => entry.sides === sides);
  if (candidates.length <= keep.count) return undefined;

  const ordered = [...candidates].sort((left, right) =>
    keep.mode === 'highest' ? right.value - left.value : left.value - right.value);
  const kept = new Set(ordered.slice(0, keep.count).map((entry) => entry.index));

  return results
    .map((_, index) => index)
    .filter((index) => kept.has(index) || candidates.every((entry) => entry.index !== index));
}

/** First group only, as with a keep rule: it is for the d20, not a damage die beside it. */
function applyFloor(results: DiceRollResult[], floor: number | undefined): {
  counts: number[];
  raisedIndexes?: number[];
} {
  const counts = results.map((result) => result.value ?? 0);
  if (floor === undefined) return { counts };

  const sides = results[0]?.sides;
  const raisedIndexes: number[] = [];
  results.forEach((result, index) => {
    if (result.sides !== sides || counts[index] >= floor) return;
    counts[index] = floor;
    raisedIndexes.push(index);
  });

  return { counts, raisedIndexes: raisedIndexes.length > 0 ? raisedIndexes : undefined };
}

/** The total, and what a caller needs to read a check off it, from dice the surface settled. */
export function summarizeRoll(
  results: DiceRollResult[],
  modifier: number,
  luckyBreaks = 0,
  keep?: DiceKeepRule,
  floor?: number,
): DiceRollOutcome {
  // The floor is applied before the keep rule, so advantage keeps the higher of what each die
  // counts as rather than of what it shows.
  const { counts, raisedIndexes } = applyFloor(results, floor);
  const keptIndexes = resolveKeptIndexes(results, counts, keep);
  const countedIndexes = keptIndexes ?? results.map((_, index) => index);

  return {
    results,
    modifier,
    total: countedIndexes.reduce((sum, index) => sum + counts[index], 0) + modifier,
    // A natural 20 or a 1 is what the die shows, which no floor changes.
    natural: results[countedIndexes[0]]?.value ?? null,
    luckyBreaks,
    keptIndexes,
    floor,
    raisedIndexes,
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

  return summarizeRoll(results, parsed.modifier, luckyBreaks, request.keep, request.floor);
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
