import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DIE_DESCRIPTIONS,
  DIE_FACES,
  KOB_STAT_IDS,
  difficultyBandFor,
  getStatName,
  kob,
  statBonusesForAge,
} from '@/data/gameSystems/kidsOnBikes/rules';
import { modifierNotation } from '@/lib/diceNotation';
import { rollOnScreen } from '@/store/diceTrayStore';
import type { KobDie, KobStatId } from '@/data/gameSystems/kidsOnBikes/types';
import { cn } from '@/lib/utils';

interface StatSpreadProps {
  statDice: Record<KobStatId, KobDie>;
  age: string | null;
  /** Omitted on the sheet, where the spread is fixed. */
  onChange?: (statId: KobStatId, die: KobDie) => void;
  /** Turns each fixed die into a Stat Check button. Only meaningful when `onChange` is omitted. */
  rollable?: boolean;
  className?: string;
}

/**
 * Throw a Stat Check. The Lucky Break is the tray's `explodeOnMax`, and the line under the total
 * is read off the imported difficulty table rather than a scale written into this component.
 */
function rollStatCheck(statId: KobStatId, die: KobDie, bonus: number) {
  const faces = DIE_FACES[die];
  if (!faces) return;

  void rollOnScreen({
    notation: modifierNotation(faces, bonus),
    label: `${getStatName(statId)} check`,
    detail: bonus > 0 ? `${die} +${bonus} from age` : die,
    explodeOnMax: true,
    describeOutcome: (outcome) => {
      const band = difficultyBandFor(outcome.total);
      return band ? `Beats a difficulty of ${band.range}.` : null;
    },
  });
}

/**
 * The six stats and their dice, with the age's +1s shown against the stat they modify rather than
 * folded into the die — the die is what you roll, the +1 is what you add after.
 */
export function StatSpread({ statDice, age, onChange, rollable, className }: Readonly<StatSpreadProps>) {
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
            ) : null}
            {!editable && rollable ? (
              <button
                type="button"
                className="mt-2 min-h-11 w-full rounded-md border text-2xl font-bold text-brand transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => rollStatCheck(statId, die, bonus)}
              >
                {die}
                {bonus > 0 ? <span className="ml-1 text-base text-muted-foreground">+{bonus}</span> : null}
              </button>
            ) : null}
            {!editable && !rollable ? (
              <p className="mt-2 text-2xl font-bold text-brand">
                {die}
                {bonus > 0 ? <span className="ml-1 text-base text-muted-foreground">+{bonus}</span> : null}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">{DIE_DESCRIPTIONS[die]}</p>
          </div>
        );
      })}
    </div>
  );
}
