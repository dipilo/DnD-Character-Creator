// Hit points, death saves and the conditions a character is under — the part of the sheet that
// changes every combat round. It writes nothing itself: every control hands a patch back through
// `onChange`, which is absent on the read-only party view, and then the panel renders as it always
// did (numbers, no buttons).
import { useState } from 'react';
import { Dices } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CONDITION_NAMES,
  MAX_DEATH_SAVES,
  MAX_EXHAUSTION,
  applyDamage,
  applyDeathSaveRoll,
  applyHealing,
  concentrationSaveDc,
  endConcentration,
  getDeathSaves,
  isDying,
  setDeathSave,
  setExhaustion,
  setTemporaryHitPoints,
  toggleCondition
} from '@/lib/sheetPlayState';
import { rollD20 } from '@/lib/d20Rolls';
import { rollOnScreen } from '@/store/diceTrayStore';
import { cn } from '@/lib/utils';
import type { Character } from '@/types/dnd';

interface SheetHitPointsPanelProps {
  /**
   * The character with its hit points already resolved — a document saved before the builder
   * derived a maximum stores 0, and taking damage against a maximum of 0 clamps everything to 0.
   * The patch this panel emits carries the resolved maximum, which repairs the document on the
   * first hit taken.
   */
  character: Character;
  /** The Constitution save, which is the only roll concentration ever asks for. */
  constitutionSave: number;
  onChange?: (patch: Partial<Character>) => void;
}

