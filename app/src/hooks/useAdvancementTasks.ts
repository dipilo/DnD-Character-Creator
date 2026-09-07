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
import { getSpellcastingRulesSummary, resolveCharacterClasses } from '@/lib/builderRules';
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
    return deriveAdvancementTasks({
      character,
      resolvedClasses,
      species,
      variant: speciesId && variantId ? getRuntimeSpeciesVariant(speciesId, variantId) : undefined,
      background: backgroundId ? backgrounds.find((entry) => entry.id === backgroundId) : undefined,
      featCatalogue: feats,
      feats: heldFeats,
      spellcastingRules
    });
  }, [backgroundId, backgrounds, character, feats, heldFeats, resolvedClasses, speciesId, spellcastingRules, variantId]);
}
