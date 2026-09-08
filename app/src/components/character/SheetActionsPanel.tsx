// The Actions tab: one filtered table of everything this character can do in a round.
//
// The chips are D&D Beyond's — All / Attack / Action / Bonus Action / Reaction / Other / Limited
// Use — and every row comes from `deriveSheetActions`, so a weapon, a spell and a feature print the
// same six columns. Nothing here is a list of actions written in the app.
//
// Same posture as every other sheet panel: no store, no state but the chip, and `onChange` is the
// whole write surface. Rolling is not a write, so a campaign-mate reading a shared sheet still gets
// every to-hit and every damage button.
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { SheetActionTable, type SheetActionTableRow } from '@/components/character/SheetActionTable';
import { SheetCombatActions } from '@/components/character/SheetCombatActions';
import { SheetResourceControl } from '@/components/character/SheetResourceControl';
import {
  SHEET_ACTION_FILTERS,
  SHEET_ACTION_FILTER_LABELS,
  SHEET_ACTION_GROUP_LABELS,
  deriveSheetActions,
  groupSheetActions,
  matchesActionFilter,
  type SheetActionDamage,
  type SheetActionEntry,
  type SheetActionFilter,
  type SheetActionsInput
} from '@/lib/sheetActions';
import { deriveAttacksPerAction } from '@/lib/sheetCombat';
import { castableSlots, spendSlot } from '@/lib/spellCasting';
import { setClassResourceUsed, toggleResourceActive } from '@/lib/sheetPlayState';
import { rollD20 } from '@/lib/d20Rolls';
import { rollOnScreen } from '@/store/diceTrayStore';
import { formatModifier } from '@/lib/sheetDerivations';
import { cn } from '@/lib/utils';
import type { Character } from '@/types/dnd';

const rollButtonClass =
  'min-h-9 rounded px-1.5 font-semibold tabular-nums transition-colors hover:bg-accent coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

interface SheetActionsPanelProps {
  character: Character;
  attacks: SheetActionsInput['attacks'];
  spells: SheetActionsInput['spells'];
  features: SheetActionsInput['features'];
  classResources: SheetActionsInput['classResources'];
  castingStat?: SheetActionsInput['castingStat'];
  /** What every character can do, from the printing this character plays. */
  combatActions: SheetActionsInput['combatActions'];
  characterLevel: number;
  slotsByLevel: number[];
  pactSlotsByLevel: number[];
  onChange?: (patch: Partial<Character>) => void;
}

