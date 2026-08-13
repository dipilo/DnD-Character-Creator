import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyAbilityScoreBonuses,
  deriveAbilityScoreBonuses,
  deriveCharacterHitPoints,
  extractSelectedProficiencies,
  resolveAbilityScoreEntryState,
  resolveBackgroundGrantedFeat,
  resolveCharacterClasses
} from '@/lib/builderRules';
import type { Character, CharacterSummary, BuilderState, BuilderStep, AbilityScores } from '@/types/dnd';

/**
 * What the server knows about one locally-held character (MERGE_PLAN.md Phase 2). localStorage is
 * a cache now rather than the record, and this is the bookkeeping that makes it one: `version` is
 * the server version last seen — null means the character has never been uploaded — and `dirty`
 * means the local copy has edits the server has not accepted yet.
 */
export interface CharacterSyncMeta {
  version: number | null;
  dirty: boolean;
  syncedAt?: string;
}

interface CharacterState {
  characters: Character[];
  currentCharacter: Partial<Character> | null;
  builderState: BuilderState;
  darkMode: boolean;

  // Server sync bookkeeping. Persisted with the characters: a cache that forgets what it already
  // uploaded would re-upload everything, or worse, mistake a deletion made elsewhere for one.
  syncMeta: Record<string, CharacterSyncMeta>;
  /** Characters deleted locally whose tombstone the server has not been told about yet. */
  pendingDeletes: string[];
  /**
   * Seats a character should take once the server has it (MERGE_PLAN.md Phase 5). Starting a
   * character "for this campaign" records the intent here, because the character does not exist
   * server-side yet — sync applies it after the create lands, and keeps it until then, so the
   * builder still works offline and signed out.
   */
  pendingSeats: Record<string, { campaignId: number; playerId: number | null }>;
  /** When the "upload your local characters" offer was last declined, so it is asked once. */
  uploadPromptDismissedAt: string | null;

  // Character CRUD
  addCharacter: (character: Character) => void;
  updateCharacter: (character: Character) => void;
  deleteCharacter: (id: string) => void;
  getCharacter: (id: string) => Character | undefined;
  duplicateCharacter: (id: string) => Character | undefined;

  // Sync layer (driven by store/characterSync.ts; not called from components directly)
  markCharacterSynced: (id: string, version: number, stillDirty?: boolean) => void;
  applyRemoteCharacter: (character: Character, version: number) => void;
  forgetCharacter: (id: string) => void;
  clearPendingDelete: (id: string) => void;
  setPendingSeat: (id: string, seat: { campaignId: number; playerId: number | null } | null) => void;
  dismissUploadPrompt: () => void;

  // Builder state
  setBuilderStep: (step: BuilderStep) => void;
  updateBuilderState: (updates: Partial<BuilderState>) => void;
  updateBuilderCharacter: (updates: Partial<Character>) => void;
  loadCharacterIntoBuilder: (id: string) => boolean;
  resetBuilder: () => void;
  
