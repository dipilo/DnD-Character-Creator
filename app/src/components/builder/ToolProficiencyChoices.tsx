import { useCharacterStore } from '@/store/characterStore';
import { useContentLibrary } from '@/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import {
  getToolProficiencyChoice,
  updateToolProficiencySelection
} from '@/lib/builderRules';

interface ToolProficiencyChoicesProps {
  /** Raw tool proficiency labels as printed by the source, choices and fixed grants mixed. */
  readonly labels: string[];
  /** Stable per-owner prefix from `getToolChoiceIdPrefix`, so class and background picks stay apart. */
  readonly idPrefix: string;
  readonly disabled?: boolean;
  readonly disabledHint?: string;
}

const NONE_VALUE = '__none__';

export function ToolProficiencyChoices({ labels, idPrefix, disabled = false, disabledHint }: ToolProficiencyChoicesProps) {
  const { builderState, updateBuilderCharacter } = useCharacterStore();
  const { equipment } = useContentLibrary();
  const toolEquipment = equipment.filter((entry) => entry.type === 'tool');
  const selections = builderState.character?.toolProficiencySelections;

  const entries = labels.map((label, index) => ({
    label,
    choice: getToolProficiencyChoice(label, `${idPrefix}-${index}`, toolEquipment)
  }));
  const hasChoices = entries.some((entry) => entry.choice);

  const setSelection = (choiceId: string, slotIndex: number, value: string, chooseCount: number) => {
    updateBuilderCharacter({
      toolProficiencySelections: updateToolProficiencySelection(
        selections,
        choiceId,
        slotIndex,
        value === NONE_VALUE ? undefined : value,
        chooseCount
      )
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {entries.filter((entry) => !entry.choice).map((entry) => (
          <Badge key={entry.label} variant="outline"><ContentReferenceText text={entry.label} /></Badge>
        ))}
      </div>

      {entries.map(({ label, choice }) => {
        if (!choice) {
          return null;
        }

        const selected = selections?.[choice.id] ?? [];

        return (
          <div key={choice.id} className="space-y-2">
            <p className="text-sm text-muted-foreground">{label}</p>
            {Array.from({ length: choice.chooseCount }).map((_, slotIndex) => {
              const currentValue = selected[slotIndex];
              const takenElsewhere = new Set(selected.filter((_, entryIndex) => entryIndex !== slotIndex));

              return (
                <div key={`${choice.id}-slot-${slotIndex}`} className="flex items-center gap-2">
                  <Select
                    value={currentValue ?? NONE_VALUE}
                    onValueChange={(value) => setSelection(choice.id, slotIndex, value, choice.chooseCount)}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={`Choose tool ${slotIndex + 1}`} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {choice.options
                        .filter((option) => option === currentValue || !takenElsewhere.has(option))
                        .map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {currentValue ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelection(choice.id, slotIndex, NONE_VALUE, choice.chooseCount)}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        );
      })}

      {hasChoices && disabled && disabledHint ? (
        <p className="text-xs text-muted-foreground">{disabledHint}</p>
      ) : null}
    </div>
  );
}
