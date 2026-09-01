// A character read straight from the server rather than out of a local cache, and written back
// the same way.
//
// The owner's own sheets do not come through here: they live in `characterStore`, and
// `characterSync` is what pushes them. This is the other case sharing created — a GM or a
// party-mate who was granted edit access holds no local copy at all, so the document *is* the
// server's and every edit is a `PUT` against the version last seen.
//
// Writes are coalesced. A spell-slot row is a dozen clicks in a few seconds and each one is a
// whole-document write, so a patch renders at once and is pushed after a pause. The bookkeeping
// (id, version, whether anything is owed) sits in a ref because it is not what the screen shows;
// what the screen shows is `draft`, which is ordinary state.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getCharacter, getSharedCharacter, isConflict, updateCharacter } from '@/lib/api';
import type { CharacterRecord, StoredCharacterDocument } from '@/lib/api';
import { conflictingRecord } from '@/lib/characterConflict';
import { getStoreForDocument } from '@/store/documentStores';

const PUSH_DEBOUNCE_MS = 900;

export interface RemoteCharacterState {
  /** Null while the first fetch is in flight, or when it failed. */
  record: CharacterRecord | null;
  document: StoredCharacterDocument | null;
  error: string | null;
  loading: boolean;
  saving: boolean;
  /**
   * Apply a sheet patch. Handing this to a sheet view is what makes it editable, so a caller that
   * may only read simply does not pass it on.
   */
  applyPatch: (patch: Partial<StoredCharacterDocument>) => void;
  /** Set when the server refused a write because someone else saved. The edit is still held. */
  conflict: RemoteCharacterConflict | null;
  /** Answer a conflict: send the local edit over their version, or take theirs and drop it. */
  resolveConflict: (choice: 'mine' | 'theirs') => void;
}

/** The other writer's copy, as the 409 handed it back. */
export interface RemoteCharacterConflict {
  theirs: CharacterRecord;
  savedAt: string | null;
}

/** Where the character is being read from: its id, or a share link's token. */
export type RemoteCharacterSource = { kind: 'id'; id: string } | { kind: 'share'; token: string };

interface Loaded {
  key: string;
  record: CharacterRecord | null;
  error: string | null;
}

/** What the push loop needs and the render does not. */
interface SyncState {
  key: string;
  id: string;
  version: number;
  document: StoredCharacterDocument;
  dirty: boolean;
}

export function useRemoteCharacter(source: RemoteCharacterSource): RemoteCharacterState {
  // Destructured to primitives on purpose. A caller passes an object literal, so depending on
  // `source` itself re-ran the load effect on *every* render — which cleared the pending edit and
  // refetched the document a moment after each click, so nothing was ever pushed.
  const kind = source.kind;
  const locator = source.kind === 'id' ? source.id : source.token;
  const key = `${kind}:${locator}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<{ key: string; document: StoredCharacterDocument } | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{ key: string; conflict: RemoteCharacterConflict } | null>(null);
  const sync = useRef<SyncState | null>(null);
  // An unanswered conflict stops the push loop. Retrying against a version the server has already
  // refused only earns the same 409, and the player would watch it fail on every keystroke.
  const blocked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback(async () => {
    const outstanding = sync.current;
    if (!outstanding?.dirty || blocked.current) return;
    const sent = outstanding.document;
    setSaving(true);
    try {
      // The summary is the client's to write (CLAUDE.md): a push that omits it leaves a
      // campaign-mate's party list showing a stale level.
      const store = getStoreForDocument(sent);
      const saved = await updateCharacter(outstanding.id, outstanding.version, {
        name: store.nameOf(sent),
        summary: await store.describe(sent),
        data: sent,
      });
      // Only what was actually sent is settled: an edit made while the request was open is still
      // owed, and now owes it against the version the server just wrote.
      const after = sync.current;
      if (after?.id === outstanding.id) {
        sync.current = { ...after, version: saved.version, dirty: after.document !== sent };
        if (after.document !== sent) void push();
      }
      setLoaded((current) => (current?.record ? { ...current, record: { ...current.record, ...saved }, error: null } : current));
    } catch (e) {
      // A 409 means the sheet was written somewhere else since it was read. The local edit stays
      // owed and nothing retries on its own: which version wins is the player's answer to give,
      // and the refusal carries the other writer's copy to show them.
      const theirs = conflictingRecord(e);
      if (theirs) {
        blocked.current = true;
        setConflict({ key: outstanding.key, conflict: { theirs, savedAt: theirs.updated_at ?? null } });
      }
      setLoaded((current) => (current ? { ...current, error: theirs ? null : describeSaveFailure(e) } : current));
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    sync.current = null;
    blocked.current = false;
    setConflict(null);
    const request = kind === 'id' ? getCharacter(locator) : getSharedCharacter(locator);
    request
      .then((record) => {
        if (cancelled) return;
        if (record.data) {
          sync.current = { key, id: record.id, version: record.version, document: record.data, dirty: false };
        }
        setLoaded({ key, record, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoaded({ key, record: null, error: describeError(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [key, kind, locator]);

  // An edit made a moment before navigating away is still an edit; send it rather than let the
  // timer die with the page. Same reasoning as the localStorage flush on `pagehide`.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    void push();
  }, [push]);

  const resolveConflict = useCallback((choice: 'mine' | 'theirs') => {
    const outstanding = sync.current;
    const pending = conflict?.conflict;
    if (!outstanding || !pending) return;
    blocked.current = false;
    setConflict(null);
    if (choice === 'mine') {
      // Rebase rather than resend: the document is the local one, the version is theirs.
      sync.current = { ...outstanding, version: pending.theirs.version, dirty: true };
      void push();
      return;
    }
    const document = pending.theirs.data;
    if (!document) return;
    sync.current = { ...outstanding, version: pending.theirs.version, document, dirty: false };
    setDraft({ key: outstanding.key, document });
    setLoaded((current) => (current ? { ...current, record: pending.theirs, error: null } : current));
  }, [conflict, push]);

  const applyPatch = useCallback((patch: Partial<StoredCharacterDocument>) => {
    const current = sync.current;
    if (!current) return;
    const next = { ...current.document, ...patch, updatedAt: new Date().toISOString() } as StoredCharacterDocument;
    sync.current = { ...current, document: next, dirty: true };
    setDraft({ key: current.key, document: next });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void push(), PUSH_DEBOUNCE_MS);
  }, [push]);

  const fresh = loaded?.key === key ? loaded : null;
  const record = fresh?.record ?? null;
  const edited = draft?.key === key ? draft.document : null;

  return {
    record,
    document: edited ?? record?.data ?? null,
    error: fresh?.error ?? null,
    loading: fresh === null,
    saving,
    applyPatch,
    conflict: conflict?.key === key ? conflict.conflict : null,
    resolveConflict,
  };
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Could not load that character.';
}

function describeSaveFailure(error: unknown): string {
  if (isConflict(error)) {
    return 'Someone else saved this sheet while you were editing it. Your change has not been sent.';
  }
  return `Could not save: ${describeError(error)}`;
}