  // Dark mode
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

const defaultAbilityScores: AbilityScores = {
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10
};

const initialBuilderState: BuilderState = {
  currentStep: 'start',
  character: {
    abilityScores: defaultAbilityScores,
    abilityScoreBonuses: {},
    abilityScoreChoiceModes: {},
    abilityScoreChoiceSelections: {},
    backgroundLanguageSelections: [],
    speciesLanguageSelections: [],
    proficiencies: {
      skills: [],
      tools: [],
      languages: [],
      armor: [],
      weapons: [],
      saves: []
    },
    equipment: [],
    spells: [],
    feats: [],
    features: [],
    classes: [],
    hp: { current: 0, maximum: 0, temporary: 0 }
  },
  selectedSourceIds: [],
  abilityScoreMethod: 'standard',
  rolledScoreAssignments: {}
};

export const useCharacterStore = create<CharacterState>()(
  persist(
    (set, get) => ({
      characters: [],
      currentCharacter: null,
      builderState: initialBuilderState,
      darkMode: false,
      syncMeta: {},
      pendingDeletes: [],
      pendingSeats: {},
      uploadPromptDismissedAt: null,

      addCharacter: (character) => {
        set((state) => ({
          characters: [...state.characters, character],
          syncMeta: { ...state.syncMeta, [character.id]: { version: null, dirty: true } }
        }));
      },

      updateCharacter: (character) => {
        set((state) => {
          const meta = state.syncMeta[character.id];
          return {
            characters: state.characters.map((c) =>
              c.id === character.id ? character : c
            ),
            syncMeta: { ...state.syncMeta, [character.id]: { ...meta, version: meta?.version ?? null, dirty: true } }
          };
        });
      },

      deleteCharacter: (id) => {
        set((state) => {
          const { [id]: removed, ...syncMeta } = state.syncMeta;
          // A character the server has never seen leaves no tombstone: there is nothing to tell it
          // about, and an id it does not know would only come back as a 404.
          const needsTombstone = removed?.version != null && !state.pendingDeletes.includes(id);
          return {
            characters: state.characters.filter((c) => c.id !== id),
            syncMeta,
            pendingDeletes: needsTombstone ? [...state.pendingDeletes, id] : state.pendingDeletes
          };
        });
      },

      getCharacter: (id) => {
        return get().characters.find((c) => c.id === id);
      },

      duplicateCharacter: (id) => {
        const character = get().characters.find((c) => c.id === id);
        if (!character) return undefined;

        const newCharacter: Character = {
          ...character,
          id: crypto.randomUUID(),
          name: `${character.name} (Copy)`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        set((state) => ({
          characters: [...state.characters, newCharacter],
          syncMeta: { ...state.syncMeta, [newCharacter.id]: { version: null, dirty: true } }
        }));

        return newCharacter;
      },

      // `stillDirty` is for the write that was overtaken: the server accepted the document that was
      // sent, so its version must be recorded, but the copy here has moved on since and still owes
      // the server an update. Clearing the flag in that case loses the newer edit silently.
      markCharacterSynced: (id, version, stillDirty = false) => {
        set((state) => ({
          syncMeta: { ...state.syncMeta, [id]: { version, dirty: stillDirty, syncedAt: new Date().toISOString() } }
        }));
      },

      /** Take the server's copy of a character: it either arrived new or moved on elsewhere. */
      applyRemoteCharacter: (character, version) => {
        set((state) => {
          const exists = state.characters.some((c) => c.id === character.id);
          return {
            characters: exists
              ? state.characters.map((c) => (c.id === character.id ? character : c))
              : [...state.characters, character],
            syncMeta: { ...state.syncMeta, [character.id]: { version, dirty: false, syncedAt: new Date().toISOString() } }
          };
        });
      },

      /** Drop a local copy without leaving a tombstone — it was already deleted on the server. */
      forgetCharacter: (id) => {
        set((state) => {
          const syncMeta = { ...state.syncMeta };
          delete syncMeta[id];
          return {
            characters: state.characters.filter((c) => c.id !== id),
            syncMeta,
            pendingDeletes: state.pendingDeletes.filter((pending) => pending !== id)
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

      dismissUploadPrompt: () => {
        set({ uploadPromptDismissedAt: new Date().toISOString() });
      },

      setBuilderStep: (step) => {
        set((state) => ({
          builderState: { ...state.builderState, currentStep: step }
        }));
      },

      updateBuilderState: (updates) => {
        set((state) => ({
          builderState: { ...state.builderState, ...updates }
        }));
      },

      updateBuilderCharacter: (updates) => {
        set((state) => {
          const nextCharacter = { ...state.builderState.character, ...updates };
          const species = nextCharacter.speciesId ? getRuntimeSpeciesById(nextCharacter.speciesId) : undefined;
          const variant = nextCharacter.speciesId && nextCharacter.variantId
            ? getRuntimeSpeciesVariant(nextCharacter.speciesId, nextCharacter.variantId)
            : undefined;
          const background = nextCharacter.backgroundId ? getRuntimeBackgroundById(nextCharacter.backgroundId) : undefined;
          const grantedBackgroundFeat = resolveBackgroundGrantedFeat(background, getRuntimeFeats());
          const selectedFeats = Array.from(new Set([
            ...(grantedBackgroundFeat ? [grantedBackgroundFeat.id] : []),
            ...(nextCharacter.feats ?? [])
          ]))
            .map((featId) => getRuntimeFeatById(featId))
            .filter((feat): feat is NonNullable<typeof feat> => Boolean(feat));

          nextCharacter.abilityScoreBonuses = deriveAbilityScoreBonuses({
            background,
            species,
            variant,
            feats: selectedFeats,
            abilityScoreChoiceModes: nextCharacter.abilityScoreChoiceModes,
            abilityScoreChoiceSelections: nextCharacter.abilityScoreChoiceSelections
          });

          const totalAbilityScores = applyAbilityScoreBonuses(nextCharacter.abilityScores, nextCharacter.abilityScoreBonuses);

          nextCharacter.hp = deriveCharacterHitPoints({
            classes: nextCharacter.classes ?? [],
            abilityScores: totalAbilityScores,
            previousHp: nextCharacter.hp,
            getClassById: getRuntimeClassById
          });

          return {
            builderState: {
              ...state.builderState,
              character: nextCharacter
            }
          };
        });
      },

      loadCharacterIntoBuilder: (id) => {
        const character = get().characters.find((entry) => entry.id === id);
        if (!character) {
          return false;
        }

        const species = character.speciesId ? getRuntimeSpeciesById(character.speciesId) : undefined;
        const variant = character.speciesId && character.variantId
          ? getRuntimeSpeciesVariant(character.speciesId, character.variantId)
          : undefined;
        const background = character.backgroundId ? getRuntimeBackgroundById(character.backgroundId) : undefined;
        const resolvedClasses = resolveCharacterClasses({
          classes: character.classes ?? [],
          getClassById: getRuntimeClassById,
          getSubclassById: getRuntimeSubclass
        });
        const abilityScoreEntry = resolveAbilityScoreEntryState(character);

        set({
          builderState: {
            ...initialBuilderState,
            currentStep: 'review',
            editingCharacterId: character.id,
            character: {
              ...character,
              // The sheet stores merged proficiencies; the builder needs the player's own picks.
              proficiencies: extractSelectedProficiencies({
                character,
                resolvedClasses,
                background,
                species,
                variant
              })
            },
            abilityScoreMethod: abilityScoreEntry.abilityScoreMethod,
            rolledScores: abilityScoreEntry.rolledScores,
            rolledScoreAssignments: abilityScoreEntry.rolledScoreAssignments
          }
        });

        return true;
      },

      resetBuilder: () => {
        set({ builderState: initialBuilderState });
      },

      toggleDarkMode: () => {
        set((state) => ({ darkMode: !state.darkMode }));
      },

      setDarkMode: (value) => {
        set({ darkMode: value });
      }
    }),
    {
      name: 'dnd-character-storage',
      partialize: (state) => ({
        characters: state.characters,
        darkMode: state.darkMode,
        syncMeta: state.syncMeta,
        pendingDeletes: state.pendingDeletes,
        pendingSeats: state.pendingSeats,
        uploadPromptDismissedAt: state.uploadPromptDismissedAt
      })
    }
  )
);

import {
  getRuntimeBackgroundById,
  getRuntimeClassById,
  getRuntimeFeatById,
  getRuntimeFeats,
  getRuntimeSpeciesById,
  getRuntimeSpeciesVariant,
  getRuntimeSubclass
} from '@/data';

export const useCharacterSummaries = (): CharacterSummary[] => {
  const { characters } = useCharacterStore();
  
  return characters.map((char) => {
    const speciesData = getRuntimeSpeciesById(char.speciesId);
    
    const totalLevel = char.classes?.reduce((sum, c) => sum + c.level, 0) || 1;
    
    return {
      id: char.id,
      name: char.name || 'Unnamed Character',
      avatar: char.portrait?.imageDataUrl || char.avatar,
      speciesName: speciesData?.name || 'Unknown Species',
      classSummary: char.classes?.map(c => {
        const cls = getRuntimeClassById(c.classId);
        return `${cls?.name || 'Unknown'} ${c.level}`;
      }).join(' / ') || 'No Class',
      level: totalLevel,
      createdAt: char.createdAt,
      updatedAt: char.updatedAt
    };
  });
};
