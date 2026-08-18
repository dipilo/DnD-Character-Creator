// Character sync (MERGE_PLAN.md Phase 2).
//
// The builder still works signed out and offline, so localStorage keeps every character — it just
// stops being the record. This module reconciles that cache against the server: it pulls what
// another device wrote, pushes what this one changed, honours deletions in both directions, and
// never resolves a conflict by throwing an edit away.
//
// It imports the document stores and no store imports it. That direction is deliberate: a store
// stays a plain document cache, and sync watches it from outside rather than being called from
// inside every mutation.
//
// `/api/characters` is one collection per account rather than one per game, so a pass sees every
// system's documents together and routes each to its own cache — that is what `documentStores.ts`
// is for, and it is why a Kids on Bikes character can hold a campaign seat.
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
  /**
   * Characters that were already in localStorage when this session began and that the server has
   * never seen. They are the one-time upload offer, and the one thing sync will not push on its
   * own: signing in should not silently publish everything the browser happened to be holding.
   * Anything created after sign-in is not on this list and uploads automatically.
   */
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

/**
 * Turned on when a session is established and off when it ends; sign-out leaves the cache alone.
 * Enabling snapshots the characters the server has never seen, which is what separates "was here
 * before you signed in, so we ask" from "you made it while signed in, so it uploads".
 */
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

/**
 * True when the local document is still the exact object a request started with. Store actions
 * replace the object rather than mutating it, so reference equality answers "was this edited while
 * the request was in flight?" — the window in which sync could otherwise lose an edit.
 */
function unchangedSince(store: DocumentStoreAdapter, id: string, snapshot: StoredDocument | undefined): boolean {
  return store.find(id) === snapshot;
}

async function pullCharacter(id: string): Promise<void> {
  const holder = getStoreHolding(id);
  const before = holder?.find(id);
  const record = await getRemoteCharacter(id);
  if (!record?.data) {
    console.warn('character', id, 'came back from the server without a readable document');
    return;
  }
  // Edited here while the fetch was in the air: keep the local edit. It is dirty, so the next pass
  // pushes it, and the server answers 409 — which keeps both copies rather than dropping one.
  if (holder && !unchangedSince(holder, id, before)) return;

  const store = getStoreForDocument(record.data);
  // A document whose system changed underneath us would otherwise sit in two caches at once.
  if (holder && holder !== store) holder.forget(id);
  store.applyRemote(store.withId(record.data, record.id), record.version);
}

/**
 * Both copies changed. The server's copy keeps the id, and the local edit is kept as a separate
 * character rather than discarded — the user decides which one to keep, not the sync layer.
 */
async function resolveConflict(store: DocumentStoreAdapter, id: string): Promise<void> {
  const local = store.find(id);
  const knownVersion = store.syncMeta()[id]?.version ?? null;
  let record;
  try {
    record = await getRemoteCharacter(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      // The id is taken but unreadable. If the server once gave us a version for it, it was ours
      // and has since been deleted from another device, so drop the local copy. If it never did,
      // the id belongs to somebody else — keep the character and let the pass report a failure.
      // Deleting it here would destroy a sheet on the strength of a 404.
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

/**
 * Take the seat a character was started for (MERGE_PLAN.md Phase 5). "New character for this
 * campaign" records the intent before the character exists server-side, so this runs once the
 * server has a copy — and only then, because the seat is row metadata on a row that has to exist.
 *
 * A refusal is not retried: the campaign or the seat is gone, or the player was never entitled to
 * it. Keeping the intent would re-attempt it on every pass forever. Going offline and losing the
 * session are the two exceptions — both are "not now" rather than "no", so the intent survives them
 * and the next pass tries again.
 */
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

/**
 * Run one character's transfer. A failure on one character must not abandon the rest of the pass —
 * a single oversized document would otherwise stop every character after it in the list from ever
 * syncing. Going offline is not a per-character problem, so that one still stops the pass.
 */
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
    // A seat recorded while offline, or against a character that was already in step with the
    // server, has no push to ride along with. `pushCharacter` clears it, so this finds nothing when
    // one of the branches above already ran.
    if (store.pendingSeats()[document.id]) await attempt(document.id, () => applyPendingSeat(store, document.id), failures);
  }

  const localIds = new Set(localEntries().map(({ document }) => document.id));
  for (const record of remote) {
    if (!localIds.has(record.id)) await attempt(record.id, () => pullCharacter(record.id), failures);
  }

  setSyncState({ unsyncedIds });
  return failures;
}

/**
 * A local character with no counterpart on the server is one of three things: deleted from another
 * device, waiting for the upload offer, or new here and never sent. Only the first is destructive,
 * and it is the only one where the server has a version on record.
 */
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

/**
 * Full reconcile. Safe to call whenever the app thinks something may have changed — concurrent
 * calls share the one in-flight pass.
 */
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

/**
 * The one-time upload offered when someone signs in with characters already in localStorage.
 * Import inserts at version 1 and skips ids the server already holds, so the follow-up sync is
 * what settles anything it declined to overwrite.
 */
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
    // Drop them from the offer immediately rather than waiting for the pass below to say so; the
    // banner should go away the moment the upload lands. Nothing is dismissed on success — a later
    // batch of local characters deserves to be offered again.
    setSyncState({ unsyncedIds: [...offered] });
    await syncCharacters();
    return { imported: result.imported.length, skipped: result.skipped.length };
  } finally {
    setSyncState({ uploading: false });
  }
}

// Pushing on every keystroke-sized store write would be one request per character per edit, so
// changes are coalesced. The watcher is the only thing that reacts to local mutations; the stores
// themselves know nothing about the network.
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
  const unsubscribes = DOCUMENT_STORES.map((store) => store.subscribe(() => {
    if (!useCharacterSyncStore.getState().enabled) return;
    if (hasOutstandingWork()) schedulePush();
  }));

  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}
