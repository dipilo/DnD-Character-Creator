/** Its own module: both stores hold it and the sync layer imports them, never the reverse. */

export interface CharacterSyncMeta {
  /** The server version last seen. Null means the character has never been uploaded. */
  version: number | null;
  /** The local copy has edits the server has not accepted yet. */
  dirty: boolean;
  syncedAt?: string;
}

/** An intent, because the character does not exist server-side yet. */
export interface PendingSeat {
  campaignId: number;
  playerId: number | null;
}
