import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_GAME_SYSTEM_ID,
  getGameSystem,
  getGameSystemForPath,
  type GameSystemDefinition,
  type GameSystemId,
} from '@/data/gameSystems';

/** The *preference* only: the path wins wherever it belongs to a system. */
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
