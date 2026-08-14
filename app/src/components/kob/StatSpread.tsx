import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DIE_DESCRIPTIONS,
  KOB_STAT_IDS,
  getStatName,
  kob,
  statBonusesForAge,
} from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobDie, KobStatId } from '@/data/gameSystems/kidsOnBikes/types';
import { cn } from '@/lib/utils';

interface StatSpreadProps {
  statDice: Record<KobStatId, KobDie>;
  age: string | null;
  /** Omitted on the sheet, where the spread is fixed. */
  onChange?: (statId: KobStatId, die: KobDie) => void;
  className?: string;
}

/**
 * The six stats and their dice, with the age's +1s shown against the stat they modify rather than
 * folded into the die — the die is what you roll, the +1 is what you add after.
 */
export function StatSpread({ statDice, age, onChange, className }: Readonly<StatSpreadProps>) {
  const bonuses = statBonusesForAge(age);
  const editable = typeof onChange === 'function';

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {KOB_STAT_IDS.map((statId) => {
        const die = statDice[statId];
        const bonus = bonuses[statId] ?? 0;
        const controlId = `kob-stat-${statId}`;
        return (
          <div key={statId} className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={controlId} className="text-sm font-semibold">
                {getStatName(statId)}
              </Label>
              {bonus > 0 ? (
                <Badge variant="secondary" className="shrink-0">
                  +{bonus} from age
                </Badge>
              ) : null}
            </div>
            {editable ? (
              <Select value={die} onValueChange={(value) => onChange(statId, value as KobDie)}>
                <SelectTrigger id={controlId} className="mt-2 h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kob.diceOrder.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option} — {DIE_DESCRIPTIONS[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-2 text-2xl font-bold text-brand">
                {die}
                {bonus > 0 ? <span className="ml-1 text-base text-muted-foreground">+{bonus}</span> : null}
              </p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{DIE_DESCRIPTIONS[die]}</p>
          </div>
        );
      })}
    </div>
  );
}
