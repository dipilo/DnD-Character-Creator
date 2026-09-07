// The spellcasting half of the sheet: what this character can cast, what it costs, and the slots
// it costs it from.
//
// The list is the same table the Actions tab prints — Name, Time, Range, Hit/DC, Damage, Notes —
// grouped by spell level, with the statblock behind the name. It used to be an accordion row whose
// name column and control group fought each other for width, which is what made a long spell name
// read as overlapping text.
//
// Cast spends the lowest slot that can carry the spell, which is what casting it normally means;
// the caret beside it is where upcasting lives, so a bigger slot stays a real choice.
//
// Same posture as every other sheet panel: it holds no state and writes nothing of its own, so a
// campaign-mate reading a shared sheet gets the same component with no `onChange`.
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, Trash2 } from 'lucide-react';
import { SheetCatalogPicker, type CatalogPickerItem } from '@/components/character/SheetCatalogPicker';
import { SheetActionTable, type SheetActionTableRow } from '@/components/character/SheetActionTable';
import { SpellCastControls } from '@/components/character/SpellCastControls';
import { SlotRow } from '@/components/character/SlotRow';
import { SpellDetail } from '@/components/spells/SpellDetail';
import { formatSpellLevel, spellReferencePath } from '@/components/spells/spellFormatting';
import { getSlotsUsed, setPactSlotsUsed, setSpellSlotsUsed } from '@/lib/sheetPlayState';
import { castableSlots, primaryCastingStat, rollSpellAttack, spendSlot, type CastableSlot } from '@/lib/spellCasting';
import { deriveSpellAttackOrSave, deriveSpellDamageOrEffect, deriveSpellDice } from '@/lib/spellFacets';
import { ABILITY_ABBREVIATIONS, formatModifier } from '@/lib/sheetDerivations';
import { rollOnScreen } from '@/store/diceTrayStore';
import { rollD20 } from '@/lib/d20Rolls';
import type { DerivedSpellcastingStats } from '@/lib/sheetDerivations';
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
  /** Total level, which is what a cantrip's own damage table keys off. */
  characterLevel: number;
  onChange?: (patch: Partial<Character>) => void;
}

const rollButtonClass =
  'min-h-9 rounded px-1.5 font-semibold tabular-nums transition-colors hover:bg-accent coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

/**
 * The letters, not the shopping list. A material component prints its whole parenthetical — "M (a
 * tiny ball of bat guano and sulfur)" — which is four wrapped lines in a Notes column; the material
 * is in the statblock the row opens.
 */
const componentLetters = (spell: Spell) =>
  spell.components.map((component) => component.split(' ')[0]).join('/');

const spellNotes = (spell: Spell) =>
  [componentLetters(spell), spell.concentration ? 'Concentration' : '', spell.ritual ? 'Ritual' : '']
    .filter(Boolean)
    .join(', ') || undefined;

export function SheetSpellsPanel({
  character,
  spells,
  catalogue,
  castingStats,
  slotsByLevel,
  pactSlotsByLevel,
  characterLevel,
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

  const castingStat = primaryCastingStat(castingStats);

  const castSpell = (entry: SheetSpellEntry, slot?: CastableSlot) => {
    if (slot) onChange?.(spendSlot(character, slot, slotsByLevel, pactSlotsByLevel));
    if (entry.spell) rollSpellAttack(entry.spell, castingStat);
  };

  const controlsFor = (entry: SheetSpellEntry) => (
    <>
      <SpellCastControls
        spellName={entry.name}
        spellLevel={entry.level}
        slots={entry.level > 0 ? castableSlots(character, slotsByLevel, pactSlotsByLevel, entry.level) : []}
        canSpend={Boolean(onChange)}
        onCast={(slot) => castSpell(entry, slot)}
      />
      {onChange && entry.level > 0 && !entry.alwaysPrepared && !entry.grantedBy ? (
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
      {onChange && !entry.grantedBy ? (
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
      ) : null}
    </>
  );

  const toRow = (entry: SheetSpellEntry): SheetActionTableRow => {
    const spell = entry.spell;
    if (!spell) {
      return {
        id: entry.id,
        name: entry.name,
        meta: 'Not in this character’s sources, so only the name is stored',
        controls: controlsFor(entry)
      };
    }

    const facets = deriveSpellAttackOrSave(spell);
    const makesAttack = facets.some((facet) => facet.kind === 'attack');
    const save = facets.find((facet) => facet.kind === 'save');
    const dice = deriveSpellDice(spell, { characterLevel, slotLevel: spell.level });
    const effects = deriveSpellDamageOrEffect(spell).map((effect) => effect.label).join(', ');
    const damageLabel = [dice, effects].filter(Boolean).join(' ');

    // Prepared is the button's own state, so it is not restated in the meta line; where the spell
    // came from is not, and is.
    let origin = '';
    if (entry.grantedBy) origin = entry.grantedBy;
    else if (entry.alwaysPrepared) origin = 'Always prepared';

    return {
      id: entry.id,
      name: spell.name,
      meta: [spell.school, origin].filter(Boolean).join(' · '),
      time: spell.castingTime || undefined,
      range: spell.range || undefined,
      hit: hitCell(
        spell.name,
        makesAttack ? castingStat?.attackBonus : undefined,
        save?.ability && castingStat
          ? `DC ${castingStat.saveDc} ${ABILITY_ABBREVIATIONS[save.ability]}`
          : undefined
      ),
      damage: damageCell(spell.name, dice, damageLabel),
      notes: spellNotes(spell),
      controls: controlsFor(entry),
      detail: (
        <div>
          <SpellDetail spell={spell} />
          <Button asChild variant="outline" size="sm" className="mt-3 min-h-11">
            <Link to={spellReferencePath(spell.id)}>
              Open spell page
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )
    };
  };

  const levels = [...new Set(spells.map((entry) => entry.level))].sort((left, right) => left - right);

  return (
    <div className="space-y-4">
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
        <CardContent className="space-y-3">
          {levels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spells recorded.</p>
          ) : (
            levels.map((level) => (
              <div key={level} className="space-y-1.5">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {level === 0 ? 'Cantrips' : formatSpellLevel(level)}
                </h4>
                <SheetActionTable
                  rows={spells.filter((entry) => entry.level === level).map((entry) => toRow(entry))}
                  emptyMessage="No spells recorded."
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** A to-hit is a button; a save is the DC this character imposes, which nothing rolls for them. */
function hitCell(spellName: string, attackBonus: number | undefined, saveLabel: string | undefined) {
  if (attackBonus !== undefined) {
    return (
      <button
        type="button"
        className={rollButtonClass}
        onClick={() => void rollD20({ modifier: attackBonus, label: `${spellName} attack` })}
      >
        {formatModifier(attackBonus)}
      </button>
    );
  }
  return saveLabel ? <span className="tabular-nums">{saveLabel}</span> : undefined;
}

/** Rolling changes nothing about the character, so a shared sheet keeps this button. */
function damageCell(spellName: string, dice: string | undefined, label: string) {
  if (!label) return undefined;
  if (!dice) return <span>{label}</span>;
  return (
    <button
      type="button"
      className={rollButtonClass}
      onClick={() => void rollOnScreen({ notation: dice, label: `${spellName} damage`, detail: label })}
    >
      {label}
    </button>
  );
}
