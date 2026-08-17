import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ABILITY_ABBREVIATIONS,
  formatModifier,
  type SheetVitals,
} from '@/lib/sheetDerivations';
import { cn } from '@/lib/utils';

/** One boxed number, the way a play sheet leads with them. */
function Stat({ label, value, hint }: Readonly<{ label: string; value: string; hint?: string }>) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Initiative, speed, the passive scores, saving throws and the skill table.
 *
 * Everything here is derived from the character document — no value on this panel is editable,
 * because none of them are things a player changes. The trackers that *are* (current HP, death
 * saves, spent slots) need document fields first; see SHEET_PARITY.md.
 */
export function SheetVitalsPanel({ vitals }: Readonly<{ vitals: SheetVitals }>) {
  return (
    <div className="space-y-4">
      {/* No proficiency bonus here: the headline card row above it already leads with one, and two
          copies of the same number read as two different stats. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Initiative" value={formatModifier(vitals.initiative)} />
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
              <div
                key={save.ability}
                className={cn(
                  'flex items-center justify-between rounded px-2 py-1.5 text-sm',
                  save.proficient && 'bg-accent',
                )}
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
              </div>
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
                <div
                  key={skill.name}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm',
                    skill.proficient && 'bg-accent',
                  )}
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
                </div>
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
                <span className="tabular-nums text-muted-foreground">
                  Save DC <span className="font-semibold text-foreground">{entry.saveDc}</span>
                  {' · '}
                  Attack <span className="font-semibold text-foreground">{formatModifier(entry.attackBonus)}</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
