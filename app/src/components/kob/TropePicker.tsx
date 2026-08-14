import { useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KOB_STAT_IDS, getStatName, kob } from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobTrope } from '@/data/gameSystems/kidsOnBikes/types';
import { cn } from '@/lib/utils';

interface TropePickerProps {
  selectedId: string | null;
  onSelect: (trope: KobTrope) => void;
}

/** The two stats a trope is best and worst at — the fastest read of what it plays like. */
function extremes(trope: KobTrope) {
  const best = KOB_STAT_IDS.find((statId) => trope.statDice[statId] === 'd20');
  const worst = KOB_STAT_IDS.find((statId) => trope.statDice[statId] === 'd4');
  return { best, worst };
}

export function TropePicker({ selectedId, onSelect }: Readonly<TropePickerProps>) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const tropes = needle
    ? kob.tropes.filter(
        (trope) =>
          trope.name.toLowerCase().includes(needle) ||
          trope.ages.some((age) => age.includes(needle)),
      )
    : kob.tropes;

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="trope-search" className="sr-only">
          Search tropes
        </Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="trope-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or age"
            className="pl-9"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {tropes.map((trope) => {
          const { best, worst } = extremes(trope);
          const selected = trope.id === selectedId;
          return (
            <button
              key={trope.id}
              type="button"
              onClick={() => onSelect(trope)}
              className={cn(
                'flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors',
                selected ? 'border-primary bg-accent' : 'hover:border-primary/40 hover:bg-accent/50',
              )}
              aria-pressed={selected}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold leading-tight">{trope.name}</span>
                {selected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {trope.ages.map((age) => (
                  <Badge key={age} variant="outline" className="capitalize">
                    {age}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {best ? `d20 ${getStatName(best)}` : null}
                {best && worst ? ' · ' : null}
                {worst ? `d4 ${getStatName(worst)}` : null}
              </p>
            </button>
          );
        })}
      </div>

      {tropes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No trope matches "{query}".</p>
      ) : null}
    </div>
  );
}
