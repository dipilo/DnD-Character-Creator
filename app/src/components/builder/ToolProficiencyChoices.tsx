import { useCharacterStore } from '@/store/characterStore';
import { resolveClassById, useContentLibrary } from '@/data';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import {
  getSelectedClassEdition,
  getToolProficiencyChoice,
  updateToolProficiencySelection,
  type SelectedClassWithLevel
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
  const { classes, equipment } = useContentLibrary();
  const toolEquipment = equipment.filter((entry) => entry.type === 'tool');
  const selections = builderState.character?.toolProficiencySelections;

  // The two printings of a tool ("Dice Set" / "Dice") collapse to one option, and the character's
  // own ruleset decides which name it is offered under.
  const selectedClasses = (builderState.character?.classes ?? [])
    .map((entry) => {
      const cls = resolveClassById(classes, entry.classId);
      return cls ? { cls, level: entry.level } : undefined;
    })
    .filter((entry): entry is SelectedClassWithLevel => Boolean(entry));
  const preferredEdition = getSelectedClassEdition(selectedClasses);

  const entries = labels.map((label, index) => ({
    label,
    choice: getToolProficiencyChoice(label, `${idPrefix}-${index}`, toolEquipment, preferredEdition)
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
              // A pick made under the other printing's name ("Dice Set") is still the player's
              // choice; keep it listed rather than showing an empty selector over a stored value.
              const options = currentValue && !choice.options.includes(currentValue)
                ? [currentValue, ...choice.options]
                : choice.options;

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
                      {options
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
