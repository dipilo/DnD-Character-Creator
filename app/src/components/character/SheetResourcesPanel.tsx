// Hit dice and class resources. Spell slots live with the spells they cast, and the two rests sit
// in the sheet header, where they are reachable from every tab.
//
// Same posture as the hit-point panel: no store, no writes — `onChange` is the whole write
// surface, and its absence is what makes the party view read-only.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { modifierNotation, parseDiceNotation } from '@/lib/diceNotation';
import { rollOnScreen } from '@/store/diceTrayStore';
import {
  adjustHitDice,
  setClassResourceUsed,
  toggleResourceActive
} from '@/lib/sheetPlayState';
import type { ResolvedClassResource } from '@/lib/sheetPlayState';
import { SlotRow } from '@/components/character/SlotRow';
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
  /**
   * Slots per level, indexed by level - 1. Read only to decide whether this panel has anything to
   * show; the slots themselves are spent on the Spells tab, beside the spells they cast.
   */
  slotsByLevel: number[];
  pactSlotsByLevel: number[];
  /** Rages, Ki Points, Channel Divinity: whatever this character's class tables state. */
  classResources: ResolvedClassResource[];
  /** Added to a spent hit die, the way the rules add it. Omitted where the sheet has not derived it. */
  constitutionModifier?: number;
  onChange?: (patch: Partial<Character>) => void;
}

/**
 * One class pool. Pips like a spell slot's, because it is spent the same way — except where the
 * book says "Unlimited", which is the 2014 Barbarian at level 20 and is not a thing to count.
 */
function ResourceRow({
  resource,
  onSetUsed,
  onToggleActive
}: Readonly<{
  resource: ResolvedClassResource;
  onSetUsed?: (next: number) => void;
  onToggleActive?: () => void;
}>) {
  const subtitle = [resource.className, resource.featureName].filter(Boolean).join(' · ');
  // The book's noun for the thing you are in ("Rage"), not the table's column heading ("Rages").
  const effectName = resource.featureName ?? resource.name;
  const exhausted = resource.maximum !== null && resource.used >= resource.maximum;

  const activeControl = resource.activatable ? (
    <div className="flex flex-wrap items-center gap-2">
      {resource.active ? <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">{effectName} active</Badge> : null}
      {onToggleActive ? (
        <Button
          type="button"
          size="sm"
          variant={resource.active ? 'default' : 'outline'}
          className="min-h-11"
          aria-pressed={resource.active}
          disabled={!resource.active && exhausted}
          onClick={onToggleActive}
        >
          {resource.active ? `End ${effectName}` : `Enter ${effectName}`}
        </Button>
      ) : null}
    </div>
  ) : null;

  if (resource.maximum === null) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">{resource.name}</span>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">Unlimited</Badge>
          {activeControl}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <SlotRow label={resource.name} total={resource.maximum} used={resource.used} onSetUsed={onSetUsed} />
      {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      {activeControl}
    </div>
  );
}

export function SheetResourcesPanel({
  character,
  hitDice,
  slotsByLevel,
  pactSlotsByLevel,
  classResources,
  constitutionModifier = 0,
  onChange
}: Readonly<SheetResourcesPanelProps>) {
  // Spending a hit die is spending it *to roll it*, so the die goes to the tray with the same
  // click that marks it used. The healing itself stays the player's to apply: the rules let a
  // short rest be interrupted, and the panel does not know whether this one finished.
  const spendHitDie = (pool: HitDicePool) => {
    onChange?.(adjustHitDice(character, pool.classId, 1));
    const sides = parseDiceNotation(pool.die)?.groups[0]?.sides;
    if (sides) {
      void rollOnScreen({
        notation: modifierNotation(sides, constitutionModifier),
        label: `${pool.className} hit die`,
        detail: 'Hit points regained on a short rest'
      });
    }
  };
  const hasSlots = slotsByLevel.some((count) => count > 0) || pactSlotsByLevel.some((count) => count > 0);
  if (hitDice.length === 0 && !hasSlots && classResources.length === 0) {
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
                      onClick={() => spendHitDie(pool)}
                    >
                      Spend &amp; roll
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {classResources.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Class Resources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {classResources.map((resource) => (
              <ResourceRow
                key={resource.key}
                resource={resource}
                onSetUsed={onChange ? (next) => onChange(setClassResourceUsed(character, resource, next)) : undefined}
                onToggleActive={onChange ? () => onChange(toggleResourceActive(character, resource)) : undefined}
              />
            ))}
          </CardContent>
        </Card>
      ) : null}

    </div>
  );
}