/** Three boxes that fill left to right; clicking the filled one you are on clears it. */
function DeathSaveRow({
  label,
  count,
  tone,
  onSet
}: Readonly<{ label: string; count: number; tone: string; onSet?: (next: number) => void }>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex gap-1.5">
        {Array.from({ length: MAX_DEATH_SAVES }, (_, index) => {
          const filled = index < count;
          const next = filled && index === count - 1 ? index : index + 1;
          return (
            <button
              key={label + String(index)}
              type="button"
              aria-label={`${label} ${index + 1}`}
              aria-pressed={filled}
              disabled={!onSet}
              onClick={() => onSet?.(next)}
              className={cn(
                'h-5 w-5 rounded-full border transition coarse:h-11 coarse:w-11',
                filled ? tone : 'border-muted-foreground/40',
                onSet ? 'cursor-pointer' : 'cursor-default'
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export function SheetHitPointsPanel({ character, constitutionSave, onChange }: Readonly<SheetHitPointsPanelProps>) {
  const [amount, setAmount] = useState('');
  const [conditionsOpen, setConditionsOpen] = useState(false);
  // The last blow taken while concentrating, which is what sets the save's DC. Not on the
  // document: it is a question waiting to be answered, not something about the character.
  const [pendingSave, setPendingSave] = useState<number | null>(null);
  const hp = character.hp;
  const deathSaves = getDeathSaves(character);

  /** The tray reports the natural die, which is what the 20-and-1 special cases key off. */
  const rollDeathSave = async () => {
    const outcome = await rollOnScreen({ notation: '1d20', label: 'Death save', detail: 'DC 10' });
    if (outcome.natural !== null) {
      onChange?.(applyDeathSaveRoll(character, outcome.natural));
    }
  };
  const dying = isDying(character);
  const conditions = character.conditions ?? [];
  const exhaustion = character.exhaustion ?? 0;
  const parsedAmount = Number.parseInt(amount, 10);
  const usableAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;

  const apply = (patch: Partial<Character>) => {
    onChange?.(patch);
    setAmount('');
  };

  const concentration = character.concentration;

  /** Damage asks for the save; dropping to 0 already ended it, so there is nothing left to ask. */
  const takeDamage = (damage: number) => {
    const patch = applyDamage(character, damage);
    apply(patch);
    // The patch carries the key only when the blow dropped them to 0, which ends it outright.
    const stillConcentrating = Boolean(concentration) && !Object.hasOwn(patch, 'concentration');
    setPendingSave(stillConcentrating ? damage : null);
  };

  const rollConcentrationSave = async (dc: number) => {
    const outcome = await rollD20({
      modifier: constitutionSave,
      label: `Concentration save (${concentration?.spellName ?? 'spell'})`,
      detail: `DC ${dc}`
    });
    setPendingSave(null);
    if (outcome.total < dc) onChange?.(endConcentration());
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Hit Points
          {character.inspiration ? <Badge variant="secondary">Inspired</Badge> : null}
          {exhaustion > 0 ? <Badge variant="destructive">Exhaustion {exhaustion}</Badge> : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-3xl font-bold leading-none tabular-nums">{hp.current}/{hp.maximum}</p>
          {hp.temporary > 0 ? <Badge variant="outline">+{hp.temporary} temp</Badge> : null}
        </div>

        {/* One line. The amount box used to carry a stacked label with the three buttons wrapping
            under it, which is three rows of a 19rem rail spent on one entry field. */}
        {onChange ? (
          <div className="flex items-stretch gap-1">
            <Label htmlFor="hp-amount" className="sr-only">Amount</Label>
            <Input
              id="hp-amount"
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replaceAll(/\D/g, ''))}
              placeholder="0"
              className="h-11 w-14 shrink-0 text-center"
            />
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="min-h-11 flex-1 px-1"
              disabled={usableAmount === 0}
              onClick={() => takeDamage(usableAmount)}
            >
              Damage
            </Button>
            <Button
              type="button"
              size="sm"
              className="min-h-11 flex-1 px-1"
              disabled={usableAmount === 0}
              onClick={() => apply(applyHealing(character, usableAmount))}
            >
              Heal
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 flex-1 px-1"
              disabled={usableAmount === 0}
              onClick={() => apply(setTemporaryHitPoints(character, usableAmount))}
            >
              Temp
            </Button>
          </div>
        ) : null}

        {concentration ? (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm">
              Concentrating on <span className="font-medium">{concentration.spellName}</span>
            </p>
            {onChange ? (
              <div className="flex flex-wrap items-center gap-1">
                {pendingSave === null ? null : (
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11 flex-1 px-1"
                    onClick={() => void rollConcentrationSave(concentrationSaveDc(pendingSave))}
                  >
                    <Dices className="h-4 w-4" />
                    Save DC {concentrationSaveDc(pendingSave)}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 flex-1 px-1"
                  onClick={() => onChange(endConcentration())}
                >
                  End
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {dying || deathSaves.successes > 0 || deathSaves.failures > 0 ? (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Death Saves</p>
              {onChange ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => void rollDeathSave()}
                >
                  <Dices className="h-4 w-4" />
                  Roll
                </Button>
              ) : null}
            </div>
            <DeathSaveRow
              label="Successes"
              count={deathSaves.successes}
              tone="border-emerald-500 bg-emerald-500"
              onSet={onChange ? (next) => onChange(setDeathSave(character, 'successes', next)) : undefined}
            />
            <DeathSaveRow
              label="Failures"
              count={deathSaves.failures}
              tone="border-red-500 bg-red-500"
              onSet={onChange ? (next) => onChange(setDeathSave(character, 'failures', next)) : undefined}
            />
          </div>
        ) : null}

        {onChange ? (
          <div className="flex items-stretch gap-1">
            <Button
              type="button"
              size="sm"
              variant={character.inspiration ? 'default' : 'outline'}
              className="min-h-11 flex-1 px-1"
              aria-pressed={Boolean(character.inspiration)}
              onClick={() => onChange({ inspiration: !character.inspiration })}
            >
              Inspiration
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 w-11 shrink-0 px-0"
              aria-label="Lower exhaustion"
              disabled={exhaustion === 0}
              onClick={() => onChange(setExhaustion(exhaustion - 1))}
            >
              −
            </Button>
            <span className="flex w-12 shrink-0 flex-col items-center justify-center leading-none">
              <span className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Exh</span>
              <span className="text-sm tabular-nums">{exhaustion}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="min-h-11 w-11 shrink-0 px-0"
              aria-label="Raise exhaustion"
              disabled={exhaustion >= MAX_EXHAUSTION}
              onClick={() => onChange(setExhaustion(exhaustion + 1))}
            >
              +
            </Button>
          </div>
        ) : null}

        {/* Fourteen toggles is five rows of chips in a 19rem rail, permanently, for a character
            who is usually under none of them. What is *on* is always shown; the rest is a press
            away. */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Conditions</p>
            {onChange ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-9 coarse:min-h-11"
                aria-expanded={conditionsOpen}
                onClick={() => setConditionsOpen((open) => !open)}
              >
                {conditionsOpen ? 'Done' : 'Set'}
              </Button>
            ) : null}
          </div>

          {conditionsOpen && onChange ? (
            // An even grid, not a wrapped row: fourteen chips of fourteen widths read as a ragged
            // block, and two columns is also what keeps each one a thumb target in a 19rem rail.
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-2">
              {CONDITION_NAMES.map((condition) => (
                <Button
                  key={condition}
                  type="button"
                  size="sm"
                  variant={conditions.includes(condition) ? 'default' : 'outline'}
                  className="min-h-9 w-full px-1 text-xs coarse:min-h-11"
                  aria-pressed={conditions.includes(condition)}
                  onClick={() => onChange(toggleCondition(character, condition))}
                >
                  {condition}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {conditions.length === 0 ? (
                <p className="text-sm text-muted-foreground">None</p>
              ) : (
                conditions.map((condition) => (
                  <Badge key={condition} variant="secondary">{condition}</Badge>
                ))
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
