// Route-level smoke harness for the scheduler API.
//
// There are no unit tests behind these ~60 routes, so Phase 1a of MERGE_PLAN.md (splitting
// server.js into modules as a pure move) has nothing to prove it changed no behaviour. This
// script boots the real server against a throwaway libsql file, drives a scripted scenario
// across every resource, and writes a normalised snapshot of every status + response body.
//
//   node server/test/smoke.mjs --write    record the snapshot as the new baseline
//   node server/test/smoke.mjs            replay and diff against the baseline (exit 1 on drift)
//
// Volatile values (timestamps, generated tokens, uptime) are redacted so two runs of the same
// code compare equal. Ids are not redacted: the DB is fresh every run, so they are stable and
// worth checking.

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const serverDir = join(here, '..');
const snapshotPath = join(here, '__snapshots__', 'smoke.json');
const write = process.argv.includes('--write');
const port = Number(process.env.SMOKE_PORT || 3987);
const base = `http://127.0.0.1:${port}`;

/** Keys whose values differ between two runs of identical code. */
const volatileKeys = new Set([
  'timestamp', 'uptime', 'created_at', 'updated_at', 'campaign_code', 'token',
  'session_id', 'pass_token', 'fake_captcha_text', 'password_hash', 'db_url',
  'expires_in_ms', 'sql',
]);

const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function redact(value, key) {
  if (key && volatileKeys.has(key)) return '<volatile>';
  if (Array.isArray(value)) return value.map((v) => redact(v));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = redact(value[k], k);
    return out;
  }
  return value;
}

/** Blank a dotted path inside a response body, for routes whose output tracks the clock. */
function blankPath(body, path) {
  const parts = path.split('.');
  let cursor = body;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cursor || typeof cursor !== 'object') return;
    cursor = cursor[parts[i]];
  }
  if (cursor && typeof cursor === 'object') {
    const last = parts[parts.length - 1];
    if (last in cursor) cursor[last] = '<clock-dependent>';
  }
}

const ctx = {};

// Authentication is a session cookie now (MERGE_PLAN.md Phase 1b), so the harness keeps a jar
// per named user instead of asserting an id in a header. A step's `jar` names the slot its
// Set-Cookie lands in; logout responses clear the cookie and are deliberately not stored, so a
// later request can replay the revoked cookie and prove the server killed it.
const cookieJar = {};
const asUser = (name) => (cookieJar[name] ? { Cookie: cookieJar[name] } : {});

const SESSION_COOKIE = 'dnd_session';

function readSetCookies(res) {
  if (typeof res.headers.getSetCookie === 'function') return res.headers.getSetCookie();
  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
}

function sessionCookieFrom(res) {
  for (const line of readSetCookies(res)) {
    if (line.startsWith(`${SESSION_COOKIE}=`)) return line;
  }
  return null;
}

/** Keep the cookie's attributes in the snapshot — they are the security assertion — not its value. */
function normaliseSetCookie(line) {
  return line
    .replace(/^([^=]+)=[^;]*/, '$1=<volatile>')
    .replace(/Expires=[^;]*/i, 'Expires=<volatile>');
}

/** Values minted at random by the server that leak into request URLs. */
const masked = [];
const mask = (s) => masked.reduce((acc, secret) => acc.replaceAll(secret, '<generated>'), s);

/**
 * Steps run in order against one server process and one DB. `path`/`body` may be functions of
 * ctx so a step can use an id or token minted by an earlier step; `capture` stores values for
 * later steps from the *unredacted* response.
 */
