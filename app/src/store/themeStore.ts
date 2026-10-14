import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_GAME_SYSTEM_ID,
  getGameSystem,
  type GameSystemId,
  type ThemeTokens,
} from '@/data/gameSystems';

/** Kept whole, so reintroducing a toggle is one control rather than a re-derivation. */
export type ThemeMode = 'dark' | 'light';

interface ThemeState {
  mode: ThemeMode;
  /** The palette to wear when the route does not imply one. */
  paletteId: GameSystemId;
  /** When set, the palette follows whichever system's builder you are in. */
  followActiveSystem: boolean;
  /** 0–360, or null for the palette's own hue. The one knob custom theming exposes today. */
  accentHue: number | null;
  setMode: (mode: ThemeMode) => void;
  setPalette: (paletteId: GameSystemId) => void;
  setFollowActiveSystem: (follow: boolean) => void;
  setAccentHue: (hue: number | null) => void;
}

/** Tokens that carry the accent hue, so a custom hue rotates the set rather than one swatch. */
const ACCENT_TOKENS: ReadonlyArray<keyof ThemeTokens> = ['primary', 'ring', 'brand'];

const ALL_THEME_TOKENS = [
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'accent',
  'accent-foreground',
  'ring',
  'brand',
  'brand-foreground',
  'brand-muted',
] as const;

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      paletteId: DEFAULT_GAME_SYSTEM_ID,
      followActiveSystem: true,
      accentHue: null,
      setMode: (mode) => set({ mode }),
      setPalette: (paletteId) => set({ paletteId }),
      setFollowActiveSystem: (followActiveSystem) => set({ followActiveSystem }),
      setAccentHue: (accentHue) => set({ accentHue }),
    }),
    { name: 'ttrpg-theme' },
  ),
);

/** A module variable: the route is the router's, and this is a DOM write, not a render input. */
let routePaletteId: GameSystemId | null = null;

function resolvePaletteId(state: ThemeState): GameSystemId {
  if (state.followActiveSystem && routePaletteId) return routePaletteId;
  return state.paletteId;
}

/** Which palette the page is actually wearing, route override included. */
export function getEffectivePaletteId(): GameSystemId {
  return resolvePaletteId(useThemeStore.getState());
}

function withAccentHue(tokens: ThemeTokens, hue: number | null): ThemeTokens {
  if (hue === null) return tokens;
  const rotated: ThemeTokens = { ...tokens };
  for (const token of ACCENT_TOKENS) {
    const value = tokens[token];
    if (!value) continue;
    // 'H S% L%' — replace the hue and keep the palette's saturation and lightness, so a custom
    // hue cannot produce a fill its own foreground colour is unreadable against.
    const parts = value.split(' ');
    if (parts.length === 3) rotated[token] = `${hue} ${parts[1]} ${parts[2]}`;
  }
  return rotated;
}

/** Never from React state, so there is no frame of the wrong palette. */
export function renderTheme(): void {
  const state = useThemeStore.getState();
  const root = document.documentElement;
  root.classList.toggle('dark', state.mode === 'dark');
  root.style.colorScheme = state.mode;

  const paletteId = resolvePaletteId(state);
  root.dataset.gameSystem = paletteId;
  const tokens = withAccentHue(getGameSystem(paletteId).theme[state.mode], state.accentHue);

  // Every token the registry can set is cleared first: switching from a palette that defines
  // `secondary` to one that does not must drop it, not leave the previous system's colour behind.
  for (const token of ALL_THEME_TOKENS) root.style.removeProperty(`--${token}`);
  for (const [token, value] of Object.entries(tokens)) root.style.setProperty(`--${token}`, value);
}

/** Tells the theme which system's screens are on display. Safe to call on every render. */
export function setRoutePalette(paletteId: GameSystemId | null): void {
  if (routePaletteId === paletteId) return;
  routePaletteId = paletteId;
  renderTheme();
}

/** Called once from `main.tsx`, outside React, as auth hydration is. */
export function startThemeWatcher(): void {
  renderTheme();
  useThemeStore.subscribe(() => renderTheme());
}
