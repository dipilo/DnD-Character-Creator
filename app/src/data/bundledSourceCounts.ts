import { baseBackgrounds } from './backgrounds';
import { baseClasses } from './classes';
import { baseSpecies } from './species';
import { resolveSourceId } from './librarySources';
import { getSourceEntryCount } from './sourceFiles/registry';

interface SourcedEntry {
  source: string;
  sourceId?: string;
}

// Built-in species, classes, and backgrounds carry book labels ("Player's Handbook",
// "Volo's Guide to Monsters", ...) rather than explicit source ids, so resolve each
// label once and count entries per manifest source.
const staticEntries: SourcedEntry[] = [...baseSpecies, ...baseClasses, ...baseBackgrounds];

const staticEntryCountsBySourceId = staticEntries.reduce<Map<string, number>>((counts, entry) => {
  const resolvedSourceId = resolveSourceId(entry.sourceId, entry.source);
  if (resolvedSourceId) {
    counts.set(resolvedSourceId, (counts.get(resolvedSourceId) ?? 0) + 1);
  }
  return counts;
}, new Map());

export const getStaticSourceEntryCount = (sourceId: string) => {
  return staticEntryCountsBySourceId.get(sourceId) ?? 0;
};

// Everything compiled into the build for a source: generated/imported source modules
// plus the built-in app content attributed to that source.
export const getBundledSourceEntryCount = (sourceId: string) => {
  return getSourceEntryCount(sourceId) + getStaticSourceEntryCount(sourceId);
};