const steps = [
  { name: 'root', method: 'GET', path: '/' },
  { name: 'health', method: 'GET', path: '/health' },
  { name: 'diag-db', method: 'GET', path: '/diag/db' },
  { name: 'discord-authorize-unconfigured', method: 'GET', path: '/auth/discord', redirect: 'manual' },

  { name: 'signup-passwordless-without-campaign', method: 'POST', path: '/auth/signup', body: { username: 'alice' } },
  { name: 'signup-alice', method: 'POST', path: '/auth/signup', body: { username: 'alice', password: 'pw-alice' }, jar: 'alice', capture: (j) => { ctx.alice = j.user?.id; } },
  { name: 'signup-alice-again', method: 'POST', path: '/auth/signup', body: { username: 'alice', password: 'other' } },
  { name: 'login-alice', method: 'POST', path: '/auth/login', body: { username: 'alice', password: 'pw-alice' }, jar: 'alice' },
  { name: 'login-alice-wrong-password', method: 'POST', path: '/auth/login', body: { username: 'alice', password: 'nope' } },
  { name: 'login-alice-no-password', method: 'POST', path: '/auth/login', body: { username: 'alice' } },
  { name: 'signup-bob', method: 'POST', path: '/auth/signup', body: { username: 'bob', password: 'pw-bob' }, jar: 'bob', capture: (j) => { ctx.bob = j.user?.id; } },

  { name: 'get-user', method: 'GET', path: () => `/api/users/${ctx.alice}`, headers: () => asUser('alice') },
  { name: 'get-user-unauthenticated', method: 'GET', path: () => `/api/users/${ctx.alice}` },
  { name: 'get-user-missing', method: 'GET', path: '/api/users/9999', headers: () => asUser('alice') },

  { name: 'create-campaign-unauthenticated', method: 'POST', path: '/api/campaigns', body: { name: 'Nope' } },
  { name: 'create-campaign', method: 'POST', path: '/api/campaigns', headers: () => asUser('alice'), body: { name: 'Test Camp', system_id: 'kids-on-bikes' }, capture: (j) => { ctx.camp = j.campaign?.id; } },
  // The server bounds the shape of a system id and interprets nothing else about it, exactly as
  // it treats allowed_source_ids — adding a system must never need a server deploy.
  { name: 'create-campaign-invalid-system', method: 'POST', path: '/api/campaigns', headers: () => asUser('alice'), body: { name: 'Bad System', system_id: 'Not A System' } },
  { name: 'list-campaigns', method: 'GET', path: '/api/campaigns', headers: () => asUser('alice') },
  { name: 'campaign-by-unknown-code', method: 'GET', path: '/api/campaigns/code/not-a-code' },
  { name: 'regenerate-code', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/regenerate-code`, headers: () => asUser('alice') },
  { name: 'rename-campaign', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: { name: 'Renamed Camp' } },
  { name: 'rename-campaign-no-name', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: {} },
  { name: 'rename-campaign-forged-user', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: { 'X-User-Id': '4242' }, body: { name: 'Hijacked' } },
  { name: 'campaign-members', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/members`, headers: () => asUser('alice') },

  { name: 'players-empty', method: 'GET', path: () => `/api/players?campaign_id=${ctx.camp}`, headers: () => asUser('alice') },
  { name: 'players-without-campaign', method: 'GET', path: '/api/players', headers: () => asUser('alice') },
  { name: 'create-player-bran', method: 'POST', path: '/api/players', headers: () => asUser('alice'), body: () => ({ campaign_id: ctx.camp, name: 'Bran', timezone: 'EST', notes: '' }), capture: (j) => { ctx.bran = j.player?.id; } },
  { name: 'create-player-cora', method: 'POST', path: '/api/players', headers: () => asUser('alice'), body: () => ({ campaign_id: ctx.camp, name: 'Cora', timezone: 'PST', notes: '' }), capture: (j) => { ctx.cora = j.player?.id; } },
  { name: 'list-players', method: 'GET', path: () => `/api/players?campaign_id=${ctx.camp}`, headers: () => asUser('alice') },
  { name: 'update-player', method: 'PUT', path: () => `/api/players/${ctx.bran}`, headers: () => asUser('alice'), body: { name: 'Bran the Bold' } },
  { name: 'update-player-missing', method: 'PUT', path: '/api/players/9999', headers: () => asUser('alice'), body: { name: 'Ghost' } },
  { name: 'update-player-unauthenticated', method: 'PUT', path: () => `/api/players/${ctx.bran}`, body: { name: 'Hijacked' } },
  { name: 'reorder-players', method: 'POST', path: '/api/players/reorder', headers: () => asUser('alice'), body: () => ({ ids: [ctx.cora, ctx.bran] }) },
  { name: 'unclaimed-players', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/unclaimed-players`, headers: () => asUser('alice') },

  { name: 'availability-create', method: 'POST', path: '/api/availability', headers: () => asUser('alice'), body: () => ({ player_id: ctx.bran, start_iso: '2026-09-01T18:00:00.000Z', end_iso: '2026-09-01T22:00:00.000Z' }) },
  { name: 'availability-create-overlapping', method: 'POST', path: '/api/availability', headers: () => asUser('alice'), body: () => ({ player_id: ctx.bran, start_iso: '2026-09-01T21:00:00.000Z', end_iso: '2026-09-02T01:00:00.000Z' }), capture: (j) => { ctx.avail = j.id; } },
  { name: 'availability-create-missing-fields', method: 'POST', path: '/api/availability', headers: () => asUser('alice'), body: () => ({ player_id: ctx.bran }) },
  { name: 'availability-list', method: 'GET', path: () => `/api/availability?player_id=${ctx.bran}&campaign_id=${ctx.camp}`, headers: () => asUser('alice') },
  { name: 'availability-update', method: 'PUT', path: () => `/api/availability/${ctx.avail}`, headers: () => asUser('alice'), body: { start_iso: '2026-09-01T17:00:00.000Z', end_iso: '2026-09-02T02:00:00.000Z' } },
  { name: 'availability-batch', method: 'POST', path: '/api/availability/batch', headers: () => asUser('alice'), body: () => ({ campaign_id: ctx.camp, operations: [
    { op: 'create', player_id: ctx.cora, start_iso: '2026-09-03T18:00:00.000Z', end_iso: '2026-09-03T23:00:00.000Z' },
    { op: 'delete', id: 9999 },
    { op: 'nonsense' },
  ] }) },
  { name: 'availability-aggregate', method: 'GET', path: () => `/api/availability/aggregate?start=2026-09-01T00:00:00.000Z&end=2026-09-08T00:00:00.000Z&campaign_id=${ctx.camp}`, headers: () => asUser('alice') },
  { name: 'availability-preview', method: 'POST', path: '/api/availability/preview', headers: () => asUser('alice'), body: { text: 'Free Mondays 6pm-10pm EST', timezone: 'EST' }, blank: ['availability'] },
  { name: 'availability-delete', method: 'DELETE', path: () => `/api/availability/${ctx.avail}`, headers: () => asUser('alice') },

  { name: 'groups-empty', method: 'GET', path: () => `/api/groups?campaign_id=${ctx.camp}`, headers: () => asUser('alice') },
  { name: 'create-group', method: 'POST', path: '/api/groups', headers: () => asUser('alice'), body: () => ({ name: 'Table A', campaign_id: ctx.camp, member_ids: [ctx.bran, ctx.cora] }), capture: (j) => { ctx.group = j.group?.id; } },
  { name: 'create-group-not-owner', method: 'POST', path: '/api/groups', headers: () => asUser('bob'), body: () => ({ name: 'Table B', campaign_id: ctx.camp }) },
  { name: 'update-group', method: 'PUT', path: () => `/api/groups/${ctx.group}`, headers: () => asUser('alice'), body: () => ({ name: 'Table A prime', member_ids: [ctx.bran] }) },
  { name: 'group-add-member', method: 'POST', path: () => `/api/groups/${ctx.group}/members`, headers: () => asUser('alice'), body: () => ({ player_id: ctx.cora }) },
  { name: 'group-remove-member', method: 'DELETE', path: () => `/api/groups/${ctx.group}/members/${ctx.cora}`, headers: () => asUser('alice') },
  { name: 'reorder-groups', method: 'POST', path: '/api/groups/reorder', headers: () => asUser('alice'), body: () => ({ ids: [ctx.group] }) },
  { name: 'suggest-groups', method: 'POST', path: '/api/groups/suggest', headers: () => asUser('alice'), body: () => ({ campaign_id: ctx.camp, numGroups: 2, targetSize: 2 }) },
  { name: 'save-suggestion', method: 'POST', path: '/api/groups/save-suggestion', headers: () => asUser('alice'), body: () => ({ campaign_id: ctx.camp, groups: [{ name: 'Suggested 1', member_ids: [ctx.bran] }] }) },
  { name: 'groups-listed', method: 'GET', path: () => `/api/groups?campaign_id=${ctx.camp}`, headers: () => asUser('alice') },
  { name: 'delete-group', method: 'DELETE', path: () => `/api/groups/${ctx.group}`, headers: () => asUser('alice') },

  { name: 'create-invite', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/invites`, headers: () => asUser('alice'), body: { max_uses: 3 }, capture: (j) => { ctx.inviteToken = j.invite?.token; ctx.inviteId = j.invite?.id; if (ctx.inviteToken) masked.push(ctx.inviteToken); } },
  { name: 'invite-preview', method: 'GET', path: () => `/api/invites/${ctx.inviteToken}` },
  { name: 'invite-preview-unknown', method: 'GET', path: '/api/invites/no-such-token' },
  { name: 'invite-challenge', method: 'GET', path: () => `/api/invites/${ctx.inviteToken}/challenge` },
  { name: 'invite-challenge-complete', method: 'POST', path: () => `/api/invites/${ctx.inviteToken}/challenge/complete`, body: { session_id: 'made-up', zoople_score: 999 } },
  { name: 'list-invites', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/invites`, headers: () => asUser('alice') },
  { name: 'patch-invite', method: 'PATCH', path: () => `/api/invites/${ctx.inviteId}`, headers: () => asUser('alice'), body: { max_uses: 5, challenge_enabled: true } },
  { name: 'patch-invite-not-a-member', method: 'PATCH', path: () => `/api/invites/${ctx.inviteId}`, headers: () => asUser('bob'), body: { max_uses: 99 } },
  { name: 'invite-join', method: 'POST', path: '/api/invites/join', headers: () => asUser('bob'), body: () => ({ token: ctx.inviteToken }) },
  { name: 'invite-join-unknown-token', method: 'POST', path: '/api/invites/join', body: { token: 'no-such-token' } },

  // Account tier 3: passwordless and campaign-scoped, reached through an invite. It gets a real
  // session like the other two tiers.
  { name: 'signup-passwordless-with-invite', method: 'POST', path: '/auth/signup', body: () => ({ username: 'dara', invite_token: ctx.inviteToken }), jar: 'dara', capture: (j) => { ctx.dara = j.user?.id; } },
  { name: 'me-as-passwordless-user', method: 'GET', path: '/api/me', headers: () => asUser('dara') },
  { name: 'members-after-join', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/members`, headers: () => asUser('alice') },
  { name: 'add-member-already-joined', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/members`, headers: () => asUser('bob') },
  { name: 'add-self-as-player', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/add-self`, headers: () => asUser('bob') },
  { name: 'reorder-campaigns', method: 'POST', path: '/api/campaigns/reorder', headers: () => asUser('alice'), body: () => ({ ids: [ctx.camp] }) },

  { name: 'claim-player', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/claim-player`, headers: () => asUser('bob'), body: () => ({ player_id: ctx.cora }) },
  { name: 'set-member-permissions', method: 'PATCH', path: () => `/api/campaigns/${ctx.camp}/members/${ctx.bob}/permissions`, headers: () => asUser('alice'), body: { permissions: { can_edit_self: true } } },
  // The grant above replaced the blob the claim wrote, so releasing the seat is refused until the
  // right is granted back. Holding a seat used to be permission enough, which left the switch inert.
  { name: 'unclaim-without-self-release', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/unclaim-player`, headers: () => asUser('bob'), body: () => ({ player_id: ctx.cora }) },
  { name: 'grant-self-release', method: 'PATCH', path: () => `/api/campaigns/${ctx.camp}/members/${ctx.bob}/permissions`, headers: () => asUser('alice'), body: { permissions: { can_edit_self: true, players_self_delete: true } } },
  { name: 'unclaim-player', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/unclaim-player`, headers: () => asUser('bob'), body: () => ({ player_id: ctx.cora }) },
  { name: 'discord-confirm-link', method: 'POST', path: '/api/discord/confirm-link', headers: () => asUser('bob'), body: () => ({ player_id: ctx.cora }) },
  // Releasing a seat is not leaving the table, so bob is still a member here and the leave
  // succeeds. It used to answer not_a_member: unclaiming deleted the membership row along with the
  // seat, which is the bug that evicted a campaign's owner for deleting a seat they had claimed.
  { name: 'leave-campaign', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/leave`, headers: () => asUser('bob') },
  { name: 'owner-cannot-leave', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/leave`, headers: () => asUser('alice') },
  { name: 'delete-invite', method: 'DELETE', path: () => `/api/invites/${ctx.inviteId}`, headers: () => asUser('alice') },

  { name: 'feedback', method: 'POST', path: '/api/feedback', headers: () => asUser('alice'), body: { message: 'smoke test', url: '/campaigns' } },
  { name: 'sheet-columns-missing-id', method: 'POST', path: '/api/sheet-columns', body: {} },
  // The intake schema is served, not duplicated in the client, so its shape is worth pinning:
  // a renamed field key silently breaks the mapping UI and every alias the importer matches on.
  { name: 'sheet-template-unauthenticated', method: 'GET', path: '/api/sheet-template' },
  { name: 'sheet-template', method: 'GET', path: '/api/sheet-template', headers: () => asUser('alice') },
  { name: 'sync-without-campaign', method: 'POST', path: '/api/sync', headers: () => asUser('alice'), body: {} },
  { name: 'sync-invalid-sheet-id', method: 'POST', path: '/api/sync', headers: () => asUser('alice'), body: () => ({ campaign_id: ctx.camp, spreadsheetId: '///' }) },
  // Importing rewrites the roster, so it is gated on can_create_players rather than membership.
  // Dara joined alice's campaign by invite and is a plain member; the old route let any member
  // import over every seat in the campaign.
  { name: 'sync-as-member-without-rights', method: 'POST', path: '/api/sync', headers: () => asUser('dara'), body: () => ({ campaign_id: ctx.camp, spreadsheetId: '///' }) },
  { name: 'rebuild-player', method: 'POST', path: () => `/api/rebuild/${ctx.bran}`, headers: () => asUser('alice') },
  { name: 'rebuild-missing-player', method: 'POST', path: '/api/rebuild/9999', headers: () => asUser('alice') },

  // Exercises the availability_preview_blocks branch of POST /api/players.
  { name: 'create-player-with-preview-blocks', method: 'POST', path: '/api/players', headers: () => asUser('alice'), body: () => ({ campaign_id: ctx.camp, name: 'Dane', availability_preview_blocks: [{ start_iso: '2026-09-05T18:00:00.000Z', end_iso: '2026-09-05T22:00:00.000Z' }] }), capture: (j) => { ctx.dane = j.player?.id; } },

  // Anonymous claim creates an account on the spot; it must come back with a session, not a
  // user id the caller is trusted to echo.
  { name: 'claim-player-anonymous', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/claim-player`, body: { name: 'Ellis' }, jar: 'ellis' },
  { name: 'me-as-anonymous-claimant', method: 'GET', path: '/api/me', headers: () => asUser('ellis') },

  // Phase 2: builder characters. Private per-user documents, which is why they could not land
  // before Phase 1b — every route is behind the session, and another user's id reads as 404 so the
  // id space stays unwalkable.
  { name: 'characters-unauthenticated', method: 'GET', path: '/api/characters' },
  { name: 'characters-empty', method: 'GET', path: '/api/characters', headers: () => asUser('alice') },
  // `summary` is the denormalised display line a party view lists by. The client computes it —
  // resolving ids to names needs the content library — and the server stores it without looking at it.
  { name: 'create-character', method: 'POST', path: '/api/characters', headers: () => asUser('alice'), body: { id: 'char-miri', summary: 'Level 3 Elf Wizard 3', data: { id: 'char-miri', name: 'Miri', speciesId: 'elf', classes: [{ classId: 'wizard', level: 3 }] } } },
  { name: 'create-character-overlong-summary', method: 'POST', path: '/api/characters', headers: () => asUser('alice'), body: { id: 'char-verbose', summary: 'x'.repeat(400), data: { name: 'Verbose' } } },
  { name: 'create-character-unauthenticated', method: 'POST', path: '/api/characters', body: { id: 'char-forged', data: { name: 'Forged' } } },
  { name: 'create-character-duplicate-id', method: 'POST', path: '/api/characters', headers: () => asUser('alice'), body: { id: 'char-miri', data: { name: 'Miri again' } } },
  { name: 'create-character-invalid-id', method: 'POST', path: '/api/characters', headers: () => asUser('alice'), body: { id: 'not a valid id', data: { name: 'Nope' } } },
  { name: 'create-character-invalid-data', method: 'POST', path: '/api/characters', headers: () => asUser('alice'), body: { id: 'char-nodata', data: 'a string is not a character' } },
  { name: 'create-character-seated', method: 'POST', path: '/api/characters', headers: () => asUser('alice'), body: () => ({ id: 'char-dane', campaign_id: ctx.camp, player_id: ctx.dane, data: { name: "Dane's Paladin" } }) },
  { name: 'create-character-foreign-campaign', method: 'POST', path: '/api/characters', headers: () => asUser('bob'), body: () => ({ id: 'char-bob', campaign_id: ctx.camp, data: { name: 'Trespasser' } }) },
  { name: 'create-character-seat-without-campaign', method: 'POST', path: '/api/characters', headers: () => asUser('alice'), body: () => ({ id: 'char-seatless', player_id: ctx.dane, data: { name: 'Seatless' } }) },
  { name: 'list-characters', method: 'GET', path: '/api/characters', headers: () => asUser('alice') },
  { name: 'list-characters-by-campaign', method: 'GET', path: () => `/api/characters?campaign_id=${ctx.camp}`, headers: () => asUser('alice') },
  { name: 'get-character', method: 'GET', path: '/api/characters/char-miri', headers: () => asUser('alice') },
  { name: 'get-character-as-other-user', method: 'GET', path: '/api/characters/char-miri', headers: () => asUser('bob') },
  { name: 'get-character-missing', method: 'GET', path: '/api/characters/char-nonexistent', headers: () => asUser('alice') },
  { name: 'update-character-without-version', method: 'PUT', path: '/api/characters/char-miri', headers: () => asUser('alice'), body: { data: { name: 'Miri II' } } },
  { name: 'update-character', method: 'PUT', path: '/api/characters/char-miri', headers: () => asUser('alice'), body: { version: 1, data: { id: 'char-miri', name: 'Miri Brightwood', speciesId: 'elf', classes: [{ classId: 'wizard', level: 4 }] } } },
  // The same write replayed by a client that never saw version 2 — the other-device case the
  // whole `version` column exists for. It must be refused with the server's copy, not merged.
  { name: 'update-character-stale-version', method: 'PUT', path: '/api/characters/char-miri', headers: () => asUser('alice'), body: { version: 1, data: { name: 'Clobbered' } } },
  { name: 'update-character-unauthenticated', method: 'PUT', path: '/api/characters/char-miri', body: { version: 2, data: { name: 'Hijacked' } } },
  { name: 'import-characters', method: 'POST', path: '/api/characters/import', headers: () => asUser('alice'), body: { characters: [{ id: 'char-imported', data: { name: 'Imported' } }, { id: 'char-miri', data: { name: 'Already here' } }, { id: 'bad id', data: {} }] } },
  { name: 'import-characters-not-an-array', method: 'POST', path: '/api/characters/import', headers: () => asUser('alice'), body: { characters: 'nope' } },
  { name: 'delete-character', method: 'DELETE', path: '/api/characters/char-miri', headers: () => asUser('alice') },
  { name: 'delete-character-again', method: 'DELETE', path: '/api/characters/char-miri', headers: () => asUser('alice') },
  { name: 'get-character-after-delete', method: 'GET', path: '/api/characters/char-miri', headers: () => asUser('alice') },
  { name: 'recreate-deleted-character', method: 'POST', path: '/api/characters', headers: () => asUser('alice'), body: { id: 'char-miri', data: { name: 'Resurrected' } } },
  { name: 'characters-after-delete', method: 'GET', path: '/api/characters', headers: () => asUser('alice') },

  // Phase 5: the seat link and the party view. Attaching a character to a campaign is what shares
  // it with that campaign's members, so these steps are the read boundary in both directions —
  // `ellis` is a member (they claimed a seat anonymously above), `bob` is not.
  { name: 'campaign-characters-unauthenticated', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/characters` },
  { name: 'campaign-characters-as-non-member', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/characters`, headers: () => asUser('bob') },
  { name: 'campaign-characters', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/characters`, headers: () => asUser('alice') },
  { name: 'campaign-characters-as-member', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/characters`, headers: () => asUser('ellis') },
  // The widened read: a seated character is readable by a campaign-mate, an unattached one is not —
  // and "is not" stays 404, because a 403 would confirm the id exists.
  { name: 'get-seated-character-as-campaign-mate', method: 'GET', path: '/api/characters/char-dane', headers: () => asUser('ellis') },
  { name: 'get-unattached-character-as-campaign-mate', method: 'GET', path: '/api/characters/char-imported', headers: () => asUser('ellis') },
  // A campaign-mate may read a seated sheet but never write it.
  { name: 'update-seated-character-as-campaign-mate', method: 'PUT', path: '/api/characters/char-dane', headers: () => asUser('ellis'), body: { version: 1, data: { name: 'Not yours' } } },

  { name: 'seat-character-without-campaign-id', method: 'PUT', path: '/api/characters/char-imported/seat', headers: () => asUser('alice'), body: {} },
  // Someone else's character is 404 to seat, exactly as it is to read.
  { name: 'seat-character-not-owned', method: 'PUT', path: '/api/characters/char-imported/seat', headers: () => asUser('bob'), body: () => ({ campaign_id: ctx.camp }) },
  // Owning the character is not enough: seating it into a campaign still needs membership of it.
  { name: 'create-character-for-bob', method: 'POST', path: '/api/characters', headers: () => asUser('bob'), body: { id: 'char-bobs-own', data: { name: "Bob's own" } } },
  { name: 'seat-character-foreign-campaign', method: 'PUT', path: '/api/characters/char-bobs-own/seat', headers: () => asUser('bob'), body: () => ({ campaign_id: ctx.camp }) },
  { name: 'seat-character', method: 'PUT', path: '/api/characters/char-imported/seat', headers: () => asUser('alice'), body: () => ({ campaign_id: ctx.camp, player_id: ctx.dane }) },
  { name: 'campaign-characters-after-seating', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/characters`, headers: () => asUser('ellis') },
  // Taking a character off the campaign takes it out of the seat too: a seat only exists inside one.
  { name: 'unseat-character', method: 'PUT', path: '/api/characters/char-imported/seat', headers: () => asUser('alice'), body: { campaign_id: null } },
  { name: 'get-unseated-character-as-campaign-mate', method: 'GET', path: '/api/characters/char-imported', headers: () => asUser('ellis') },

  // The campaign's content agreement. Owner-only, and the ids are stored without interpretation.
  { name: 'set-campaign-sources', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: { allowed_source_ids: ['phb-2024', 'basic-rules-2024', 'phb-2024'] } },
  { name: 'set-campaign-sources-invalid', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: { allowed_source_ids: ['Not A Source Id'] } },
  { name: 'set-campaign-sources-not-an-array', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: { allowed_source_ids: 'phb-2024' } },
  { name: 'update-campaign-nothing-to-update', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: {} },
  { name: 'set-campaign-sources-as-member', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('ellis'), body: { allowed_source_ids: [] } },
  { name: 'set-campaign-system', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: { system_id: 'dnd-5e' } },
  { name: 'set-campaign-system-invalid', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: { system_id: 'NOT VALID' } },
  // Unknown flags are dropped rather than stored: a permission nobody can see is one nobody can
  // revoke either.
  { name: 'set-campaign-default-permissions', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: { default_member_permissions: { can_edit_self: true, players_self_delete: true, not_a_real_flag: true } } },
  { name: 'set-campaign-default-permissions-not-an-object', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: { default_member_permissions: 'can_edit_self' } },
  { name: 'set-campaign-default-invite-permissions', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice'), body: { default_invite_permissions: { can_manage_groups: true } } },
  { name: 'set-campaign-defaults-as-member', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('ellis'), body: { default_member_permissions: { can_delete_players: true } } },
  { name: 'campaigns-carry-allowed-sources', method: 'GET', path: '/api/campaigns', headers: () => asUser('alice') },

  // What a joiner is granted. A second campaign, because the first one's members joined before it
  // had any defaults — and that is the point: the defaults apply on the way in, not retroactively.
  { name: 'create-campaign-with-defaults', method: 'POST', path: '/api/campaigns', headers: () => asUser('alice'), body: { name: 'Defaults Camp' }, capture: (j) => { ctx.camp2 = j.campaign?.id; } },
  { name: 'set-defaults-on-camp2', method: 'PUT', path: () => `/api/campaigns/${ctx.camp2}`, headers: () => asUser('alice'), body: { default_member_permissions: { can_edit_self: true }, default_invite_permissions: { can_manage_groups: true } } },
  // No `permissions` in the body, so the link takes the campaign's default for invited arrivals.
  { name: 'create-invite-inheriting-defaults', method: 'POST', path: () => `/api/campaigns/${ctx.camp2}/invites`, headers: () => asUser('alice'), body: {}, capture: (j) => { ctx.invite2Token = j.invite?.token; ctx.invite2Id = j.invite?.id; if (ctx.invite2Token) masked.push(ctx.invite2Token); } },
  // An explicit blob overrides it, including the empty one that means "grant nothing".
  { name: 'create-invite-with-own-permissions', method: 'POST', path: () => `/api/campaigns/${ctx.camp2}/invites`, headers: () => asUser('alice'), body: { permissions: { can_create_players: true } }, capture: (j) => { ctx.invite3Token = j.invite?.token; if (ctx.invite3Token) masked.push(ctx.invite3Token); } },
  { name: 'join-camp2-on-inherited-invite', method: 'POST', path: '/api/invites/join', headers: () => asUser('bob'), body: () => ({ token: ctx.invite2Token }) },
  { name: 'join-camp2-on-explicit-invite', method: 'POST', path: '/api/invites/join', headers: () => asUser('ellis'), body: () => ({ token: ctx.invite3Token }) },
  { name: 'camp2-members-carry-granted-permissions', method: 'GET', path: () => `/api/campaigns/${ctx.camp2}/members`, headers: () => asUser('alice') },
  // Joining by id is the other door in, and it takes the campaign's member default too.
  { name: 'join-camp2-by-id', method: 'POST', path: () => `/api/campaigns/${ctx.camp2}/members`, headers: () => asUser('dara') },
  { name: 'camp2-members-after-direct-join', method: 'GET', path: () => `/api/campaigns/${ctx.camp2}/members`, headers: () => asUser('alice'), capture: (j) => { ctx.camp2Owner = j.members?.find((m) => m.role === 'owner')?.id; ctx.camp2Dara = j.members?.find((m) => m.user_id === ctx.dara)?.id; } },

  // The owner's two removals. Neither destroys anything: a removed member's seat goes back to
  // unclaimed, and a character taken off the table is only unshared.
  { name: 'remove-member-as-member', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp2}/members/${ctx.camp2Dara}`, headers: () => asUser('bob') },
  { name: 'remove-owner-member', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp2}/members/${ctx.camp2Owner}`, headers: () => asUser('alice') },
  { name: 'remove-member', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp2}/members/${ctx.camp2Dara}`, headers: () => asUser('alice') },
  { name: 'remove-member-again', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp2}/members/${ctx.camp2Dara}`, headers: () => asUser('alice') },
  { name: 'camp2-members-after-removal', method: 'GET', path: () => `/api/campaigns/${ctx.camp2}/members`, headers: () => asUser('alice') },
  { name: 'removed-member-cannot-read-camp2', method: 'GET', path: () => `/api/campaigns/${ctx.camp2}/members`, headers: () => asUser('dara') },

  { name: 'seat-character-in-camp2', method: 'PUT', path: '/api/characters/char-imported/seat', headers: () => asUser('alice'), body: () => ({ campaign_id: ctx.camp2 }) },
  { name: 'remove-campaign-character-as-member', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp2}/characters/char-imported`, headers: () => asUser('bob') },
  { name: 'remove-campaign-character', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp2}/characters/char-imported`, headers: () => asUser('alice') },
  { name: 'remove-campaign-character-again', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp2}/characters/char-imported`, headers: () => asUser('alice') },
  // The document is untouched by either removal — it is still its owner's, merely unattached.
  { name: 'character-after-campaign-removal', method: 'GET', path: '/api/characters/char-imported', headers: () => asUser('alice') },

  { name: 'delete-camp2', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp2}`, headers: () => asUser('alice') },

  { name: 'delete-player', method: 'DELETE', path: () => `/api/players/${ctx.cora}`, headers: () => asUser('alice') },
  { name: 'delete-campaign', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser('alice') },
  { name: 'campaigns-after-delete', method: 'GET', path: '/api/campaigns', headers: () => asUser('alice') },
  // Deleting the campaign gives up the seat; the sheet belongs to its user and survives detached.
  { name: 'characters-after-campaign-delete', method: 'GET', path: '/api/characters', headers: () => asUser('alice') },

  // Phase 1b gate. The first four are the forgery the old server accepted: naming a user id in a
  // header or query string used to *be* the login. All four must now come back 401.
  { name: 'me-unauthenticated', method: 'GET', path: '/api/me' },
  { name: 'me-forged-header', method: 'GET', path: '/api/me', headers: () => ({ 'X-User-Id': String(ctx.alice) }) },
  { name: 'me-forged-query', method: 'GET', path: () => `/api/me?user_id=${ctx.alice}` },
  { name: 'campaigns-forged-header', method: 'GET', path: '/api/campaigns', headers: () => ({ 'X-User-Id': String(ctx.alice) }) },
  { name: 'me-invented-session', method: 'GET', path: '/api/me', headers: { Cookie: 'dnd_session=not-a-real-session-id' } },
  { name: 'me-authenticated', method: 'GET', path: '/api/me', headers: () => asUser('alice') },
  { name: 'discord-potential-links', method: 'GET', path: '/api/discord/potential-links', headers: () => asUser('alice') },

  // Signing out must kill the session server-side, not merely drop the cookie: the jar keeps
  // bob's pre-logout cookie (logout's Set-Cookie is a clear, which is never stored) and replays it.
  { name: 'logout-bob', method: 'POST', path: '/auth/logout', headers: () => asUser('bob') },
  { name: 'me-with-revoked-cookie', method: 'GET', path: '/api/me', headers: () => asUser('bob') },
  { name: 'logout-without-session', method: 'POST', path: '/auth/logout' },
  { name: 'logout-all-unauthenticated', method: 'POST', path: '/auth/logout-all' },
  { name: 'logout-all-alice', method: 'POST', path: '/auth/logout-all', headers: () => asUser('alice') },
  { name: 'me-after-logout-all', method: 'GET', path: '/api/me', headers: () => asUser('alice') },
];

const resolve = (v) => (typeof v === 'function' ? v() : v);

async function waitForServer(child) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('server did not become healthy in 30s');
}

async function runStep(step) {
  const path = resolve(step.path);
  const headers = { 'Content-Type': 'application/json', ...(resolve(step.headers) || {}) };
  const body = resolve(step.body);
  const res = await fetch(base + path, {
    method: step.method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: step.redirect || 'manual',
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.length > 200 ? `${text.slice(0, 200)}…` : text;
  }
  if (step.capture && parsed && typeof parsed === 'object') step.capture(parsed);
  if (step.blank) for (const p of step.blank) blankPath(parsed, p);

  const setCookie = sessionCookieFrom(res);
  // A cleared cookie (empty value) is not a session and must not overwrite the jar.
  if (step.jar && setCookie && !setCookie.startsWith(`${SESSION_COOKIE}=;`)) {
    cookieJar[step.jar] = setCookie.split(';')[0];
  }

  const out = { name: step.name, request: mask(`${step.method} ${path}`), status: res.status, body: redact(parsed) };
  if (setCookie) out.set_cookie = normaliseSetCookie(setCookie);
  return out;
}

/** Strip absolute paths and line numbers so a stack trace does not fail the diff. */
function normaliseLog(line) {
  return line
    .replaceAll(serverDir.replaceAll('\\', '/'), '<server>')
    .replaceAll(serverDir, '<server>')
    .replace(/:\d+:\d+/g, ':<pos>')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '<iso>')
    .trim();
}

async function main() {
  const dbDir = mkdtempSync(join(tmpdir(), 'dnd-smoke-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${join(dbDir, 'smoke.db').replaceAll('\\', '/')}`,
      PORT: String(port),
      NODE_ENV: 'test',
      // The scenario is longer than either production rate-limit budget, and the limiters are
      // not what it is testing. Raising them here is what lets the step list keep growing.
      RATE_LIMIT_MAX: '100000',
      AUTH_RATE_LIMIT_MAX: '100000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logLines = [];
  child.stdout.on('data', (d) => { for (const l of String(d).split('\n')) if (l.trim()) logLines.push(l); });
  child.stderr.on('data', (d) => { for (const l of String(d).split('\n')) if (l.trim()) logLines.push(l); });

  const results = [];
  try {
    await waitForServer(child);
    for (const step of steps) {
      results.push(await runStep(step));
    }
  } finally {
    child.kill();
    await new Promise((r) => child.once('exit', r));
    try { rmSync(dbDir, { recursive: true, force: true }); } catch { /* windows file lock */ }
  }

  // Only the first line of a logged error is stable; stack frames move with every edit.
  const errors = logLines
    .filter((l) => /error|warn|Error:/i.test(l))
    .map((l) => normaliseLog(l.split('\n')[0]))
    .filter((l) => !l.startsWith('at '));

  const snapshot = { requests: results.length, results, errors: [...new Set(errors)].sort() };
  const serialised = `${JSON.stringify(snapshot, null, 2)}\n`;

  if (write) {
    mkdirSync(dirname(snapshotPath), { recursive: true });
    writeFileSync(snapshotPath, serialised);
    console.log(`wrote baseline: ${results.length} requests, ${snapshot.errors.length} distinct log errors`);
    return;
  }

  let baseline;
  try {
    // Normalised because git checks the snapshot out with CRLF wherever core.autocrlf=true, and a
    // byte comparison then reports every line as drift on a tree that has not changed.
    // .gitattributes pins eol=lf as well; this is the half that survives a mis-configured clone.
    baseline = readFileSync(snapshotPath, 'utf8').replaceAll('\r\n', '\n');
  } catch {
    console.error(`no baseline at ${snapshotPath} — run with --write first`);
    process.exitCode = 1;
    return;
  }

  if (baseline === serialised) {
    console.log(`smoke OK: ${results.length} requests match the baseline`);
    return;
  }

  const a = baseline.split('\n');
  const b = serialised.split('\n');
  console.error('SMOKE DRIFT — response snapshot differs from baseline:');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) console.error(`  line ${i + 1}\n    baseline: ${a[i] ?? '<eof>'}\n    current:  ${b[i] ?? '<eof>'}`);
  }
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
