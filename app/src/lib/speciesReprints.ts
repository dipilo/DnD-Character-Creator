// Which of two printings' traits a merge may take, read from the reprint note the books carry.
import type { Feature, Species, SpeciesVariant } from '@/types/dnd';

/**
 * True when `fallback` is the printing that superseded `primary`. A reprint renames the traits it
 * carries over — Volo's "Expert Forgery" is Monsters of the Multiverse' "Expert Duplication",
 * "Kenku Training" is "Kenku Recall" — so a merge keyed on trait name granted the Kenku all four.
 */
export function isSupersededBy(primary: Species, fallback?: Species): boolean {
  return Boolean(primary.reprintedAs?.length)
    && fallback !== undefined
    && fallback.sourceId !== primary.sourceId;
}

/** The traits a merge may take from `fallback`: none at all where it is the reprint. */
export function fallbackTraits(
  primary: Species,
  fallback?: Species
): { features: Feature[]; variants?: SpeciesVariant[] } {
  if (isSupersededBy(primary, fallback)) {
    return { features: [], variants: undefined };
  }

  return { features: fallback?.features ?? [], variants: fallback?.variants };
}
