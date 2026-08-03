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

interface CharacterState {
  characters: Character[];
  currentCharacter: Partial<Character> | null;
  builderState: BuilderState;
  darkMode: boolean;
  
  // Character CRUD
  addCharacter: (character: Character) => void;
  updateCharacter: (character: Character) => void;
  deleteCharacter: (id: string) => void;
  getCharacter: (id: string) => Character | undefined;
  duplicateCharacter: (id: string) => Character | undefined;
  
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

      addCharacter: (character) => {
        set((state) => ({
          characters: [...state.characters, character]
        }));
      },

      updateCharacter: (character) => {
        set((state) => ({
          characters: state.characters.map((c) =>
            c.id === character.id ? character : c
          )
        }));
      },

      deleteCharacter: (id) => {
        set((state) => ({
          characters: state.characters.filter((c) => c.id !== id)
        }));
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
          characters: [...state.characters, newCharacter]
        }));

        return newCharacter;
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
        darkMode: state.darkMode 
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
