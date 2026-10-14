// No store and no writes: `onChange` absent is what makes the party view read-only.
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
  /** Read only to decide whether this panel shows; slots are spent on the Spells tab. */
  slotsByLevel: number[];
  pactSlotsByLevel: number[];
  /** Rages, Ki Points, Channel Divinity: whatever this character's class tables state. */
  classResources: ResolvedClassResource[];
  /** Added to a spent hit die, the way the rules add it. Omitted where the sheet has not derived it. */
  constitutionModifier?: number;
  onChange?: (patch: Partial<Character>) => void;
}

/** Pips, as a slot is spent, except "Unlimited", which is not a thing to count. */
function ResourceRow({
  resource,
  onSetUsed,
  onToggleActive
}: Readonly<{
  resource: ResolvedClassResource;
  onSetUsed?: (next: number) => void;
  onToggleActive?: () => void;
}>) {
  // A pool sized by an ability or the proficiency bonus is a bare number without the last segment,
  // and a player who raises their Charisma has no way to tell why the tracker grew.
  const maximumSource = resource.maximumSource ? `Max ${resource.maximumSource}` : undefined;
  const subtitle = [resource.className, resource.featureName, maximumSource].filter(Boolean).join(' · ');
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
  // The healing stays the player's to apply: a short rest can be interrupted.
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
