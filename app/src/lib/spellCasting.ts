/**
 * Which slot a cast can come out of, and which class it is cast as.
 *
 * Lifted out of `SheetSpellsPanel` when the Actions table started casting too: two screens deciding
 * separately what "the lowest slot that can carry this spell" means is two answers to one question.
 */
import { getSlotsUsed, setPactSlotsUsed, setSpellSlotsUsed } from '@/lib/sheetPlayState';
import { deriveSpellAttackOrSave } from '@/lib/spellFacets';
import { rollD20 } from '@/lib/d20Rolls';
import type { DerivedSpellcastingStats } from '@/lib/sheetDerivations';
import type { Character, Spell } from '@/types/dnd';

/** A slot level that can still be spent, and which pool it comes from. */
export interface CastableSlot {
  level: number;
  remaining: number;
  pact: boolean;
}

export function castableSlots(
  character: Pick<Character, 'spellSlotsUsed' | 'pactSlotsUsed'>,
  slotsByLevel: readonly number[],
  pactSlotsByLevel: readonly number[],
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

/**
 * The class a spell is cast as. `character.spells` records no class, so a multiclass caster has no
 * stored answer: the strongest attack bonus is used and the roll is labelled with the class it came
 * from, which keeps the choice visible rather than silent.
 */
export function primaryCastingStat(castingStats: readonly DerivedSpellcastingStats[]) {
  return castingStats.reduce<DerivedSpellcastingStats | undefined>(
    (best, stat) => (best && best.attackBonus >= stat.attackBonus ? best : stat),
    undefined
  );
}

/** Marking one slot of the chosen pool spent. */
export function spendSlot(
  character: Character,
  slot: CastableSlot,
  slotsByLevel: readonly number[],
  pactSlotsByLevel: readonly number[]
): Partial<Character> {
  const used = getSlotsUsed(slot.pact ? character.pactSlotsUsed : character.spellSlotsUsed, slot.level) + 1;
  const total = (slot.pact ? pactSlotsByLevel : slotsByLevel)[slot.level - 1] ?? 0;
  return slot.pact
    ? setPactSlotsUsed(character, slot.level, used, total)
    : setSpellSlotsUsed(character, slot.level, used, total);
}

/**
 * Casting is the slot and the throw together: spending a slot without rolling the attack the spell
 * states leaves the player hunting for the number elsewhere on the sheet. A spell that makes no
 * attack throws nothing here, which is why Magic Missile only spends its slot.
 */
export function rollSpellAttack(spell: Spell, castingStat: DerivedSpellcastingStats | undefined): void {
  const attack = deriveSpellAttackOrSave(spell).find((facet) => facet.kind === 'attack');
  if (!attack || !castingStat) return;
  void rollD20({
    modifier: castingStat.attackBonus,
    label: `${spell.name} attack`,
    detail: `${castingStat.className} · ${attack.label}`
  });
}
