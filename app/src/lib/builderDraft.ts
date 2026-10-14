// Persisted with the character cache; this decides what may be restored.

import type { BuilderState } from '@/types/dnd';

/** Opening the builder and leaving is not unfinished work. */
export function hasResumableDraft(state: BuilderState | undefined): boolean {
  const character = state?.character;
  if (!character) return false;
  return Boolean(
    character.speciesId
    || character.backgroundId
    || character.name?.trim()
    || (character.classes?.length ?? 0) > 0,
  );
}

/** A grant edit never resumes: its stored version is exactly what a reload stales. */
export function restorableBuilderState(stored: unknown, fallback: BuilderState): BuilderState {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return fallback;
  const draft = stored as Partial<BuilderState>;
  if (draft.remoteEditing) return fallback;
  if (!draft.character || typeof draft.character !== 'object' || Array.isArray(draft.character)) return fallback;

  const proficiencies = draft.character.proficiencies;
  const usableProficiencies = proficiencies && typeof proficiencies === 'object' && !Array.isArray(proficiencies);

  return {
    ...fallback,
    ...draft,
    remoteEditing: undefined,
    character: {
      ...fallback.character,
      ...draft.character,
      proficiencies: usableProficiencies ? proficiencies : fallback.character.proficiencies,
    },
    selectedSourceIds: Array.isArray(draft.selectedSourceIds) ? draft.selectedSourceIds : fallback.selectedSourceIds,
  };
}
