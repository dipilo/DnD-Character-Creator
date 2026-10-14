// Reconciles the localStorage cache against the server, never discarding an edit.
import { create } from 'zustand';
import {
  ApiError,
  createCharacter,
  deleteCharacter as deleteRemoteCharacter,
  getCharacter as getRemoteCharacter,
  importCharacters,
  isConflict,
  isOffline,
  isUnauthorized,
  listCharacters,
  setCharacterSeat,
  updateCharacter as updateRemoteCharacter,
} from '@/lib/api';
import {
  DOCUMENT_STORES,
  getStoreForDocument,
  getStoreHolding,
  type DocumentStoreAdapter,
  type StoredDocument,
} from '@/store/documentStores';
import { toast } from 'sonner';

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error';

interface CharacterSyncState {
  status: SyncStatus;
  /** False while signed out: nothing is pushed, and the cache is simply the app's storage. */
  enabled: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  /** The one-time upload offer: signing in publishes nothing on its own. */
  unsyncedIds: string[];
  /** Local edits kept aside as separate characters because the server's copy had moved on. */
  conflictIds: string[];
  uploading: boolean;
}

export const useCharacterSyncStore = create<CharacterSyncState>()(() => ({
  status: 'idle',
  enabled: false,
  lastSyncedAt: null,
  error: null,
  unsyncedIds: [],
  conflictIds: [],
  uploading: false,
}));

const setSyncState = (patch: Partial<CharacterSyncState>) => useCharacterSyncStore.setState(patch);

/** Every locally-held document, paired with the cache that holds it. */
function localEntries(): Array<{ store: DocumentStoreAdapter; document: StoredDocument }> {
  return DOCUMENT_STORES.flatMap((store) => store.characters().map((document) => ({ store, document })));
}

/** Enabling snapshots what the server has never seen, so sign-out leaves the cache alone. */
export function setSyncEnabled(enabled: boolean): void {
  if (!enabled) {
    setSyncState({ enabled: false, status: 'idle', unsyncedIds: [], error: null });
    return;
  }
  setSyncState({
    enabled: true,
    unsyncedIds: localEntries()
      .filter(({ store, document }) => store.syncMeta()[document.id]?.version == null)
      .map(({ document }) => document.id),
  });
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : 'unknown_error';
}

/** Store actions replace the object, so reference equality catches an edit in flight. */
function unchangedSince(store: DocumentStoreAdapter, id: string, snapshot: StoredDocument | undefined): boolean {
  return store.find(id) === snapshot;
}

async function pullCharacter(id: string): Promise<void> {
  const holder = getStoreHolding(id);
  const before = holder?.find(id);
  const record = await getRemoteCharacter(id);
  if (!record?.data) {
    throw new Error(`Character ${id} came back from the server without a readable document.`);
  }
  // Edited here while the fetch was in the air: keep the local edit. It is dirty, so the next pass
  // pushes it, and the server answers 409 — which keeps both copies rather than dropping one.
  if (holder && !unchangedSince(holder, id, before)) return;

  const store = getStoreForDocument(record.data);
  // A document whose system changed underneath us would otherwise sit in two caches at once.
  if (holder && holder !== store) holder.forget(id);
  store.applyRemote(store.withId(record.data, record.id), record.version);
}

/** The local edit is kept as a separate character; the user picks, not sync. */
async function resolveConflict(store: DocumentStoreAdapter, id: string): Promise<void> {
  const local = store.find(id);
  const knownVersion = store.syncMeta()[id]?.version ?? null;
  let record;
  try {
    record = await getRemoteCharacter(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      // A 404 deletes only what the server once gave us a version for.
      if (knownVersion != null) {
        store.forget(id);
        return;
      }
      throw new Error(`character id ${id} is already taken by another account`);
    }
    throw e;
  }
  if (!record.data) return;

  const serverStore = getStoreForDocument(record.data);
  const server = serverStore.withId(record.data, record.id);
  const differs = Boolean(local) && JSON.stringify(local) !== JSON.stringify(server);
  if (serverStore !== store) store.forget(id);
  serverStore.applyRemote(server, record.version);

  if (differs && local) {
    const copy = store.conflictCopy(local);
    store.add(copy);
    setSyncState({ conflictIds: [...useCharacterSyncStore.getState().conflictIds, copy.id] });
    // Keeping the edit but saying nothing would look like the edit was lost.
    toast.message(`${serverStore.nameOf(server)} was edited on another device`, {
      description: 'That version was kept. Your changes are saved beside it as a conflict copy.',
    });
  }
}

