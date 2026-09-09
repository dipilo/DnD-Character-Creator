import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ABILITY_ABBREVIATIONS,
  formatModifier,
  type SheetVitals,
} from '@/lib/sheetDerivations';
import { senseLabel } from '@/lib/sheetCombat';
import { rollD20 } from '@/lib/d20Rolls';
import { SheetAbilityBlocks } from '@/components/character/SheetAbilityBlocks';
import { cn } from '@/lib/utils';

/** One boxed number, the way a play sheet leads with them. Rollable when a d20 check exists for it. */
export function Stat({
  label,
  value,
  hint,
  roll,
  compact,
}: Readonly<{
  label: string;
  value: string;
  hint?: string;
  roll?: { label: string; modifier: number };
  /** The rail's version: one size down, because the column is 19rem wide and very tall. */
  compact?: boolean;
}>) {
  const body = (
    <>
      <p className="text-[0.65rem] font-medium uppercase leading-4 tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('font-bold tabular-nums', compact ? 'text-lg leading-6' : 'mt-1 text-2xl')}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{hint}</p> : null}
    </>
  );

  const shell = cn('rounded-lg border bg-card text-center', compact ? 'p-2' : 'p-3');

  if (!roll) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        shell,
        'min-h-11 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
      )}
      onClick={() => void rollD20({ modifier: roll.modifier, label: roll.label })}
    >
      {body}
    </button>
  );
}

/**
 * Initiative, speed, the passive scores, then the six ability blocks that hold the saves and skills.
 *
 * Everything here is derived from the character document — no value is editable, because none of
 * them are things a player changes. Rolling one is not editing it: a check goes to the shared dice
 * tray and writes nothing back, which is why a read-only party view can roll from it too.
 */
export function SheetVitalsPanel({
  vitals,
  variant = 'panel',
}: Readonly<{
  vitals: SheetVitals;
  /** `rail` is one narrow column; the two are mutually exclusive by media query, so nothing renders twice. */
  variant?: 'rail' | 'panel';
}>) {
  const inRail = variant === 'rail';

  return (
    <div className="space-y-3">
      {/* No proficiency bonus here: the rail already leads with one, and two copies of the same
          number read as two different stats. */}
      <div className={cn('grid gap-2', inRail ? 'grid-cols-3' : 'grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5')}>
        <Stat
          label="Initiative"
          value={formatModifier(vitals.initiative)}
          compact={inRail}
          roll={{ label: 'Initiative', modifier: vitals.initiative }}
        />
        <Stat label="Speed" value={`${vitals.speed} ft`} compact={inRail} />
        <Stat label="Passive Perc." value={String(vitals.passivePerception)} compact={inRail} />
        <Stat label="Passive Inv." value={String(vitals.passiveInvestigation)} compact={inRail} />
        <Stat label="Passive Ins." value={String(vitals.passiveInsight)} compact={inRail} />
        {/* A special sense is a stat a player reads, not a trait they look up — the range is the
            whole of it, and the feature that granted it is the hint. */}
        {vitals.senses.map((sense) => (
          <Stat
            key={sense.sense}
            label={senseLabel(sense)}
            value={`${sense.range} ft`}
            hint={inRail ? undefined : sense.source}
            compact={inRail}
          />
        ))}
      </div>

      <SheetAbilityBlocks saves={vitals.saves} skills={vitals.skills} variant={variant} />
    </div>
  );
}

/**
 * Save DC and spell attack per casting class. It sits on the Spells tab beside the spells it
 * describes rather than in the rail: a save DC is read while casting, not while doing something else.
 */
export function SheetSpellcastingCard({ vitals }: Readonly<{ vitals: SheetVitals }>) {
  if (vitals.spellcasting.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Spellcasting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {vitals.spellcasting.map((entry) => (
          <div key={entry.className} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">
              {entry.className}
              <span className="ml-2 text-xs uppercase text-muted-foreground">
                {ABILITY_ABBREVIATIONS[entry.ability]}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-2 tabular-nums text-muted-foreground">
              <span>
                Save DC <span className="font-semibold text-foreground">{entry.saveDc}</span>
              </span>
              <button
                type="button"
                className="min-h-11 rounded px-2 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() =>
                  void rollD20({
                    modifier: entry.attackBonus,
                    label: `${entry.className} spell attack`,
                    detail: 'd20 check',
                  })
                }
              >
                Attack <span className="font-semibold text-foreground">{formatModifier(entry.attackBonus)}</span>
              </button>
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
