import type { Character } from '@/types/dnd';
import type { KobCharacter } from '@/types/kob';

/**
 * What `/api/characters` can be asked to hold. The server treats `data` as opaque JSON, so a row is
 * whichever system's document was written into it — discriminated by `systemId`, which is why
 * `KobCharacter` carries one. `Character` has none: a document without the field is a D&D one,
 * written before there was a second system.
 */
export type StoredCharacterDocument = Character | KobCharacter;

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
  /**
   * "Level 5 Elf Wizard 5 (Evocation)", denormalised out of the document by the *writing* client so
   * a party view can list a campaign's characters without fetching everyone's sheet. Null on rows
   * written before Phase 5, which simply list by name.
   */
  summary: string | null;
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
  data: StoredCharacterDocument | null;
}

export interface CharacterWritePayload {
  id?: string;
  name?: string;
  /** See `CharacterRecordSummary.summary`. Send it on every write or a list row goes stale. */
  summary?: string;
  campaign_id?: number | null;
  player_id?: number | null;
  schema_version?: number;
  data: StoredCharacterDocument;
}

/** One row of the sign-in upload offer, named and summarised by the cache that holds it. */
export interface CharacterImportEntry {
  id: string;
  name: string;
  summary: string;
  data: StoredCharacterDocument;
}

export interface CharacterImportResult {
  ok: true;
  imported: string[];
  skipped: { id: string | null; reason: string }[];
}

/**
 * Where a character sits (MERGE_PLAN.md Phase 5). This is row metadata, not part of the document,
 * and it is written on its own route: seating a character is not editing the sheet, so it carries
 * no `version` and bumps none. `campaign_id: null` detaches, which clears the seat with it — a seat
 * only exists inside a campaign.
 */
export interface CharacterSeat {
  campaign_id: number | null;
  player_id?: number | null;
}

/**
 * One character in a campaign's party view. Attaching a character to a campaign is what shares it
 * with that campaign's members, so this is the only list where `user_id` is somebody else's;
 * `owner_name` and `player_name` are the joins that make the row readable.
 */
export interface CampaignCharacterSummary extends CharacterRecordSummary {
  owner_name: string | null;
  player_name: string | null;
}

// ---------------------------------------------------------------------------
// Scheduler (MERGE_PLAN.md Phase 4). These mirror the server's row shapes; the
// server answers with `SELECT *` in most places, so the columns in db/schema.js
// are the contract.
// ---------------------------------------------------------------------------

export interface Campaign {
  id: number;
  name: string | null;
  owner_user_id: number | null;
  created_at: string | null;
  /** The short join code. Owners can regenerate it; it is a credential, so treat it as one. */
  campaign_code: string | null;
  sort_index: number | null;
  /**
   * The table's content agreement (MERGE_PLAN.md Phase 5): a JSON array of content-source ids, as
   * stored. The server keeps it opaque — the source manifest is the client's — so read it with
   * `parseAllowedSourceIds` rather than at each call site. Null or empty means no restriction,
   * which is what an empty selection means in the builder's own source filter too.
   */
  allowed_source_ids: string | null;
  /**
   * The game this table plays, as a `GameSystemId`. The server bounds the shape and interprets
   * nothing — the registry is the client's (`data/gameSystems.ts`) — so read it through
   * `getGameSystem`, which falls back to the default for the null a pre-column campaign carries.
   */
  system_id: string | null;
  /** JSON permission blob granted to anyone who joins. Null grants nothing. */
  default_member_permissions: string | null;
  /**
   * JSON permission blob a new invite link starts with. Distinct from the member default because
   * an invited arrival and someone joining with the campaign code are not the same audience.
   */
  default_invite_permissions: string | null;
}

/**
 * The flags a campaign owner may grant a member. The owner implicitly holds all of them, so a
 * client asking "may I?" must check ownership first — see `memberCan` in `campaignStore`.
 */
export interface CampaignPermissions {
  can_create_players?: boolean;
  can_delete_players?: boolean;
  can_manage_groups?: boolean;
  can_create_invites?: boolean;
  can_edit_self?: boolean;
  /** Legacy name for the same right as `players_self_delete`; the server accepts either. */
  can_unclaim?: boolean;
  players_self_delete?: boolean;
}

export interface CampaignMember {
  id: number;
  campaign_id: number;
  user_id: number | null;
  player_id: number | null;
  role: string | null;
  /** JSON, as stored. Parse with `parsePermissions` rather than at each call site. */
  permissions: string | null;
  created_at: string | null;
  user_discord: string | null;
  user_name: string | null;
  player_name: string | null;
}

/**
 * A campaign seat. It can exist unclaimed — imported from a sheet before anyone owns it — which is
 * why a player is not the same thing as a user (MERGE_PLAN.md §9). `password_hash` is never sent.
 */
export interface Player {
  id: number;
  name: string | null;
  discord: string | null;
  timezone: string | null;
  notes: string | null;
  age: string | null;
  computer_access: string | null;
  pref_party_size: string | null;
  pref_session_length: string | null;
  pref_vtt: string | null;
  pref_play_with: string | null;
  pref_play_not_with: string | null;
  pref_play_with_ids: string | null;
  pref_play_not_with_ids: string | null;
  campaign_id: number | null;
  discord_id: string | null;
  unclaimed_at: string | null;
  sort_index: number | null;
  ddb_url: string | null;
  ddb_json: string | null;
  ddb_avatar_url: string | null;
  claimed_user_id?: number | null;
  is_claimed?: boolean;
}

