import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { ResolvedExpertiseGrant } from '@/lib/expertise';

interface ExpertiseSelectorProps {
  readonly grants: readonly ResolvedExpertiseGrant[];
  /** The picks for one grant, in slot order. */
  readonly onValueChange: (grantId: string, slotIndex: number, value: string | undefined) => void;
  readonly disabled?: boolean;
}

const NONE = '__none__';

/**
 * The picks an Expertise grant asks for. Options are the character's own proficiencies, because
 * that is what the books say the player chooses from, so a character with nothing to double gets
 * a line saying so rather than an empty select.
 */
export function ExpertiseSelector({ grants, onValueChange, disabled = false }: ExpertiseSelectorProps) {
  if (grants.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {grants.map((entry) => {
        const { grant } = entry;
        const slots = Array.from({ length: grant.count }, (_, index) => index);
        const nothingToDouble = entry.options.length === 0 && entry.selected.length === 0;

        return (
          <div key={grant.id} className="space-y-2">
            <p className="text-sm font-medium">
              Expertise{grant.level > 1 ? ` (level ${grant.level})` : ''}
            </p>
            {grant.fixed ? (
              <p className="text-sm text-muted-foreground">{grant.fixed.join(' and ')}</p>
            ) : null}
            {nothingToDouble ? (
              <p className="text-sm text-muted-foreground">
                Choose skill proficiencies first, then come back to double one.
              </p>
            ) : null}
            {!grant.fixed && !nothingToDouble
              ? slots.map((slotIndex) => {
                const currentValue = entry.selected[slotIndex];
                const takenHere = new Set(entry.selected.filter((_, index) => index !== slotIndex));
                const offered = entry.options.filter((option) => option === currentValue || !takenHere.has(option));

                return (
                  <div key={`${grant.id}-slot-${slotIndex}`} className="flex items-center gap-2">
                    <Select
                      value={currentValue ?? NONE}
                      disabled={disabled}
                      onValueChange={(value) => onValueChange(grant.id, slotIndex, value === NONE ? undefined : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Choose proficiency ${slotIndex + 1}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {offered.map((option) => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentValue ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={disabled}
                        onClick={() => onValueChange(grant.id, slotIndex, undefined)}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                );
              })
              : null}
          </div>
        );
      })}
    </div>
  );
}
