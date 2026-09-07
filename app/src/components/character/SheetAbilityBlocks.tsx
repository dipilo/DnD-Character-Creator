// Saving throws and skills, in six blocks — one per ability, with that ability's skills under it.
//
// They used to be two cards: a six-row Saving Throws list and an eighteen-row Skills list, each
// repeating the ability every row ("Strength" in the save, "STR" beside Athletics). D&D Beyond's
// own sheet groups them, and the `layout_v2` module of the extension `SHEET_LAYOUT_PLAN.md` names
// rebuilds that whole area the same way. Grouping drops two card headers and every repeated ability
// name, and it puts a skill next to the save it shares a modifier with.
//
// The ability *check* is not here: the score boxes above the blocks are the check button, and
// rendering it twice would put two of the same roll on one sheet.
import { Card, CardContent } from '@/components/ui/card';
import { rollD20 } from '@/lib/d20Rolls';
import {
  ABILITY_ORDER,
  formatModifier,
  type DerivedSave,
  type DerivedSkill
} from '@/lib/sheetDerivations';
import { cn } from '@/lib/utils';
import type { AbilityScores } from '@/types/dnd';

const abilityLabel = (ability: keyof AbilityScores) => ability.charAt(0).toUpperCase() + ability.slice(1);

/** The filled dot every proficient row carries, in the saves and the skills alike. */
function ProficiencyDot({ proficient }: Readonly<{ proficient: boolean }>) {
  return (
    <span
      className={cn(
        'h-2 w-2 shrink-0 rounded-full border',
        proficient ? 'border-primary bg-primary' : 'border-muted-foreground/50'
      )}
      aria-hidden="true"
    />
  );
}

interface RollRowProps {
  readonly name: string;
  readonly proficient: boolean;
  readonly modifier: number;
  readonly rollLabel: string;
  readonly className?: string;
}

/** One rollable line. Rolling changes nothing, so a read-only sheet keeps every one of these. */
function RollRow({ name, proficient, modifier, rollLabel, className }: RollRowProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-9 w-full items-center justify-between gap-2 rounded px-2 text-sm transition-colors hover:bg-accent coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        proficient && 'bg-accent',
        className
      )}
      onClick={() => void rollD20({ modifier, label: rollLabel, detail: 'd20 check' })}
    >
      <span className="flex min-w-0 items-center gap-2">
        <ProficiencyDot proficient={proficient} />
        <span className="truncate">{name}</span>
      </span>
      <span className="shrink-0 font-semibold tabular-nums">{formatModifier(modifier)}</span>
    </button>
  );
}

interface SheetAbilityBlocksProps {
  readonly saves: readonly DerivedSave[];
  readonly skills: readonly DerivedSkill[];
  /** `rail` is one 19rem column; `panel` has room for two blocks side by side. */
  readonly variant?: 'rail' | 'panel';
}

export function SheetAbilityBlocks({ saves, skills, variant = 'panel' }: SheetAbilityBlocksProps) {
  const inRail = variant === 'rail';

  return (
    <Card>
      <CardContent className={cn('grid gap-3', inRail ? '' : 'sm:grid-cols-2 xl:grid-cols-3')}>
        {ABILITY_ORDER.map((ability) => {
          const save = saves.find((entry) => entry.ability === ability);
          const owned = skills.filter((skill) => skill.ability === ability);
          const label = abilityLabel(ability);

          return (
            <div key={ability} className="min-w-0">
              {/* The save is the block's own heading control, not a seventh row of its own list. */}
              <div className="flex items-center justify-between gap-2 border-b">
                <h4 className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </h4>
                {save ? (
                  <button
                    type="button"
                    className="flex min-h-9 shrink-0 items-center gap-1.5 rounded px-2 text-xs transition-colors hover:bg-accent coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() =>
                      void rollD20({ modifier: save.modifier, label: `${label} save`, detail: 'd20 check' })
                    }
                  >
                    <ProficiencyDot proficient={save.proficient} />
                    <span className="uppercase tracking-wide text-muted-foreground">Save</span>
                    <span className="font-semibold tabular-nums">{formatModifier(save.modifier)}</span>
                  </button>
                ) : null}
              </div>
              {owned.map((skill) => (
                <RollRow
                  key={skill.name}
                  name={skill.name}
                  proficient={skill.proficient}
                  modifier={skill.modifier}
                  rollLabel={skill.name}
                />
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
