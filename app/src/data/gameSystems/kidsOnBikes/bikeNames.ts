/**
 * Suggested names for a Kids on Bikes bike, shown as the field's placeholder.
 *
 * Flavour, not book content, so it stays out of the import pipeline — the same call
 * `campaignNames.ts` makes for the campaign-name suggestion. What *is* book content is the half
 * that makes the suggestion fit the bike: every colour and every upgrade the vault defines carries
 * its own adjective ("Rusty" is Tough, "Tassels" are a Getaway Ride), so the templates draw those
 * straight off the chosen options rather than restating them here.
 *
 * The generator is pure. A seed comes from the caller, which keeps `Math.random()` out of a render
 * body and means the suggestion holds still while the player types and only changes when the bike
 * — or the page — does.
 */

import type { KobBikeOption } from './types';

/** Generic bike nouns. Nothing here is from the book; it is the connective tissue. */
const RIDE_NOUNS = [
  'Arrow', 'Blur', 'Bolt', 'Bullet', 'Comet', 'Cruiser', 'Dart', 'Dash',
  'Ghost', 'Hornet', 'Lightning', 'Machine', 'Racer', 'Rocket', 'Runner', 'Rush',
  'Shadow', 'Spark', 'Streak', 'Thunder', 'Wind', 'Wing',
];

/** Names a kid actually gives a bike, for when nothing has been chosen yet. */
const NICKNAMES = [
  'Old Faithful', 'The Beast', 'The Getaway', 'Trusty', 'Bessie', 'The Workhorse',
  'Two Wheels', 'The Hand-Me-Down', 'Spokes', 'Handlebars',
];

/**
 * A tiny deterministic generator. `Math.random()` cannot be called while rendering, and a seeded
 * sequence gives the same practical result: a different name per visit, stable within one.
 */
function makePicker(seed: number) {
  let state = (seed >>> 0) || 1;
  return <T,>(bank: readonly T[]): T => {
    // xorshift32 — short, no dependency, and far better distributed than `seed % length`.
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return bank[state % bank.length];
  };
}

/** The head noun of a two-word phrase ("Getaway Ride" → "Ride", "Milk Crate" → "Crate"). */
function lastWord(value: string) {
  return value.trim().split(/\s+/).at(-1) ?? value;
}

/** Upgrades are named in the plural ("Tassels", "Pegs"); one of them is what goes in a name. */
function singularWord(value: string) {
  return value.length > 3 && value.endsWith('s') && !value.endsWith('ss') ? value.slice(0, -1) : value;
}

const upgradeNoun = (upgrade: KobBikeOption) => singularWord(lastWord(upgrade.name));

type Pick = <T>(bank: readonly T[]) => T;
type Template = (pick: Pick, color: KobBikeOption | null, upgrade: KobBikeOption | null) => string;

const COLOR_TEMPLATES: Template[] = [
  (pick, color) => `${color!.name} ${pick(RIDE_NOUNS)}`,
  (pick, color) => `The ${color!.name} ${pick(RIDE_NOUNS)}`,
  (pick, color) => `${color!.adjective} ${pick(RIDE_NOUNS)}`,
  (_pick, color) => `Old ${color!.name}`,
];

const UPGRADE_TEMPLATES: Template[] = [
  (_pick, _color, upgrade) => `The ${upgrade!.adjective}`,
  (pick, _color, upgrade) => `${upgradeNoun(upgrade!)} ${pick(RIDE_NOUNS)}`,
  (pick, _color, upgrade) => `The ${upgradeNoun(upgrade!)} ${pick(RIDE_NOUNS)}`,
];

const COMBINED_TEMPLATES: Template[] = [
  (_pick, color, upgrade) => `${color!.name} ${upgradeNoun(upgrade!)}`,
  (_pick, color, upgrade) => `The ${color!.adjective} ${lastWord(upgrade!.adjective)}`,
  (pick, color) => `${color!.name} ${pick(RIDE_NOUNS)}`,
  (_pick, color, upgrade) => `${color!.adjective} ${upgradeNoun(upgrade!)}`,
];

/**
 * One suggested bike name. Draws on whichever halves of the bike have been chosen; with neither,
 * it falls back to a nickname so the field still suggests something.
 */
export function suggestBikeName(
  color: KobBikeOption | null | undefined,
  upgrade: KobBikeOption | null | undefined,
  seed: number
): string {
  // Mix the choice into the seed so changing the bike changes the suggestion.
  const choiceSalt = [...(color?.id ?? ''), ...(upgrade?.id ?? '')]
    .reduce((hash, char) => (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0, 7);
  const pick = makePicker((seed ^ choiceSalt) >>> 0);

  let templates: Template[];
  if (color && upgrade) {
    templates = COMBINED_TEMPLATES;
  } else if (color) {
    templates = COLOR_TEMPLATES;
  } else if (upgrade) {
    templates = UPGRADE_TEMPLATES;
  } else {
    return pick(NICKNAMES);
  }

  return pick(templates)(pick, color ?? null, upgrade ?? null);
}
