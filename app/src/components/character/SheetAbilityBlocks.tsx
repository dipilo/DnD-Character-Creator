// One block per ability; the check button is the score box, so it is not repeated here.
import { Asterisk, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { effectiveModifier, rollD20 } from '@/lib/d20Rolls';
import {
  applyRollEffects,
  describeConditionalRollEffects,
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

/** Expertise rings the dot rather than taking a column: one proficiency, counted twice. */
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

/** Only the sign that the number about to be rolled is not the bare one. */
export function RollEffectMark({ effects }: Readonly<{ effects: AppliedRollEffects }>) {
  const { advantage, disadvantage, floor, bonus, applied, conditional } = effects;
  if (applied.length === 0 && conditional.length === 0) return null;

  const title = [describeRollEffects(applied), describeConditionalRollEffects(conditional)]
    .filter(Boolean)
    .join(' · ');
  const swing = advantage !== disadvantage;

  return (
    <span className="flex shrink-0 items-center text-primary" title={title} aria-label={title}>
      {swing && advantage ? <ChevronUp className="h-3.5 w-3.5" /> : null}
      {swing && disadvantage ? <ChevronDown className="h-3.5 w-3.5" /> : null}
      {floor ? <span className="text-[0.65rem] font-semibold leading-none">≥{floor}</span> : null}
      {/* The row's own number already carries the bonus, so this says a feature is in it, not how
          much — two signed numbers side by side read as one sum. */}
      {bonus ? <Plus className="h-3 w-3" /> : null}
      {/* Muted, and never an arrow: a clause the sheet cannot check must not look like advantage
          the character holds. The tooltip carries the words that narrow it. */}
      {conditional.length > 0 ? <Asterisk className="h-3 w-3 text-muted-foreground" /> : null}
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
