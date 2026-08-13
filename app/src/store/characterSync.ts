// Character sync (MERGE_PLAN.md Phase 2).
//
// The builder still works signed out and offline, so localStorage keeps every character — it just
// stops being the record. This module reconciles that cache against the server: it pulls what
// another device wrote, pushes what this one changed, honours deletions in both directions, and
// never resolves a conflict by throwing an edit away.
//
// It imports `characterStore` and `characterStore` does not import it. That direction is
// deliberate: the store stays a plain document cache, and sync watches it from outside rather
// than being called from inside every mutation.
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
  updateCharacter as updateRemoteCharacter,
} from '@/lib/api';
import { useCharacterStore } from '@/store/characterStore';
import type { Character } from '@/types/dnd';
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
const store = () => useCharacterStore.getState();

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
  const { characters, syncMeta } = store();
  setSyncState({
    enabled: true,
    unsyncedIds: characters.filter((c) => syncMeta[c.id]?.version == null).map((c) => c.id),
  });
}

/** The document as the server should store it: its own id wins over whatever the copy carried. */
function withId(character: Character, id: string): Character {
  return character.id === id ? character : { ...character, id };
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
function unchangedSince(id: string, snapshot: Character | undefined): boolean {
  return store().characters.find((c) => c.id === id) === snapshot;
}

async function pullCharacter(id: string): Promise<void> {
  const before = store().characters.find((c) => c.id === id);
  const record = await getRemoteCharacter(id);
  if (!record?.data) {
    console.warn('character', id, 'came back from the server without a readable document');
    return;
  }
  // Edited here while the fetch was in the air: keep the local edit. It is dirty, so the next pass
  // pushes it, and the server answers 409 — which keeps both copies rather than dropping one.
  if (!unchangedSince(id, before)) return;
  store().applyRemoteCharacter(withId(record.data, record.id), record.version);
}

/**
 * Both copies changed. The server's copy keeps the id, and the local edit is kept as a separate
 * character rather than discarded — the user decides which one to keep, not the sync layer.
 */
async function resolveConflict(id: string): Promise<void> {
  const local = store().characters.find((c) => c.id === id);
  const knownVersion = store().syncMeta[id]?.version ?? null;
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
        store().forgetCharacter(id);
        return;
      }
      throw new Error(`character id ${id} is already taken by another account`);
    }
    throw e;
  }
  if (!record.data) return;

  const server = withId(record.data, record.id);
  const differs = Boolean(local) && JSON.stringify(local) !== JSON.stringify(server);
  store().applyRemoteCharacter(server, record.version);

  if (differs && local) {
    const copy: Character = {
      ...local,
      id: crypto.randomUUID(),
      name: `${local.name} (conflict copy)`,
      updatedAt: new Date().toISOString(),
    };
    store().addCharacter(copy);
    setSyncState({ conflictIds: [...useCharacterSyncStore.getState().conflictIds, copy.id] });
    // Keeping the edit but saying nothing would look like the edit was lost.
    toast.message(`${server.name} was edited on another device`, {
      description: 'That version was kept. Your changes are saved beside it as a conflict copy.',
    });
  }
}

/** Send one local character to the server. Returns false when the request never landed. */
export async function pushCharacter(id: string): Promise<boolean> {
  const state = store();
  const character = state.characters.find((c) => c.id === id);
  if (!character) return true;
  const meta = state.syncMeta[id];

  try {
    if (meta?.version == null) {
      const created = await createCharacter({ id, name: character.name, data: character });
      store().markCharacterSynced(id, created.version, !unchangedSince(id, character));
    } else {
      const updated = await updateRemoteCharacter(id, meta.version, { name: character.name, data: character });
      store().markCharacterSynced(id, updated.version, !unchangedSince(id, character));
    }
    return true;
  } catch (e) {
    if (isOffline(e)) return false;
    // An update that 404s is a character we had a version for and the server no longer has:
    // deleted from another device between the list and this write.
    if (e instanceof ApiError && e.status === 404 && meta?.version != null) {
      store().forgetCharacter(id);
      return true;
    }
    // A create refused by a tombstone is the opposite situation — the id is spoken for but this
    // copy was never ours to delete. Report it; do not destroy the only copy on the strength of it.
    if (e instanceof ApiError && e.code === 'character_deleted') {
      throw new Error(`character id ${id} was deleted on the server and cannot be re-created`);
    }
    if (isConflict(e)) {
      await resolveConflict(id);
      return true;
    }
    throw e;
  }
}

/** Tell the server about characters deleted here. A 404 means it already agrees. */
async function flushPendingDeletes(): Promise<boolean> {
  // Safe to iterate without copying: clearPendingDelete replaces the array rather than splicing it.
  const pending = store().pendingDeletes;
  for (const id of pending) {
    try {
      await deleteRemoteCharacter(id);
      store().clearPendingDelete(id);
    } catch (e) {
      if (isOffline(e)) return false;
      if (e instanceof ApiError && e.status === 404) {
        store().clearPendingDelete(id);
        continue;
      }
      throw e;
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
  const localCharacters = store().characters;
  for (const character of localCharacters) {
    const meta = store().syncMeta[character.id];
    const record = remoteById.get(character.id);
    if (!record) {
      await attempt(character.id, () => reconcileMissingRemote(character.id, meta?.version ?? null, awaitingOffer, unsyncedIds), failures);
      continue;
    }
    if (meta?.dirty) await attempt(character.id, () => pushCharacter(character.id), failures);
    else if (meta?.version !== record.version) await attempt(character.id, () => pullCharacter(character.id), failures);
  }

  const localIds = new Set(store().characters.map((c) => c.id));
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
async function reconcileMissingRemote(id: string, knownVersion: number | null, awaitingOffer: Set<string>, unsyncedIds: string[]): Promise<void> {
  if (knownVersion != null) {
    store().forgetCharacter(id);
    return;
  }
  if (awaitingOffer.has(id)) {
    unsyncedIds.push(id);
    return;
  }
  await pushCharacter(id);
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
  const characters = store().characters.filter((c) => offered.has(c.id));
  if (characters.length === 0) return { imported: 0, skipped: 0 };
  const sentById = new Map(characters.map((c) => [c.id, c]));

  setSyncState({ uploading: true });
  try {
    const result = await importCharacters(characters);
    for (const id of result.imported) {
      store().markCharacterSynced(id, 1, !unchangedSince(id, sentById.get(id)));
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
// changes are coalesced. The watcher is the only thing that reacts to local mutations; the store
// itself knows nothing about the network.
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
  const state = store();
  if (state.pendingDeletes.length > 0) return true;
  return state.characters.some((c) => state.syncMeta[c.id]?.dirty);
}

/** Watch the cache for local changes and push them. Returns the unsubscribe. */
export function startCharacterSyncWatcher(): () => void {
  return useCharacterStore.subscribe((state, previous) => {
    if (!useCharacterSyncStore.getState().enabled) return;
    if (state.characters === previous.characters && state.syncMeta === previous.syncMeta && state.pendingDeletes === previous.pendingDeletes) return;
    if (hasOutstandingWork()) schedulePush();
  });
}
