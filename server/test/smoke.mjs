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
const asUser = (id) => ({ 'X-User-Id': String(id) });

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
  { name: 'signup-alice', method: 'POST', path: '/auth/signup', body: { username: 'alice', password: 'pw-alice' }, capture: (j) => { ctx.alice = j.user?.id; } },
  { name: 'signup-alice-again', method: 'POST', path: '/auth/signup', body: { username: 'alice', password: 'other' } },
  { name: 'login-alice', method: 'POST', path: '/auth/login', body: { username: 'alice', password: 'pw-alice' } },
  { name: 'login-alice-wrong-password', method: 'POST', path: '/auth/login', body: { username: 'alice', password: 'nope' } },
  { name: 'login-alice-no-password', method: 'POST', path: '/auth/login', body: { username: 'alice' } },
  { name: 'signup-bob', method: 'POST', path: '/auth/signup', body: { username: 'bob', password: 'pw-bob' }, capture: (j) => { ctx.bob = j.user?.id; } },

  { name: 'get-user', method: 'GET', path: () => `/api/users/${ctx.alice}` },
  { name: 'get-user-missing', method: 'GET', path: '/api/users/9999' },

  { name: 'create-campaign-unauthenticated', method: 'POST', path: '/api/campaigns', body: { name: 'Nope' } },
  { name: 'create-campaign', method: 'POST', path: '/api/campaigns', headers: () => asUser(ctx.alice), body: { name: 'Test Camp' }, capture: (j) => { ctx.camp = j.campaign?.id; } },
  { name: 'list-campaigns', method: 'GET', path: '/api/campaigns', headers: () => asUser(ctx.alice) },
  { name: 'campaign-by-unknown-code', method: 'GET', path: '/api/campaigns/code/not-a-code' },
  { name: 'regenerate-code', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/regenerate-code`, headers: () => asUser(ctx.alice) },
  { name: 'rename-campaign', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser(ctx.alice), body: { name: 'Renamed Camp' } },
  { name: 'rename-campaign-no-name', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser(ctx.alice), body: {} },
  { name: 'rename-campaign-forged-user', method: 'PUT', path: () => `/api/campaigns/${ctx.camp}`, headers: { 'X-User-Id': '4242' }, body: { name: 'Hijacked' } },
  { name: 'campaign-members', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/members`, headers: () => asUser(ctx.alice) },

  { name: 'players-empty', method: 'GET', path: () => `/api/players?campaign_id=${ctx.camp}`, headers: () => asUser(ctx.alice) },
  { name: 'players-without-campaign', method: 'GET', path: '/api/players', headers: () => asUser(ctx.alice) },
  { name: 'create-player-bran', method: 'POST', path: '/api/players', headers: () => asUser(ctx.alice), body: () => ({ campaign_id: ctx.camp, name: 'Bran', timezone: 'EST', notes: '' }), capture: (j) => { ctx.bran = j.player?.id; } },
  { name: 'create-player-cora', method: 'POST', path: '/api/players', headers: () => asUser(ctx.alice), body: () => ({ campaign_id: ctx.camp, name: 'Cora', timezone: 'PST', notes: '' }), capture: (j) => { ctx.cora = j.player?.id; } },
  { name: 'list-players', method: 'GET', path: () => `/api/players?campaign_id=${ctx.camp}`, headers: () => asUser(ctx.alice) },
  { name: 'update-player', method: 'PUT', path: () => `/api/players/${ctx.bran}`, headers: () => asUser(ctx.alice), body: { name: 'Bran the Bold' } },
  { name: 'update-player-missing', method: 'PUT', path: '/api/players/9999', headers: () => asUser(ctx.alice), body: { name: 'Ghost' } },
  { name: 'update-player-unauthenticated', method: 'PUT', path: () => `/api/players/${ctx.bran}`, body: { name: 'Hijacked' } },
  { name: 'reorder-players', method: 'POST', path: '/api/players/reorder', headers: () => asUser(ctx.alice), body: () => ({ ids: [ctx.cora, ctx.bran] }) },
  { name: 'unclaimed-players', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/unclaimed-players`, headers: () => asUser(ctx.alice) },

  { name: 'availability-create', method: 'POST', path: '/api/availability', headers: () => asUser(ctx.alice), body: () => ({ player_id: ctx.bran, start_iso: '2026-09-01T18:00:00.000Z', end_iso: '2026-09-01T22:00:00.000Z' }) },
  { name: 'availability-create-overlapping', method: 'POST', path: '/api/availability', headers: () => asUser(ctx.alice), body: () => ({ player_id: ctx.bran, start_iso: '2026-09-01T21:00:00.000Z', end_iso: '2026-09-02T01:00:00.000Z' }), capture: (j) => { ctx.avail = j.id; } },
  { name: 'availability-create-missing-fields', method: 'POST', path: '/api/availability', headers: () => asUser(ctx.alice), body: () => ({ player_id: ctx.bran }) },
  { name: 'availability-list', method: 'GET', path: () => `/api/availability?player_id=${ctx.bran}&campaign_id=${ctx.camp}`, headers: () => asUser(ctx.alice) },
  { name: 'availability-update', method: 'PUT', path: () => `/api/availability/${ctx.avail}`, headers: () => asUser(ctx.alice), body: { start_iso: '2026-09-01T17:00:00.000Z', end_iso: '2026-09-02T02:00:00.000Z' } },
  { name: 'availability-batch', method: 'POST', path: '/api/availability/batch', headers: () => asUser(ctx.alice), body: () => ({ campaign_id: ctx.camp, operations: [
    { op: 'create', player_id: ctx.cora, start_iso: '2026-09-03T18:00:00.000Z', end_iso: '2026-09-03T23:00:00.000Z' },
    { op: 'delete', id: 9999 },
    { op: 'nonsense' },
  ] }) },
  { name: 'availability-aggregate', method: 'GET', path: () => `/api/availability/aggregate?start=2026-09-01T00:00:00.000Z&end=2026-09-08T00:00:00.000Z&campaign_id=${ctx.camp}`, headers: () => asUser(ctx.alice) },
  { name: 'availability-preview', method: 'POST', path: '/api/availability/preview', headers: () => asUser(ctx.alice), body: { text: 'Free Mondays 6pm-10pm EST', timezone: 'EST' }, blank: ['availability'] },
  { name: 'availability-delete', method: 'DELETE', path: () => `/api/availability/${ctx.avail}`, headers: () => asUser(ctx.alice) },

  { name: 'groups-empty', method: 'GET', path: () => `/api/groups?campaign_id=${ctx.camp}`, headers: () => asUser(ctx.alice) },
  { name: 'create-group', method: 'POST', path: '/api/groups', headers: () => asUser(ctx.alice), body: () => ({ name: 'Table A', campaign_id: ctx.camp, member_ids: [ctx.bran, ctx.cora] }), capture: (j) => { ctx.group = j.group?.id; } },
  { name: 'create-group-not-owner', method: 'POST', path: '/api/groups', headers: () => asUser(ctx.bob), body: () => ({ name: 'Table B', campaign_id: ctx.camp }) },
  { name: 'update-group', method: 'PUT', path: () => `/api/groups/${ctx.group}`, headers: () => asUser(ctx.alice), body: () => ({ name: 'Table A prime', member_ids: [ctx.bran] }) },
  { name: 'group-add-member', method: 'POST', path: () => `/api/groups/${ctx.group}/members`, headers: () => asUser(ctx.alice), body: () => ({ player_id: ctx.cora }) },
  { name: 'group-remove-member', method: 'DELETE', path: () => `/api/groups/${ctx.group}/members/${ctx.cora}`, headers: () => asUser(ctx.alice) },
  { name: 'reorder-groups', method: 'POST', path: '/api/groups/reorder', headers: () => asUser(ctx.alice), body: () => ({ ids: [ctx.group] }) },
  { name: 'suggest-groups', method: 'POST', path: '/api/groups/suggest', headers: () => asUser(ctx.alice), body: () => ({ campaign_id: ctx.camp, numGroups: 2, targetSize: 2 }) },
  { name: 'save-suggestion', method: 'POST', path: '/api/groups/save-suggestion', headers: () => asUser(ctx.alice), body: () => ({ campaign_id: ctx.camp, groups: [{ name: 'Suggested 1', member_ids: [ctx.bran] }] }) },
  { name: 'groups-listed', method: 'GET', path: () => `/api/groups?campaign_id=${ctx.camp}`, headers: () => asUser(ctx.alice) },
  { name: 'delete-group', method: 'DELETE', path: () => `/api/groups/${ctx.group}`, headers: () => asUser(ctx.alice) },

  { name: 'create-invite', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/invites`, headers: () => asUser(ctx.alice), body: { max_uses: 3 }, capture: (j) => { ctx.inviteToken = j.invite?.token; ctx.inviteId = j.invite?.id; if (ctx.inviteToken) masked.push(ctx.inviteToken); } },
  { name: 'invite-preview', method: 'GET', path: () => `/api/invites/${ctx.inviteToken}` },
  { name: 'invite-preview-unknown', method: 'GET', path: '/api/invites/no-such-token' },
  { name: 'invite-challenge', method: 'GET', path: () => `/api/invites/${ctx.inviteToken}/challenge` },
  { name: 'invite-challenge-complete', method: 'POST', path: () => `/api/invites/${ctx.inviteToken}/challenge/complete`, body: { session_id: 'made-up', zoople_score: 999 } },
  { name: 'list-invites', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/invites`, headers: () => asUser(ctx.alice) },
  { name: 'patch-invite', method: 'PATCH', path: () => `/api/invites/${ctx.inviteId}`, headers: () => asUser(ctx.alice), body: { max_uses: 5, challenge_enabled: true } },
  { name: 'patch-invite-not-a-member', method: 'PATCH', path: () => `/api/invites/${ctx.inviteId}`, headers: () => asUser(ctx.bob), body: { max_uses: 99 } },
  { name: 'invite-join', method: 'POST', path: '/api/invites/join', headers: () => asUser(ctx.bob), body: () => ({ token: ctx.inviteToken }) },
  { name: 'invite-join-unknown-token', method: 'POST', path: '/api/invites/join', body: { token: 'no-such-token' } },
  { name: 'members-after-join', method: 'GET', path: () => `/api/campaigns/${ctx.camp}/members`, headers: () => asUser(ctx.alice) },
  { name: 'add-member-already-joined', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/members`, headers: () => asUser(ctx.bob) },
  { name: 'add-self-as-player', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/add-self`, headers: () => asUser(ctx.bob) },
  { name: 'reorder-campaigns', method: 'POST', path: '/api/campaigns/reorder', headers: () => asUser(ctx.alice), body: () => ({ ids: [ctx.camp] }) },

  { name: 'claim-player', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/claim-player`, headers: () => asUser(ctx.bob), body: () => ({ player_id: ctx.cora }) },
  { name: 'set-member-permissions', method: 'PATCH', path: () => `/api/campaigns/${ctx.camp}/members/${ctx.bob}/permissions`, headers: () => asUser(ctx.alice), body: { permissions: { can_edit_self: true } } },
  { name: 'unclaim-player', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/unclaim-player`, headers: () => asUser(ctx.bob), body: () => ({ player_id: ctx.cora }) },
  { name: 'discord-confirm-link', method: 'POST', path: '/api/discord/confirm-link', headers: () => asUser(ctx.bob), body: () => ({ player_id: ctx.cora }) },
  { name: 'leave-campaign', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/leave`, headers: () => asUser(ctx.bob) },
  { name: 'owner-cannot-leave', method: 'POST', path: () => `/api/campaigns/${ctx.camp}/leave`, headers: () => asUser(ctx.alice) },
  { name: 'delete-invite', method: 'DELETE', path: () => `/api/invites/${ctx.inviteId}`, headers: () => asUser(ctx.alice) },

  { name: 'feedback', method: 'POST', path: '/api/feedback', headers: () => asUser(ctx.alice), body: { message: 'smoke test', url: '/campaigns' } },
  { name: 'sheet-columns-missing-id', method: 'POST', path: '/api/sheet-columns', body: {} },
  { name: 'sync-without-campaign', method: 'POST', path: '/api/sync', headers: () => asUser(ctx.alice), body: {} },
  { name: 'sync-invalid-sheet-id', method: 'POST', path: '/api/sync', headers: () => asUser(ctx.alice), body: () => ({ campaign_id: ctx.camp, spreadsheetId: '///' }) },
  { name: 'rebuild-player', method: 'POST', path: () => `/api/rebuild/${ctx.bran}`, headers: () => asUser(ctx.alice) },
  { name: 'rebuild-missing-player', method: 'POST', path: '/api/rebuild/9999', headers: () => asUser(ctx.alice) },

  // Exercises the availability_preview_blocks branch of POST /api/players.
  { name: 'create-player-with-preview-blocks', method: 'POST', path: '/api/players', headers: () => asUser(ctx.alice), body: () => ({ campaign_id: ctx.camp, name: 'Dane', availability_preview_blocks: [{ start_iso: '2026-09-05T18:00:00.000Z', end_iso: '2026-09-05T22:00:00.000Z' }] }) },

  { name: 'delete-player', method: 'DELETE', path: () => `/api/players/${ctx.cora}`, headers: () => asUser(ctx.alice) },
  { name: 'delete-campaign', method: 'DELETE', path: () => `/api/campaigns/${ctx.camp}`, headers: () => asUser(ctx.alice) },
  { name: 'campaigns-after-delete', method: 'GET', path: '/api/campaigns', headers: () => asUser(ctx.alice) },
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
  return { name: step.name, request: mask(`${step.method} ${path}`), status: res.status, body: redact(parsed) };
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
    baseline = readFileSync(snapshotPath, 'utf8');
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
