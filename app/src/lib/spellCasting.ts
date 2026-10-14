/** One answer to "the lowest slot that can carry this", for both screens that ask. */
import { getSlotsUsed, setPactSlotsUsed, setSpellSlotsUsed, startConcentration } from '@/lib/sheetPlayState';
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

/** No stored answer, so the strongest bonus is used and the roll says which class. */
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

/** A spell that makes no attack throws nothing, so Magic Missile only spends its slot. */
export function rollSpellAttack(spell: Spell, castingStat: DerivedSpellcastingStats | undefined): void {
  const attack = deriveSpellAttackOrSave(spell).find((facet) => facet.kind === 'attack');
  if (!attack || !castingStat) return;
  void rollD20({
    modifier: castingStat.attackBonus,
    label: `${spell.name} attack`,
    detail: `${castingStat.className} · ${attack.label}`
  });
}

/** Casting a second concentration spell replaces the first; a cantrip spends no slot. */
export function castPatch(
  character: Character,
  spell: Pick<Spell, 'id' | 'name' | 'concentration'> | undefined,
  slot: CastableSlot | undefined,
  slotsByLevel: readonly number[],
  pactSlotsByLevel: readonly number[],
  spellLevel: number
): Partial<Character> {
  const spent = slot ? spendSlot(character, slot, slotsByLevel, pactSlotsByLevel) : {};
  if (!spell?.concentration) return spent;
  return { ...spent, ...startConcentration(spell.id, spell.name, slot?.level ?? spellLevel) };
}
