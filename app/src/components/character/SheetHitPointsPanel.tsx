// Hit points, death saves and the conditions a character is under — the part of the sheet that
// changes every combat round. It writes nothing itself: every control hands a patch back through
// `onChange`, which is absent on the read-only party view, and then the panel renders as it always
// did (numbers, no buttons).
import { useState } from 'react';
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
  applyHealing,
  getDeathSaves,
  isDying,
  setDeathSave,
  setExhaustion,
  setTemporaryHitPoints,
  toggleCondition
} from '@/lib/sheetPlayState';
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
                'h-5 w-5 rounded-full border transition',
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

export function SheetHitPointsPanel({ character, onChange }: Readonly<SheetHitPointsPanelProps>) {
  const [amount, setAmount] = useState('');
  const hp = character.hp;
  const deathSaves = getDeathSaves(character);
  const dying = isDying(character);
  const conditions = character.conditions ?? [];
  const exhaustion = character.exhaustion ?? 0;
  const parsedAmount = Number.parseInt(amount, 10);
  const usableAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;

  const apply = (patch: Partial<Character>) => {
    onChange?.(patch);
    setAmount('');
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
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <p className="text-3xl font-bold tabular-nums">{hp.current}/{hp.maximum}</p>
          {hp.temporary > 0 ? <Badge variant="outline">+{hp.temporary} temp</Badge> : null}
        </div>

        {onChange ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[6rem] flex-1">
              <Label htmlFor="hp-amount" className="text-xs uppercase tracking-wide text-muted-foreground">
                Amount
              </Label>
              <Input
                id="hp-amount"
                inputMode="numeric"
                value={amount}
                onChange={(event) => setAmount(event.target.value.replaceAll(/[^0-9]/g, ''))}
                placeholder="0"
                className="mt-1"
              />
            </div>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={usableAmount === 0}
              onClick={() => apply(applyDamage(character, usableAmount))}
            >
              Damage
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={usableAmount === 0}
              onClick={() => apply(applyHealing(character, usableAmount))}
            >
              Heal
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={usableAmount === 0}
              onClick={() => apply(setTemporaryHitPoints(character, usableAmount))}
            >
              Temp HP
            </Button>
          </div>
        ) : null}

        {dying || deathSaves.successes > 0 || deathSaves.failures > 0 ? (
          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">Death Saves</p>
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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={character.inspiration ? 'default' : 'outline'}
              className="min-h-11"
              aria-pressed={Boolean(character.inspiration)}
              onClick={() => onChange({ inspiration: !character.inspiration })}
            >
              Inspiration
            </Button>
            <div className="flex items-center gap-1">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Exhaustion</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11"
                disabled={exhaustion === 0}
                onClick={() => onChange(setExhaustion(exhaustion - 1))}
              >
                −
              </Button>
              <span className="w-6 text-center tabular-nums">{exhaustion}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11"
                disabled={exhaustion >= MAX_EXHAUSTION}
                onClick={() => onChange(setExhaustion(exhaustion + 1))}
              >
                +
              </Button>
            </div>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Conditions</p>
          {onChange ? (
            <div className="flex flex-wrap gap-1.5">
              {CONDITION_NAMES.map((condition) => (
                <Button
                  key={condition}
                  type="button"
                  size="sm"
                  variant={conditions.includes(condition) ? 'default' : 'outline'}
                  aria-pressed={conditions.includes(condition)}
                  onClick={() => onChange(toggleCondition(character, condition))}
                >
                  {condition}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{conditions.join(', ') || 'None'}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
