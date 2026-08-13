// The one-line description of a character (MERGE_PLAN.md Phase 5).
//
// It lives here rather than in a component because two very different callers need it: the sheet
// header, and the sync layer, which sends it to the server as a denormalised column so a campaign's
// party view can list "Level 5 Elf Wizard 5 (Evocation)" without fetching everyone's document.
//
// Resolving ids to names needs the content library, which only the client has — so the client is
// what computes this line, and the server stores it verbatim without interpreting it. A row written
// by a client that did not send one simply lists by name.
import { getRuntimeClassById, getRuntimeSpeciesById, getRuntimeSubclass } from '@/data';
import { resolveCharacterClasses } from '@/lib/builderRules';
import type { Character } from '@/types/dnd';

/** The server caps this column; truncating here keeps the stored line and the rendered one equal. */
export const CHARACTER_SUMMARY_MAX_LENGTH = 200;

export function getCharacterTotalLevel(character: Pick<Character, 'classes'>): number {
  return character.classes?.reduce((sum, entry) => sum + entry.level, 0) || 1;
}

/** "Wizard 4 (Evocation) / Rogue 1", or an empty string when no class resolves. */
export function describeCharacterClasses(character: Pick<Character, 'classes'>): string {
  return resolveCharacterClasses({
    classes: character.classes ?? [],
    getClassById: getRuntimeClassById,
    getSubclassById: getRuntimeSubclass
  })
    .map(({ entry, cls, subclass }) => {
      const label = `${cls.name} ${entry.level}`;
      return subclass ? `${label} (${subclass.name})` : label;
    })
    .join(' / ');
}

/** "Level 5 Elf Wizard 5 (Evocation)". Falls back gracefully when content cannot be resolved. */
export function describeCharacter(character: Pick<Character, 'classes' | 'speciesId'>): string {
  const species = character.speciesId ? getRuntimeSpeciesById(character.speciesId) : undefined;
  const parts = [
    `Level ${getCharacterTotalLevel(character)}`,
    species?.name,
    describeCharacterClasses(character)
  ].filter((part): part is string => Boolean(part && part.trim()));

  return parts.join(' ').slice(0, CHARACTER_SUMMARY_MAX_LENGTH);
}
