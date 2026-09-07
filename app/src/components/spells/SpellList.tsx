// A character's spells: name and level in the row, everything else behind the disclosure.
//
// The row is what a player reads down at the table, so it carries the name, the level and the
// controls; the statblock and the description open underneath it, and the spell's own page is one
// link away for reading it properly.
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { SpellDetail } from '@/components/spells/SpellDetail';
import { formatSpellLevel, spellReferencePath } from '@/components/spells/spellFormatting';
import type { Spell } from '@/types/dnd';

export interface SpellListEntry {
  /** The stored id, which is also the key. */
  id: string;
  /** The name to print when the library does not know the spell. */
  name: string;
  spell?: Spell;
  level: number;
  /** Badges shown beside the name — "Prepared", "From Magic Initiate". */
  tags?: string[];
  /** The row's own controls: prepare, remove, cast. */
  actions?: ReactNode;
}

interface SpellListProps {
  readonly entries: readonly SpellListEntry[];
  /** Rendered when there is nothing to list. */
  readonly emptyMessage: string;
}

export function SpellList({ entries, emptyMessage }: SpellListProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const byLevel = new Map<number, SpellListEntry[]>();
  for (const entry of entries) {
    byLevel.set(entry.level, [...(byLevel.get(entry.level) ?? []), entry]);
  }
  const levels = [...byLevel.keys()].sort((left, right) => left - right);

  return (
    <div className="space-y-4">
      {levels.map((level) => (
        <div key={level}>
          <h4 className="mb-2 text-sm font-medium text-muted-foreground">
            {level === 0 ? 'Cantrips' : formatSpellLevel(level)}
          </h4>
          <Accordion type="multiple" className="w-full rounded-lg border">
            {(byLevel.get(level) ?? []).map((entry) => (
              <SpellListRow key={entry.id} entry={entry} />
            ))}
          </Accordion>
        </div>
      ))}
    </div>
  );
}

function SpellListRow({ entry }: Readonly<{ entry: SpellListEntry }>) {
  return (
    <AccordionItem value={entry.id} className="px-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <AccordionTrigger className="min-w-0 flex-1 py-3">
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-left">
            <span className="break-words font-medium">{entry.spell?.name ?? entry.name}</span>
            <span className="text-xs text-muted-foreground">
              {entry.spell ? `${formatSpellLevel(entry.level)} · ${entry.spell.school}` : formatSpellLevel(entry.level)}
            </span>
            {(entry.tags ?? []).map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </span>
        </AccordionTrigger>
        {entry.actions ? <div className="flex flex-wrap items-center gap-2 py-2">{entry.actions}</div> : null}
      </div>
      <AccordionContent className="pb-4">
        {entry.spell ? (
          <div>
            <SpellDetail spell={entry.spell} />
            <Button asChild variant="outline" size="sm" className="mt-3 min-h-11">
              <Link to={spellReferencePath(entry.spell.id)}>
                Open spell page
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            This spell is not in the sources this character has enabled, so only its name is stored.
          </p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