export function SheetActionsPanel({
  character,
  attacks,
  spells,
  features,
  classResources,
  castingStat,
  combatActions,
  characterLevel,
  slotsByLevel,
  pactSlotsByLevel,
  onChange
}: Readonly<SheetActionsPanelProps>) {
  const [filter, setFilter] = useState<SheetActionFilter>('all');

  const entries = useMemo(
    () =>
      deriveSheetActions({ attacks, spells, features, classResources, castingStat, characterLevel, combatActions }),
    [attacks, castingStat, characterLevel, classResources, combatActions, features, spells]
  );
  const attacksPerAction = useMemo(() => deriveAttacksPerAction(features), [features]);
  const visible = entries.filter((entry) => matchesActionFilter(entry, filter));
  const sections = groupSheetActions(visible);

  const resourceFor = (entry: SheetActionEntry) =>
    entry.resourceKey ? classResources.find((resource) => resource.key === entry.resourceKey) : undefined;

  /**
   * Rolling to hit with a spell *is* casting it, so the roll spends the slot rather than a Cast
   * button beside it spending one and the roll being a second press. The lowest slot that can carry
   * the spell is the one spent, which is what `lib/spellCasting.ts` already answers for the Spells
   * tab; upcasting is a real choice and stays there, where the slots are.
   */
  const castOnAttack = (entry: SheetActionEntry) => {
    if (entry.kind !== 'spell' || !onChange) return;
    if (entry.spellLevel === undefined || entry.spellLevel === 0) return;
    const [lowest] = castableSlots(character, slotsByLevel, pactSlotsByLevel, entry.spellLevel);
    if (lowest) onChange(spendSlot(character, lowest, slotsByLevel, pactSlotsByLevel));
  };

  const controlsFor = (entry: SheetActionEntry) => {
    const resource = resourceFor(entry);
    if (!resource) return undefined;
    return (
      <SheetResourceControl
        resource={resource}
        onSetUsed={onChange ? (next) => onChange(setClassResourceUsed(character, resource, next)) : undefined}
        onToggleActive={onChange ? () => onChange(toggleResourceActive(character, resource)) : undefined}
      />
    );
  };

  const toRow = (entry: SheetActionEntry): SheetActionTableRow => ({
    id: entry.id,
    name: entry.name,
    meta: entry.meta,
    time: entry.time,
    range: entry.range,
    hit: hitCell(entry, () => castOnAttack(entry)),
    damage: damageCell(entry),
    notes: entry.notes,
    controls: controlsFor(entry),
    detail: entry.description ? (
      <p className="text-sm leading-relaxed text-muted-foreground">
        <ContentReferenceText text={entry.description} />
      </p>
    ) : undefined
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-base">
          Actions
          <span className="text-xs font-normal text-muted-foreground">
            Attacks per Action: {attacksPerAction}
          </span>
        </CardTitle>
        <CardDescription>
          Weapons, the spells you attack with, and the features whose own text says when they are used.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* The chips scroll rather than wrapping to three rows on a phone. */}
        <div className="scroll-strip -mx-1 flex gap-1 px-1 pb-1">
          {SHEET_ACTION_FILTERS.map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={filter === option ? 'default' : 'outline'}
              aria-pressed={filter === option}
              className={cn('min-h-9 shrink-0 coarse:min-h-11', filter === option && 'shadow-none')}
              onClick={() => setFilter(option)}
            >
              {SHEET_ACTION_FILTER_LABELS[option]}
            </Button>
          ))}
        </div>

        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here under this filter.</p>
        ) : (
          sections.map((section) => {
            // The actions everybody has are a list of names under their own heading, the way the
            // books print them: nothing about them is rolled, so a table row of empty columns was
            // the wrong shape for them.
            const own = section.entries.filter((entry) => entry.kind !== 'combat-action');
            const standard = section.entries.filter((entry) => entry.kind === 'combat-action');
            return (
              <div key={section.group} className="space-y-1.5">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {SHEET_ACTION_GROUP_LABELS[section.group]}
                </h4>
                {own.length > 0 ? (
                  <SheetActionTable
                    rows={own.map((entry) => toRow(entry))}
                    emptyMessage="Nothing here under this filter."
                    nameHeading="Attack"
                    showTime={false}
                  />
                ) : null}
                {standard.length > 0 ? (
                  <div className="pt-1">
                    <SheetCombatActions actions={standard} />
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/** The Hit/DC cell: a to-hit is a button, a save is the DC this character imposes. */
function hitCell(entry: SheetActionEntry, onRoll: () => void) {
  if (entry.attackBonus !== undefined) {
    return (
      <button
        type="button"
        className={rollButtonClass}
        onClick={() => {
          onRoll();
          void rollD20({ modifier: entry.attackBonus ?? 0, label: `${entry.name} attack`, detail: entry.meta });
        }}
      >
        {formatModifier(entry.attackBonus)}
      </button>
    );
  }
  return entry.saveLabel ? <span className="tabular-nums">{entry.saveLabel}</span> : undefined;
}

/**
 * The Damage cell, one line per choice the row offers. A Versatile weapon states two, and which one
 * is thrown is decided as the blow is struck — so they are two buttons rather than one reading
 * "1d6+1 bludgeoning (1d8+1 bludgeoning)", which could only ever throw the first.
 *
 * Rolling changes nothing, so a read-only sheet keeps these.
 */
function damageCell(entry: SheetActionEntry) {
  if (entry.damages.length === 0) return undefined;
  return (
    <span className="flex flex-col items-start gap-0.5">
      {entry.damages.map((damage) => (
        <DamageButton key={damage.label} name={entry.name} damage={damage} />
      ))}
    </span>
  );
}

function DamageButton({ name, damage }: Readonly<{ name: string; damage: SheetActionDamage }>) {
  if (!damage.notation) return <span className="text-sm">{damage.label}</span>;
  return (
    <button
      type="button"
      className={cn(rollButtonClass, 'text-left')}
      onClick={() =>
        void rollOnScreen({
          notation: damage.notation ?? '',
          label: `${name} damage`,
          detail: damage.label
        })
      }
    >
      {damage.label}
    </button>
  );
}
