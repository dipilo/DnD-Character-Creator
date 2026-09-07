// Which way the next d20 leans. Sticky until changed, and every roll made under it says so in the
// tray, so a mode left on is visible rather than silently altering the numbers.
import { Button } from '@/components/ui/button';
import { D20_MODE_LABELS, useD20ModeStore, type D20Mode } from '@/lib/d20Rolls';

const MODES: D20Mode[] = ['normal', 'advantage', 'disadvantage'];

export function AdvantageToggle() {
  const mode = useD20ModeStore((state) => state.mode);
  const setMode = useD20ModeStore((state) => state.setMode);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">d20 rolls</span>
      <div className="flex flex-wrap gap-1">
        {MODES.map((entry) => (
          <Button
            key={entry}
            type="button"
            size="sm"
            variant={mode === entry ? 'default' : 'outline'}
            className="min-h-11"
            aria-pressed={mode === entry}
            onClick={() => setMode(entry)}
          >
            {D20_MODE_LABELS[entry]}
          </Button>
        ))}
      </div>
    </div>
  );
}
