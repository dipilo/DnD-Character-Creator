import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_GAME_SYSTEM_ID,
  getGameSystem,
  getGameSystemForPath,
  type GameSystemDefinition,
  type GameSystemId,
} from '@/data/gameSystems';

/**
 * Which game the app is currently being used for.
 *
 * This is the *preference* only. Which system's screens are on display stays the router's fact —
 * `resolveActiveGameSystem` lets the path win whenever it belongs to a system, and falls back to
 * the preference on the screens that belong to no system (home, campaigns, dice). Pushing the
 * pathname in here would be state mirroring state, which is the rule `themeStore` already follows
 * for the palette.
 */
interface GameSystemState {
  preferredSystemId: GameSystemId;
  setPreferredSystem: (systemId: GameSystemId) => void;
}

export const useGameSystemStore = create<GameSystemState>()(
  persist(
    (set) => ({
      preferredSystemId: DEFAULT_GAME_SYSTEM_ID,
      setPreferredSystem: (preferredSystemId) => set({ preferredSystemId }),
    }),
    { name: 'ttrpg-active-system' },
  ),
);

export function resolveActiveGameSystem(pathname: string, preferredSystemId: GameSystemId): GameSystemDefinition {
  return getGameSystemForPath(pathname) ?? getGameSystem(preferredSystemId);
}
