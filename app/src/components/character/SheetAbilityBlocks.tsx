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
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { effectiveModifier, rollD20 } from '@/lib/d20Rolls';
import {
  applyRollEffects,
  describeRollEffects,
  type AppliedRollEffects,
  type ResolvedRollEffect,
  type RollTarget
} from '@/lib/rollEffects';
import {
  ABILITY_ORDER,
  formatModifier,
  type DerivedSave,
  type DerivedSkill
} from '@/lib/sheetDerivations';
import { cn } from '@/lib/utils';
import type { AbilityScores } from '@/types/dnd';

const abilityLabel = (ability: keyof AbilityScores) => ability.charAt(0).toUpperCase() + ability.slice(1);

/**
 * The filled dot every proficient row carries, in the saves and the skills alike. Expertise rings
 * it rather than taking a column of its own: it is the same proficiency, counted twice.
 */
function ProficiencyDot({ proficient, expertise = false }: Readonly<{ proficient: boolean; expertise?: boolean }>) {
  return (
    <span
      className={cn(
        'h-2 w-2 shrink-0 rounded-full border',
        proficient ? 'border-primary bg-primary' : 'border-muted-foreground/50',
        expertise && 'ring-1 ring-primary ring-offset-1 ring-offset-background'
      )}
      aria-hidden="true"
    />
  );
}

/**
 * What a feature does to this row, marked on the row itself. The tray's detail line names the
 * feature; this is only the sign that the number about to be rolled is not the bare one.
 */
export function RollEffectMark({ effects }: Readonly<{ effects: AppliedRollEffects }>) {
  const { advantage, disadvantage, floor, bonus, applied } = effects;
  if (applied.length === 0) return null;

  const title = describeRollEffects(applied);
  const swing = advantage !== disadvantage;

  return (
    <span className="flex shrink-0 items-center text-primary" title={title} aria-label={title}>
      {swing && advantage ? <ChevronUp className="h-3.5 w-3.5" /> : null}
      {swing && disadvantage ? <ChevronDown className="h-3.5 w-3.5" /> : null}
      {floor ? <span className="text-[0.65rem] font-semibold leading-none">≥{floor}</span> : null}
      {/* The row's own number already carries the bonus, so this says a feature is in it, not how
          much — two signed numbers side by side read as one sum. */}
      {bonus ? <Plus className="h-3 w-3" /> : null}
    </span>
  );
}

interface RollRowProps {
  readonly name: string;
  readonly proficient: boolean;
  readonly expertise?: boolean;
  readonly modifier: number;
  readonly rollLabel: string;
  readonly effects: AppliedRollEffects;
  readonly className?: string;
}

/** One rollable line. Rolling changes nothing, so a read-only sheet keeps every one of these. */
function RollRow({ name, proficient, expertise = false, modifier, rollLabel, effects, className }: RollRowProps) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-9 w-full items-center justify-between gap-2 rounded px-2 text-sm transition-colors hover:bg-accent coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        proficient && 'bg-accent',
        className
      )}
      onClick={() => void rollD20({ modifier, label: rollLabel, detail: 'd20 check', effects })}
    >
      <span className="flex min-w-0 items-center gap-2">
        <ProficiencyDot proficient={proficient} expertise={expertise} />
        <span className="truncate">{name}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <RollEffectMark effects={effects} />
        <span className="font-semibold tabular-nums">{formatModifier(effectiveModifier(modifier, effects))}</span>
      </span>
    </button>
  );
}

interface SheetAbilityBlocksProps {
  readonly saves: readonly DerivedSave[];
  readonly skills: readonly DerivedSkill[];
  /** `rail` is one 19rem column; `panel` has room for two blocks side by side. */
  readonly variant?: 'rail' | 'panel';
  /** What the character's features do to a d20 test, read from their own sentences. */
  readonly rollEffects?: readonly ResolvedRollEffect[];
}

export function SheetAbilityBlocks({ saves, skills, variant = 'panel', rollEffects = [] }: SheetAbilityBlocksProps) {
  const inRail = variant === 'rail';
  const effectsFor = (target: RollTarget) => applyRollEffects(rollEffects, target);

  return (
    <Card>
      <CardContent className={cn('grid gap-3', inRail ? '' : 'sm:grid-cols-2 xl:grid-cols-3')}>
        {ABILITY_ORDER.map((ability) => {
          const save = saves.find((entry) => entry.ability === ability);
          const owned = skills.filter((skill) => skill.ability === ability);
          const label = abilityLabel(ability);
          const saveEffects = save
            ? effectsFor({ kind: 'save', ability, proficient: save.proficient })
            : undefined;

          return (
            <div key={ability} className="min-w-0">
              {/* The save is the block's own heading control, not a seventh row of its own list. */}
              <div className="flex items-center justify-between gap-2 border-b">
                <h4 className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </h4>
                {save && saveEffects ? (
                  <button
                    type="button"
                    className="flex min-h-9 shrink-0 items-center gap-1.5 rounded px-2 text-xs transition-colors hover:bg-accent coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() =>
                      void rollD20({
                        modifier: save.modifier,
                        label: `${label} save`,
                        detail: 'd20 check',
                        effects: saveEffects
                      })
                    }
                  >
                    <ProficiencyDot proficient={save.proficient} />
                    <span className="uppercase tracking-wide text-muted-foreground">Save</span>
                    <RollEffectMark effects={saveEffects} />
                    <span className="font-semibold tabular-nums">{formatModifier(effectiveModifier(save.modifier, saveEffects))}</span>
                  </button>
                ) : null}
              </div>
              {owned.map((skill) => (
                <RollRow
                  key={skill.name}
                  name={skill.name}
                  proficient={skill.proficient}
                  expertise={skill.expertise}
                  modifier={skill.modifier}
                  rollLabel={skill.name}
                  effects={effectsFor({
                    kind: 'check',
                    ability: skill.ability,
                    skill: skill.name,
                    proficient: skill.proficient
                  })}
                />
              ))}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
