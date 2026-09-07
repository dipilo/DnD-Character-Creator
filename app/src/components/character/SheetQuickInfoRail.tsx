// The part of the sheet that never goes away.
//
// Checking a skill modifier while reading a spell used to mean leaving the spell: every number a
// player consults *while doing something else* sat behind the Stats tab. This is that half of the
// sheet, lifted out of the tabs — abilities, AC, hit points, proficiency, and (where there is a
// column for it) initiative, speed, the passives, saves and skills.
//
// It writes nothing of its own. The hit-point panel hands its patches back through the single
// optional `onChange`, and a roll goes to the shared dice tray, which changes no document.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { rollD20 } from '@/lib/d20Rolls';
import { ABILITY_ABBREVIATIONS, formatModifier, type SheetVitals } from '@/lib/sheetDerivations';
import type { DerivedArmorClass } from '@/lib/builderRules';
import { SheetHitPointsPanel } from '@/components/character/SheetHitPointsPanel';
import { SheetVitalsPanel } from '@/components/character/SheetVitalsPanel';
import { cn } from '@/lib/utils';
import type { AbilityScores, Character } from '@/types/dnd';

const calculateModifier = (score: number): number => Math.floor((score - 10) / 2);

interface SheetQuickInfoRailProps {
  /** With hit points already resolved, the way `SheetHitPointsPanel` wants them. */
  character: Character;
  /** After species, background and feat bonuses. */
  abilityScores: AbilityScores;
  /** Before them, so a box can show what was rolled or bought under the total. */
  baseAbilityScores: AbilityScores;
  abilityBonusFor: (ability: keyof AbilityScores) => number;
  armor: DerivedArmorClass;
  proficiencyBonus: number;
  totalLevel: number;
  vitals: SheetVitals;
  /**
   * The rail has a column of its own, so saves and skills belong in it. Below that they are the
   * subsection's leading Stats tab instead — a phone has no room for a pinned second column.
   */
  railIsColumn: boolean;
  onChange?: (patch: Partial<Character>) => void;
}

/** The three numbers consulted mid-action, pinned where the rail cannot be. */
function CompactStrip({
  current,
  maximum,
  temporary,
  armorClass,
  proficiencyBonus,
}: Readonly<{
  current: number;
  maximum: number;
  temporary: number;
  armorClass: number;
  proficiencyBonus: number;
}>) {
  const hp = temporary > 0 ? `${current}+${temporary}/${maximum}` : `${current}/${maximum}`;
  const cells: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'HP', value: hp },
    { label: 'AC', value: String(armorClass) },
    { label: 'Prof', value: formatModifier(proficiencyBonus) },
  ];

  return (
    // Pinned under the app's own sticky header (h-14, h-12 when short), not over it.
    <div className="sticky top-14 z-30 -mx-1 grid grid-cols-3 gap-2 border-b bg-background/95 px-1 py-2 backdrop-blur short:top-12">
      {cells.map((cell) => (
        <div key={cell.label} className="text-center">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{cell.label}</p>
          <p className="text-lg font-bold tabular-nums">{cell.value}</p>
        </div>
      ))}
    </div>
  );
}

export function SheetQuickInfoRail({
  character,
  abilityScores,
  baseAbilityScores,
  abilityBonusFor,
  armor,
  proficiencyBonus,
  totalLevel,
  vitals,
  railIsColumn,
  onChange,
}: Readonly<SheetQuickInfoRailProps>) {
  return (
    <div className="space-y-4">
      {railIsColumn ? null : (
        <CompactStrip
          current={character.hp.current}
          maximum={character.hp.maximum}
          temporary={character.hp.temporary}
          armorClass={armor.value}
          proficiencyBonus={proficiencyBonus}
        />
      )}

      {/* Three across in the rail as well: two columns of tall boxes cost a third of the column's
          height before the first panel, which is what pushed saves and skills off the screen. The
          label is the three-letter form there, because "CONSTITUTION" does not fit a 95px box. */}
      <div className={cn('grid gap-2', railIsColumn ? 'grid-cols-3' : 'grid-cols-3 sm:gap-4')}>
        {Object.entries(abilityScores).map(([ability, score]) => {
          const mod = calculateModifier(score);
          const bonus = abilityBonusFor(ability as keyof AbilityScores);
          const abilityLabel = ability.charAt(0).toUpperCase() + ability.slice(1);
          return (
            <button
              key={ability}
              type="button"
              className="min-h-11 rounded-lg border bg-card p-2 text-center transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() =>
                void rollD20({
                  modifier: mod,
                  label: `${abilityLabel} check`,
                  detail: 'd20 check',
                })
              }
            >
              <p className="text-[0.65rem] font-medium uppercase leading-4 tracking-wide text-muted-foreground">
                {railIsColumn ? ABILITY_ABBREVIATIONS[ability as keyof AbilityScores] : ability}
              </p>
              <p className="text-xl font-bold leading-6 tabular-nums">{formatModifier(mod)}</p>
              <p className="text-xs leading-4 text-muted-foreground tabular-nums">
                {score}
                {bonus === 0 ? null : (
                  <span className="ml-1">
                    ({baseAbilityScores[ability as keyof AbilityScores]}
                    {formatModifier(bonus)})
                  </span>
                )}
              </p>
            </button>
          );
        })}
      </div>

      <SheetHitPointsPanel character={character} onChange={onChange} />

      {railIsColumn ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <ArmorClassCard armor={armor} />
            <ProficiencyBonusCard proficiencyBonus={proficiencyBonus} totalLevel={totalLevel} />
          </div>
          <SheetVitalsPanel vitals={vitals} variant="rail" />
        </>
      ) : null}
    </div>
  );
}

export function ArmorClassCard({ armor }: Readonly<{ armor: DerivedArmorClass }>) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">Armor Class</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold leading-7">{armor.value}</p>
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">{armor.source}</p>
        {!armor.proficient && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Current armor is equipped without matching proficiency.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ProficiencyBonusCard({
  proficiencyBonus,
  totalLevel,
}: Readonly<{ proficiencyBonus: number; totalLevel: number }>) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">Proficiency Bonus</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold leading-7">{formatModifier(proficiencyBonus)}</p>
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">Level {totalLevel}</p>
      </CardContent>
    </Card>
  );
}
