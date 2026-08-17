/**
 * The bookkeeping a document cache keeps so `store/characterSync.ts` can reconcile it against the
 * server. It lives in its own module because both system stores hold it and neither may import the
 * other — the sync layer imports the stores, never the reverse.
 */

export interface CharacterSyncMeta {
  /** The server version last seen. Null means the character has never been uploaded. */
  version: number | null;
  /** The local copy has edits the server has not accepted yet. */
  dirty: boolean;
  syncedAt?: string;
}

/**
 * A seat a character should take once the server has it (MERGE_PLAN.md Phase 5). Starting a
 * character "for this campaign" records the intent here because the character does not exist
 * server-side yet, which is what lets the builder work offline and signed out.
 */
export interface PendingSeat {
  campaignId: number;
  playerId: number | null;
}
