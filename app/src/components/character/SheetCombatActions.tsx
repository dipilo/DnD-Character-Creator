// The actions every character has, printed the way the books list them: a name per line of a
// wrapped list under the timing that governs it, and the rule itself behind the name.
//
// They used to be rows of the attack table, which gave Dodge and Disengage a Range, a Hit/DC and a
// Damage column that could never hold anything — and no button, because there is nothing here to
// roll. A name that opens the rule is the whole interaction, so the list is names and the rule
// arrives in a drawer beside it.
//
// Nothing here is a list of actions written in the app: `combatActions` is imported from whichever
// printing this character plays.
import { useState } from 'react';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SHEET_ACTION_FILTER_LABELS, type SheetActionEntry } from '@/lib/sheetActions';

const paragraphsOf = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export function SheetCombatActions({ actions }: Readonly<{ actions: readonly SheetActionEntry[] }>) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...actions].sort((a, b) => a.name.localeCompare(b.name));
  const active = sorted.find((entry) => entry.id === openId);

  if (sorted.length === 0) return null;

  // The timing is singular here: the group heading names the set, the drawer names one action.
  const subtitle = active
    ? [SHEET_ACTION_FILTER_LABELS[active.group], active.meta].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="space-y-1.5">
      <h5 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Actions in Combat
      </h5>
      <div className="flex flex-wrap gap-x-1 gap-y-0.5">
        {sorted.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            className="flex min-h-9 items-center rounded px-1 text-sm font-medium text-primary transition-colors hover:bg-accent coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => setOpenId(entry.id)}
          >
            {entry.name}
            {index < sorted.length - 1 ? <span className="text-muted-foreground">,</span> : null}
          </button>
        ))}
      </div>

      <Sheet open={Boolean(active)} onOpenChange={(open) => setOpenId(open ? openId : null)}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto overscroll-contain sm:max-w-md"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>{active?.name}</SheetTitle>
            <SheetDescription>{subtitle}</SheetDescription>
          </SheetHeader>
          <div className="space-y-2 px-4 pb-6 text-sm leading-relaxed">
            {active?.summary ? (
              <p className="border-b pb-2 italic text-muted-foreground">{active.summary}</p>
            ) : null}
            {paragraphsOf(active?.description ?? '').map((paragraph) => (
              <p key={paragraph.slice(0, 60)}>
                <ContentReferenceText text={paragraph} />
              </p>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
