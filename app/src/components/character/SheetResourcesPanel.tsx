// Hit dice, spell slots and the two rests. Same posture as the hit-point panel: no store, no
// writes — `onChange` is the whole write surface, and its absence is what makes the party view
// read-only.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  adjustHitDice,
  applyLongRest,
  applyShortRest,
  getSlotsUsed,
  setPactSlotsUsed,
  setSpellSlotsUsed
} from '@/lib/sheetPlayState';
import { cn } from '@/lib/utils';
import type { Character } from '@/types/dnd';

export interface HitDicePool {
  classId: string;
  className: string;
  die: string;
  total: number;
  used: number;
}

interface SheetResourcesPanelProps {
  character: Character;
  hitDice: HitDicePool[];
  /** Slots per level, indexed by level - 1, exactly as `getSpellcastingRulesSummary` reports them. */
  slotsByLevel: number[];
  pactSlotsByLevel: number[];
  onChange?: (patch: Partial<Character>) => void;
}

/** One row of pips per slot level. A filled pip is a slot still available; clicking spends it. */
function SlotRow({
  label,
  total,
  used,
  onSetUsed
}: Readonly<{ label: string; total: number; used: number; onSetUsed?: (next: number) => void }>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {Array.from({ length: total }, (_, index) => {
          const spent = index < used;
          // Clicking the last spent pip gives it back; clicking any available pip spends up to it.
          const next = spent && index === used - 1 ? index : index + 1;
          return (
            <button
              key={label + String(index)}
              type="button"
              aria-label={`${label} slot ${index + 1}`}
              aria-pressed={spent}
              disabled={!onSetUsed}
              onClick={() => onSetUsed?.(next)}
              className={cn(
                'h-5 w-5 rounded-sm border transition',
                spent ? 'border-muted-foreground/40 bg-transparent' : 'border-primary bg-primary',
                onSetUsed ? 'cursor-pointer' : 'cursor-default'
              )}
            />
          );
        })}
        <span className="ml-1 text-xs tabular-nums text-muted-foreground">{total - used}/{total}</span>
      </div>
    </div>
  );
}

export function SheetResourcesPanel({
  character,
  hitDice,
  slotsByLevel,
  pactSlotsByLevel,
  onChange
}: Readonly<SheetResourcesPanelProps>) {
  const hasSlots = slotsByLevel.some((count) => count > 0) || pactSlotsByLevel.some((count) => count > 0);
  if (hitDice.length === 0 && !hasSlots) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {hitDice.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Hit Dice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hitDice.map((pool) => (
              <div key={pool.classId} className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="secondary" className="text-sm">
                  {pool.total - pool.used}/{pool.total}{pool.die} · {pool.className}
                </Badge>
                {onChange ? (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={pool.used === 0}
                      onClick={() => onChange(adjustHitDice(character, pool.classId, -1))}
                    >
                      Regain
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={pool.used >= pool.total}
                      onClick={() => onChange(adjustHitDice(character, pool.classId, 1))}
                    >
                      Spend
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            {onChange ? (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button type="button" size="sm" variant="outline" className="min-h-11" onClick={() => onChange(applyShortRest())}>
                  Short Rest
                </Button>
                <Button type="button" size="sm" className="min-h-11" onClick={() => onChange(applyLongRest(character))}>
                  Long Rest
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {hasSlots ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Spell Slots</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {slotsByLevel.map((total, index) => (total > 0 ? (
              <SlotRow
                key={`slot-${index + 1}`}
                label={`Level ${index + 1}`}
                total={total}
                used={getSlotsUsed(character.spellSlotsUsed, index + 1)}
                onSetUsed={onChange ? (next) => onChange(setSpellSlotsUsed(character, index + 1, next, total)) : undefined}
              />
            ) : null))}
            {pactSlotsByLevel.map((total, index) => (total > 0 ? (
              <SlotRow
                key={`pact-${index + 1}`}
                label={`Pact Magic (level ${index + 1})`}
                total={total}
                used={getSlotsUsed(character.pactSlotsUsed, index + 1)}
                onSetUsed={onChange ? (next) => onChange(setPactSlotsUsed(character, index + 1, next, total)) : undefined}
              />
            ) : null))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
