import type { Character } from '@/types/dnd';

/** The public profile the server returns. There is no token here and no id the client echoes back. */
export interface AuthUser {
  id: number;
  username: string | null;
  discord_id: string | null;
  created_at: string | null;
}

/** Row metadata for one stored character: everything except the document itself. */
export interface CharacterRecordSummary {
  id: string;
  user_id: number;
  campaign_id: number | null;
  player_id: number | null;
  name: string | null;
  schema_version: number;
  /** Bumped by the server on every write. Send the one you last saw or the write is refused. */
  version: number;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * A stored character. `data` is the builder's own `Character` object, round-tripped verbatim —
 * the server stores it as one JSON document precisely so every choice-mode and selection field
 * survives to be read back into the builder (CLAUDE.md; MERGE_PLAN.md §5.3). It is null only when
 * a stored document failed to parse.
 */
export interface CharacterRecord extends CharacterRecordSummary {
  data: Character | null;
}

export interface CharacterWritePayload {
  id?: string;
  name?: string;
  campaign_id?: number | null;
  player_id?: number | null;
  schema_version?: number;
  data: Character;
}

export interface CharacterImportResult {
  ok: true;
  imported: string[];
  skipped: { id: string | null; reason: string }[];
}
