/**
 * D20 tests, and the advantage state they are thrown under.
 *
 * Advantage is 5e's rule, not the tray's, so it lives here: the tray takes a generic "keep this
 * many dice, from this end" and this module is the only place that knows two d20s keeping the
 * higher is what advantage means.
 *
 * The mode is deliberately sticky rather than resetting after each roll — a fighter making three
 * attacks with advantage should not have to set it three times — and it is stated on the roll's
 * own label, so a mode left on is visible in the result rather than silently changing every
 * subsequent number.
 */
import { create } from 'zustand';
import { modifierNotation } from '@/lib/diceNotation';
import { describeRollEffects, type AppliedRollEffects } from '@/lib/rollEffects';
import { rollOnScreen, type DiceKeepRule, type DiceRollOutcome } from '@/store/diceTrayStore';

export type D20Mode = 'normal' | 'advantage' | 'disadvantage';

export const D20_MODE_LABELS: Record<D20Mode, string> = {
  normal: 'Normal',
  advantage: 'Advantage',
  disadvantage: 'Disadvantage'
};

interface D20ModeState {
  mode: D20Mode;
  setMode: (mode: D20Mode) => void;
}

/**
 * Not persisted: an advantage left on from yesterday's session is a wrong number tomorrow, and
 * this is UI state rather than anything about the character.
 */
export const useD20ModeStore = create<D20ModeState>()((set) => ({
  mode: 'normal',
  setMode: (mode) => set({ mode })
}));

export const getD20Mode = () => useD20ModeStore.getState().mode;

const keepRuleFor = (mode: D20Mode): DiceKeepRule | undefined => {
  if (mode === 'advantage') return { count: 1, mode: 'highest' };
  if (mode === 'disadvantage') return { count: 1, mode: 'lowest' };
  return undefined;
};

/**
 * Advantage and disadvantage on the same roll cancel, in both printings. It is the dice rule
 * rather than a fact about the features, so it is resolved here and not in `rollEffects`.
 */
function modeFromEffects(base: D20Mode, effects: AppliedRollEffects | undefined): D20Mode {
  const up = base === 'advantage' || Boolean(effects?.advantage);
  const down = base === 'disadvantage' || Boolean(effects?.disadvantage);
  if (up === down) return 'normal';
  return up ? 'advantage' : 'disadvantage';
}

export interface D20RollRequest {
  modifier: number;
  label: string;
  detail?: string;
  /** Overrides the tray's current mode. A death save is always a straight roll, for instance. */
  mode?: D20Mode;
  /**
   * What the character's own features do to this roll (`applyRollEffects`). They are folded in
   * here rather than by each caller so one sheet row cannot apply them and the next forget.
   */
  effects?: AppliedRollEffects;
}

/** Throw a d20 test under the given advantage state, or whatever the sheet is currently set to. */
export function rollD20({ modifier, label, detail, mode, effects }: D20RollRequest): Promise<DiceRollOutcome> {
  const activeMode = modeFromEffects(mode ?? getD20Mode(), effects);
  const dice = activeMode === 'normal' ? 1 : 2;
  const modeLabel = activeMode === 'normal' ? undefined : D20_MODE_LABELS[activeMode];
  // The features that applied are named under the roll, so a number a feature changed says which.
  const applied = effects ? describeRollEffects(effects.applied) : undefined;

  return rollOnScreen({
    notation: modifierNotation(20, modifier, dice),
    label: modeLabel ? `${label} (${modeLabel})` : label,
    detail: [detail, applied].filter(Boolean).join(' · ') || undefined,
    keep: keepRuleFor(activeMode),
    floor: effects?.floor
  });
}
