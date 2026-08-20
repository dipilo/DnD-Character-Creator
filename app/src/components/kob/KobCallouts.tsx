// The vault's callouts, with the fold state Obsidian's `+`/`-` already recorded.
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { KobCallout } from '@/data/gameSystems/kidsOnBikes/types';

export function KobCallouts({ callouts }: Readonly<{ callouts: KobCallout[] }>) {
  return (
    <>
      {callouts.map((callout) => (
        <Collapsible key={callout.kind} defaultOpen={callout.defaultOpen}>
          <CollapsibleTrigger className="group flex min-h-11 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground">
            {callout.kind}
            <ChevronDown className="size-3.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="max-w-prose space-y-2 pt-1">
            {callout.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </>
  );
}
