// Resolving a stored species id against the merged library. Pure, and separate from
// `runtimeContent.ts` because that module reaches the content packs through `import.meta.glob`
// and so cannot be loaded outside Vite.
import { getRulesEdition } from '@/lib/builderRules';
import type { Species } from '@/types/dnd';

/** Lower case, punctuation flattened to single spaces — the key every canonical match uses. */
export const normalizeContentKey = (value: string) =>
  value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();

/** A species is matched on its printed name, never on the id a pack happened to mint. */
export const getCanonicalSpeciesKey = (species: Species) =>
  normalizeContentKey(species.name || species.id);

/** A bare id states no book, so an id naming 2024 is the only one that asks for that printing. */
const getEditionFromContentId = (id: string) => (/-2024(?:-|$)|^phb-2024/.test(id) ? '2024' : '2014');

/**
 * A stored species id is a pointer that can go stale exactly as a class id can — the app's own
 * hand-written Kenku was retired in favour of the Volo's pack, and a character holding `kenku`
 * resolved to nothing and read as "Unknown Species". The edition read off the id is a preference,
 * not a requirement: a bare `kenku` names no printing, so any printing beats nothing.
 */
export function resolveSpeciesById(species: readonly Species[], id: string): Species | undefined {
  const exactMatch = species.find((entry) => entry.id === id);
  if (exactMatch) {
    return exactMatch;
  }

  // A pack mints `basic-rules-2024-elf` and `volos-kenku`, so the name is the id's *tail*. Every
  // candidate whose name ends the id is a match and the longest one wins, or `half-elf` would
  // resolve to the Elf — the prefix a pack happens to use is not worth a list in the app.
  const canonicalKey = normalizeContentKey(id);
  let matching: Species[] = [];
  let matchedLength = 0;
  for (const entry of species) {
    const key = getCanonicalSpeciesKey(entry);
    if (!key) continue;
    if (canonicalKey !== key && !canonicalKey.endsWith(` ${key}`)) continue;
    if (key.length < matchedLength) continue;
    if (key.length > matchedLength) {
      matching = [];
      matchedLength = key.length;
    }
    matching.push(entry);
  }

  if (matching.length === 0) {
    return undefined;
  }

  const edition = getEditionFromContentId(id);
  return matching.find((entry) => getRulesEdition(entry.sourceId, entry.source) === edition) ?? matching[0];
}
