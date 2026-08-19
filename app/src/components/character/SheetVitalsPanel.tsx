import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ABILITY_ABBREVIATIONS,
  formatModifier,
  type SheetVitals,
} from '@/lib/sheetDerivations';
import { modifierNotation } from '@/lib/diceNotation';
import { rollOnScreen } from '@/store/diceTrayStore';
import { cn } from '@/lib/utils';

/** One boxed number, the way a play sheet leads with them. Rollable when a d20 check exists for it. */
function Stat({
  label,
  value,
  hint,
  roll,
}: Readonly<{ label: string; value: string; hint?: string; roll?: { label: string; modifier: number } }>) {
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );

  if (!roll) {
    return <div className="rounded-lg border bg-card p-3 text-center">{body}</div>;
  }

  return (
    <button
      type="button"
      className="min-h-11 rounded-lg border bg-card p-3 text-center transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      onClick={() => void rollOnScreen({ notation: modifierNotation(20, roll.modifier), label: roll.label })}
    >
      {body}
    </button>
  );
}

/**
 * Initiative, speed, the passive scores, saving throws and the skill table.
 *
 * Everything here is derived from the character document — no value is editable, because none of
 * them are things a player changes. Rolling one is not editing it: a check goes to the shared dice
 * tray and writes nothing back, which is why a read-only party view can roll from it too.
 */
export function SheetVitalsPanel({ vitals }: Readonly<{ vitals: SheetVitals }>) {
  const rollCheck = (label: string, modifier: number) =>
    void rollOnScreen({ notation: modifierNotation(20, modifier), label, detail: 'd20 check' });

  return (
    <div className="space-y-4">
      {/* No proficiency bonus here: the headline card row above it already leads with one, and two
          copies of the same number read as two different stats. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Initiative"
          value={formatModifier(vitals.initiative)}
          roll={{ label: 'Initiative', modifier: vitals.initiative }}
        />
        <Stat label="Speed" value={`${vitals.speed} ft`} />
        <Stat label="Passive Perc." value={String(vitals.passivePerception)} />
        <Stat label="Passive Inv." value={String(vitals.passiveInvestigation)} />
        <Stat label="Passive Ins." value={String(vitals.passiveInsight)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Saving Throws</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {vitals.saves.map((save) => (
              <button
                key={save.ability}
                type="button"
                className={cn(
                  'flex min-h-11 w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  save.proficient && 'bg-accent',
                )}
                onClick={() =>
                  rollCheck(`${save.ability.charAt(0).toUpperCase()}${save.ability.slice(1)} save`, save.modifier)
                }
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full border',
                      save.proficient ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                    )}
                    aria-hidden="true"
                  />
                  <span className="capitalize">{save.ability}</span>
                </span>
                <span className="font-semibold tabular-nums">{formatModifier(save.modifier)}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Skills</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Two columns from sm up; one on a phone, where a two-column skill list wraps every
                name onto a second line. */}
            <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {vitals.skills.map((skill) => (
                <button
                  key={skill.name}
                  type="button"
                  className={cn(
                    'flex min-h-11 w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    skill.proficient && 'bg-accent',
                  )}
                  onClick={() => rollCheck(skill.name, skill.modifier)}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full border',
                        skill.proficient ? 'border-primary bg-primary' : 'border-muted-foreground/50',
                      )}
                      aria-hidden="true"
                    />
                    <span className="truncate">{skill.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {ABILITY_ABBREVIATIONS[skill.ability]}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {formatModifier(skill.modifier)}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hit dice are not here: they are spendable, so they live on the resources panel with the
          spell slots rather than being printed twice, once as a number you cannot change. */}
      {vitals.spellcasting.length > 0 ? (
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
                    onClick={() => rollCheck(`${entry.className} spell attack`, entry.attackBonus)}
                  >
                    Attack <span className="font-semibold text-foreground">{formatModifier(entry.attackBonus)}</span>
                  </button>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
