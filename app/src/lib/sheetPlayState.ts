/**
 * The rules for the numbers a player changes during play.
 *
 * Kept out of the sheet component for the same reason the derivations are: `CharacterSheetView`
 * renders and never decides. Every function here takes the document and returns the patch to apply,
 * so the owner's page can persist it and the read-only party view can simply not pass a handler.
 */
import type { Character, CharacterClass, Class, ClassResource, CoinUnit } from '@/types/dnd';

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
    // Both printings end concentration at 0 hit points, with no save offered.
    if (character.concentration) patch.concentration = undefined;
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
export function applyShortRest(character?: Character, resources: ResolvedClassResource[] = []): Partial<Character> {
  if (!character) return { pactSlotsUsed: [] };
  return { pactSlotsUsed: [], classResourcesUsed: restoreOnRest(character, resources, 'short') };
}

/**
 * A long rest: full hit points, every spell slot back, and half the character's total hit dice
 * (minimum one) recovered — spread across the classes that have spent any.
 */
export function applyLongRest(character: Character, resources: ResolvedClassResource[] = []): Partial<Character> {
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
    classResourcesUsed: restoreOnRest(character, resources, 'long'),
    // Nothing you entered survives a night's sleep.
    activeEffects: [],
    concentration: undefined,
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

/* -------------------------------------------------------------------------- *
 * Concentration
 * -------------------------------------------------------------------------- */

/**
 * Start concentrating. A character concentrates on one spell, so this replaces whatever they were
 * holding rather than adding to it — which is the whole reason the field is on the document and
 * not worked out from the spell list.
 */
export function startConcentration(
  spellId: string,
  spellName: string,
  slotLevel: number,
): Partial<Character> {
  return { concentration: { spellId, spellName, slotLevel } };
}

export function endConcentration(): Partial<Character> {
  return { concentration: undefined };
}

/**
 * The save damage imposes: DC 10, or half the damage taken when that is higher. Stated identically
 * in both printings, so it is one number rather than a per-edition lookup.
 */
export function concentrationSaveDc(damage: number): number {
  return Math.max(10, Math.floor(Math.max(0, damage) / 2));
}

/* -------------------------------------------------------------------------- *
 * The purse
 * -------------------------------------------------------------------------- */

/** Smallest first, which is the order both printings print the coins in. */
export const COIN_UNITS: readonly CoinUnit[] = ['cp', 'sp', 'ep', 'gp', 'pp'];

export const COIN_LABELS: Record<CoinUnit, string> = {
  cp: 'Copper',
  sp: 'Silver',
  ep: 'Electrum',
  gp: 'Gold',
  pp: 'Platinum',
};

export const getCoins = (character: Pick<Character, 'currency'>, unit: CoinUnit): number =>
  Math.max(0, Math.trunc(character.currency?.[unit] ?? 0));

/** A coin nobody carries is dropped rather than stored as a zero, so an untouched purse is absent. */
export function setCoins(character: Character, unit: CoinUnit, amount: number): Partial<Character> {
  const next = { ...(character.currency ?? {}) };
  const value = Math.max(0, Math.trunc(amount));
  if (value === 0) delete next[unit];
  else next[unit] = value;
  return { currency: Object.keys(next).length > 0 ? next : undefined };
}

/**
 * One class resource as this character holds it: the pool the class table states, the maximum at
 * the level they have in that class, and how much of it is spent.
 *
 * The table is the class's (`ClassResource`), so nothing here knows what a Rage or a Ki Point is —
 * a class whose table states no pool column simply produces no tracker.
 */
export interface ResolvedClassResource extends ClassResource {
  /** `<classId>::<resourceId>`, the key on the document. */
  key: string;
  classId: string;
  className: string;
  /** The level's entry in `perLevel`. Null is the book's "Unlimited". */
  maximum: number | null;
  used: number;
  /**
   * Whether this is something you *enter* and stay in rather than simply spend. Read from the
   * feature's own words — both printings of Rage say "you can enter", and no other class pool in
   * either book does.
   */
  activatable: boolean;
  /** Whether the character is in it right now. */
  active: boolean;
}

/** The phrase that separates a pool you enter from one you only spend. */
const ENTERED_RESOURCE_PATTERN = /\byou can enter\b/i;

export function classResourceKey(classId: string, resourceId: string): string {
  return `${classId}::${resourceId}`;
}

/**
 * Every pool this character has, in class order. `resolveClass` is passed in rather than imported
 * so this module stays free of the content library, exactly as the rest of it is.
 */
export function resolveClassResources(
  character: Pick<Character, 'classes' | 'classResourcesUsed' | 'activeEffects'>,
  resolveClass: (classId: string) => Class | undefined,
): ResolvedClassResource[] {
  const spent = character.classResourcesUsed ?? {};
  const resolved: ResolvedClassResource[] = [];

  for (const entry of character.classes) {
    const cls = resolveClass(entry.classId);
    for (const resource of cls?.resources ?? []) {
      const maximum = resource.perLevel[entry.level - 1] ?? 0;
      // A pool the character has not reached the level for is not an empty tracker, it is no
      // tracker: the 2024 Cleric gains Channel Divinity at level 2.
      if (maximum === 0) continue;
      const key = classResourceKey(entry.classId, resource.id);
      const feature = cls?.features.find((candidate) => candidate.name === resource.featureName);
      resolved.push({
        ...resource,
        key,
        classId: entry.classId,
        className: cls?.name ?? entry.classId,
        maximum,
        used: clamp(spent[key] ?? 0, 0, maximum ?? Number.MAX_SAFE_INTEGER),
        activatable: ENTERED_RESOURCE_PATTERN.test(feature?.description ?? ''),
        active: (character.activeEffects ?? []).includes(key),
      });
    }
  }

  return resolved;
}

export function setClassResourceUsed(
  character: Character,
  resource: ResolvedClassResource,
  next: number,
): Partial<Character> {
  const used = clamp(Math.trunc(next), 0, resource.maximum ?? Number.MAX_SAFE_INTEGER);
  const current = { ...(character.classResourcesUsed ?? {}) };
  if (used === 0) delete current[resource.key];
  else current[resource.key] = used;
  return { classResourcesUsed: current };
}

/**
 * Enter a resource, or come out of it.
 *
 * Entering spends a use, because that is what the pool counts; ending does not give it back, which
 * is also what the books say. A pool with nothing left cannot be entered.
 */
export function toggleResourceActive(
  character: Character,
  resource: ResolvedClassResource,
): Partial<Character> {
  const active = character.activeEffects ?? [];

  if (active.includes(resource.key)) {
    return { activeEffects: active.filter((entry) => entry !== resource.key) };
  }

  const remaining = resource.maximum === null ? Number.MAX_SAFE_INTEGER : resource.maximum - resource.used;
  if (remaining <= 0) {
    return {};
  }

  return {
    ...setClassResourceUsed(character, resource, resource.used + 1),
    activeEffects: [...active, resource.key],
  };
}

/**
 * What a rest gives back. A resource that comes back fully on this rest is cleared; one the 2024
 * books hand back a single use of on a short rest is reduced by that much instead, which is what
 * `shortRestRegain` carries. A resource whose source states no recovery is left alone.
 */
function restoreOnRest(
  character: Character,
  resources: ResolvedClassResource[],
  rest: 'short' | 'long',
): Record<string, number> {
  const next = { ...(character.classResourcesUsed ?? {}) };

  for (const resource of resources) {
    const spentNow = next[resource.key] ?? 0;
    if (spentNow === 0) continue;

    if (resource.resetsOn === rest || (rest === 'long' && resource.resetsOn === 'short')) {
      delete next[resource.key];
      continue;
    }
    if (rest === 'short' && resource.resetsOn === 'long' && resource.shortRestRegain) {
      const left = Math.max(0, spentNow - resource.shortRestRegain);
      if (left === 0) delete next[resource.key];
      else next[resource.key] = left;
    }
  }

  return next;
}
