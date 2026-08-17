/**
 * What a starting-equipment line still leaves the player to decide.
 *
 * A class kit prints two kinds of unresolved item: a weapon named by category ("any simple
 * weapon", "two martial weapons") and an item named by family ("an arcane focus", "a holy
 * symbol", "Musical Instrument of your choice"). Both are picks, not proficiencies — the same rule
 * that governs "One type of gaming set" on the proficiency side — so they get a selector and the
 * sheet shows what was picked, never the phrase.
 *
 * The tests are deliberately exact on the family name. "Arcane Focus (crystal)" and "Druidic Focus
 * (sprig of mistletoe)" are the 2024 book naming a specific item, so they stay fixed grants; only a
 * bare family, a "…of your choice", or a "Choose 1 from …" is offered as a choice.
 */

export type WeaponCategory = 'simple' | 'martial';
export type WeaponType = 'melee' | 'ranged';

export interface StartingWeaponRule {
  category: WeaponCategory;
  type?: WeaponType;
  /** How many separate weapons the line grants — "Two martial weapons" is two picks, not one. */
  count: number;
}

const quantityWords: Record<string, number> = {
  a: 1,
  an: 1,
  any: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10
};

export function normalizeEquipmentOptionName(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Strip the leading article or count and any "of your choice" / "Choose 1 from" wrapper, leaving
 * the bare thing being named. Returns the count alongside it, so "two martial weapons" is one
 * phrase asking for two picks.
 */
function readChoicePhrase(optionName: string) {
  let text = normalizeEquipmentOptionName(optionName);
  let count = 1;

  // Literal spaces throughout: the text is already normalised to single spaces, and `\s+(.+)`
  // gives adjacent quantifiers something to backtrack over (S8786).
  const chooseFrom = /^choose (\d+) from (.+)$/.exec(text);
  if (chooseFrom) {
    count = Number.parseInt(chooseFrom[1], 10);
    text = chooseFrom[2];
  }

  // Quantifiers stack — Tasha's Artificer prints "any two simple weapons of your choice" — so peel
  // them off until one is not a quantity, keeping the largest count any of them named.
  let previous = '';
  while (text !== previous) {
    previous = text;
    const numericPrefix = /^(\d+) (.+)$/.exec(text);
    const wordPrefix = /^([a-z]+) (.+)$/.exec(text);
    if (numericPrefix) {
      count = Math.max(count, Number.parseInt(numericPrefix[1], 10));
      text = numericPrefix[2];
    } else if (wordPrefix && Object.hasOwn(quantityWords, wordPrefix[1])) {
      count = Math.max(count, quantityWords[wordPrefix[1]]);
      text = wordPrefix[2];
    }
  }

  text = text.replace(/ of your choice$/, '').trim();
  return { text, count: Number.isFinite(count) && count > 0 ? count : 1 };
}

const weaponPhrasePattern = /^(simple|martial)(?: (melee|ranged))? weapons?$/;

/** The weapon category a line leaves open, or null when it names a specific weapon. */
export function getStartingWeaponRule(optionName: string): StartingWeaponRule | null {
  const { text, count } = readChoicePhrase(optionName);
  const match = weaponPhrasePattern.exec(text);
  if (!match) return null;

  return {
    category: match[1] as WeaponCategory,
    type: (match[2] as WeaponType | undefined) ?? undefined,
    count
  };
}

/**
 * The families a line can name instead of an item. `tag` is the semantic tag the equipment filter
 * already computes for a catalogue entry, so the candidate list and the type filter agree.
 */
const equipmentChoiceFamilies: Array<{ pattern: RegExp; tag: string; label: string }> = [
  { pattern: /^(?:other )?musical instruments?$/, tag: 'instrument', label: 'musical instrument' },
  { pattern: /^gaming sets?$/, tag: 'gaming set', label: 'gaming set' },
  { pattern: /^artisan s tools?$/, tag: 'artisan tools', label: "artisan's tools" },
  { pattern: /^holy symbols?$/, tag: 'holy symbol', label: 'holy symbol' },
  { pattern: /^arcane focus(?:es)?$/, tag: 'arcane focus', label: 'arcane focus' },
  { pattern: /^druidic focus(?:es)?$/, tag: 'druidic focus', label: 'druidic focus' },
  { pattern: /^spellcasting focus(?:es)?$/, tag: 'arcane focus', label: 'spellcasting focus' }
];

export interface EquipmentChoiceFamily {
  tag: string;
  label: string;
  count: number;
}

/** The family a line leaves open, or null when it names a specific item. */
export function getEquipmentChoiceFamily(optionName: string): EquipmentChoiceFamily | null {
  const { text, count } = readChoicePhrase(optionName);
  const family = equipmentChoiceFamilies.find((entry) => entry.pattern.test(text));
  return family ? { tag: family.tag, label: family.label, count } : null;
}

/** True when the line names something the player still has to pick. */
export function isEquipmentChoiceOption(optionName?: string): boolean {
  if (!optionName) return false;
  return Boolean(getStartingWeaponRule(optionName) ?? getEquipmentChoiceFamily(optionName));
}

/** How many picks a line asks for; 1 for anything that is not a choice. */
export function getEquipmentChoiceCount(optionName: string): number {
  return (getStartingWeaponRule(optionName) ?? getEquipmentChoiceFamily(optionName))?.count ?? 1;
}
