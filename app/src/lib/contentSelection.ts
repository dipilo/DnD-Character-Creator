import type { Background, Class, Species } from '@/types/dnd';
import { resolveSourceId } from '@/data/librarySources';
import { getRulesEdition, type RulesEdition } from '@/lib/builderRules';

interface NamedContentEntry {
  id: string;
  name: string;
  source: string;
  sourceId?: string;
}

const normalizeName = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();
const getSafeArrayLength = (value: unknown) => Array.isArray(value) ? value.length : 0;
const getSafeStringLength = (value: unknown) => typeof value === 'string' ? value.length : 0;

const getPreferredSourceWeight = (sourceId?: string) => {
  if (!sourceId) {
    return 0;
  }
  if (sourceId.startsWith('phb-')) {
    return 400;
  }
  if (sourceId.startsWith('basic-rules-')) {
    return 300;
  }
  return 100;
};

const getResolvedSourceId = (entry: NamedContentEntry) => resolveSourceId(entry.sourceId, entry.source);

export const getCanonicalContentKey = (entry: NamedContentEntry) => {
  const resolvedSourceId = getResolvedSourceId(entry);
  const edition = getRulesEdition(resolvedSourceId, entry.source);
  const normalizedName = normalizeName(entry.name);

  if (edition !== 'unknown') {
    return `${edition}::${normalizedName}`;
  }

  return `${resolvedSourceId ?? normalizeName(entry.source)}::${normalizedName}`;
};

export const dedupeCanonicalContent = <T extends NamedContentEntry>(entries: T[], getScore: (entry: T) => number) => {
  const preferredByKey = new Map<string, T>();

  entries.forEach((entry) => {
    const key = getCanonicalContentKey(entry);
    const current = preferredByKey.get(key);
    const entryWeight = getScore(entry) + getPreferredSourceWeight(getResolvedSourceId(entry));
    const currentWeight = current ? getScore(current) + getPreferredSourceWeight(getResolvedSourceId(current)) : Number.NEGATIVE_INFINITY;

    if (!current || entryWeight > currentWeight || (entryWeight === currentWeight && entry.id.localeCompare(current.id) < 0)) {
      preferredByKey.set(key, entry);
    }
  });

  return entries.filter((entry) => preferredByKey.get(getCanonicalContentKey(entry))?.id === entry.id);
};

// Collapse entries that share a name but come from different editions (e.g. the 2014 and
// 2024 printings of Fireball), keeping the printing that matches the preferred edition.
// Entries whose names are unique always survive, so single-edition content is unaffected.
export const dedupeByNamePreferringEdition = <T extends NamedContentEntry>(
  entries: T[],
  preferredEdition: RulesEdition
) => {
  const getEditionRank = (entry: T) => {
    const entryEdition = getRulesEdition(getResolvedSourceId(entry), entry.source);
    if (preferredEdition !== 'unknown' && entryEdition === preferredEdition) {
      return 3;
    }
    if (entryEdition === '2024') {
      return 2;
    }
    if (entryEdition === 'unknown') {
      return 1;
    }
    return 0;
  };

  const preferredByName = new Map<string, T>();
  entries.forEach((entry) => {
    const key = normalizeName(entry.name);
    const current = preferredByName.get(key);
    if (!current || getEditionRank(entry) > getEditionRank(current)) {
      preferredByName.set(key, entry);
    }
  });

  return entries.filter((entry) => preferredByName.get(normalizeName(entry.name)) === entry);
};

export const getClassSelectionScore = (entry: Class) => {
  return (getSafeArrayLength(entry.subclasses) * 500)
    + (getSafeArrayLength(entry.features) * 25)
    + Math.min(getSafeStringLength(entry.description), 600);
};

export const getSpeciesSelectionScore = (entry: Species) => {
  return ((getSafeArrayLength(entry.variants)) * 250)
    + (getSafeArrayLength(entry.features) * 50)
    + (getSafeArrayLength(entry.languages) * 10);
};

export const getBackgroundSelectionScore = (entry: Background) => {
  return (getSafeArrayLength(entry.skillProficiencies) * 100)
    + (getSafeArrayLength(entry.toolProficiencies) * 40)
    + getSafeArrayLength(entry.personalityTraits);
};