/** Runs once the server has a copy; a refusal is final, but offline is "not now". */
async function applyPendingSeat(store: DocumentStoreAdapter, id: string): Promise<void> {
  const pending = store.pendingSeats()[id];
  if (!pending) return;
  try {
    await setCharacterSeat(id, { campaign_id: pending.campaignId, player_id: pending.playerId });
    store.setPendingSeat(id, null);
  } catch (e) {
    if (isOffline(e)) return;
    if (isUnauthorized(e)) throw e;
    console.warn('could not seat character', id, describe(e));
    store.setPendingSeat(id, null);
  }
}

/** Send one local character to the server. Returns false when the request never landed. */
export async function pushCharacter(store: DocumentStoreAdapter, id: string): Promise<boolean> {
  const character = store.find(id);
  if (!character) return true;
  const meta = store.syncMeta()[id];

  try {
    // `summary` is the denormalised display line the party view lists by; it has to ride along on
    // every write or a campaign-mate sees a stale level after a level-up.
    const payload = { name: store.nameOf(character), summary: await store.describe(character), data: character };
    if (meta?.version == null) {
      const created = await createCharacter({ id, ...payload });
      store.markSynced(id, created.version, !unchangedSince(store, id, character));
    } else {
      const updated = await updateRemoteCharacter(id, meta.version, payload);
      store.markSynced(id, updated.version, !unchangedSince(store, id, character));
    }
    await applyPendingSeat(store, id);
    return true;
  } catch (e) {
    if (isOffline(e)) return false;
    // An update that 404s is a character we had a version for and the server no longer has:
    // deleted from another device between the list and this write.
    if (e instanceof ApiError && e.status === 404 && meta?.version != null) {
      store.forget(id);
      return true;
    }
    // A create refused by a tombstone is the opposite situation — the id is spoken for but this
    // copy was never ours to delete. Report it; do not destroy the only copy on the strength of it.
    if (e instanceof ApiError && e.code === 'character_deleted') {
      throw new Error(`character id ${id} was deleted on the server and cannot be re-created`);
    }
    if (isConflict(e)) {
      await resolveConflict(store, id);
      return true;
    }
    throw e;
  }
}

/** Tell the server about characters deleted here. A 404 means it already agrees. */
async function flushPendingDeletes(): Promise<boolean> {
  for (const store of DOCUMENT_STORES) {
    // Safe to iterate without copying: clearPendingDelete replaces the array rather than splicing.
    const pending = store.pendingDeletes();
    for (const id of pending) {
      try {
        await deleteRemoteCharacter(id);
        store.clearPendingDelete(id);
      } catch (e) {
        if (isOffline(e)) return false;
        if (e instanceof ApiError && e.status === 404) {
          store.clearPendingDelete(id);
          continue;
        }
        throw e;
      }
    }
  }
  return true;
}

/** One character's failure must not abandon the pass; going offline still stops it. */
async function attempt(id: string, action: () => Promise<unknown>, failures: string[]): Promise<void> {
  try {
    await action();
  } catch (e) {
    if (isOffline(e) || isUnauthorized(e)) throw e;
    console.warn('character sync failed for', id, describe(e));
    failures.push(id);
  }
}

/** Returns the ids that could not be transferred; an empty array means the pass was clean. */
async function reconcile(): Promise<string[]> {
  const remote = await listCharacters();
  const remoteById = new Map(remote.map((record) => [record.id, record]));
  const awaitingOffer = new Set(useCharacterSyncStore.getState().unsyncedIds);
  const unsyncedIds: string[] = [];
  const failures: string[] = [];

  // Safe to iterate without copying: every store action here replaces the array rather than
  // mutating the one being walked.
  for (const { store, document } of localEntries()) {
    const meta = store.syncMeta()[document.id];
    const record = remoteById.get(document.id);
    if (!record) {
      await attempt(
        document.id,
        () => reconcileMissingRemote(store, document.id, meta?.version ?? null, awaitingOffer, unsyncedIds),
        failures,
      );
      continue;
    }
    if (meta?.dirty) await attempt(document.id, () => pushCharacter(store, document.id), failures);
    else if (meta?.version !== record.version) await attempt(document.id, () => pullCharacter(document.id), failures);
    // `pushCharacter` clears the seat, so this finds nothing when a branch above ran.
    if (store.pendingSeats()[document.id]) await attempt(document.id, () => applyPendingSeat(store, document.id), failures);
  }

  const localIds = new Set(localEntries().map(({ document }) => document.id));
  for (const record of remote) {
    if (!localIds.has(record.id)) await attempt(record.id, () => pullCharacter(record.id), failures);
  }

  setSyncState({ unsyncedIds });
  return failures;
}

