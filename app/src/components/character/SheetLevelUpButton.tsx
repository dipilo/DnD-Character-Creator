// Levelling up without leaving the sheet.
//
// A level is a number on the document and the builder's Class step is not the only place it may be
// raised — but which class gains the level is a real choice for a multiclass character, so the
// control names the class rather than picking one.
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ChevronUp } from 'lucide-react';
import { getRuntimeClassById } from '@/data';
import { applyLevelUp, canLevelUp, totalCharacterLevel } from '@/lib/characterAdvancement';
import type { ResolvedCharacterClass } from '@/lib/builderRules';
import type { Character } from '@/types/dnd';

interface SheetLevelUpButtonProps {
  readonly character: Character;
  readonly resolvedClasses: readonly ResolvedCharacterClass[];
  readonly onChange: (patch: Partial<Character>) => void;
}

export function SheetLevelUpButton({ character, resolvedClasses, onChange }: SheetLevelUpButtonProps) {
  if (resolvedClasses.length === 0) return null;

  if (!canLevelUp(character)) {
    return (
      <Button type="button" size="sm" variant="outline" className="min-h-11" disabled>
        Level {totalCharacterLevel(character)}
      </Button>
    );
  }

  const levelUp = (classId: string) => onChange(applyLevelUp(character, classId, getRuntimeClassById));

  if (resolvedClasses.length === 1) {
    const { cls, entry } = resolvedClasses[0];
    return (
      <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => levelUp(entry.classId)}>
        <ChevronUp className="mr-1 h-4 w-4" />
        Level Up ({cls.name} {entry.level + 1})
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="sm" variant="outline" className="min-h-11">
          <ChevronUp className="mr-1 h-4 w-4" />
          Level Up
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {resolvedClasses.map(({ cls, entry }) => (
          <DropdownMenuItem key={entry.classId} onSelect={() => levelUp(entry.classId)}>
            {cls.name} {entry.level} → {entry.level + 1}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
