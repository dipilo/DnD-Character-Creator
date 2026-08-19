import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ABILITY_ABBREVIATIONS, formatModifier, type DerivedAttack } from '@/lib/sheetDerivations';
import { modifierNotation } from '@/lib/diceNotation';
import { rollOnScreen } from '@/store/diceTrayStore';

const rollButtonClass =
  'min-h-11 rounded px-2 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * Every equipped weapon with its to-hit and its damage (NEXT_STEPS.md §5.4).
 *
 * Purely derived, so it needs no write surface of its own: change what is equipped on the Equipment
 * tab and these rows follow. Ammunition counts and "where did I throw that dagger" are state, and
 * are deliberately not modelled here.
 *
 * The to-hit and the damage are both buttons: they throw on the shared tray and write nothing back,
 * so a campaign-mate reading the sheet can still roll it.
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
                  <span className="flex flex-wrap items-center gap-1 tabular-nums">
                    <button
                      type="button"
                      className={rollButtonClass}
                      onClick={() =>
                        void rollOnScreen({
                          notation: modifierNotation(20, attack.attackBonus),
                          label: `${attack.name} attack`,
                          detail: attack.kind,
                        })
                      }
                    >
                      <span className="text-xs uppercase text-muted-foreground">Hit </span>
                      <span className="font-semibold">{formatModifier(attack.attackBonus)}</span>
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      className={rollButtonClass}
                      onClick={() =>
                        void rollOnScreen({
                          notation: attack.damage,
                          label: `${attack.name} damage`,
                          detail: attack.damage,
                        })
                      }
                    >
                      <span className="font-semibold">{attack.damage}</span>
                    </button>
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
                      <button
                        type="button"
                        className={rollButtonClass}
                        onClick={() =>
                          void rollOnScreen({
                            notation: attack.versatileDamage ?? '',
                            label: `${attack.name} damage (two-handed)`,
                            detail: attack.versatileDamage,
                          })
                        }
                      >
                        two-handed {attack.versatileDamage}
                      </button>
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
