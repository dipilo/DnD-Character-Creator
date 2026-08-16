import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ABILITY_ABBREVIATIONS, formatModifier, type DerivedAttack } from '@/lib/sheetDerivations';

/**
 * Every equipped weapon with its to-hit and its damage (NEXT_STEPS.md §5.4).
 *
 * Read-only, like the rest of the sheet: `CharacterSheetView` performs no writes, which is what
 * lets a campaign-mate render a fetched character through the same code. Ammunition counts and
 * "where did I throw that dagger" are state, and are deliberately not modelled here.
 */
export function SheetAttacksPanel({ attacks }: Readonly<{ attacks: DerivedAttack[] }>) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Attacks</CardTitle>
        <CardDescription>
          Every weapon you have marked as equipped. Finesse already picks the better of Strength and
          Dexterity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {attacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No weapons equipped. Mark one as equipped on the Equipment step and it appears here.
          </p>
        ) : (
          <div className="space-y-2">
            {attacks.map((attack) => (
              <div key={attack.name} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium">{attack.name}</span>
                  <span className="tabular-nums">
                    <span className="text-xs uppercase text-muted-foreground">Hit </span>
                    <span className="font-semibold">{formatModifier(attack.attackBonus)}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    <span className="font-semibold">{attack.damage}</span>
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{attack.kind}</span>
                  <span>·</span>
                  <span>{ABILITY_ABBREVIATIONS[attack.ability]}</span>
                  {attack.range ? (
                    <>
                      <span>·</span>
                      <span>{attack.range}</span>
                    </>
                  ) : null}
                  {attack.versatileDamage ? (
                    <>
                      <span>·</span>
                      <span>two-handed {attack.versatileDamage}</span>
                    </>
                  ) : null}
                  {/* A weapon you are not proficient with still attacks — it just does not add the
                      proficiency bonus, which is exactly the thing worth saying out loud. */}
                  {attack.proficient ? null : <Badge variant="outline">Not proficient</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
