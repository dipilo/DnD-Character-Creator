/**
 * The D&D content lookups `characterStore` needs, injected rather than imported.
 *
 * `@/data` merges every source pack at module scope, so a static import of it from the store put
 * all 23 packs — 5.75 MB — into the boot graph: `main.tsx` starts the sync watcher, which reaches
 * `documentStores`, which reaches `characterStore`, which reached the library. `index.html`
 * modulepreloaded the lot, so a Kids on Bikes screen, the dice roller and the home page each
 * downloaded and parsed the entire D&D library before rendering anything.
 *
 * `@/data` registers itself on import, and every screen that can reach one of the builder actions
 * imports `@/data` already. Nothing here falls back to an empty library: an unregistered call is a
 * wiring bug and says so, rather than silently deriving a character's bonuses from no content
 * (CLAUDE.md — a builder page must not substitute a default for missing state).
 */
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
