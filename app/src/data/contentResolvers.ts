/** Injected, or the store drags 5.75 MB of packs into the boot graph; no empty fallback. */
// Type-only, so it is erased at build time and pulls nothing into the boot graph. Taking the
// signatures from the functions themselves keeps the two from drifting.
import type * as RuntimeContent from './runtimeContent';

export interface DndContentResolvers {
  getRuntimeBackgroundById: typeof RuntimeContent.getRuntimeBackgroundById;
  getRuntimeClassById: typeof RuntimeContent.getRuntimeClassById;
  getRuntimeFeatById: typeof RuntimeContent.getRuntimeFeatById;
  getRuntimeFeats: typeof RuntimeContent.getRuntimeFeats;
  getRuntimeSpeciesById: typeof RuntimeContent.getRuntimeSpeciesById;
  getRuntimeSpeciesVariant: typeof RuntimeContent.getRuntimeSpeciesVariant;
  getRuntimeSubclass: typeof RuntimeContent.getRuntimeSubclass;
}

let resolvers: DndContentResolvers | null = null;

/** Called by `@/data` as a module side effect. Importing the library is what wires it up. */
export function registerDndContentResolvers(next: DndContentResolvers): void {
  resolvers = next;
}

export function dndContent(): DndContentResolvers {
  if (!resolvers) {
    throw new Error(
      'D&D content resolvers are not registered. A screen that reaches a builder action must import "@/data".',
    );
  }
  return resolvers;
}
