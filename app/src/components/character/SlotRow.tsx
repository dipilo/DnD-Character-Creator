// One row of pips for a spendable pool — a spell slot level, a Rage, a Ki Point.
//
// Shared by the resources panel and the spells panel so a slot is spent the same way wherever it
// is shown, and `onSetUsed` being absent is what makes a read-only sheet read-only.
import { cn } from '@/lib/utils';

interface SlotRowProps {
  readonly label: string;
  readonly total: number;
  readonly used: number;
  readonly onSetUsed?: (next: number) => void;
}

export function SlotRow({ label, total, used, onSetUsed }: SlotRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: total }, (_, index) => {
          const spent = index < used;
          // Clicking the last spent pip gives it back; clicking any available pip spends up to it.
          const next = spent && index === used - 1 ? index : index + 1;
          return (
            <button
              key={label + String(index)}
              type="button"
              aria-label={`${label} slot ${index + 1}`}
              aria-pressed={spent}
              disabled={!onSetUsed}
              onClick={() => onSetUsed?.(next)}
              className={cn(
                'h-5 w-5 rounded-sm border transition coarse:h-11 coarse:w-7',
                spent ? 'border-muted-foreground/40 bg-transparent' : 'border-primary bg-primary',
                onSetUsed ? 'cursor-pointer' : 'cursor-default'
              )}
            />
          );
        })}
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">{total - used}/{total}</span>
      </div>
    </div>
  );
}
