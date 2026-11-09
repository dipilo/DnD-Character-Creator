// The forms a shape-shifter knows, and the one they are wearing. Writes nothing of its own: every
// edit hands a patch back through the one `onChange`, so the party view is read-only for free.
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SheetCatalogPicker, type CatalogPickerItem } from '@/components/character/SheetCatalogPicker';
import { ABILITY_ABBREVIATIONS, formatModifier } from '@/lib/sheetDerivations';
import { abilityModifier } from '@/lib/sheetMath';
import {
  assumeFormPatch,
  eligibleForms,
  formWalkingSpeed,
  revertFormPatch,
  setKnownFormsPatch,
  type ResolvedWildShape
} from '@/lib/wildShape';
import type { Character, Monster } from '@/types/dnd';

interface SheetWildShapePanelProps {
  character: Character;
  shift: ResolvedWildShape;
  /** The whole library: which of it is a form is the feature's own table's answer. */
  monsters: readonly Monster[];
  onChange?: (patch: Partial<Character>) => void;
}

/** "Max CR 1/4 · 4 forms known · no flying" — the row the table states, not a sentence we wrote. */
function describeLimits(shift: ResolvedWildShape): string {
  const rating = shift.limits.maxChallengeRating;
  const printed = rating < 1 ? `1/${Math.round(1 / rating)}` : String(rating);
  return [
    `Max CR ${printed}`,
    shift.limits.knownForms === undefined ? undefined : `${shift.limits.knownForms} forms known`,
    shift.limits.flySpeed ? undefined : 'no flying speed',
    shift.limits.swimSpeed ? undefined : 'no swimming speed'
  ].filter(Boolean).join(' · ');
}

const challengeLabel = (form: Monster) => `CR ${form.challengeRating}`;

export function SheetWildShapePanel({ character, shift, monsters, onChange }: Readonly<SheetWildShapePanelProps>) {
  const available = useMemo<CatalogPickerItem[]>(() => {
    const held = new Set(shift.known.map((form) => form.id));
    return eligibleForms(monsters, shift.limits)
      .filter((form) => !held.has(form.id))
      .map((form) => ({
        id: form.id,
        name: form.name,
        detail: `${challengeLabel(form)} · AC ${form.ac} · ${form.hp.average} HP · ${form.speed}`,
        keywords: `${form.type} ${form.size}`
      }));
  }, [monsters, shift.known, shift.limits]);

  const addForm = (id: string) => {
    if (!onChange) return;
    onChange(setKnownFormsPatch(character, [...shift.known.map((form) => form.id), id], shift.limits));
  };

  const dropForm = (id: string) => {
    if (!onChange) return;
    onChange(setKnownFormsPatch(character, shift.known.filter((form) => form.id !== id).map((form) => form.id), shift.limits));
  };

  const atLimit = shift.limits.knownForms !== undefined && shift.known.length >= shift.limits.knownForms;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{shift.feature.name}</CardTitle>
        <CardDescription>{describeLimits(shift)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {shift.form ? (
          <ActiveForm
            form={shift.form}
            character={character}
            shift={shift}
            onRevert={onChange ? () => onChange(revertFormPatch(character, shift.rules)) : undefined}
          />
        ) : null}

        {shift.known.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No forms known yet. {shift.limits.knownForms === undefined
              ? 'This printing lets you assume any eligible beast you have seen.'
              : `Pick up to ${shift.limits.knownForms}.`}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {shift.known.map((form) => (
              <li key={form.id} className="flex min-h-9 flex-wrap items-center justify-between gap-2 rounded border px-2 py-1.5 coarse:min-h-11">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{form.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {challengeLabel(form)} · AC {form.ac} · {formWalkingSpeed(form)} ft
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {onChange && form.id !== shift.form?.id ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9 coarse:min-h-11"
                      onClick={() => onChange(assumeFormPatch(character, form, shift.rules, shift.classLevel))}
                    >
                      Transform
                    </Button>
                  ) : null}
                  {onChange ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-9 coarse:min-h-11"
                      onClick={() => dropForm(form.id)}
                    >
                      Forget
                    </Button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}

        {onChange && !atLimit ? (
          <SheetCatalogPicker
            triggerLabel="Learn a form"
            title="Beast forms"
            description={`Every beast the ${shift.feature.name} table allows at this level: ${describeLimits(shift)}.`}
            items={available}
            onPick={addForm}
          />
        ) : null}
        {atLimit ? (
          <p className="text-xs text-muted-foreground">
            {shift.limits.knownForms} of {shift.limits.knownForms} forms known. Forget one to learn another.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** What the stat block replaced, said plainly: the numbers a player reads while shape-shifted. */
function ActiveForm({
  form,
  character,
  shift,
  onRevert
}: Readonly<{ form: Monster; character: Character; shift: ResolvedWildShape; onRevert?: () => void }>) {
  const scores = shift.rules.retainsMentalAbilities
    ? (['strength', 'dexterity', 'constitution'] as const)
    : (['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const);

  return (
    <div className="space-y-2 rounded-lg border border-primary bg-primary/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <Badge>In {form.name} form</Badge>
          <span className="text-xs text-muted-foreground tabular-nums">
            AC {form.ac} · {form.speed}
          </span>
        </span>
        {onRevert ? (
          <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={onRevert}>
            Revert
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
        {scores.map((ability) => (
          <span key={ability}>
            {ABILITY_ABBREVIATIONS[ability]} {form.abilityScores[ability]} (
            {formatModifier(abilityModifier(form.abilityScores[ability]))})
          </span>
        ))}
      </div>
      {/* The sentences that say what the character keeps, so nobody has to go back to the feature. */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        {shift.rules.retainsMentalAbilities
          ? 'Intelligence, Wisdom and Charisma, your class features and your proficiencies are your own.'
          : 'This printing replaces every one of your statistics.'}
        {shift.rules.assumesBeastHitPoints
          ? ` Reverting returns you to ${character.wildShape?.restoreHp?.current ?? character.hp.current} hit points, less any damage beyond this form's.`
          : ''}
        {shift.rules.temporaryHitPoints
          ? ` ${shift.classLevel} temporary hit points came with the form.`
          : ''}
        {shift.rules.forbidsSpellcasting
          ? ' You can’t cast spells in this form, though a spell already cast carries on.'
          : ''}
      </p>
    </div>
  );
}
