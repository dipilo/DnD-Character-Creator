// Computed by the client, which has the library; the server stores it verbatim.
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
