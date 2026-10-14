// What a class table's extra columns mean, shared by both importers so they agree.

import { parseResourceReset } from './classResources.mjs';

const normalizeLabel = (value) => String(value ?? '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '');
const slugify = (value) => String(value ?? '').toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '');
const escapeRegExp = (value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const dashOnlyPattern = /^[—–-]+$/;

// A "Known" column is a build-time count, a bonus is "+2", movement is a distance.
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

/** `null` is "Unlimited"; `undefined` disqualifies the column. */
export const readResourceCell = (value) => {
  const text = String(value ?? '').trim();
  if (!text || dashOnlyPattern.test(text)) return 0;
  if (/^unlimited$/i.test(text)) return null;
  return /^\d+$/.test(text) ? Number(text) : undefined;
};

/** `null` is a printed dash; `undefined` disqualifies the column. */
export const readFeatureDiceCell = (value) => {
  const text = String(value ?? '').trim();
  if (!text || dashOnlyPattern.test(text)) return null;
  const match = /^(\d*)[dD](\d+)$/.exec(text);
  return match ? `${match[1] || '1'}d${match[2]}` : undefined;
};

/** From the book's "as shown in the <Column> column"; the name is only the fallback. */
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

/** A column whose feature states no rest that returns the uses is not a pool. */
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

/** Without this a level-20 Monk reads 1d4; an unclaimed column is dropped. */
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