/** The subset of a player a client may write. Ids and claim state are the server's to decide. */
export type PlayerWritePayload = Partial<
  Pick<
    Player,
    | 'name' | 'discord' | 'timezone' | 'notes' | 'age' | 'computer_access'
    | 'pref_party_size' | 'pref_session_length' | 'pref_vtt'
    | 'pref_play_with' | 'pref_play_not_with'
    | 'ddb_url' | 'ddb_json' | 'ddb_avatar_url'
  >
> & {
  /** Re-derive sheet-sourced availability from `notes` on save. */
  rebuildOnSave?: boolean;
  /** Blocks the player confirmed in the preview pane, used instead of re-parsing the notes. */
  availability_preview_blocks?: AvailabilityBlock[];
};

export interface AvailabilityRow {
  id: number;
  player_id: number;
  start_iso: string;
  end_iso: string;
  source: string | null;
  campaign_id: number | null;
}

/** A start/end pair with no identity yet: a parse preview, or a block about to be created. */
export interface AvailabilityBlock {
  start_iso: string;
  end_iso: string;
}

export interface AvailabilityPreview {
  ok: true;
  availability: AvailabilityBlock[];
  preview: { daysAhead: number; count: number; timezone: string };
}

/** One operation in a coalesced `/api/availability/batch` write. */
export type AvailabilityOp =
  | { op: 'create'; player_id: number; start_iso: string; end_iso: string }
  | { op: 'update'; id: number; start_iso: string; end_iso: string }
  | { op: 'delete'; id: number };

/**
 * One slice of the aggregate scan: how many of the campaign's players are free between `start` and
 * `end`. The server splits the window at every block boundary, so the count is constant across it.
 */
export interface AggregateInterval {
  start: string;
  end: string;
  count: number;
  player_ids: number[];
}

export interface Group {
  id: number;
  name: string | null;
  notes: string | null;
  created_at: string | null;
  sort_index: number | null;
  campaign_id: number | null;
  members: Player[];
}

export interface GroupSuggestionMember {
  id: number;
  name: string | null;
  discord: string | null;
  /** No availability at all in the requested window — a group of these is not a real suggestion. */
  zero_availability: boolean;
}

export interface GroupSuggestion {
  members: GroupSuggestionMember[];
  /** Summed member availability inside the window, in hours. */
  score: number;
}

export interface GroupSuggestionResult {
  ok: true;
  groups: GroupSuggestion[];
  leftover: GroupSuggestionMember[];
  meta: { algo: string; counts: Record<string, number> };
}

export interface Invite {
  id: number;
  token: string | null;
  campaign_id: number;
  created_by_user_id: number | null;
  expires_at: string | null;
  /** null means unlimited. */
  max_uses: number | null;
  challenge_enabled: number;
  challenge_min_score: number;
  used_count: number;
  created_at: string | null;
  /**
   * What this link grants whoever joins on it, as a JSON blob. Null means "no opinion" and the
   * campaign's `default_invite_permissions` applies; `"{}"` is an explicit "grant nothing".
   */
  permissions: string | null;
}

export interface InvitePreview {
  ok: true;
  invite: Invite;
  campaign: Pick<Campaign, 'id' | 'name'> | null;
}

export interface InviteJoinResult {
  ok: true;
  campaign_id: number;
  campaign_name: string | null;
}

/** A seat offered on an invite landing page: enough to recognise it, nothing more. */
export interface UnclaimedPlayer {
  id: number;
  name: string | null;
  discord: string | null;
  notes: string | null;
  sort_index: number | null;
}

/* ---------- Google Sheets intake (MERGE_PLAN.md §20) ---------- */

/**
 * One question the intake template asks. Mirrors `server/lib/sheetIntake.js`, which is the single
 * definition — this type describes what `GET /api/sheet-template` sends, it does not restate it.
 */
export interface IntakeField {
  key: string;
  /** The `players` column the answer is stored in. */
  column: string;
  label: string;
  /** The Form question, verbatim. This is the wording the template uses. */
  question: string;
  type: 'short' | 'paragraph' | 'choice';
  required?: boolean;
  /** Participates in matching a row to an existing seat. */
  identity?: boolean;
  aliases: string[];
  help?: string;
  choices?: string[];
}

export interface SheetIntakeTemplate {
  fields: IntakeField[];
  /** "Make a copy" URLs, or null when the deployment has not configured them. */
  templates: { sheet: string | null; form: string | null };
}

/** field key -> the sheet header it reads from. */
export type SheetMapping = Record<string, string>;

export interface SheetSyncRequest {
  campaign_id: number;
  spreadsheetId: string;
  gid?: string;
  mapping?: SheetMapping | null;
}

export interface SheetPlanDetail {
  creates: { row: number; name: string; discord: string }[];
  updates: { row: number; seat_id: number; seat_name: string | null; claimed: boolean; columns: string[] }[];
  skipped: { row: number; seat_id: number | null; reason: string }[];
}

export interface SheetPreview {
  ok: true;
  dry_run: true;
  created: number;
  updated: number;
  skipped: number;
  detail: SheetPlanDetail;
}

export interface SheetImportResult {
  ok: true;
  created: number;
  updated: number;
  skipped: number;
  detail: SheetPlanDetail;
  players: Player[];
}
