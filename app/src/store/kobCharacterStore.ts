import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { KobCharacter, KobConsentSheet } from '@/types/kob';
import { KOB_STAT_IDS, statDiceForTrope } from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobDie, KobStatId } from '@/data/gameSystems/kidsOnBikes/types';
import { createDebouncedLocalStorage } from '@/lib/debouncedStorage';
import type { CharacterSyncMeta, PendingSeat } from '@/store/syncTypes';

/**
 * Kids on Bikes characters, cached in localStorage.
 *
 * Deliberately the same posture as `characterStore`: a document cache that knows nothing about the
 * network, so the builder works signed out. `store/characterSync.ts` watches it from outside and
 * pushes what changed — the sync bookkeeping below is the half of that contract this store owns,
 * and it is the same shape the 5e store keeps for the same reasons.
 */

interface KobCharacterState {
  characters: KobCharacter[];

  // Server sync bookkeeping; see `characterStore` for what each field means. Persisted with the
  // characters: a cache that forgets what it uploaded would re-upload everything.
  syncMeta: Record<string, CharacterSyncMeta>;
  pendingDeletes: string[];
  pendingSeats: Record<string, PendingSeat>;

  createCharacter: () => KobCharacter;
  updateCharacter: (id: string, patch: Partial<KobCharacter>) => void;
  deleteCharacter: (id: string) => void;
  duplicateCharacter: (id: string) => KobCharacter | null;
  getCharacter: (id: string) => KobCharacter | undefined;

  // Driven by store/characterSync.ts; not called from components.
  addCharacter: (character: KobCharacter) => void;
  markCharacterSynced: (id: string, version: number, stillDirty?: boolean) => void;
  applyRemoteCharacter: (character: KobCharacter, version: number) => void;
  forgetCharacter: (id: string) => void;
  clearPendingDelete: (id: string) => void;
  setPendingSeat: (id: string, seat: PendingSeat | null) => void;
}

function emptyStatDice(): Record<KobStatId, KobDie> {
  return statDiceForTrope(null);
}

function emptyConsentSheet(): KobConsentSheet {
  return {
    crush: false,
    date: false,
    partner: false,
    onScreenIntimacy: false,
    offScreenIntimacy: false,
    relationshipNotes: '',
    characterNotes: '',
  };
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
    consent: emptyConsentSheet(),
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
    bondedActions: (character.bondedActions ?? []).map((entry) => ({
      ...entry,
      // Entries written before the pair became a pointer carry neither field.
      id: entry.id || crypto.randomUUID(),
      withCharacterId: entry.withCharacterId ?? null,
    })),
    consent: { ...base.consent, ...(character.consent ?? {}) },
  };
}

const dirtyMeta = (meta: CharacterSyncMeta | undefined): CharacterSyncMeta => ({
  ...meta,
  version: meta?.version ?? null,
  dirty: true,
});

export const useKobCharacterStore = create<KobCharacterState>()(
  persist(
    (set, get) => ({
      characters: [],
      syncMeta: {},
      pendingDeletes: [],
      pendingSeats: {},

      createCharacter: () => {
        const character = createEmptyKobCharacter();
        set((state) => ({
          characters: [...state.characters, character],
          syncMeta: { ...state.syncMeta, [character.id]: { version: null, dirty: true } },
        }));
        return character;
      },

      updateCharacter: (id, patch) => {
        set((state) => ({
          characters: state.characters.map((character) =>
            character.id === id
              ? { ...character, ...patch, updatedAt: new Date().toISOString() }
              : character,
          ),
          syncMeta: { ...state.syncMeta, [id]: dirtyMeta(state.syncMeta[id]) },
        }));
      },

      deleteCharacter: (id) => {
        set((state) => {
          const { [id]: removed, ...syncMeta } = state.syncMeta;
          // A character the server never saw leaves no tombstone: an id it does not know would
          // only come back as a 404.
          const needsTombstone = removed?.version != null && !state.pendingDeletes.includes(id);
          return {
            characters: state.characters.filter((character) => character.id !== id),
            syncMeta,
            pendingDeletes: needsTombstone ? [...state.pendingDeletes, id] : state.pendingDeletes,
          };
        });
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
        set((state) => ({
          characters: [...state.characters, copy],
          syncMeta: { ...state.syncMeta, [copy.id]: { version: null, dirty: true } },
        }));
        return copy;
      },

      getCharacter: (id) => get().characters.find((character) => character.id === id),

      addCharacter: (character) => {
        set((state) => ({
          characters: [...state.characters, character],
          syncMeta: { ...state.syncMeta, [character.id]: { version: null, dirty: true } },
        }));
      },

      markCharacterSynced: (id, version, stillDirty = false) => {
        set((state) => ({
          syncMeta: { ...state.syncMeta, [id]: { version, dirty: stillDirty, syncedAt: new Date().toISOString() } },
        }));
      },

      applyRemoteCharacter: (character, version) => {
        set((state) => {
          const stored = withDefaults(character);
          const exists = state.characters.some((entry) => entry.id === stored.id);
          return {
            characters: exists
              ? state.characters.map((entry) => (entry.id === stored.id ? stored : entry))
              : [...state.characters, stored],
            syncMeta: { ...state.syncMeta, [stored.id]: { version, dirty: false, syncedAt: new Date().toISOString() } },
          };
        });
      },

      forgetCharacter: (id) => {
        set((state) => {
          const syncMeta = { ...state.syncMeta };
          delete syncMeta[id];
          return {
            characters: state.characters.filter((character) => character.id !== id),
            syncMeta,
            pendingDeletes: state.pendingDeletes.filter((pending) => pending !== id),
          };
        });
      },

      clearPendingDelete: (id) => {
        set((state) => ({ pendingDeletes: state.pendingDeletes.filter((pending) => pending !== id) }));
      },

      setPendingSeat: (id, seat) => {
        set((state) => {
          const pendingSeats = { ...state.pendingSeats };
          if (seat) pendingSeats[id] = seat;
          else delete pendingSeats[id];
          return { pendingSeats };
        });
      },
    }),
    {
      name: 'kids-on-bikes-storage',
      storage: createDebouncedLocalStorage(),
      partialize: (state) => ({
        characters: state.characters,
        syncMeta: state.syncMeta,
        pendingDeletes: state.pendingDeletes,
        pendingSeats: state.pendingSeats,
      }),
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
