import type { CharacterFeatureSelection, FeatureOption } from '@/types/dnd';

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