// The spellcasting half of the sheet: what this character can cast, what it costs, and the slots
// it costs it from.
//
// The list leads with a spell's name and level and puts everything else behind a disclosure, which
// is what a player reads down at the table. Casting spends the slot the player picks — the panel
// never guesses which, because casting a 1st-level spell with a 3rd-level slot is a real choice.
//
// Same posture as every other sheet panel: it holds no state and writes nothing of its own, so a
// campaign-mate reading a shared sheet gets the same component with no `onChange`.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Trash2 } from 'lucide-react';
import { SheetCatalogPicker, type CatalogPickerItem } from '@/components/character/SheetCatalogPicker';
import { SlotRow } from '@/components/character/SlotRow';
import { SpellList, type SpellListEntry } from '@/components/spells/SpellList';
import { formatSpellLevel } from '@/components/spells/spellFormatting';
import { getSlotsUsed, setPactSlotsUsed, setSpellSlotsUsed } from '@/lib/sheetPlayState';
import type { DerivedSpellcastingStats } from '@/lib/sheetDerivations';
import { formatModifier } from '@/lib/sheetDerivations';
import type { Character, Spell } from '@/types/dnd';

/** One spell as the sheet holds it: the stored entry, resolved where the library knows it. */
export interface SheetSpellEntry {
  id: string;
  name: string;
  level: number;
  spell?: Spell;
  prepared: boolean;
  alwaysPrepared?: boolean;
  /** Set when the spell comes from a feat rather than a class, and names the feat. */
  grantedBy?: string;
}

interface SheetSpellsPanelProps {
  character: Character;
  spells: SheetSpellEntry[];
  catalogue: Spell[];
  /** Save DC and attack bonus per spellcasting class. */
  castingStats: DerivedSpellcastingStats[];
  slotsByLevel: number[];
  pactSlotsByLevel: number[];
  onChange?: (patch: Partial<Character>) => void;
}

/** A slot level that can still be spent, and which pool it comes from. */
interface CastableSlot {
  level: number;
  remaining: number;
  pact: boolean;
}

function castableSlots(
  character: Character,
  slotsByLevel: number[],
  pactSlotsByLevel: number[],
  minimumLevel: number
): CastableSlot[] {
  const slots: CastableSlot[] = [];

  slotsByLevel.forEach((total, index) => {
    const level = index + 1;
    if (total <= 0 || level < minimumLevel) return;
    const remaining = total - getSlotsUsed(character.spellSlotsUsed, level);
    if (remaining > 0) slots.push({ level, remaining, pact: false });
  });

  pactSlotsByLevel.forEach((total, index) => {
    const level = index + 1;
    if (total <= 0 || level < minimumLevel) return;
    const remaining = total - getSlotsUsed(character.pactSlotsUsed, level);
    if (remaining > 0) slots.push({ level, remaining, pact: true });
  });

  return slots;
}

export function SheetSpellsPanel({
  character,
  spells,
  catalogue,
  castingStats,
  slotsByLevel,
  pactSlotsByLevel,
  onChange
}: Readonly<SheetSpellsPanelProps>) {
  const hasSlots = slotsByLevel.some((count) => count > 0) || pactSlotsByLevel.some((count) => count > 0);
  if (spells.length === 0 && !hasSlots && !onChange) {
    return null;
  }

  const chosenIds = new Set(character.spells.map((entry) => entry.spellId));
  const pickerItems: CatalogPickerItem[] = catalogue
    .filter((spell) => !chosenIds.has(spell.id))
    .map((spell) => ({
      id: spell.id,
      name: spell.name,
      detail: `${formatSpellLevel(spell.level)} · ${spell.school} · ${spell.source}`,
      keywords: spell.school
    }));

  const addSpell = (spellId: string) => {
    if (chosenIds.has(spellId)) return;
    onChange?.({ spells: [...character.spells, { spellId, prepared: false }] });
  };

  const togglePrepared = (spellId: string) => {
    onChange?.({
      spells: character.spells.map((entry) =>
        entry.spellId === spellId ? { ...entry, prepared: !entry.prepared } : entry
      )
    });
  };

  const removeSpell = (spellId: string) => {
    onChange?.({ spells: character.spells.filter((entry) => entry.spellId !== spellId) });
  };

  const castWith = (slot: CastableSlot) => {
    const used = getSlotsUsed(slot.pact ? character.pactSlotsUsed : character.spellSlotsUsed, slot.level) + 1;
    const total = (slot.pact ? pactSlotsByLevel : slotsByLevel)[slot.level - 1] ?? 0;
    onChange?.(slot.pact
      ? setPactSlotsUsed(character, slot.level, used, total)
      : setSpellSlotsUsed(character, slot.level, used, total));
  };

  const entries: SpellListEntry[] = spells.map((entry) => {
    const tags: string[] = [];
    if (entry.grantedBy) tags.push(entry.grantedBy);
    else if (entry.alwaysPrepared) tags.push('Always prepared');
    else if (entry.prepared && entry.level > 0) tags.push('Prepared');

    const slots = entry.level > 0 ? castableSlots(character, slotsByLevel, pactSlotsByLevel, entry.level) : [];

    return {
      id: entry.id,
      name: entry.name,
      level: entry.level,
      spell: entry.spell,
      tags,
      actions: onChange ? (
        <>
          {entry.level > 0 && slots.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="sm" variant="outline" className="min-h-11">Cast</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {slots.map((slot) => (
                  <DropdownMenuItem key={`${slot.pact ? 'pact' : 'slot'}-${slot.level}`} onSelect={() => castWith(slot)}>
                    {slot.pact ? `Pact slot (level ${slot.level})` : `Level ${slot.level} slot`} · {slot.remaining} left
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {entry.level > 0 && !entry.alwaysPrepared && !entry.grantedBy ? (
            <Button
              type="button"
              size="sm"
              variant={entry.prepared ? 'default' : 'outline'}
              className="min-h-11"
              aria-pressed={entry.prepared}
              onClick={() => togglePrepared(entry.id)}
            >
              {entry.prepared ? 'Prepared' : 'Prepare'}
            </Button>
          ) : null}
          {entry.grantedBy ? null : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11"
              aria-label={`Remove ${entry.name}`}
              onClick={() => removeSpell(entry.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </>
      ) : null
    };
  });

  return (
    <div className="space-y-4">
      {castingStats.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Spellcasting</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {castingStats.map((stat) => (
              <div key={stat.className} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{stat.className}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="secondary">Save DC {stat.saveDc}</Badge>
                  <Badge variant="secondary">Attack {formatModifier(stat.attackBonus)}</Badge>
                  <Badge variant="outline">{stat.ability.slice(0, 3).toUpperCase()}</Badge>
                </div>
              </div>
            ))}
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

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Spells</CardTitle>
              {onChange ? (
                <CardDescription>Open a spell to read it, or cast it from a slot.</CardDescription>
              ) : null}
            </div>
            {onChange ? (
              <SheetCatalogPicker
                triggerLabel="Add spell"
                title="Add a spell"
                description="Anything from the sources this character can use."
                items={pickerItems}
                onPick={addSpell}
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <SpellList entries={entries} emptyMessage="No spells recorded." />
        </CardContent>
      </Card>
    </div>
  );
}
