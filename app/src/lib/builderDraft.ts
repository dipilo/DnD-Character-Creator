// Crash recovery for the character being built.
//
// The builder's state was in memory only, so a refresh, a tab the phone froze in the background or
// a browser that fell over took every choice with it — several people built a whole character and
// lost it because the work only became a document when they pressed Create Character. The state is
// persisted with the character cache now, and this module decides what may be restored from it and
// whether the result is worth offering back.

import type { BuilderState } from '@/types/dnd';

/**
 * A restored draft is only worth mentioning once the player has chosen something. Opening the
 * builder, looking at the species list and leaving is not unfinished work.
 */
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

/**
 * The persisted builder state, made safe to resume.
 *
 * Returns the fallback — a clean builder — for anything that must not come back. A grant edit is
 * the case that matters: `remoteEditing` carries the version someone else's character was read at,
 * and a reload is exactly when that version has gone stale, so resuming one would push a document
 * built against a copy the server has already moved past.
 *
 * Everything else is shape-guarded, because a draft read out of localStorage was not necessarily
 * written by this version of the app.
 */
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
