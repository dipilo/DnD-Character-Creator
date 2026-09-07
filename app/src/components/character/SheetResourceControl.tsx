// Spending a limited-use feature from the row that has it.
//
// The Class Resources card is where a whole pool is read at once; this is the other half — the one
// press that *uses* the feature, beside the feature. Rage and its siblings are entered rather than
// spent, which the resource itself already knows (`activatable`), so the control says Enter / End
// there and Use everywhere else.
//
// Shared by the Actions table and the Features tab. `onSetUsed` and `onToggleActive` being absent
// is what leaves a read-only sheet with the count and no buttons.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ResolvedClassResource } from '@/lib/sheetPlayState';

interface SheetResourceControlProps {
  readonly resource: ResolvedClassResource;
  readonly onSetUsed?: (next: number) => void;
  readonly onToggleActive?: () => void;
}

export function SheetResourceControl({ resource, onSetUsed, onToggleActive }: SheetResourceControlProps) {
  // The book's "Unlimited" is a real value and is not a thing to count down.
  const remaining = resource.maximum === null ? null : resource.maximum - resource.used;
  const exhausted = remaining !== null && remaining <= 0;
  const count = (
    <span className="text-xs tabular-nums text-muted-foreground">
      {remaining === null ? 'Unlimited' : `${remaining}/${resource.maximum}`}
    </span>
  );

  if (resource.activatable) {
    return (
      <div className="flex flex-wrap items-center gap-1">
        {resource.active ? <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">Active</Badge> : null}
        {onToggleActive ? (
          <Button
            type="button"
            size="sm"
            variant={resource.active ? 'default' : 'outline'}
            className="min-h-11"
            aria-pressed={resource.active}
            disabled={!resource.active && exhausted}
            onClick={onToggleActive}
          >
            {resource.active ? 'End' : 'Enter'}
          </Button>
        ) : null}
        {count}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {onSetUsed ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11"
          disabled={exhausted}
          onClick={() => onSetUsed(resource.used + 1)}
        >
          Use
        </Button>
      ) : null}
      {onSetUsed && resource.used > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-11"
          onClick={() => onSetUsed(resource.used - 1)}
        >
          Undo
        </Button>
      ) : null}
      {count}
    </div>
  );
}
