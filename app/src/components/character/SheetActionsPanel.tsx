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
import { SpellCastControls } from '@/components/character/SpellCastControls';
import { SheetResourceControl } from '@/components/character/SheetResourceControl';
import {
  SHEET_ACTION_FILTERS,
  SHEET_ACTION_FILTER_LABELS,
  SHEET_ACTION_GROUP_LABELS,
  deriveSheetActions,
  groupSheetActions,
  matchesActionFilter,
  type SheetActionEntry,
  type SheetActionFilter,
  type SheetActionsInput
} from '@/lib/sheetActions';
import { castableSlots, rollSpellAttack, spendSlot, type CastableSlot } from '@/lib/spellCasting';
import { setClassResourceUsed, toggleResourceActive } from '@/lib/sheetPlayState';
import { rollD20 } from '@/lib/d20Rolls';
import { rollOnScreen } from '@/store/diceTrayStore';
import { formatModifier } from '@/lib/sheetDerivations';
import { cn } from '@/lib/utils';
import type { Character, Spell } from '@/types/dnd';

const rollButtonClass =
  'min-h-9 rounded px-1.5 font-semibold tabular-nums transition-colors hover:bg-accent coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

interface SheetActionsPanelProps {
  character: Character;
  attacks: SheetActionsInput['attacks'];
  spells: SheetActionsInput['spells'];
  features: SheetActionsInput['features'];
  classResources: SheetActionsInput['classResources'];
  castingStat?: SheetActionsInput['castingStat'];
  characterLevel: number;
  /** Resolved spells by id, so a Cast can throw what the spell states. */
  spellsById: ReadonlyMap<string, Spell>;
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
  characterLevel,
  spellsById,
  slotsByLevel,
  pactSlotsByLevel,
  onChange
}: Readonly<SheetActionsPanelProps>) {
  const [filter, setFilter] = useState<SheetActionFilter>('all');

  const entries = useMemo(
    () => deriveSheetActions({ attacks, spells, features, classResources, castingStat, characterLevel }),
    [attacks, castingStat, characterLevel, classResources, features, spells]
  );
  const visible = entries.filter((entry) => matchesActionFilter(entry, filter));
  const sections = groupSheetActions(visible);

  const resourceFor = (entry: SheetActionEntry) =>
    entry.resourceKey ? classResources.find((resource) => resource.key === entry.resourceKey) : undefined;

  const cast = (entry: SheetActionEntry, slot?: CastableSlot) => {
    if (slot) onChange?.(spendSlot(character, slot, slotsByLevel, pactSlotsByLevel));
    const spell = entry.spellId ? spellsById.get(entry.spellId) : undefined;
    if (spell) rollSpellAttack(spell, castingStat);
  };

  const controlsFor = (entry: SheetActionEntry) => {
    if (entry.kind === 'spell' && entry.spellLevel !== undefined) {
      const slots =
        entry.spellLevel > 0
          ? castableSlots(character, slotsByLevel, pactSlotsByLevel, entry.spellLevel)
          : [];
      return (
        <SpellCastControls
          spellName={entry.name}
          spellLevel={entry.spellLevel}
          slots={slots}
          canSpend={Boolean(onChange)}
          onCast={(slot) => cast(entry, slot)}
        />
      );
    }

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
    hit: hitCell(entry),
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
        <CardTitle className="text-base">Actions</CardTitle>
        <CardDescription>
          Weapons, spells and the features whose own text says when they are used.
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
          sections.map((section) => (
            <div key={section.group} className="space-y-1.5">
              <h4 className="text-sm font-medium text-muted-foreground">
                {SHEET_ACTION_GROUP_LABELS[section.group]}
              </h4>
              <SheetActionTable
                rows={section.entries.map((entry) => toRow(entry))}
                emptyMessage="Nothing here under this filter."
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** The Hit/DC cell: a to-hit is a button, a save is the DC this character imposes. */
function hitCell(entry: SheetActionEntry) {
  if (entry.attackBonus !== undefined) {
    return (
      <button
        type="button"
        className={rollButtonClass}
        onClick={() =>
          void rollD20({ modifier: entry.attackBonus ?? 0, label: `${entry.name} attack`, detail: entry.meta })
        }
      >
        {formatModifier(entry.attackBonus)}
      </button>
    );
  }
  return entry.saveLabel ? <span className="tabular-nums">{entry.saveLabel}</span> : undefined;
}

/** The Damage cell. Rolling changes nothing, so a read-only sheet keeps this button. */
function damageCell(entry: SheetActionEntry) {
  if (!entry.damageLabel) return undefined;
  if (!entry.damageNotation) return <span>{entry.damageLabel}</span>;
  return (
    <button
      type="button"
      className={rollButtonClass}
      onClick={() =>
        void rollOnScreen({
          notation: entry.damageNotation ?? '',
          label: `${entry.name} damage`,
          detail: entry.damageLabel
        })
      }
    >
      {entry.damageLabel}
    </button>
  );
}
