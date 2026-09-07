// Play sessions and the table's shared dice feed.
//
// The rules worth an end-to-end check are all refusals: only the DM (or a member the DM granted
// `can_manage_sessions`) may start or end one, a campaign may have only one open at a time, a
// closed session takes no more rolls, and nobody outside the campaign can read the feed or write
// to it. Each of those fails silently in a way that looks like nothing at all — a second feed
// nobody is reading, or a stranger quietly logging dice into someone else's game.
//
//   node server/test/gameSessions.mjs      (npm run test:sessions)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SESSIONS_PORT || 3993);
const base = `http://127.0.0.1:${port}`;

const jars = {};

async function call(who, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(jars[who] ? { Cookie: jars[who] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const setCookie = (res.headers.getSetCookie?.() ?? []).find((line) => line.startsWith('dnd_session='));
  if (setCookie && !setCookie.startsWith('dnd_session=;')) jars[who] = setCookie.split(';')[0];
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });

async function signUp(who, username) {
  await call(who, 'POST', '/auth/signup', { username, password: 'correct horse battery staple' });
}

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

const roll = (label, total) => ({
  label,
  notation: '1d20+5',
  total,
  detail: 'd20 check',
  results: [{ value: total - 5, sides: 20 }],
});

async function setUpTable() {
  await signUp('gm', 'sessions-gm');
  await signUp('player', 'sessions-player');
  await signUp('helper', 'sessions-helper');
  await signUp('stranger', 'sessions-stranger');

  const campaign = await call('gm', 'POST', '/api/campaigns', { name: 'The Long Winter' });
  const campaignId = campaign.json.campaign?.id;
  const invite = await call('gm', 'POST', `/api/campaigns/${campaignId}/invites`, { max_uses: 0 });
  const token = invite.json.invite?.token;
  await call('player', 'POST', '/api/invites/join', { token });
  await call('helper', 'POST', '/api/invites/join', { token });
  return campaignId;
}

async function scenario() {
  const campaignId = await setUpTable();

  // ---- who may start one --------------------------------------------------
  const strangerList = await call('stranger', 'GET', `/api/game-sessions?campaign_id=${campaignId}`);
  check('a non-member cannot list sessions', strangerList.status === 403, strangerList.status);

  const playerStart = await call('player', 'POST', '/api/game-sessions', { campaign_id: campaignId, name: 'Session 1' });
  check('a plain member cannot start a session', playerStart.status === 403, `${playerStart.status} ${playerStart.json.error}`);

  const started = await call('gm', 'POST', '/api/game-sessions', { campaign_id: campaignId, name: 'Session 1' });
  check('the owner can start one', started.status === 200 && started.json.session?.is_open === true, started.status);
  const sessionId = started.json.session?.id;

  const second = await call('gm', 'POST', '/api/game-sessions', { campaign_id: campaignId });
  check('a second open session is refused', second.status === 409 && second.json.error === 'session_already_open', `${second.status} ${second.json.error}`);
  check('the refusal carries the one already open', second.json.session?.id === sessionId, second.json.session?.id);

  // ---- who may roll into it ----------------------------------------------
  const playerRoll = await call('player', 'POST', `/api/game-sessions/${sessionId}/rolls`, {
    ...roll('Stealth', 18),
    character_name: 'Nera',
  });
  check('any member may add a roll', playerRoll.status === 200, `${playerRoll.status} ${playerRoll.json.error}`);
  check('the roll carries who rolled it', playerRoll.json.roll?.character_name === 'Nera', playerRoll.json.roll?.character_name);
  check('and the account that owns it', playerRoll.json.roll?.username === 'sessions-player', playerRoll.json.roll?.username);
  check('the dice survive the trip', playerRoll.json.roll?.results?.[0]?.sides === 20, JSON.stringify(playerRoll.json.roll?.results));

  const strangerRoll = await call('stranger', 'POST', `/api/game-sessions/${sessionId}/rolls`, roll('Sneaky', 20));
  check('a non-member cannot roll into the feed', strangerRoll.status === 403, strangerRoll.status);

  const badRoll = await call('gm', 'POST', `/api/game-sessions/${sessionId}/rolls`, { notation: '1d20', total: 7 });
  check('a roll with no label is refused', badRoll.status === 400 && badRoll.json.error === 'label_required', `${badRoll.status} ${badRoll.json.error}`);

  await call('gm', 'POST', `/api/game-sessions/${sessionId}/rolls`, roll('Initiative', 14));

  // ---- the feed the whole table reads -------------------------------------
  const feed = await call('player', 'GET', `/api/game-sessions/${sessionId}/rolls`);
  check('the feed carries every roll', feed.json.rolls?.length === 2, feed.json.rolls?.length);
  check('the feed is oldest first', feed.json.rolls?.[0]?.label === 'Stealth', feed.json.rolls?.[0]?.label);

  const after = feed.json.rolls?.[0]?.id;
  const tail = await call('player', 'GET', `/api/game-sessions/${sessionId}/rolls?after=${after}`);
  check('polling with `after` returns only what is new', tail.json.rolls?.length === 1, tail.json.rolls?.length);

  const strangerFeed = await call('stranger', 'GET', `/api/game-sessions/${sessionId}/rolls`);
  check('a non-member cannot read the feed', strangerFeed.status === 403, strangerFeed.status);

  // ---- a granted member runs the table ------------------------------------
  const members = await call('gm', 'GET', `/api/campaigns/${campaignId}/members`);
  const helperRow = members.json.members?.find((row) => row.user_name === 'sessions-helper');
  const granted = await call('gm', 'PATCH', `/api/campaigns/${campaignId}/members/${helperRow?.id}/permissions`, {
    permissions: { can_manage_sessions: true },
  });
  check('the owner can grant session management', granted.status === 200, `${granted.status} ${granted.json.error}`);

  const helperEnd = await call('helper', 'POST', `/api/game-sessions/${sessionId}/end`);
  check('a member granted session management can end one', helperEnd.status === 200, `${helperEnd.status} ${helperEnd.json.error}`);
  check('ending closes it', helperEnd.json.session?.is_open === false, helperEnd.json.session?.is_open);

  // ---- a closed session is a record, not a place to write -----------------
  const afterEnd = await call('player', 'POST', `/api/game-sessions/${sessionId}/rolls`, roll('Too late', 3));
  check('a closed session takes no more rolls', afterEnd.status === 409 && afterEnd.json.error === 'session_closed', `${afterEnd.status} ${afterEnd.json.error}`);

  const kept = await call('player', 'GET', `/api/game-sessions/${sessionId}/rolls`);
  check('its rolls survive it', kept.json.rolls?.length === 2, kept.json.rolls?.length);

  const restart = await call('gm', 'POST', '/api/game-sessions', { campaign_id: campaignId, name: 'Session 2' });
  check('a new session can start once the last one ended', restart.status === 200, restart.status);

  const listed = await call('player', 'GET', `/api/game-sessions?campaign_id=${campaignId}`);
  check('both sessions are listed, newest first', listed.json.sessions?.[0]?.name === 'Session 2', JSON.stringify(listed.json.sessions?.map((s) => s.name)));
  check('a plain member is told they cannot manage them', listed.json.can_manage === false, listed.json.can_manage);

  const missing = await call('gm', 'GET', '/api/game-sessions/999999/rolls');
  check('an unknown session is 404', missing.status === 404, missing.status);
}

async function main() {
  const dbDir = mkdtempSync(join(tmpdir(), 'dnd-sessions-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${join(dbDir, 'sessions.db').replaceAll('\\', '/')}`,
      PORT: String(port),
      NODE_ENV: 'test',
      RATE_LIMIT_MAX: '10000',
      AUTH_RATE_LIMIT_MAX: '10000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(String(d)));

  try {
    await waitForServer(child);
    await scenario();
  } finally {
    child.kill();
    await new Promise((r) => setTimeout(r, 200));
    rmSync(dbDir, { recursive: true, force: true });
  }

  const failed = checks.filter((entry) => !entry.ok);
  for (const entry of checks) {
    console.log(`${entry.ok ? 'ok  ' : 'FAIL'} ${entry.name}${entry.ok || entry.detail === '' ? '' : `  (${entry.detail})`}`);
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (failed.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
