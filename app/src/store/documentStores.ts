/**
 * One adapter per system's document cache, so the sync pass can reconcile both without knowing
 * either one's shape.
 *
 * `/api/characters` is a single collection per account — it does not partition by game — so a
 * sync pass necessarily sees Kids on Bikes documents next to D&D ones and has to route each record
 * to the store that owns it. `systemId` on the document is that routing key, which is exactly why
 * `KobCharacter` carries one.
 *
 * Direction still holds: this module imports the stores and no store imports it.
 */
import { DEFAULT_GAME_SYSTEM_ID, type GameSystemId } from '@/data/gameSystems';
import { describeKobCharacter, fullName } from '@/data/gameSystems/kidsOnBikes/rules';
import { useCharacterStore } from '@/store/characterStore';
import { useKobCharacterStore } from '@/store/kobCharacterStore';
import type { CharacterSyncMeta, PendingSeat } from '@/store/syncTypes';
import type { Character } from '@/types/dnd';
import type { KobCharacter } from '@/types/kob';

/** Any document `/api/characters` can be asked to hold. */
export type StoredDocument = Character | KobCharacter;

export interface DocumentStoreAdapter<T extends StoredDocument = StoredDocument> {
  systemId: GameSystemId;
  characters: () => T[];
  syncMeta: () => Record<string, CharacterSyncMeta>;
  pendingDeletes: () => string[];
  pendingSeats: () => Record<string, PendingSeat>;
  find: (id: string) => T | undefined;
  add: (document: T) => void;
  applyRemote: (document: T, version: number) => void;
  forget: (id: string) => void;
  markSynced: (id: string, version: number, stillDirty?: boolean) => void;
  clearPendingDelete: (id: string) => void;
  setPendingSeat: (id: string, seat: PendingSeat | null) => void;
  /** The row's `name` column, which is what a list falls back to when there is no summary. */
  nameOf: (document: T) => string;
  /**
   * The denormalised display line the party view lists by.
   *
   * Async because resolving a D&D character's species and class names needs the whole content
   * library, and a static import of it here put all 23 source packs — 5.75 MB — into the boot
   * graph: `main.tsx` starts the sync watcher, which imports this module. Every page paid for it,
   * including the ones with no D&D content on them at all. Both call sites already await.
   */
  describe: (document: T) => Promise<string>;
  /** The document as the server should store it: the row's id wins over whatever the copy carried. */
  withId: (document: T, id: string) => T;
  /** A copy kept aside when both sides changed. Never overwrites, never discards. */
  conflictCopy: (document: T) => T;
  /** True when a record's document belongs to this store. */
  owns: (document: StoredDocument) => boolean;
  /** Notify on any local change, so the sync watcher can coalesce a push. */
  subscribe: (listener: () => void) => () => void;
}

const dndStore = () => useCharacterStore.getState();

const dndAdapter: DocumentStoreAdapter<Character> = {
  systemId: 'dnd-5e',
  characters: () => dndStore().characters,
  syncMeta: () => dndStore().syncMeta,
  pendingDeletes: () => dndStore().pendingDeletes,
  pendingSeats: () => dndStore().pendingSeats,
  find: (id) => dndStore().characters.find((entry) => entry.id === id),
  add: (document) => dndStore().addCharacter(document),
  applyRemote: (document, version) => dndStore().applyRemoteCharacter(document, version),
  forget: (id) => dndStore().forgetCharacter(id),
  markSynced: (id, version, stillDirty) => dndStore().markCharacterSynced(id, version, stillDirty),
  clearPendingDelete: (id) => dndStore().clearPendingDelete(id),
  setPendingSeat: (id, seat) => dndStore().setPendingSeat(id, seat),
  nameOf: (document) => document.name,
  describe: async (document) => {
    const { describeCharacter } = await import('@/lib/characterSummary');
    return describeCharacter(document);
  },
  withId: (document, id) => (document.id === id ? document : { ...document, id }),
  conflictCopy: (document) => ({
    ...document,
    id: crypto.randomUUID(),
    name: `${document.name} (conflict copy)`,
    updatedAt: new Date().toISOString(),
  }),
  // Anything without a systemId is a D&D document written before the discriminator existed.
  owns: (document) => (document as KobCharacter).systemId !== 'kids-on-bikes',
  subscribe: (listener) => useCharacterStore.subscribe((state, previous) => {
    if (state.characters === previous.characters
      && state.syncMeta === previous.syncMeta
      && state.pendingDeletes === previous.pendingDeletes) return;
    listener();
  }),
};

const kobStore = () => useKobCharacterStore.getState();

const kobAdapter: DocumentStoreAdapter<KobCharacter> = {
  systemId: 'kids-on-bikes',
  characters: () => kobStore().characters,
  syncMeta: () => kobStore().syncMeta,
  pendingDeletes: () => kobStore().pendingDeletes,
  pendingSeats: () => kobStore().pendingSeats,
  find: (id) => kobStore().characters.find((entry) => entry.id === id),
  add: (document) => kobStore().addCharacter(document),
  applyRemote: (document, version) => kobStore().applyRemoteCharacter(document, version),
  forget: (id) => kobStore().forgetCharacter(id),
  markSynced: (id, version, stillDirty) => kobStore().markCharacterSynced(id, version, stillDirty),
  clearPendingDelete: (id) => kobStore().clearPendingDelete(id),
  setPendingSeat: (id, seat) => kobStore().setPendingSeat(id, seat),
  nameOf: (document) => fullName(document) || 'Unnamed',
  describe: (document) => Promise.resolve(describeKobCharacter(document)),
  withId: (document, id) => (document.id === id ? document : { ...document, id }),
  conflictCopy: (document) => ({
    ...document,
    id: crypto.randomUUID(),
    firstName: `${document.firstName || 'Unnamed'} (conflict copy)`,
    updatedAt: new Date().toISOString(),
  }),
  owns: (document) => (document as KobCharacter).systemId === 'kids-on-bikes',
  subscribe: (listener) => useKobCharacterStore.subscribe((state, previous) => {
    if (state.characters === previous.characters
      && state.syncMeta === previous.syncMeta
      && state.pendingDeletes === previous.pendingDeletes) return;
    listener();
  }),
};

/** Every cache the sync pass reconciles. Adding a system is adding its adapter here. */
export const DOCUMENT_STORES: DocumentStoreAdapter[] = [
  dndAdapter as DocumentStoreAdapter,
  kobAdapter as DocumentStoreAdapter,
];

export function getDocumentStore(systemId: GameSystemId): DocumentStoreAdapter {
  return DOCUMENT_STORES.find((adapter) => adapter.systemId === systemId)
    ?? DOCUMENT_STORES.find((adapter) => adapter.systemId === DEFAULT_GAME_SYSTEM_ID)
    ?? DOCUMENT_STORES[0];
}

/** Which cache a fetched document belongs in. */
export function getStoreForDocument(document: StoredDocument): DocumentStoreAdapter {
  return DOCUMENT_STORES.find((adapter) => adapter.owns(document)) ?? getDocumentStore(DEFAULT_GAME_SYSTEM_ID);
}

/** Which cache already holds this id locally, if any. */
export function getStoreHolding(id: string): DocumentStoreAdapter | undefined {
  return DOCUMENT_STORES.find((adapter) => adapter.find(id));
}
