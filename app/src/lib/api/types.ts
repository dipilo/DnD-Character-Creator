import type { Character } from '@/types/dnd';
import type { KobCharacter } from '@/types/kob';

/** Discriminated by `systemId`; a document without the field is a D&D one. */
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
  /** Denormalised by the writing client so a party view needs no sheet fetch; null pre-Phase 5. */
  summary: string | null;
  /** A row written before the column reads as `campaign`. */
  visibility: CharacterVisibility;
  schema_version: number;
  /** Bumped by the server on every write. Send the one you last saw or the write is refused. */
  version: number;
  created_at: string | null;
  updated_at: string | null;
}

/** The only thing deciding who a share link lets in. */
export type CharacterVisibility = 'private' | 'campaign' | 'public';

/** What the owner may grant, and to whom. */
export type CharacterGrantSubject = 'user' | 'campaign_owner';
export type CharacterGrantAccess = 'view' | 'edit';

export interface CharacterGrant {
  id: number;
  character_id: string;
  subject_type: CharacterGrantSubject;
  subject_id: number;
  access: CharacterGrantAccess;
  created_at: string | null;
  /** "Ada" or "GM of Curse of Strahd" — a list of bare ids is not one anyone can revoke. */
  label: string;
}

/** Readable and writable by its owner alone; rotating `share_token` revokes every link sent. */
export interface CharacterSharing {
  character_id: string;
  visibility: CharacterVisibility;
  share_token: string | null;
  grants: CharacterGrant[];
}

/** `data` is the builder's `Character`, round-tripped verbatim; null only when it failed to parse. */
export interface CharacterRecord extends CharacterRecordSummary {
  /** A courtesy, rechecked on every write; `is_owner` gates everything that is not the document. */
  is_owner: boolean;
  can_edit: boolean;
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

/** Row metadata on its own route, so it carries no `version`; detaching clears the seat. */
export interface CharacterSeat {
  campaign_id: number | null;
  player_id?: number | null;
}

/** The only list where `user_id` is somebody else's. */
export interface CampaignCharacterSummary extends CharacterRecordSummary {
  owner_name: string | null;
  player_name: string | null;
  /** A private character still holds its seat, but the sheet behind it does not open. */
  can_read: boolean;
  can_edit: boolean;
}

/** `granted_via` says which grant reached you, so it stays with the seat. */
export interface SharedCharacterSummary extends CampaignCharacterSummary {
  granted_via: 'user' | 'campaign_owner';
}

// Scheduler row shapes; the server answers with `SELECT *`, so db/schema.js is the contract.
export interface Campaign {
  id: number;
  name: string | null;
  owner_user_id: number | null;
  created_at: string | null;
  /** The short join code. Owners can regenerate it; it is a credential, so treat it as one. */
  campaign_code: string | null;
  sort_index: number | null;
  /** Opaque to the server; read it with `parseAllowedSourceIds`. Null or empty is no restriction. */
  allowed_source_ids: string | null;
  /** Read through `getGameSystem`, which falls back to the default a pre-column campaign carries. */
  system_id: string | null;
  /** JSON permission blob granted to anyone who joins. Null grants nothing. */
  default_member_permissions: string | null;
  /** Distinct from the member default: an invited arrival is not the same audience. */
  default_invite_permissions: string | null;
  /** Null is "no opinion": 'first' for a player, 'never' for the owner. */
  default_auto_claim_seats: AutoClaimMode | null;
  /** The ask, not the answer; the reply is on the member's own row. Stored 0/1. */
  requests_character_edit: number | null;
}

/** The owner implicitly holds all of them, so check ownership first (`memberCan`). */
export interface CampaignPermissions {
  can_create_players?: boolean;
  can_delete_players?: boolean;
  can_manage_groups?: boolean;
  can_manage_sessions?: boolean;
  can_create_invites?: boolean;
  can_edit_self?: boolean;
  /** Legacy name for the same right as `players_self_delete`; the server accepts either. */
  can_unclaim?: boolean;
  players_self_delete?: boolean;
}

/** 'first' claims only while they hold none, so it covers a seat made after a deletion. */
export type AutoClaimMode = 'never' | 'first' | 'always';

export interface CampaignMember {
  id: number;
  campaign_id: number;
  user_id: number | null;
  player_id: number | null;
  role: string | null;
  /** JSON, as stored. Parse with `parsePermissions` rather than at each call site. */
  permissions: string | null;
  /** Theirs to set and nobody else's, which is why it is its own column. */
  character_edit_consent: number | null;
  /** The owner's word on this member's auto-claim. Null hands the decision to their preference. */
  auto_claim_override: AutoClaimMode | null;
  /** This member's own auto-claim setting. Null falls through to the campaign's default. */
  auto_claim_preference: AutoClaimMode | null;
  created_at: string | null;
  user_discord: string | null;
  user_name: string | null;
  player_name: string | null;
}

/** Can exist unclaimed, so a player is not a user; `password_hash` is never sent. */
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

/** The server splits at every block boundary, so the count is constant across the slice. */
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
  /** A palette key from `lib/groupColors.ts`. The server stores it without interpreting it. */
  color: string | null;
  /** How many seats this table is meant to hold, or null when it has no target. */
  target_size: number | null;
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
  /** Null defers to the campaign's default; `"{}"` is an explicit "grant nothing". */
  permissions: string | null;
}