/** Only a deletion is destructive, and only it has a version on record. */
async function reconcileMissingRemote(
  store: DocumentStoreAdapter,
  id: string,
  knownVersion: number | null,
  awaitingOffer: Set<string>,
  unsyncedIds: string[],
): Promise<void> {
  if (knownVersion != null) {
    store.forget(id);
    return;
  }
  if (awaitingOffer.has(id)) {
    unsyncedIds.push(id);
    return;
  }
  await pushCharacter(store, id);
}

/** Undelivered deletes mean the connection went; a failed character means the server said no. */
function statusAfter(deletesDelivered: boolean, anyFailed: boolean): SyncStatus {
  if (!deletesDelivered) return 'offline';
  return anyFailed ? 'error' : 'idle';
}

let inFlight: Promise<void> | null = null;

/** Concurrent calls share the one in-flight pass. */
export function syncCharacters(): Promise<void> {
  inFlight ??= runSync().finally(() => { inFlight = null; });
  return inFlight;
}

async function runSync(): Promise<void> {
  setSyncState({ status: 'syncing', error: null });
  try {
    const delivered = await flushPendingDeletes();
    const failures = await reconcile();
    const noun = failures.length === 1 ? 'character' : 'characters';
    setSyncState({
      status: statusAfter(delivered, failures.length > 0),
      lastSyncedAt: new Date().toISOString(),
      error: failures.length > 0 ? `could not sync ${failures.length} ${noun}` : null,
    });
  } catch (e) {
    if (isUnauthorized(e)) {
      // The session ended underneath us. The cache keeps working; it just stops syncing.
      setSyncEnabled(false);
      return;
    }
    if (isOffline(e)) {
      setSyncState({ status: 'offline', error: null });
      return;
    }
    console.error('character sync failed', e);
    setSyncState({ status: 'error', error: describe(e) });
  }
}

/** Inserts at version 1 and skips ids the server holds; the follow-up sync settles the rest. */
export async function uploadLocalCharacters(): Promise<{ imported: number; skipped: number }> {
  const offered = new Set(useCharacterSyncStore.getState().unsyncedIds);
  const entries = localEntries().filter(({ document }) => offered.has(document.id));
  if (entries.length === 0) return { imported: 0, skipped: 0 };
  const byId = new Map(entries.map(({ store, document }) => [document.id, { store, document }]));

  setSyncState({ uploading: true });
  try {
    const result = await importCharacters(
      await Promise.all(entries.map(async ({ store, document }) => ({
        id: document.id,
        name: store.nameOf(document),
        summary: await store.describe(document),
        data: document,
      }))),
    );
    for (const id of result.imported) {
      const entry = byId.get(id);
      entry?.store.markSynced(id, 1, !unchangedSince(entry.store, id, entry.document));
      offered.delete(id);
    }
    // The banner goes the moment the upload lands; a later batch is offered again.
    setSyncState({ unsyncedIds: [...offered] });
    await syncCharacters();
    return { imported: result.imported.length, skipped: result.skipped.length };
  } finally {
    setSyncState({ uploading: false });
  }
}

// Coalesced: the watcher is the only thing reacting to local mutations.
const PUSH_DEBOUNCE_MS = 1200;
let pushTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePush(): void {
  if (pushTimer !== null) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    if (!useCharacterSyncStore.getState().enabled) return;
    void syncCharacters();
  }, PUSH_DEBOUNCE_MS);
}

function hasOutstandingWork(): boolean {
  return DOCUMENT_STORES.some((store) => {
    if (store.pendingDeletes().length > 0) return true;
    const meta = store.syncMeta();
    return store.characters().some((document) => meta[document.id]?.dirty);
  });
}

/** Watch every cache for local changes and push them. Returns the unsubscribe. */
export function startCharacterSyncWatcher(): () => void {
  const retryFailedSync = () => {
    const { enabled, status } = useCharacterSyncStore.getState();
    if (enabled && (status === 'offline' || status === 'error')) void syncCharacters();
  };
  window.addEventListener('online', retryFailedSync);
  window.addEventListener('focus', retryFailedSync);
  const unsubscribes = DOCUMENT_STORES.map((store) => store.subscribe(() => {
    if (!useCharacterSyncStore.getState().enabled) return;
    if (hasOutstandingWork()) schedulePush();
  }));

  return () => {
    window.removeEventListener('online', retryFailedSync);
    window.removeEventListener('focus', retryFailedSync);
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}
