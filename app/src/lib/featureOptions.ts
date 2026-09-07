import type { CharacterFeatureSelection, Feature, FeatureOption } from '@/types/dnd';

export interface FeatureOptionAvailabilityContext {
  level?: number;
  selectedFeatureChoices?: CharacterFeatureSelection[];
  selectedSpellIds?: string[];
}

export const getSelectedFeatureOptionIds = (
  selectedFeatureChoices: CharacterFeatureSelection[] | undefined,
  featureId: string
) => {
  return (selectedFeatureChoices ?? [])
    .filter((entry) => entry.featureId === featureId && entry.optionId)
    .map((entry) => entry.optionId as string);
};

export const updateFeatureOptionSelections = (
  currentSelections: CharacterFeatureSelection[] | undefined,
  featureId: string,
  slotIndex: number,
  optionId: string,
  chooseCount = 1
) => {
  const existingSelections = currentSelections ?? [];
  const otherSelections = existingSelections.filter((entry) => entry.featureId !== featureId);
  const selectedOptionIds = getSelectedFeatureOptionIds(existingSelections, featureId)
    .filter((entry, index, collection) => collection.indexOf(entry) === index);
  const nextOptionIds = selectedOptionIds.filter((_, index) => index !== slotIndex && index < chooseCount);

  if (optionId !== '__none__') {
    const insertionIndex = Math.min(slotIndex, nextOptionIds.length);
    nextOptionIds.splice(insertionIndex, 0, optionId);
  }

  return [
    ...otherSelections,
    ...nextOptionIds.slice(0, chooseCount).map((entry) => ({ featureId, optionId: entry }))
  ];
};

export const getFeatureOptionRequirementText = (option: FeatureOption) => option.prerequisites?.text;

/**
 * The options this character actually chose for a feature, in the order they were chosen.
 *
 * A feature that offers options is a stub without them — "Eldritch Invocations" reads as a
 * sentence about a list, and the two invocations the player picked are the thing they need on the
 * sheet.
 */
export const getChosenFeatureOptions = (
  feature: Pick<Feature, 'id' | 'options'>,
  selectedFeatureChoices: CharacterFeatureSelection[] | undefined
): FeatureOption[] => {
  const options = feature.options ?? [];
  if (options.length === 0) {
    return [];
  }

  const byId = new Map(options.map((option) => [option.id, option]));
  return getSelectedFeatureOptionIds(selectedFeatureChoices, feature.id)
    .map((optionId) => byId.get(optionId))
    .filter((option): option is FeatureOption => Boolean(option));
};

/**
 * The options this feature offers that another feature has already spent.
 *
 * Two features share a pool when they offer the same option — "Additional Eldritch Invocation" is
 * the same list as "Eldritch Invocations" — so nothing has to name a pool for the exclusion to
 * hold, and a pool added by a supplement is covered the moment its options reach both features.
 */
export const getPoolBlockedOptionIds = (
  siblingFeatures: ReadonlyArray<Pick<Feature, 'id' | 'options'>>,
  featureId: string,
  selectedFeatureChoices: CharacterFeatureSelection[] | undefined
): Set<string> => {
  const feature = siblingFeatures.find((entry) => entry.id === featureId);
  const ownOptionIds = new Set((feature?.options ?? []).map((option) => option.id));
  const blocked = new Set<string>();
  if (ownOptionIds.size === 0) {
    return blocked;
  }

  for (const sibling of siblingFeatures) {
    if (sibling.id === featureId) continue;
    const sharesPool = (sibling.options ?? []).some((option) => ownOptionIds.has(option.id));
    if (!sharesPool) continue;

    for (const optionId of getSelectedFeatureOptionIds(selectedFeatureChoices, sibling.id)) {
      if (ownOptionIds.has(optionId)) blocked.add(optionId);
    }
  }

  return blocked;
};

export const isFeatureOptionAvailable = (
  option: FeatureOption,
  context?: FeatureOptionAvailabilityContext
) => {
  const prerequisites = option.prerequisites;
  if (!prerequisites) {
    return true;
  }

  if (prerequisites.minimumLevel && (context?.level ?? 0) < prerequisites.minimumLevel) {
    return false;
  }

  if (prerequisites.requiredOptionIds?.length) {
    const selectedOptionIds = new Set(
      (context?.selectedFeatureChoices ?? [])
        .map((entry) => entry.optionId)
        .filter((entry): entry is string => Boolean(entry))
    );

    if (!prerequisites.requiredOptionIds.every((entry) => selectedOptionIds.has(entry))) {
      return false;
    }
  }

  if (prerequisites.requiredSpellIds?.length) {
    const selectedSpellIds = new Set(context?.selectedSpellIds ?? []);
    if (!prerequisites.requiredSpellIds.every((entry) => selectedSpellIds.has(entry))) {
      return false;
    }
  }

  return true;
};