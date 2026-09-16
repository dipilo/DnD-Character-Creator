// The Discord bot's read surface (/api/bot/*): the key gates it, the Discord id picks the user,
// and character visibility is the same decision the browser routes make.
//
// There is no route that links a Discord id to a password account without a real OAuth
// round-trip, so the link is written into the test database directly — the same column
// /auth/discord/callback writes.
//
//   node server/test/botApi.mjs      (npm run test:bot)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(serverDir, 'package.json'));
const { createClient } = require('@libsql/client');

const port = Number(process.env.BOT_API_PORT || 3993);
const base = `http://127.0.0.1:${port}`;
const BOT_KEY = 'test-bot-key-0123456789';
const PLAYER_DISCORD = '123456789012345678';
const STRANGER_DISCORD = '987654321098765432';

const sheet = {
  id: 'c1a2b3d4-0000-4000-8000-0000000000b0',
  name: 'Tessaly Vane',
  speciesId: 'human',
  classes: [{ classId: 'rogue', level: 5 }],
  abilityScores: { strength: 8, dexterity: 16, constitution: 12, intelligence: 13, wisdom: 11, charisma: 14 },
  abilityScoreBonuses: { dexterity: 2 },
  spells: [],
  equipment: [],
  feats: [],
  features: [],
  proficiencies: { skills: ['Stealth', 'Perception'], tools: [], languages: [], armor: [], weapons: [], saves: ['dexterity', 'intelligence'] },
  hp: { current: 33, maximum: 38, temporary: 0 },
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

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
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function bot(path, { key = BOT_KEY, discordId = PLAYER_DISCORD } = {}) {
  const headers = {};
  if (key !== null) headers['X-Bot-Key'] = key;
  if (discordId !== null) headers['X-Discord-Id'] = discordId;
  const res = await fetch(base + path, { headers });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });

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

async function scenario(dbUrl) {
  await call('player', 'POST', '/auth/signup', { username: 'bot-player', password: 'correct horse battery staple' });
  await call('other', 'POST', '/auth/signup', { username: 'bot-other', password: 'correct horse battery staple' });
  const db = createClient({ url: dbUrl });
  await db.execute({ sql: 'UPDATE users SET discord_id = ? WHERE username = ?', args: [PLAYER_DISCORD, 'bot-player'] });
  db.close();

  const created = await call('player', 'POST', '/api/characters', { id: sheet.id, data: sheet });
  check('the player has a character', created.status === 201, created.status);
  const foreign = await call('other', 'POST', '/api/characters', { data: { ...sheet, id: undefined, name: 'Not Yours' } });
  const foreignId = foreign.json?.character?.id;
  check('another account has one too', foreign.status === 201 && Boolean(foreignId), foreign.status);

  // ---- the key is the whole gate ------------------------------------------
  const noKey = await bot('/api/bot/me', { key: null });
  check('no key is 401', noKey.status === 401, noKey.status);
  const wrongKey = await bot('/api/bot/me', { key: 'nope' });
  check('a wrong key is 401', wrongKey.status === 401, wrongKey.status);
  const noId = await bot('/api/bot/me', { discordId: null });
  check('a keyed call without a Discord id is 400', noId.status === 400, noId.status);
  const unlinked = await bot('/api/bot/me', { discordId: STRANGER_DISCORD });
  check('an unlinked Discord id is 403 discord_not_linked', unlinked.status === 403 && unlinked.json?.error === 'discord_not_linked', `${unlinked.status} ${unlinked.json?.error}`);

  // ---- a linked user reads their own things --------------------------------
  const me = await bot('/api/bot/me');
  check('a linked id resolves to its account', me.status === 200 && me.json?.user?.username === 'bot-player', JSON.stringify(me.json));
  const list = await bot('/api/bot/characters');
  check('the list holds the player\'s character', list.json?.characters?.length === 1 && list.json.characters[0].id === sheet.id, JSON.stringify(list.json).slice(0, 200));
  check('the list is summaries, not documents', list.json?.characters?.[0]?.data === undefined);
  const show = await bot(`/api/bot/characters/${sheet.id}`);
  check('the document comes back whole', show.json?.character?.data?.abilityScores?.dexterity === 16, JSON.stringify(show.json).slice(0, 200));
  check('the owner is told so', show.json?.character?.is_owner === true);

  // ---- and nobody else's -----------------------------------------------------
  const other = await bot(`/api/bot/characters/${foreignId}`);
  check('another account\'s private character is 404, not 403', other.status === 404, other.status);
  const junk = await bot('/api/bot/characters/not%20an%20id!');
  check('a malformed id is 404', junk.status === 404, junk.status);
}

async function main() {
  const dbDir = mkdtempSync(join(tmpdir(), 'dnd-bot-'));
  const dbUrl = `file:${join(dbDir, 'bot.db').replaceAll('\\', '/')}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: dbUrl,
      PORT: String(port),
      NODE_ENV: 'test',
      BOT_API_KEY: BOT_KEY,
      RATE_LIMIT_MAX: '10000',
      AUTH_RATE_LIMIT_MAX: '10000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', (d) => process.stderr.write(String(d)));

  try {
    await waitForServer(child);
    await scenario(dbUrl);
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
