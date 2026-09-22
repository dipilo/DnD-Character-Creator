/**
 * Spell slot totals: what a class contributes at its level, and the shared pool a multiclass
 * caster draws from. Split out of `builderRules.ts` so the server can run it for the Discord
 * bot's play state (`server/lib/botPlayState.js`) — that loader uses Node's type stripping, so
 * this file may hold only `type` imports, exactly like `sheetMath.ts`.
 */
import type { Class, Subclass } from '@/types/dnd';

/** The shape `builderRules`' `SelectedClassWithLevel` has; structural, so both callers fit. */
export interface SlotClassEntry {
  cls: Class;
  level: number;
  subclass?: Subclass;
}

export type CasterKind = 'none' | 'pact' | 'half' | 'third' | 'full';

export interface SlotTotals {
  slotsByLevel: number[];
  pactSlotsByLevel: number[];
  multiclassCasterLevel: number;
}

export const normalizeName = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();

export const multiclassSpellSlotsTable: number[][] = [
  [2],
  [3],
  [4, 2],
  [4, 3],
  [4, 3, 2],
  [4, 3, 3],
  [4, 3, 3, 1],
  [4, 3, 3, 2],
  [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1]
];

export const getProgressionSlots = (values: number[][] | undefined, level: number) => {
  if (!values || level <= 0) {
    return [];
  }

  return values[Math.max(0, level - 1)] ?? [];
};

export const getHighestUnlockedSpellLevel = (slotsByLevel: number[]) => {
  return slotsByLevel.reduce((highestLevel, slotCount, index) => {
    return slotCount > 0 ? index + 1 : highestLevel;
  }, 0);
};

const getClassLookupKey = (cls: Class) => `${normalizeName(cls.id)} ${normalizeName(cls.name)}`;
export const classMatches = (cls: Class, token: string) => getClassLookupKey(cls).includes(token);

const getSubclassSpellcasting = (entry: SlotClassEntry) => {
  if (!entry.subclass?.spellcasting) {
    return undefined;
  }

  if (entry.cls.spellcasting) {
    return entry.cls.spellcasting;
  }

  return entry.subclass.spellcasting;
};

export const getSpellcastingSource = (entry: SlotClassEntry) => {
  return entry.cls.spellcasting ?? getSubclassSpellcasting(entry);
};

export const getCasterContribution = (entry: SlotClassEntry): { kind: CasterKind; slotsByLevel: number[] } => {
  const spellcasting = getSpellcastingSource(entry);
  if (!spellcasting) {
    return { kind: 'none', slotsByLevel: [] };
  }

  if (classMatches(entry.cls, 'warlock')) {
    return {
      kind: 'pact',
      slotsByLevel: getProgressionSlots(spellcasting.spellSlots, entry.level)
    };
  }

  if (classMatches(entry.cls, 'paladin') || classMatches(entry.cls, 'ranger')) {
    return {
      kind: 'half',
      slotsByLevel: getProgressionSlots(spellcasting.spellSlots, entry.level)
    };
  }

  if ((classMatches(entry.cls, 'fighter') || classMatches(entry.cls, 'rogue')) && entry.subclass?.spellcasting) {
    return {
      kind: 'third',
      slotsByLevel: getProgressionSlots(entry.subclass.spellcasting.spellSlots, entry.level)
    };
  }

  return {
    kind: 'full',
    slotsByLevel: getProgressionSlots(spellcasting.spellSlots, entry.level)
  };
};

/**
 * The slots a character has: a single caster's own column, or the multiclass table at the
 * combined caster level; pact slots are summed separately because they are the Warlock's own pool.
 */
export const deriveSlotTotals = (entries: SlotClassEntry[]): SlotTotals => {
  const contributions = entries.map((entry) => ({ entry, contribution: getCasterContribution(entry) }));

  const multiclassCasterLevel = contributions.reduce((total, { entry, contribution }) => {
    if (contribution.kind === 'full') {
      return total + entry.level;
    }
    if (contribution.kind === 'half') {
      return total + Math.floor(entry.level / 2);
    }
    if (contribution.kind === 'third') {
      return total + Math.floor(entry.level / 3);
    }
    return total;
  }, 0);

  const casters = contributions.filter(({ contribution }) => contribution.kind !== 'none' && contribution.kind !== 'pact' && contribution.slotsByLevel.length > 0);
  const slotsByLevel = casters.length <= 1
    ? (casters[0]?.contribution.slotsByLevel ?? [])
    : (multiclassSpellSlotsTable[Math.max(0, multiclassCasterLevel - 1)] ?? []);
  const pactSlotsByLevel = contributions.reduce<number[]>((slots, { contribution }) => {
    if (contribution.kind !== 'pact') {
      return slots;
    }
    contribution.slotsByLevel.forEach((slotCount, index) => {
      slots[index] = (slots[index] ?? 0) + slotCount;
    });
    return slots;
  }, []);

  return { slotsByLevel, pactSlotsByLevel, multiclassCasterLevel };
};
