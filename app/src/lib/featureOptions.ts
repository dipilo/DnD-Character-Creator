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

/** A feature offering options is a stub without the picks printed beside it. */
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

/** Shared by matching option ids, so nothing has to name a pool. */
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

/** A feature that lists options and states no count is one pick, which is what the selector offers. */
export const featureChoiceCount = (feature: Pick<Feature, 'chooseCount' | 'options'>) =>
  feature.chooseCount ?? (feature.options?.length ? 1 : 0);
