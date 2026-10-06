// The builder's half of the unfinished-choice list.
//
// The sheet already derives its classes, species and spellcasting rules for its own panels and
// hands them straight to `deriveAdvancementTasks`; the builder derives none of that at the shell
// level, so this hook does it once for the step rail. Both end at the same pure function, which is
// what keeps the two lists from disagreeing.
import { useMemo } from 'react';
import {
  getRuntimeClassById,
  getRuntimeFeatById,
  getRuntimeSpeciesById,
  getRuntimeSpeciesVariant,
  getRuntimeSpellById,
  getRuntimeSubclass,
  useContentLibrary
} from '@/data';
import { deriveCharacterProficiencies, getSpellcastingRulesSummary, resolveCharacterClasses } from '@/lib/builderRules';
import { deriveAdvancementTasks, type AdvancementTask } from '@/lib/characterAdvancement';
import type { Character, Feat } from '@/types/dnd';

const isFeat = (value: Feat | undefined): value is Feat => Boolean(value);

export function useAdvancementTasks(character: Partial<Character> | undefined): AdvancementTask[] {
  const { backgrounds, feats } = useContentLibrary();

  const resolvedClasses = useMemo(
    () =>
      resolveCharacterClasses({
        classes: character?.classes ?? [],
        getClassById: getRuntimeClassById,
        getSubclassById: getRuntimeSubclass
      }),
    [character?.classes]
  );

  const spellcastingRules = useMemo(
    () =>
      getSpellcastingRulesSummary({
        selectedClasses: resolvedClasses.map(({ entry, cls, subclass }) => ({
          cls,
          level: entry.level,
          subclassId: entry.subclassId,
          subclass
        })),
        abilityScores: character?.abilityScores,
        selectedSpells: character?.spells ?? [],
        getSpellById: getRuntimeSpellById
      }),
    [character?.abilityScores, character?.spells, resolvedClasses]
  );

  const heldFeats = useMemo(
    () => (character?.feats ?? []).map((featId) => getRuntimeFeatById(featId)).filter(isFeat),
    [character?.feats]
  );

  const speciesId = character?.speciesId;
  const variantId = character?.variantId;
  const backgroundId = character?.backgroundId;

  return useMemo(() => {
    if (!character || resolvedClasses.length === 0) return [];

    const species = speciesId ? getRuntimeSpeciesById(speciesId) : undefined;
    const variant = speciesId && variantId ? getRuntimeSpeciesVariant(speciesId, variantId) : undefined;
    const background = backgroundId ? backgrounds.find((entry) => entry.id === backgroundId) : undefined;
    // Expertise doubles a proficiency the character already holds, so its options are the merged
    // list rather than the builder's pick layer.
    const merged = deriveCharacterProficiencies({ character, resolvedClasses, background, species, variant });
    return deriveAdvancementTasks({
      character,
      // The builder's `proficiencies` is the pick layer already.
      selectedSkills: character.proficiencies?.skills ?? [],
      resolvedClasses,
      species,
      variant,
      background,
      featCatalogue: feats,
      feats: heldFeats,
      spellcastingRules,
      expertiseProficiencies: { skills: merged.skills, tools: merged.tools }
    });
  }, [backgroundId, backgrounds, character, feats, heldFeats, resolvedClasses, speciesId, spellcastingRules, variantId]);
}
