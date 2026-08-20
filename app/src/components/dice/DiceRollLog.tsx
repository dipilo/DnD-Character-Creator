// The shared roll history. Every roll the app settles is logged by `diceTrayStore`, wherever it was
// thrown from, so this reads the same list on the roller page as it would anywhere else.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { isMaximum, useDiceTrayStore, type DiceRollLogEntry } from '@/store/diceTrayStore';

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

interface DiceRollLogProps {
  /** Styling for the dark roller page; the tray's own card uses the app palette. */
  dark?: boolean;
  emptyMessage?: string;
  /**
   * Throw one die of the newest roll again. Offered only by a caller that owns the surface those
   * dice are still sitting on: dice-box can only reroll a die it is currently rendering.
   */
  onRerollDie?: (index: number) => void;
  rerollDisabled?: boolean;
}

export function DiceRollLog({
  dark = false,
  emptyMessage = 'Roll the dice to start a history.',
  onRerollDie,
  rerollDisabled = false,
}: Readonly<DiceRollLogProps>) {
  const log = useDiceTrayStore((state) => state.log);
  const clearLog = useDiceTrayStore((state) => state.clearLog);

  const mutedClass = dark ? 'text-slate-400' : 'text-muted-foreground';
  const rowClass = dark ? 'border-white/10 bg-white/5' : 'border bg-muted/40';

  if (log.length === 0) {
    return <p className={`text-sm ${dark ? 'text-slate-300' : 'text-muted-foreground'}`}>{emptyMessage}</p>;
  }

  const [latest, ...earlier] = log;

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border p-3 ${rowClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{latest.label}</p>
            <p className={`truncate text-xs ${mutedClass}`}>
              {[latest.detail, latest.notation].filter(Boolean).join(' · ')}
            </p>
          </div>
          <p className={`text-3xl font-bold leading-none tabular-nums ${dark ? 'text-white' : ''}`}>{latest.total}</p>
        </div>
        <DiceBadges entry={latest} onRerollDie={onRerollDie} rerollDisabled={rerollDisabled} />
        {onRerollDie ? (
          <p className={`mt-1.5 text-xs ${mutedClass}`}>Click a die to throw it again.</p>
        ) : null}
        {latest.note ? <p className={`mt-2 text-xs ${mutedClass}`}>{latest.note}</p> : null}
      </div>

      {earlier.length > 0 ? (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto overscroll-contain pr-1 touch-pan-y">
          {earlier.map((entry) => (
            <li key={entry.id} className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${rowClass}`}>
              <div className="min-w-0">
                <p className="truncate text-sm">{entry.label}</p>
                <p className={`truncate text-xs ${mutedClass}`}>
                  {[entry.notation, entry.results.map((r) => r.value ?? '?').join(', '), formatTime(entry.at)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span className="shrink-0 text-lg font-semibold tabular-nums">{entry.total}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <Button
        type="button"
        variant={dark ? 'outline' : 'ghost'}
        size="sm"
        className={dark ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : ''}
        onClick={clearLog}
      >
        Clear history
      </Button>
    </div>
  );
}

interface DiceBadgesProps {
  entry: DiceRollLogEntry;
  onRerollDie?: (index: number) => void;
  rerollDisabled?: boolean;
}

function DiceBadges({ entry, onRerollDie, rerollDisabled = false }: Readonly<DiceBadgesProps>) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {entry.results.map((result, index) => {
        const label = `d${result.sides ?? '?'}: ${result.value ?? '?'}`;
        const badge = (
          <Badge variant={isMaximum(result) ? 'default' : 'secondary'} className="tabular-nums">
            {label}
          </Badge>
        );
        const key = `${result.rollId ?? 'x'}-${result.sides}-${index}`;
        // A die with no `rollId` was resolved instantly and is not on any surface to throw again.
        if (!onRerollDie || result.rollId == null) return <span key={key}>{badge}</span>;
        return (
          <button
            key={key}
            type="button"
            disabled={rerollDisabled}
            onClick={() => onRerollDie(index)}
            aria-label={`Reroll ${label}`}
            className="rounded-full transition hover:brightness-110 disabled:opacity-50"
          >
            {badge}
          </button>
        );
      })}
      {entry.modifier !== 0 ? (
        <Badge variant="outline" className="tabular-nums">{formatSigned(entry.modifier)}</Badge>
      ) : null}
      {entry.luckyBreaks > 0 ? (
        <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">
          {entry.luckyBreaks === 1 ? 'Lucky Break' : `${entry.luckyBreaks} Lucky Breaks`}
        </Badge>
      ) : null}
    </div>
  );
}
