// Cast, and the slot it costs.
//
// A cantrip costs nothing so it says At Will, and a levelled spell spends its lowest usable slot on
// one click; the caret beside it is where upcasting lives, so a bigger slot stays a real choice
// without being the only way to cast. The button names the act, not the bookkeeping — which slot
// went is read off the slot track, and "Cast (pact 3)" was a label restating what the row below it
// already shows.
//
// Shared by the Spells tab and the Actions table, which both offer a cast of the same spell.
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import type { CastableSlot } from '@/lib/spellCasting';

interface CastControlsProps {
  readonly spellName: string;
  readonly spellLevel: number;
  readonly slots: readonly CastableSlot[];
  /** False on a read-only sheet, where a cantrip still casts because it spends nothing. */
  readonly canSpend: boolean;
  readonly onCast: (slot?: CastableSlot) => void;
}

export function SpellCastControls({ spellName, spellLevel, slots, canSpend, onCast }: CastControlsProps) {
  if (spellLevel === 0) {
    return (
      <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onCast()}>
        At Will
      </Button>
    );
  }

  if (!canSpend) return null;

  if (slots.length === 0) {
    return (
      <Button type="button" size="sm" variant="outline" className="min-h-11" disabled>
        No slots
      </Button>
    );
  }

  const [lowest, ...higher] = slots;

  return (
    <div className="flex items-center">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className={higher.length > 0 ? 'min-h-11 rounded-r-none border-r-0' : 'min-h-11'}
        onClick={() => onCast(lowest)}
      >
        Cast
      </Button>
      {higher.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 rounded-l-none px-2"
              aria-label={`Cast ${spellName} with a higher slot`}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {higher.map((slot) => (
              <DropdownMenuItem key={`${slot.pact ? 'pact' : 'slot'}-${slot.level}`} onSelect={() => onCast(slot)}>
                {slot.pact ? `Pact slot (level ${slot.level})` : `Level ${slot.level} slot`} · {slot.remaining} left
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
