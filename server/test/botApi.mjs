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
  // A bare `rogue` is what older documents stored; the derived sheet has to find the class anyway.
  // The wizard level is there so the sheet has a save DC to derive.
  classes: [{ classId: 'rogue', level: 4 }, { classId: 'basic-rules-2024-wizard', level: 1, spellsKnown: ['basic-rules-2024-fire-bolt'] }],
  abilityScores: { strength: 8, dexterity: 16, constitution: 12, intelligence: 13, wisdom: 11, charisma: 14 },
  abilityScoreBonuses: { dexterity: 2 },
  spells: [{ spellId: 'basic-rules-2024-burning-hands', prepared: true }],
  equipment: [
    { equipmentId: 'basic-rules-2024-rapier', quantity: 1, equipped: true },
    { equipmentId: 'basic-rules-2024-shortbow', quantity: 1, equipped: false },
  ],
  feats: [],
  features: [],
  proficiencies: { skills: ['Stealth', 'Perception'], tools: [], languages: [], armor: [], weapons: ['Simple weapons', 'Rapiers'], saves: ['dexterity', 'intelligence'] },
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

async function bot(path, { key = BOT_KEY, discordId = PLAYER_DISCORD, body } = {}) {
  const headers = {};
  if (key !== null) headers['X-Bot-Key'] = key;
  if (discordId !== null) headers['X-Discord-Id'] = discordId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { headers, method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const play = (id, body, options = {}) => bot(`/api/bot/characters/${id}/play`, { ...options, body });

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

  // ---- the derived sheet: the app's maths, run here ---------------------------
  const derived = await bot(`/api/bot/characters/${sheet.id}/sheet`);
  check('the derived sheet comes back', derived.status === 200 && derived.json?.sheet?.level === 5, `${derived.status} ${JSON.stringify(derived.json).slice(0, 200)}`);
  const d = derived.json?.sheet ?? {};
  check('proficiency bonus is +3 at 5th', d.proficiencyBonus === 3, d.proficiencyBonus);
  check('bonuses are applied to the scores', d.abilityScores?.dexterity === 18 && d.abilityModifiers?.dexterity === 4, JSON.stringify(d.abilityScores));
  const rapier = (d.attacks ?? []).find((entry) => entry.name === 'Rapier');
  check('an equipped weapon gets a row; finesse picks Dex', rapier?.attackBonus === 7 && rapier.damage === '1d8+4 piercing' && rapier.ability === 'dexterity', JSON.stringify(rapier));
  check('an unequipped weapon does not', !(d.attacks ?? []).some((entry) => entry.name === 'Shortbow'), JSON.stringify((d.attacks ?? []).map((entry) => entry.name)));
  check('the unarmed strike is always there', (d.attacks ?? []).some((entry) => entry.name === 'Unarmed Strike'));
  check('a bare class id still resolves', (d.spellcasting ?? []).some((entry) => entry.className === 'Wizard' && entry.saveDc === 12 && entry.attackBonus === 4), JSON.stringify(d.spellcasting));
  const bolt = (d.spells ?? []).find((entry) => entry.name === 'Fire Bolt');
  check('a cantrip scales to the character level', bolt?.dice === '2d10' && bolt.attackOrSave?.[0]?.kind === 'attack' && bolt.attackBonus === 4, JSON.stringify(bolt));
  const hands = (d.spells ?? []).find((entry) => entry.name === 'Burning Hands');
  check('a levelled spell carries its dice per slot', hands?.prepared === true && hands.diceBySlot?.['1'] === '3d6' && hands.diceBySlot?.['3'] === '5d6' && hands.attackOrSave?.[0]?.ability === 'dexterity' && hands.saveDc === 12, JSON.stringify(hands));
  const foreignSheet = await bot(`/api/bot/characters/${foreignId}/sheet`);
  check('the derived sheet is 404 for a character the caller cannot see', foreignSheet.status === 404, foreignSheet.status);

  // ---- play state: the app's rules, applied here, written under the version -------
  const play0 = await bot(`/api/bot/characters/${sheet.id}/play`);
  check('the play state comes back', play0.status === 200 && play0.json?.state?.hp?.current === 33 && play0.json.can_edit === true, `${play0.status} ${JSON.stringify(play0.json).slice(0, 160)}`);
  check('slot totals are the multiclass pool', JSON.stringify(play0.json?.state?.slots) === JSON.stringify([{ level: 1, total: 2, used: 0 }]), JSON.stringify(play0.json?.state?.slots));
  const versionBefore = play0.json?.version;
  const temp = await play(sheet.id, { action: 'temp_hp', value: 5 });
  const hit = await play(sheet.id, { action: 'damage', amount: 8 });
  check('damage eats temporary hit points first', hit.json?.state?.hp?.current === 30 && hit.json.state.hp.temporary === 0 && temp.status === 200, JSON.stringify(hit.json?.state?.hp));
  check('each write bumps the version', hit.json?.version === versionBefore + 2, `${versionBefore} -> ${hit.json?.version}`);
  const down = await play(sheet.id, { action: 'damage', amount: 99 });
  const natOne = await play(sheet.id, { action: 'death_save', roll: 1 });
  check('a natural 1 is two failures', natOne.json?.state?.deathSaves?.failures === 2 && down.json?.state?.dying === true, JSON.stringify(natOne.json?.state?.deathSaves));
  const up = await play(sheet.id, { action: 'heal', amount: 4 });
  check('healing above 0 clears the saves', up.json?.state?.hp?.current === 4 && up.json.state.deathSaves.failures === 0, JSON.stringify(up.json?.state));
  await play(sheet.id, { action: 'slot', level: 1 });
  const second = await play(sheet.id, { action: 'slot', level: 1 });
  const third = await play(sheet.id, { action: 'slot', level: 1 });
  check('spending past the last slot is refused', second.json?.state?.slots?.[0]?.used === 2 && third.status === 400 && third.json?.error === 'no_slot_left', `${third.status} ${third.json?.error}`);
  const cast = await play(sheet.id, { action: 'cast', spellId: 'basic-rules-2024-burning-hands' });
  check('a cast with no slot left is refused', cast.status === 400 && cast.json?.error === 'no_slot_left', `${cast.status} ${cast.json?.error}`);
  await play(sheet.id, { action: 'slot', level: 1, delta: -2 });
  const hold = await play(sheet.id, { action: 'cast', spellId: 'basic-rules-2024-burning-hands' });
  check('a cast spends the slot (and Burning Hands takes no concentration)', hold.json?.state?.concentration === null && hold.json?.state?.slots?.[0]?.used === 1, `${hold.status} ${JSON.stringify(hold.json?.state?.concentration)}`);
  const rope = await play(sheet.id, { action: 'item', item: 'rope, hempen (50 feet)', delta: 1 });
  check('an item resolves by name into the pack', rope.json?.state?.equipment?.some((entry) => entry.name === 'Rope, hempen (50 feet)' && entry.quantity === 1), JSON.stringify(rope.json?.state?.equipment));
  const broke = await play(sheet.id, { action: 'coins', unit: 'gp', delta: -1 });
  check('spending coins you do not have is refused', broke.status === 400 && broke.json?.error === 'not_enough_coins', `${broke.status} ${broke.json?.error}`);
  const rest = await play(sheet.id, { action: 'rest', kind: 'long' });
  check('a long rest restores hit points and slots', rest.json?.state?.hp?.current === 38 && rest.json.state.slots[0].used === 0, JSON.stringify(rest.json?.state?.hp));
  const unknown = await play(sheet.id, { action: 'teleport' });
  check('an action outside the table is 400', unknown.status === 400 && unknown.json?.error === 'unknown_action', `${unknown.status} ${unknown.json?.error}`);
  const doc = await bot(`/api/bot/characters/${sheet.id}`);
  check('the browser sees the same document', doc.json?.character?.data?.hp?.current === 38 && doc.json.character.version === rest.json?.version, `${doc.json?.character?.version} vs ${rest.json?.version}`);
  const foreignPlay = await play(foreignId, { action: 'heal', amount: 1 });
  check('writing to a character the caller cannot see is 404', foreignPlay.status === 404, foreignPlay.status);

  // ---- and nobody else's -----------------------------------------------------
  const other = await bot(`/api/bot/characters/${foreignId}`);
  check('another account\'s private character is 404, not 403', other.status === 404, other.status);
  const junk = await bot('/api/bot/characters/not%20an%20id!');
  check('a malformed id is 404', junk.status === 404, junk.status);

  // ---- campaigns: the table's calendar, as the member ------------------------
  const noCampaigns = await bot('/api/bot/campaigns');
  check('a member of nothing has an empty campaign list', noCampaigns.status === 200 && noCampaigns.json?.campaigns?.length === 0, JSON.stringify(noCampaigns.json));
  const table = await call('other', 'POST', '/api/campaigns', { name: 'Bot Table' });
  const campaignId = table.json?.campaign?.id;
  check('another account owns a campaign', Boolean(campaignId), JSON.stringify(table.json).slice(0, 120));
  const hidden = await bot(`/api/bot/campaigns/${campaignId}`);
  check('a campaign the caller is not in is 404', hidden.status === 404, hidden.status);
  const joined = await call('player', 'POST', `/api/campaigns/${campaignId}/add-self`, {});
  check('the player takes a seat', joined.status === 200 && Boolean(joined.json?.player?.id), JSON.stringify(joined.json).slice(0, 120));
  const listed = await bot('/api/bot/campaigns');
  check('the campaign lists with role and seat', listed.json?.campaigns?.[0]?.id === campaignId && listed.json.campaigns[0].role === 'player' && listed.json.campaigns[0].player_id === joined.json.player.id && listed.json.campaigns[0].member_count === 2, JSON.stringify(listed.json));
  const detail = await bot(`/api/bot/campaigns/${campaignId}`);
  check('the table names its members with Discord ids', detail.status === 200 && detail.json?.members?.length === 2 && detail.json.members.some((m) => m.discord_id === PLAYER_DISCORD) && detail.json.members[0].role === 'owner', JSON.stringify(detail.json?.members));

  const nothing = await bot(`/api/bot/campaigns/${campaignId}/availability`, { body: { text: 'no idea' } });
  check('text that parses to nothing is 400 nothing_parsed', nothing.status === 400 && nothing.json?.error === 'nothing_parsed', `${nothing.status} ${nothing.json?.error}`);
  const wrote = await bot(`/api/bot/campaigns/${campaignId}/availability`, { body: { text: 'every Monday and Wednesday 7pm-11pm', timezone: 'Europe/London' } });
  check('free text writes blocks against the caller\'s seat', wrote.status === 200 && wrote.json?.written?.length >= 4 && wrote.json.player_id === joined.json.player.id, JSON.stringify(wrote.json).slice(0, 200));
  const monday = new Date(wrote.json.written[0].start_iso);
  const window = await bot(`/api/bot/campaigns/${campaignId}/availability?start=${new Date(monday.getTime() - 3600000).toISOString()}&end=${new Date(monday.getTime() + 5 * 3600000).toISOString()}`);
  check('the aggregate shows the seat free in that window', window.status === 200 && window.json?.intervals?.some((i) => i.count === 1 && i.player_ids.includes(joined.json.player.id)), JSON.stringify(window.json?.intervals));
  const tooLong = await bot(`/api/bot/campaigns/${campaignId}/availability?start=2026-01-01T00:00:00Z&end=2026-06-01T00:00:00Z`);
  check('a window over 56 days is refused', tooLong.status === 400 && tooLong.json?.error === 'window_too_long', `${tooLong.status} ${tooLong.json?.error}`);
  const replaced = await bot(`/api/bot/campaigns/${campaignId}/availability`, { body: { text: 'Fridays 8pm-midnight', timezone: 'Europe/London', replace: true } });
  check('replace clears the future first', replaced.status === 200 && replaced.json?.cleared >= 4 && replaced.json.written.length >= 2, JSON.stringify(replaced.json).slice(0, 160));
  check('the zone given is remembered on the seat', replaced.json?.timezone === 'Europe/London', replaced.json?.timezone);
  const unzoned = await bot(`/api/bot/campaigns/${campaignId}/availability`, { body: { text: 'Sunday 3pm-6pm' } });
  check('no zone given reads the seat\'s', unzoned.status === 200 && unzoned.json?.timezone === 'Europe/London', JSON.stringify(unzoned.json).slice(0, 120));
  const badZone = await bot(`/api/bot/campaigns/${campaignId}/availability`, { body: { text: 'Sunday 3pm-6pm', timezone: 'Mars/Olympus' } });
  check('an unknown zone is refused, not read as UTC', badZone.status === 400 && badZone.json?.error === 'unknown_timezone', `${badZone.status} ${badZone.json?.error}`);
  const cleared = await bot(`/api/bot/campaigns/${campaignId}/availability`, { body: { clear: true } });
  check('clear drops the rest and writes nothing', cleared.status === 200 && cleared.json?.cleared >= 3 && cleared.json.written.length === 0, JSON.stringify(cleared.json));
  await call('other', 'GET', '/api/bot/me');

  // the owner never took a seat; writing availability makes one rather than refusing
  const db2 = createClient({ url: dbUrl });
  await db2.execute({ sql: 'UPDATE users SET discord_id = ? WHERE username = ?', args: [STRANGER_DISCORD, 'bot-other'] });
  db2.close();
  const ownerWrote = await bot(`/api/bot/campaigns/${campaignId}/availability`, { discordId: STRANGER_DISCORD, body: { text: 'Saturday 2pm-6pm' } });
  check('a seatless owner gets a seat on first write', ownerWrote.status === 200 && Number(ownerWrote.json?.player_id) > 0, JSON.stringify(ownerWrote.json).slice(0, 160));
  const ownerListed = await bot('/api/bot/campaigns', { discordId: STRANGER_DISCORD });
  check('and the seat sticks to the membership', ownerListed.json?.campaigns?.[0]?.player_id === ownerWrote.json.player_id, JSON.stringify(ownerListed.json));

  // ---- the content library: keyed, but nobody's ----------------------------
  const contentNoKey = await bot('/api/bot/content/spell?q=fireball', { key: null });
  check('content without a key is 401', contentNoKey.status === 401, contentNoKey.status);
  const fireball = await bot('/api/bot/content/spell?q=fireball', { discordId: null });
  check('content needs no Discord id', fireball.status === 200, fireball.status);
  check('exact name ranks first, newer edition ahead',
    fireball.json?.results?.[0]?.name === 'Fireball' && fireball.json.results[0].edition === '2024'
      && fireball.json.results[1]?.name === 'Fireball' && fireball.json.results[1].edition === '2014',
    JSON.stringify(fireball.json?.results?.slice(0, 2)));
  const only2014 = await bot('/api/bot/content/spell?q=fireball&edition=2014', { discordId: null });
  check('edition filters', only2014.json?.results?.every((entry) => entry.edition === '2014'), JSON.stringify(only2014.json?.results?.map((e) => e.edition)));
  const entry = await bot(`/api/bot/content/spell/${fireball.json.results[0].id}`, { discordId: null });
  check('an entry comes back whole', entry.json?.entry?.level === 3 && typeof entry.json.entry.description === 'string', JSON.stringify(entry.json).slice(0, 120));
  const book = await bot('/api/bot/content/spell?q=caustic%20brew', { discordId: null });
  check('book-only content is not served', book.status === 200 && book.json?.results?.length === 0, JSON.stringify(book.json?.results));
  const badKind = await bot('/api/bot/content/subclass?q=x', { discordId: null });
  check('an unknown kind is 404', badKind.status === 404, badKind.status);
  const badId = await bot('/api/bot/content/spell/nope', { discordId: null });
  check('an unknown id is 404', badId.status === 404, badId.status);
  const capped = await bot('/api/bot/content/monster?q=&limit=999', { discordId: null });
  check('the result cap holds', capped.json?.results?.length === 25, capped.json?.results?.length);
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
    // Windows keeps the database locked for a beat after the process dies; a failed cleanup
    // must not read as a failed run.
    for (let attempt = 0; attempt < 10; attempt++) {
      await new Promise((r) => setTimeout(r, 200));
      try {
        rmSync(dbDir, { recursive: true, force: true });
        break;
      } catch (e) {
        if (attempt === 9) console.warn('temp database not removed:', e?.code);
      }
    }
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
