/**
 * The rules for the numbers a player changes during play.
 *
 * Kept out of the sheet component for the same reason the derivations are: `CharacterSheetView`
 * renders and never decides. Every function here takes the document and returns the patch to apply,
 * so the owner's page can persist it and the read-only party view can simply not pass a handler.
 */
import type { Character, CharacterClass } from '@/types/dnd';

export interface DeathSaves {
  successes: number;
  failures: number;
}

const EMPTY_DEATH_SAVES: DeathSaves = { successes: 0, failures: 0 };
export const MAX_DEATH_SAVES = 3;
export const MAX_EXHAUSTION = 6;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const getDeathSaves = (character: Pick<Character, 'deathSaves'>): DeathSaves =>
  character.deathSaves ?? EMPTY_DEATH_SAVES;

/** True once the character is dying: at 0 hit points and not yet stabilised. */
export const isDying = (character: Pick<Character, 'hp' | 'deathSaves'>): boolean => {
  const saves = getDeathSaves(character);
  return character.hp.current <= 0 && saves.successes < MAX_DEATH_SAVES && saves.failures < MAX_DEATH_SAVES;
};

/**
 * Damage eats temporary hit points first, and the two pools never mix — 5 damage against 3 temp
 * and 10 real leaves 0 temp and 8 real, not 8 of one pool.
 */
export function applyDamage(character: Character, amount: number): Partial<Character> {
  const damage = Math.max(0, Math.trunc(amount));
  const absorbed = Math.min(character.hp.temporary, damage);
  const current = clamp(character.hp.current - (damage - absorbed), 0, character.hp.maximum);
  const patch: Partial<Character> = {
    hp: { ...character.hp, current, temporary: character.hp.temporary - absorbed }
  };

  // Dropping to 0 starts a fresh set of death saves; carrying the last fight's over is a bug the
  // player would only notice after rolling one.
  if (current === 0 && character.hp.current > 0) {
    patch.deathSaves = { ...EMPTY_DEATH_SAVES };
  }

  return patch;
}

/** Healing above 0 ends the dying condition, so the death saves go with it. */
export function applyHealing(character: Character, amount: number): Partial<Character> {
  const healing = Math.max(0, Math.trunc(amount));
  const current = clamp(character.hp.current + healing, 0, character.hp.maximum);
  const patch: Partial<Character> = { hp: { ...character.hp, current } };
  if (current > 0 && character.hp.current <= 0) {
    patch.deathSaves = { ...EMPTY_DEATH_SAVES };
  }
  return patch;
}

/**
 * Set the temporary pool outright. Temporary hit points never stack — a second source replaces the
 * first rather than adding to it — so the control is a value the player types, not a +/-.
 */
export function setTemporaryHitPoints(character: Character, amount: number): Partial<Character> {
  return { hp: { ...character.hp, temporary: Math.max(0, Math.trunc(amount)) } };
}

export function setDeathSave(character: Character, kind: keyof DeathSaves, count: number): Partial<Character> {
  const saves = getDeathSaves(character);
  return { deathSaves: { ...saves, [kind]: clamp(count, 0, MAX_DEATH_SAVES) } };
}

/**
 * Record a rolled death save. A natural 20 is back on your feet with 1 hit point and a natural 1
 * costs two failures, so the roll cannot simply be turned into a `setDeathSave` by the caller.
 */
export function applyDeathSaveRoll(character: Character, roll: number): Partial<Character> {
  const saves = getDeathSaves(character);

  if (roll >= 20) {
    return {
      deathSaves: EMPTY_DEATH_SAVES,
      hp: { ...character.hp, current: Math.max(1, character.hp.current) }
    };
  }

  if (roll >= 10) {
    return { deathSaves: { ...saves, successes: clamp(saves.successes + 1, 0, MAX_DEATH_SAVES) } };
  }

  return { deathSaves: { ...saves, failures: clamp(saves.failures + (roll <= 1 ? 2 : 1), 0, MAX_DEATH_SAVES) } };
}

/** Spend or restore one class's hit dice. `delta` is +1 for spending, -1 for getting one back. */
export function adjustHitDice(character: Character, classId: string, delta: number): Partial<Character> {
  return {
    classes: character.classes.map((entry) =>
      entry.classId === classId
        ? { ...entry, hitDiceUsed: clamp((entry.hitDiceUsed ?? 0) + delta, 0, entry.level) }
        : entry
    )
  };
}

const setSlotCount = (used: number[] | undefined, index: number, value: number, maximum: number): number[] => {
  const next = [...(used ?? [])];
  while (next.length <= index) next.push(0);
  next[index] = clamp(value, 0, maximum);
  return next;
};

export function setSpellSlotsUsed(character: Character, slotLevel: number, used: number, maximum: number): Partial<Character> {
  return { spellSlotsUsed: setSlotCount(character.spellSlotsUsed, slotLevel - 1, used, maximum) };
}

export function setPactSlotsUsed(character: Character, slotLevel: number, used: number, maximum: number): Partial<Character> {
  return { pactSlotsUsed: setSlotCount(character.pactSlotsUsed, slotLevel - 1, used, maximum) };
}

export const getSlotsUsed = (used: number[] | undefined, slotLevel: number) => used?.[slotLevel - 1] ?? 0;

/**
 * A short rest gets the pact slots back and nothing else. Hit dice are spent *during* a short rest
 * rather than restored by one, so this deliberately leaves them alone.
 */
export function applyShortRest(): Partial<Character> {
  return { pactSlotsUsed: [] };
}

/**
 * A long rest: full hit points, every spell slot back, and half the character's total hit dice
 * (minimum one) recovered — spread across the classes that have spent any.
 */
export function applyLongRest(character: Character): Partial<Character> {
  const totalLevel = character.classes.reduce((sum, entry) => sum + entry.level, 0);
  let recoverable = Math.max(1, Math.floor(totalLevel / 2));

  const classes: CharacterClass[] = character.classes.map((entry) => {
    const spent = entry.hitDiceUsed ?? 0;
    const recovered = Math.min(spent, recoverable);
    recoverable -= recovered;
    return { ...entry, hitDiceUsed: spent - recovered };
  });

  return {
    classes,
    hp: { ...character.hp, current: character.hp.maximum, temporary: 0 },
    spellSlotsUsed: [],
    pactSlotsUsed: [],
    deathSaves: { ...EMPTY_DEATH_SAVES },
    // Exhaustion drops by one on a long rest in both editions.
    exhaustion: Math.max(0, (character.exhaustion ?? 0) - 1)
  };
}

/** The conditions both editions print, so the sheet offers a list rather than a free-text box. */
export const CONDITION_NAMES = [
  'Blinded',
  'Charmed',
  'Deafened',
  'Frightened',
  'Grappled',
  'Incapacitated',
  'Invisible',
  'Paralyzed',
  'Petrified',
  'Poisoned',
  'Prone',
  'Restrained',
  'Stunned',
  'Unconscious'
] as const;

export function toggleCondition(character: Character, condition: string): Partial<Character> {
  const current = character.conditions ?? [];
  return {
    conditions: current.includes(condition)
      ? current.filter((entry) => entry !== condition)
      : [...current, condition]
  };
}

export function setExhaustion(level: number): Partial<Character> {
  return { exhaustion: clamp(Math.trunc(level), 0, MAX_EXHAUSTION) };
}
