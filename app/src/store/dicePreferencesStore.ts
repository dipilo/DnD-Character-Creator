import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_DICE_COLOR, type DiceColorMode } from '@/components/dice/DiceScene';

interface DicePreferencesState {
  theme: string;
  diceColor: string;
  randomColors: boolean;
  fullyRandomColors: boolean;
  soundEnabled: boolean;
  diceScale: number;
  setTheme: (theme: string) => void;
  setDiceColor: (color: string) => void;
  setRandomColors: (value: boolean) => void;
  setFullyRandomColors: (value: boolean) => void;
  setSoundEnabled: (value: boolean) => void;
  setDiceScale: (value: number) => void;
}

// Kept for callers that want the resolved DiceScene colorMode from these prefs.
export const resolveDiceColorMode = (state: Pick<DicePreferencesState, 'randomColors' | 'fullyRandomColors'>): DiceColorMode => {
  if (!state.randomColors) return 'single';
  return state.fullyRandomColors ? 'random-any' : 'random';
};

export const useDicePreferencesStore = create<DicePreferencesState>()(
  persist(
    (set) => ({
      theme: 'default',
      diceColor: DEFAULT_DICE_COLOR,
      randomColors: true,
      fullyRandomColors: false,
      soundEnabled: true,
      diceScale: 8.4,

      setTheme: (theme) => set({ theme }),
      setDiceColor: (diceColor) => set({ diceColor }),
      setRandomColors: (randomColors) => set({ randomColors }),
      setFullyRandomColors: (fullyRandomColors) => set({ fullyRandomColors }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setDiceScale: (diceScale) => set({ diceScale })
    }),
    {
      name: 'dnd-dice-preferences'
    }
  )
);
