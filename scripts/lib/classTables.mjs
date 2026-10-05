// What a class table's extra columns mean, shared by the two importers so they cannot disagree.
//
// The HTML document imports walk `<table>` blocks and the 5etools adapter reads `classTableGroups`;
// both arrive at the same shape — a column of plain-text cells under a plain-text header, one cell
// per class level from 1 up — and the judgment about what such a column *is* belongs here rather
// than in either caller. Nothing about a specific class is written down: a column earns a tracker
// because its own cells are counts and the feature it cross-references states a rest that returns
// them, and it earns a die column because its cells are dice notation.

import { parseResourceReset } from './classResources.mjs';

const normalizeLabel = (value) => String(value ?? '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '');
const slugify = (value) => String(value ?? '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '');
const escapeRegExp = (value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const dashOnlyPattern = /^[—–-]+$/;

// Everything in the table other than a pool is deliberately refused. A "Known" column is a
// build-time count, not a pool a player spends; a proficiency bonus is "+2"; and Unarmored Movement
// is a distance. Sneak Attack and Martial Arts are dice, which `featureDiceFromColumns` reads.
export const NON_TRACKED_HEADERS = new Set([
  'level', 'proficiencybonus', 'features', 'feature', 'spellslots', 'slotlevel',
  'cantripsknown', 'cantrips', 'spellsknown', 'preparedspells', 'spellsprepared',
]);

export const isTrackedColumnHeader = (header) => {
  const normalized = normalizeLabel(header);
  if (!normalized || NON_TRACKED_HEADERS.has(normalized)) return false;
  // "Invocations Known", "Infusions Known", "Maneuvers Known": how many you picked, not how many
  // you have left.
  if (normalized.endsWith('known')) return false;
  return /^\d+(?:st|nd|rd|th)?$/.test(normalized) === false;
};

/**
 * One cell of a resource column: the number, `null` for the 2014 Barbarian's level-20 "Unlimited"
 * Rages, and `undefined` for anything else — which is what disqualifies the whole column, because a
 * cell holding "1d6" or "+10 ft." means it was never a pool.
 */
export const readResourceCell = (value) => {
  const text = String(value ?? '').trim();
  if (!text || dashOnlyPattern.test(text)) return 0;
  if (/^unlimited$/i.test(text)) return null;
  return /^\d+$/.test(text) ? Number(text) : undefined;
};

/**
 * One cell of a dice column: the notation, `null` where the table prints a dash, and `undefined`
 * for anything else — which disqualifies the column, because a cell holding a bare number means it
 * was a pool and one holding "+10 ft." means it was a distance.
 */
export const readFeatureDiceCell = (value) => {
  const text = String(value ?? '').trim();
  if (!text || dashOnlyPattern.test(text)) return null;
  const match = /^(\d*)[dD](\d+)$/.exec(text);
  return match ? `${match[1] || '1'}d${match[2]}` : undefined;
};

/**
 * Which feature a column belongs to, from the book's own cross-reference: every one of these says
 * "as shown in the <Column> column of the <Class> table". Matching on the feature *name* instead
 * misses the ones the book named differently — the 2014 Sorcery Points column belongs to Font of
 * Magic — so the name is only the fallback.
 */
const resourceFeatureKey = (header) => normalizeLabel(header).replace(/points$/, '').replace(/s$/, '');

export const findResourceFeature = (header, features) => {
  const label = String(header ?? '').trim();
  if (!label) return null;

  const columnReference = new RegExp(String.raw`\b${escapeRegExp(label)}\s+column\b`, 'i');
  const byReference = features.find((feature) => columnReference.test(feature.description ?? ''));
  if (byReference) return byReference;

  const key = resourceFeatureKey(header);
  if (!key) return null;
  return features.find((feature) => {
    const name = normalizeLabel(feature.name ?? '').replace(/s$/, '');
    return name === key || name.includes(key) || key.includes(name);
  }) ?? null;
};

/**
 * The pools a class table states: Rages, Ki Points, Sorcery Points, Channel Divinity, Second Wind,
 * Wild Shape. A column whose feature states no rest that returns the uses is not a pool.
 */
export const resourcesFromColumns = (columns, features) => {
  const resources = [];

  for (const { header, cells } of columns) {
    if (!isTrackedColumnHeader(header)) continue;

    const perLevel = cells.map((cell) => readResourceCell(cell));
    if (perLevel.some((value) => value === undefined)) continue;
    if (!perLevel.some((value) => value === null || value > 0)) continue;

    const name = String(header ?? '').trim();
    if (!name || resources.some((one) => one.name === name)) continue;

    const feature = findResourceFeature(header, features);
    const { resetsOn, shortRestRegain } = parseResourceReset(feature?.description ?? '');
    if (!resetsOn) continue;

    resources.push({
      id: slugify(name),
      name,
      perLevel,
      resetsOn,
      shortRestRegain: shortRestRegain ?? undefined,
      featureName: feature?.name,
    });
  }

  return resources.length > 0 ? resources : undefined;
};

/**
 * The dice a class table states: the Monk's Martial Arts die, the Rogue's Sneak Attack, the 2024
 * Bard's Bardic die. The feature's own sentences state only what it rolls at 1st level and then
 * point at the column, so without this a level-20 Monk still reads 1d4. A column no feature claims
 * is dropped rather than guessed at.
 */
export const featureDiceFromColumns = (columns, features) => {
  const dice = [];

  for (const { header, cells } of columns) {
    if (!isTrackedColumnHeader(header)) continue;

    const perLevel = cells.map((cell) => readFeatureDiceCell(cell));
    if (perLevel.some((value) => value === undefined)) continue;
    if (!perLevel.some((value) => value !== null)) continue;

    const name = String(header ?? '').trim();
    if (!name || dice.some((one) => one.name === name)) continue;

    const feature = findResourceFeature(header, features);
    if (!feature?.name) continue;

    dice.push({ id: slugify(name), name, perLevel, featureName: feature.name });
  }

  return dice.length > 0 ? dice : undefined;
};
