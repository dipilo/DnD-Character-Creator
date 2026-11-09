import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ABILITY_ABBREVIATIONS,
  formatModifier,
  type SheetVitals,
} from '@/lib/sheetDerivations';
import { senseLabel } from '@/lib/sheetCombat';
import { effectiveModifier, rollD20 } from '@/lib/d20Rolls';
import { applyRollEffects, type AppliedRollEffects } from '@/lib/rollEffects';
import { DerivationHint } from '@/components/character/DerivationHint';
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
  roll?: { label: string; modifier: number; effects?: AppliedRollEffects };
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
      onClick={() => void rollD20({ modifier: roll.modifier, label: roll.label, effects: roll.effects })}
    >
      {body}
    </button>
  );
}

/** "10 + Perception +5" — the formula both printings state, with this character's own figure. */
function passiveHint(vitals: SheetVitals, skill: string): string | undefined {
  const entry = vitals.skills.find((candidate) => candidate.name === skill);
  return entry ? `10 + ${skill} ${formatModifier(entry.modifier)}` : undefined;
}

/** All derived and none editable; rolling writes nothing, so a reader can roll too. */
export function SheetVitalsPanel({
  vitals,
  variant = 'panel',
}: Readonly<{
  vitals: SheetVitals;
  /** `rail` is one narrow column; the two are mutually exclusive by media query, so nothing renders twice. */
  variant?: 'rail' | 'panel';
}>) {
  const inRail = variant === 'rail';
  const initiativeEffects = applyRollEffects(vitals.rollEffects, { kind: 'initiative', ability: 'dexterity' });

  return (
    <div className="space-y-3">
      {/* No proficiency bonus here: the rail already leads with one, and two copies of the same
          number read as two different stats. */}
      <div className={cn('grid gap-2', inRail ? 'grid-cols-3' : 'grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5')}>
        <Stat
          label="Initiative"
          value={formatModifier(effectiveModifier(vitals.initiative, initiativeEffects))}
          compact={inRail}
          roll={{ label: 'Initiative', modifier: vitals.initiative, effects: initiativeEffects }}
        />
        <Stat label="Speed" value={`${vitals.speed} ft`} compact={inRail} />
        {/* A passive score is 10 plus the skill's own modifier in both printings, and the hint says
            which skill so the number is checkable without opening the skill list. */}
        <Stat
          label="Passive Perc."
          value={String(vitals.passivePerception)}
          hint={inRail ? undefined : passiveHint(vitals, 'Perception')}
          compact={inRail}
        />
        <Stat
          label="Passive Inv."
          value={String(vitals.passiveInvestigation)}
          hint={inRail ? undefined : passiveHint(vitals, 'Investigation')}
          compact={inRail}
        />
        <Stat
          label="Passive Ins."
          value={String(vitals.passiveInsight)}
          hint={inRail ? undefined : passiveHint(vitals, 'Insight')}
          compact={inRail}
        />
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

      <SheetAbilityBlocks
        saves={vitals.saves}
        skills={vitals.skills}
        variant={variant}
        rollEffects={vitals.rollEffects}
      />
    </div>
  );
}

/** On the Spells tab, not the rail: a save DC is read while casting. */
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
              <DerivationHint
                title={`${entry.className} spell save DC`}
                lines={[
                  { label: 'Base, stated by both printings', value: '8' },
                  { label: 'Proficiency bonus', value: formatModifier(entry.proficiencyBonus) },
                  { label: `${ABILITY_ABBREVIATIONS[entry.ability]} modifier`, value: formatModifier(entry.abilityModifier) }
                ]}
                detail={`A spell attack with ${entry.className} is the same figure without the 8.`}
              >
                Save DC <span className="font-semibold text-foreground">{entry.saveDc}</span>
              </DerivationHint>
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
