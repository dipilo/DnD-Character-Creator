import type { Feature } from '@/types/dnd';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import {
  getFeatureOptionRequirementText,
  isFeatureOptionAvailable,
  type FeatureOptionAvailabilityContext
} from '@/lib/featureOptions';

interface FeatureOptionSelectorProps {
  readonly feature: Pick<Feature, 'id' | 'options' | 'chooseCount'>;
  readonly selectedOptionIds: string[];
  readonly onValueChange: (slotIndex: number, value: string) => void;
  readonly showDescriptions?: boolean;
  readonly selectionContext?: FeatureOptionAvailabilityContext;
}

export function FeatureOptionSelector({
  feature,
  selectedOptionIds,
  onValueChange,
  showDescriptions = true,
  selectionContext
}: FeatureOptionSelectorProps) {
  const featureOptions = feature.options ?? [];

  if (featureOptions.length === 0) {
    return null;
  }

  const choiceCount = feature.chooseCount ?? 1;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Options</p>
      <div className="space-y-2">
        {Array.from({ length: choiceCount }).map((_, index) => {
          const currentValue = selectedOptionIds[index];
          const blockedSelections = new Set(
            selectedOptionIds.filter((_, entryIndex) => entryIndex !== index)
          );

          return (
            <div key={`${feature.id}-slot-${index}`} className="flex items-center gap-2">
              <Select value={currentValue ?? '__none__'} onValueChange={(value) => onValueChange(index, value)}>
                <SelectTrigger>
                  <SelectValue placeholder={`Choose option ${index + 1}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {featureOptions.map((option) => {
                    const requirementText = getFeatureOptionRequirementText(option);
                    const alreadySelectedElsewhere = option.id !== currentValue && blockedSelections.has(option.id);
                    const available = option.id === currentValue || isFeatureOptionAvailable(option, selectionContext);
                    const disabled = alreadySelectedElsewhere || !available;
                    let optionLabel = option.name;

                    if (alreadySelectedElsewhere) {
                      optionLabel = `${optionLabel} (already selected)`;
                    } else if (requirementText && !available) {
                      optionLabel = `${optionLabel} (${requirementText})`;
                    }

                    return (
                      <SelectItem key={option.id} value={option.id} disabled={disabled}>
                        {optionLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {currentValue ? (
                <Button type="button" size="sm" variant="ghost" onClick={() => onValueChange(index, '__none__')}>
                  Clear
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
      {showDescriptions
        ? featureOptions.map((option) => {
            const requirementText = getFeatureOptionRequirementText(option);

            return (
              <div key={`${option.id}-description`} className="pl-4 text-sm text-muted-foreground">
                • <span className="font-medium">{option.name}:</span> <ContentReferenceText text={option.description} />
                {requirementText ? <span>{` Requires: ${requirementText}.`}</span> : null}
              </div>
            );
          })
        : null}
    </div>
  );
}