export interface InvitePreview {
  ok: true;
  invite: Invite;
  /** Only the ask, so the landing page can put it before joining; absent means no. */
  campaign: Pick<Campaign, 'id' | 'name' | 'requests_character_edit'> | null;
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

/** Describes what `GET /api/sheet-template` sends; `server/lib/sheetIntake.js` defines it. */
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

/** `warnings` come from Appendix B, `notes` are the player's; the merge carries both. */
export interface PreGameFormList {
  warnings: string[];
  notes: string[];
}

export interface PreGameFormData {
  lists: Record<string, PreGameFormList>;
}

export interface PreGameForm {
  campaign_id: number;
  user_id: number;
  owner_name: string | null;
  data: PreGameFormData;
  updated_at: string | null;
}

/** `respondents` is a count, not a roster, for the same reason lines carry no author. */
export interface PreGameFormSummary {
  respondents: number;
  lists: Record<string, string[]>;
}

/** One Aspect of a Powered Character. A hidden one never leaves the server for a player. */
export interface PoweredCharacterAspect {
  id: string;
  text: string;
  /** The seat this Aspect sits in front of, or null while it is still in the middle of the table. */
  holder: number | null;
  /** Turned sideways, the book's signal that this Aspect is what the moment is about. */
  active: boolean;
  hidden: boolean;
}

export interface PoweredCharacterFear {
  id: string;
  text: string;
  revealed: boolean;
}

export interface PoweredCharacterData {
  name: string;
  concept: string;
  /** Stat id to die, e.g. `{ brains: 'd12' }`. */
  stats: Record<string, string>;
  powerTokens: { pool: number; spent: number };
  aspects: PoweredCharacterAspect[];
  fears: PoweredCharacterFear[];
  /** How many cards are face down. The text is not sent; the count is, because the table sees them. */
  hiddenAspects: number;
  hiddenFears: number;
}

export interface PoweredCharacter {
  id: number;
  campaign_id: number;
  version: number;
  /** Whether the caller runs this campaign, and so may write the document rather than only play it. */
  is_owner: boolean;
  data: PoweredCharacterData;
  updated_at: string | null;
}

/** What every member may write: Power Tokens spent, and which Aspects are turned and in front of whom. */
export interface PoweredCharacterPlayPatch {
  spent?: number;
  aspects?: { id: string; active?: boolean; holder?: number | null }[];
}

/** A play session at one table. `is_open` is `ended_at` being null, resolved server-side. */
export interface GameSession {
  id: number;
  campaign_id: number;
  group_id: number | null;
  name: string | null;
  started_by: number;
  started_at: string;
  ended_at: string | null;
  is_open: boolean;
}

/** One roll as it settled on somebody's screen, as the table sees it. */
export interface SessionRoll {
  id: number;
  session_id: number;
  user_id: number;
  username: string | null;
  character_name: string | null;
  label: string;
  detail: string | null;
  notation: string;
  total: number;
  note: string | null;
  results: Array<{ value: number; sides: number; dropped?: boolean }>;
  rolled_at: string;
}
