// The character's level, on the sheet, in both directions.
//
// A level is a number on the document and the builder's Class step is not the only place it may be
// set — but which class gains or gives back the level is a real choice for a multiclass character,
// so the menu names the class rather than picking one. Levelling is something a player tries out,
// which is why the control that raises a level also lowers it.
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { getRuntimeClassById } from '@/data';
import {
  applyLevelDown,
  applyLevelUp,
  canLevelDown,
  canLevelUp,
  totalCharacterLevel
} from '@/lib/characterAdvancement';
import type { ResolvedCharacterClass } from '@/lib/builderRules';
import type { Character } from '@/types/dnd';

interface SheetLevelControlProps {
  readonly character: Character;
  readonly resolvedClasses: readonly ResolvedCharacterClass[];
  readonly onChange: (patch: Partial<Character>) => void;
}

export function SheetLevelControl({ character, resolvedClasses, onChange }: SheetLevelControlProps) {
  if (resolvedClasses.length === 0) return null;

  const total = totalCharacterLevel(character);
  const canRaise = canLevelUp(character);
  const canLower = canLevelDown(character);

  if (!canRaise && !canLower) {
    return (
      <Button type="button" size="sm" variant="outline" className="min-h-11" disabled>
        Level {total}
      </Button>
    );
  }

  const raise = (classId: string) => onChange(applyLevelUp(character, classId, getRuntimeClassById));
  const lower = (classId: string) => onChange(applyLevelDown(character, classId, getRuntimeClassById));
  const lowerable = resolvedClasses.filter(({ entry }) => entry.level > 1);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="min-h-11">
          Level {total}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[calc(100dvh-8rem)] overflow-y-auto">
        {canRaise ? (
          <>
            <DropdownMenuLabel>Level up</DropdownMenuLabel>
            {resolvedClasses.map(({ cls, entry }) => (
              <DropdownMenuItem key={`up-${entry.classId}`} onSelect={() => raise(entry.classId)}>
                {cls.name} {entry.level} → {entry.level + 1}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}

        {canRaise && canLower ? <DropdownMenuSeparator /> : null}

        {canLower ? (
          <>
            <DropdownMenuLabel>Level down</DropdownMenuLabel>
            {lowerable.map(({ cls, entry }) => (
              <DropdownMenuItem key={`down-${entry.classId}`} onSelect={() => lower(entry.classId)}>
                {cls.name} {entry.level} → {entry.level - 1}
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
