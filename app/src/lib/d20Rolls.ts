// Advantage is 5e's rule, not the tray's; the mode is sticky and stated on the label.
import { create } from 'zustand';
import { modifierNotation } from '@/lib/diceNotation';
import {
  describeConditionalRollEffects,
  describeRollEffects,
  type AppliedRollEffects
} from '@/lib/rollEffects';
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

/** Not persisted: UI state, and yesterday's advantage is tomorrow's wrong number. */
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

/** The dice rule, not a fact about the features, so it resolves here. */
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
  /** Folded in here, so one row cannot apply effects and the next forget. */
  effects?: AppliedRollEffects;
}

/** What a row showing a modifier has to show once its features are read. */
export const effectiveModifier = (modifier: number, effects: AppliedRollEffects | undefined) =>
  modifier + (effects?.bonus ?? 0);

/** Throw a d20 test under the given advantage state, or whatever the sheet is currently set to. */
export function rollD20({ modifier, label, detail, mode, effects }: D20RollRequest): Promise<DiceRollOutcome> {
  const activeMode = modeFromEffects(mode ?? getD20Mode(), effects);
  const dice = activeMode === 'normal' ? 1 : 2;
  const modeLabel = activeMode === 'normal' ? undefined : D20_MODE_LABELS[activeMode];
  // A conditional one is named on its own terms; the roll itself stays bare.
  const applied = effects ? describeRollEffects(effects.applied) : undefined;
  const offered = effects ? describeConditionalRollEffects(effects.conditional) : undefined;

  return rollOnScreen({
    notation: modifierNotation(20, modifier + (effects?.bonus ?? 0), dice),
    label: modeLabel ? `${label} (${modeLabel})` : label,
    detail: [detail, applied, offered].filter(Boolean).join(' · ') || undefined,
    keep: keepRuleFor(activeMode),
    floor: effects?.floor
  });
}
