// Which of two printings' traits a merge may take. Two entries for one species are two printings
// of it, not a sparse entry and a rich one, so filling a gap and adding a trait are different acts.
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

/** Whether the two entries are printings from different books, which is the usual case here. */
const isOtherPrinting = (primary: Species, fallback?: Species) =>
  fallback !== undefined && fallback.sourceId !== primary.sourceId;

/**
 * The traits a merge may take from `fallback`.
 *
 * A published species' trait list is complete by construction, so another *book's* printing of it
 * contributes nothing to that list — adding by name is what put Expert Forgery and Expert
 * Duplication on one Kenku, and it does the same to every species Monsters of the Multiverse
 * reprinted whether or not the older entry carries a reprint note. A primary holding no traits at
 * all is a real gap, though, so a pack that parsed none still gets filled.
 *
 * Variants stay on the narrower rule: folding a lineage in from another book is how the
 * dragonmarks and the Eladrin reach their base species, and only a reprint holds them back.
 */
export function fallbackTraits(
  primary: Species,
  fallback?: Species
): { features: Feature[]; variants?: SpeciesVariant[] } {
  const variants = isSupersededBy(primary, fallback) ? undefined : fallback?.variants;

  if (primary.features.length > 0 && isOtherPrinting(primary, fallback)) {
    return { features: [], variants };
  }

  return { features: fallback?.features ?? [], variants };
}
