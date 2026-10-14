// Play-state rules: each function takes the document and returns a patch to apply.
import type { AbilityScores, Character, CharacterClass, Class, ClassResource, CoinUnit, Subclass } from '@/types/dnd';

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

/** Temp first, and the pools never mix: 5 against 3 temp and 10 real leaves 8 real. */
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

/** Temp hit points never stack, so this is a typed value, not a +/-. */
export function setTemporaryHitPoints(character: Character, amount: number): Partial<Character> {
  return { hp: { ...character.hp, temporary: Math.max(0, Math.trunc(amount)) } };
}

export function setDeathSave(character: Character, kind: keyof DeathSaves, count: number): Partial<Character> {
  const saves = getDeathSaves(character);
  return { deathSaves: { ...saves, [kind]: clamp(count, 0, MAX_DEATH_SAVES) } };
}

/** A natural 20 restores 1 hit point and a natural 1 costs two failures. */
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

/** Hit dice are spent *during* a short rest, so this leaves them alone. */
export function applyShortRest(character?: Character, resources: ResolvedClassResource[] = []): Partial<Character> {
  if (!character) return { pactSlotsUsed: [] };
  return { pactSlotsUsed: [], classResourcesUsed: restoreOnRest(character, resources, 'short') };
}

/** Half the total hit dice back, minimum one, spread across classes that spent any. */
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

/** Replaces whatever was held, which is why the field is on the document. */
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

/** DC 10 or half the damage, whichever is higher; both printings state it identically. */
export function concentrationSaveDc(damage: number): number {
  return Math.max(10, Math.floor(Math.max(0, damage) / 2));
}

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

/** The pool is the source's, so a feature whose text states none produces no tracker. */
export interface ResolvedClassResource extends ClassResource {
  /** `<classId>::<resourceId>`, the key on the document. */
  key: string;
  classId: string;
  className: string;
  /** The level's entry in `perLevel`, or the ability's or proficiency's answer. Null is the book's "Unlimited". */
  maximum: number | null;
  /** Says why the number is 3 when an ability or the proficiency bonus sized it. */
  maximumSource?: string;
  used: number;
  /** Whether this is a pool you enter and stay in rather than one you only spend. */
  activatable: boolean;
  /** Whether the character is in it right now. */
  active: boolean;
}

/** Stance wording; a miss leaves the pool's benefits applying outside it. See docs/rules/sheet.md. */
const ENTERED_RESOURCE_PATTERN =
  /\byou can enter\b|\bwhich lasts? for\b|\bduring which you (?:gain|have)\b|\bfor the duration\b|\bwhich last for\b/i;

export function classResourceKey(classId: string, resourceId: string): string {
  return `${classId}::${resourceId}`;
}

/** Passed in, so this module stays free of `sheetMath`, which the bot loads separately. */
export interface ResourceScaling {
  abilityModifier: (ability: keyof AbilityScores) => number;
  proficiencyBonus: number;
}

/** The maximum, and the phrase the book sized it with where that is not the table's own column. */
interface ResourceMaximum {
  value: number | null;
  source?: string;
}

function resourceMaximum(resource: ClassResource, level: number, scaling: ResourceScaling): ResourceMaximum {
  // `?? 0` here read the book's "Unlimited" as a pool of nothing, so the 2014 Barbarian's level-20
  // Rages were dropped as an unreached level and the panel's Unlimited branch was unreachable.
  const entry = resource.perLevel[level - 1];
  const stated = entry === undefined ? 0 : entry;
  if (stated === 0 || stated === null) return { value: stated };
  if (resource.usesFromAbility) {
    const { ability, bonus, minimum } = resource.usesFromAbility;
    // The six ability keys are their own labels once capitalised; a table here could only drift.
    const named = `${ability.charAt(0).toUpperCase()}${ability.slice(1)} modifier`;
    const base = bonus > 0 ? `${bonus} + ${named}` : named;
    return {
      value: Math.max(minimum, scaling.abilityModifier(ability) + bonus),
      source: minimum > 0 ? `${base}, minimum ${minimum}` : base,
    };
  }
  if (resource.usesFromProficiencyBonus) return { value: scaling.proficiencyBonus, source: 'Proficiency bonus' };
  return { value: stated };
}

/** Font of Inspiration moves Bardic Inspiration to a short rest at 5th level; the pool says so. */
function resourceResetAt(resource: ClassResource, level: number): ClassResource['resetsOn'] {
  if (resource.shortRestFromLevel !== undefined && level >= resource.shortRestFromLevel) return 'short';
  return resource.resetsOn;
}

/** Resolvers are passed in, so this module stays free of the content library. */
export function resolveClassResources(
  character: Pick<Character, 'classes' | 'classResourcesUsed' | 'activeEffects'>,
  resolveClass: (classId: string) => Class | undefined,
  scaling: ResourceScaling,
  resolveSubclass: (subclassId: string, cls: Class) => Subclass | undefined = (id, cls) =>
    cls.subclasses.find((candidate) => candidate.id === id),
): ResolvedClassResource[] {
  const spent = character.classResourcesUsed ?? {};
  const resolved: ResolvedClassResource[] = [];

  for (const entry of character.classes) {
    const cls = resolveClass(entry.classId);
    if (!cls) continue;
    const subclass = entry.subclassId ? resolveSubclass(entry.subclassId, cls) : undefined;
    const pools = [
      ...(cls.resources ?? []).map((resource) => ({ resource, features: cls.features })),
      ...(subclass ? (subclass.resources ?? []).map((resource) => ({ resource, features: subclass.features })) : []),
    ];

    for (const { resource, features } of pools) {
      const maximum = resourceMaximum(resource, entry.level, scaling);
      // A pool the character has not reached the level for is not an empty tracker, it is no
      // tracker: the 2024 Cleric gains Channel Divinity at level 2.
      if (maximum.value === 0) continue;
      const key = classResourceKey(entry.classId, resource.id);
      const feature = features.find((candidate) => candidate.name === resource.featureName);
      resolved.push({
        ...resource,
        resetsOn: resourceResetAt(resource, entry.level),
        key,
        classId: entry.classId,
        className: cls.name,
        maximum: maximum.value,
        maximumSource: maximum.source,
        used: clamp(spent[key] ?? 0, 0, maximum.value ?? Number.MAX_SAFE_INTEGER),
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

/** Entering spends a use and ending does not give it back, as the books say. */
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

/** `shortRestRegain` carries a partial; a resource stating no recovery is left alone. */
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
