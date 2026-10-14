// The books a player builds with, remembered across characters. A draft keeps its own list, so
// this is the seed a new one starts from and never a filter applied over one already underway.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SourcePreferencesState {
  /** Empty means every book, which is what the picker shows with nothing selected. */
  defaultSourceIds: string[];
  setDefaultSourceIds: (ids: string[]) => void;
}

export const useSourcePreferencesStore = create<SourcePreferencesState>()(
  persist(
    (set) => ({
      defaultSourceIds: [],
      setDefaultSourceIds: (ids) => set({ defaultSourceIds: [...new Set(ids)] })
    }),
    {
      name: 'dnd-source-preferences'
    }
  )
);

/** Read outside React, for the builder state a new character starts from. */
export const getDefaultSourceIds = () => useSourcePreferencesStore.getState().defaultSourceIds;
