import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KobCharacter } from '@/types/kob';
import { KOB_STAT_IDS, statDiceForTrope } from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobDie, KobStatId } from '@/data/gameSystems/kidsOnBikes/types';

/**
 * Kids on Bikes characters, cached in localStorage.
 *
 * Deliberately the same posture as `characterStore`: a document cache that knows nothing about
 * the network, so the builder works signed out. It is **not yet wired to `/api/characters`** —
 * see KIDS_ON_BIKES.md for what that needs. Keep the store free of fetches when it is.
 */

interface KobCharacterState {
  characters: KobCharacter[];
  createCharacter: () => KobCharacter;
  updateCharacter: (id: string, patch: Partial<KobCharacter>) => void;
  deleteCharacter: (id: string) => void;
  duplicateCharacter: (id: string) => KobCharacter | null;
  getCharacter: (id: string) => KobCharacter | undefined;
}

function emptyStatDice(): Record<KobStatId, KobDie> {
  return statDiceForTrope(null);
}

export function createEmptyKobCharacter(): KobCharacter {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    systemId: 'kids-on-bikes',
    schemaVersion: 1,
    firstName: '',
    lastName: '',
    pronouns: '',
    description: '',
    tropeId: null,
    age: null,
    fromScratch: false,
    statDice: emptyStatDice(),
    strengthIds: [],
    skilledAt: '',
    flawId: null,
    customFlaw: '',
    motivation: '',
    fear: '',
    obligations: '',
    knacks: [''],
    backpack: '',
    tropeAnswers: [],
    bike: { colorId: '', upgradeId: '', name: '', origin: '', favoriteMemory: '' },
    relationships: [],
    bondedActions: [],
    // "Each player starts the game with 3 AT in their supply."
    adversityTokens: 3,
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * A stored document may predate a field. Filling the gaps on read keeps every screen free of
 * `?? ''` and means an older character never renders as a half-empty sheet.
 */
function withDefaults(character: KobCharacter): KobCharacter {
  const base = createEmptyKobCharacter();
  const statDice = { ...base.statDice, ...(character.statDice ?? {}) };
  for (const statId of KOB_STAT_IDS) statDice[statId] ??= 'd4';
  return {
    ...base,
    ...character,
    statDice,
    bike: { ...base.bike, ...(character.bike ?? {}) },
    knacks: character.knacks?.length ? character.knacks : base.knacks,
    relationships: character.relationships ?? [],
    bondedActions: character.bondedActions ?? [],
  };
}

export const useKobCharacterStore = create<KobCharacterState>()(
  persist(
    (set, get) => ({
      characters: [],

      createCharacter: () => {
        const character = createEmptyKobCharacter();
        set((state) => ({ characters: [...state.characters, character] }));
        return character;
      },

      updateCharacter: (id, patch) => {
        set((state) => ({
          characters: state.characters.map((character) =>
            character.id === id
              ? { ...character, ...patch, updatedAt: new Date().toISOString() }
              : character,
          ),
        }));
      },

      deleteCharacter: (id) => {
        set((state) => ({
          characters: state.characters.filter((character) => character.id !== id),
        }));
      },

      duplicateCharacter: (id) => {
        const source = get().characters.find((character) => character.id === id);
        if (!source) return null;
        const now = new Date().toISOString();
        const copy: KobCharacter = {
          ...structuredClone(source),
          id: crypto.randomUUID(),
          firstName: source.firstName ? `${source.firstName} (copy)` : '',
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ characters: [...state.characters, copy] }));
        return copy;
      },

      getCharacter: (id) => get().characters.find((character) => character.id === id),
    }),
    {
      name: 'kids-on-bikes-storage',
      partialize: (state) => ({ characters: state.characters }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<KobCharacterState> | undefined;
        return {
          ...current,
          ...stored,
          characters: (stored?.characters ?? []).map((character) => withDefaults(character)),
        };
      },
    },
  ),
);
