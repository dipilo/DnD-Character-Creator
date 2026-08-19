// Character sharing: who may open a sheet, and who may edit it.
//
// The read rules used to be one sentence — a row belongs to one user, and attaching it to a
// campaign lets that campaign read it — and a status snapshot was enough to check them. Three
// things widen them now, all of them the owner's own act, and each has a way of being wrong that
// looks like nothing at all: a private character still readable by its table, a granted editor
// able to move someone else's seat, a consent the GM could grant themselves.
//
// So this drives the whole surface with four real accounts and asserts the refusals as hard as
// the permissions.
//
//   node server/test/characterSharing.mjs      (npm run test:sharing)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SHARING_PORT || 3992);
const base = `http://127.0.0.1:${port}`;

const sheet = {
  id: 'c1a2b3d4-0000-4000-8000-000000000001',
  name: 'Bellara Quill',
  speciesId: 'human',
  classes: [{ classId: 'wizard', level: 3 }],
  abilityScores: { strength: 8, dexterity: 14, constitution: 12, intelligence: 17, wisdom: 11, charisma: 10 },
  spells: [],
  equipment: [],
  feats: [],
  features: [],
  proficiencies: { skills: [], tools: [], languages: [], armor: [], weapons: [], saves: [] },
  hp: { current: 20, maximum: 20, temporary: 0 },
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

/** The GM runs a campaign; the player brings a character to it; the mate and the stranger differ. */
async function setUpTable() {
  await signUp('gm', 'sharing-gm');
  await signUp('player', 'sharing-player');
  await signUp('mate', 'sharing-mate');
  await signUp('stranger', 'sharing-stranger');

  const campaign = await call('gm', 'POST', '/api/campaigns', { name: 'The Quiet Coast' });
  const campaignId = campaign.json.campaign?.id;
  const invite = await call('gm', 'POST', `/api/campaigns/${campaignId}/invites`, { max_uses: 0 });
  const token = invite.json.invite?.token;
  await call('player', 'POST', '/api/invites/join', { token });
  await call('mate', 'POST', '/api/invites/join', { token });
  return { campaignId, inviteToken: token };
}

async function scenario() {
  const { campaignId, inviteToken } = await setUpTable();

  const created = await call('player', 'POST', '/api/characters', { id: sheet.id, data: sheet });
  check('a new character is created', created.status === 201, created.status);
  check('a new character defaults to campaign visibility', created.json.character?.visibility === 'campaign', created.json.character?.visibility);
  check('its owner is told so', created.json.character?.is_owner === true, created.json.character?.is_owner);

  // ---- unattached: nobody else can see it, and cannot tell it exists -------
  const strangerBefore = await call('stranger', 'GET', `/api/characters/${sheet.id}`);
  check('an unattached character is invisible to a stranger', strangerBefore.status === 404, strangerBefore.status);
  const mateBefore = await call('mate', 'GET', `/api/characters/${sheet.id}`);
  check('an unattached character is invisible to a campaign-mate', mateBefore.status === 404, mateBefore.status);

  // ---- attaching is the act of sharing -------------------------------------
  await call('player', 'PUT', `/api/characters/${sheet.id}/seat`, { campaign_id: campaignId });
  const mateAttached = await call('mate', 'GET', `/api/characters/${sheet.id}`);
  check('attaching lets a campaign-mate read it', mateAttached.status === 200, mateAttached.status);
  check('a reader is told they do not own it', mateAttached.json.character?.is_owner === false, mateAttached.json.character?.is_owner);
  check('a reader is told they cannot edit it', mateAttached.json.character?.can_edit === false, mateAttached.json.character?.can_edit);

  const mateWrite = await call('mate', 'PUT', `/api/characters/${sheet.id}`, { version: 1, data: sheet });
  check('a reader who tries to write is refused with 403', mateWrite.status === 403 && mateWrite.json.error === 'character_not_editable', `${mateWrite.status} ${mateWrite.json.error}`);

  // ---- private closes it again, seat and all -------------------------------
  const madePrivate = await call('player', 'PUT', `/api/characters/${sheet.id}/sharing`, { visibility: 'private' });
  check('the owner can make it private', madePrivate.json.sharing?.visibility === 'private', madePrivate.json.sharing?.visibility);
  const shareToken = madePrivate.json.sharing?.share_token;
  check('a share link is minted', typeof shareToken === 'string' && shareToken.length >= 16, shareToken);

  const matePrivate = await call('mate', 'GET', `/api/characters/${sheet.id}`);
  check('private hides it from the table it is seated at', matePrivate.status === 404, matePrivate.status);
  const partyPrivate = await call('mate', 'GET', `/api/campaigns/${campaignId}/characters`);
  const partyRow = partyPrivate.json.characters?.find((row) => row.id === sheet.id);
  check('the seat still shows in the party list', Boolean(partyRow), JSON.stringify(partyPrivate.json).slice(0, 200));
  check('but the party list says the sheet does not open', partyRow?.can_read === false, partyRow?.can_read);

  const anonPrivate = await call('anon', 'GET', `/api/shared/characters/${shareToken}`);
  check('a private share link does not open for a stranger', anonPrivate.status === 404, anonPrivate.status);

  // ---- public opens for anyone, signed in or not ---------------------------
  await call('player', 'PUT', `/api/characters/${sheet.id}/sharing`, { visibility: 'public' });
  const anonPublic = await call('anon', 'GET', `/api/shared/characters/${shareToken}`);
  check('a public share link opens signed out', anonPublic.status === 200, anonPublic.status);
  check('and carries the document', anonPublic.json.character?.data?.name === 'Bellara Quill', anonPublic.json.character?.data?.name);
  check('a signed-out reader may not edit it', anonPublic.json.character?.can_edit === false, anonPublic.json.character?.can_edit);

  const rotated = await call('player', 'PUT', `/api/characters/${sheet.id}/sharing`, { rotate_token: true });
  const newToken = rotated.json.sharing?.share_token;
  check('rotating mints a different link', typeof newToken === 'string' && newToken !== shareToken, newToken);
  const anonOld = await call('anon', 'GET', `/api/shared/characters/${shareToken}`);
  check('the old link stops working', anonOld.status === 404, anonOld.status);

  // ---- a named grant beats the visibility ---------------------------------
  await call('player', 'PUT', `/api/characters/${sheet.id}/sharing`, { visibility: 'private' });
  const mateId = (await call('gm', 'GET', `/api/campaigns/${campaignId}/members`)).json.members
    ?.find((m) => m.user_name === 'sharing-mate')?.user_id;
  const granted = await call('player', 'POST', `/api/characters/${sheet.id}/grants`, {
    subject_type: 'user', subject_id: mateId, access: 'edit',
  });
  check('the owner can grant a campaign-mate edit access', granted.status === 201, `${granted.status} ${JSON.stringify(granted.json).slice(0, 120)}`);
  check('the grant is labelled, not a bare id', granted.json.sharing?.grants?.[0]?.label === 'sharing-mate', granted.json.sharing?.grants?.[0]?.label);

  const mateGranted = await call('mate', 'GET', `/api/characters/${sheet.id}`);
  check('a grant opens a private sheet', mateGranted.status === 200, mateGranted.status);
  check('and says it may be edited', mateGranted.json.character?.can_edit === true, mateGranted.json.character?.can_edit);

  const mateEdit = await call('mate', 'PUT', `/api/characters/${sheet.id}`, {
    version: mateGranted.json.character.version,
    data: { ...sheet, name: 'Bellara Quill, Third Circle' },
  });
  check('a granted editor can write the document', mateEdit.status === 200, `${mateEdit.status} ${JSON.stringify(mateEdit.json).slice(0, 120)}`);

  const mateMovesSeat = await call('mate', 'PUT', `/api/characters/${sheet.id}`, {
    version: mateEdit.json.character.version, campaign_id: null, data: sheet,
  });
  check('a granted editor may not move the seat', mateMovesSeat.status === 403 && mateMovesSeat.json.error === 'seat_is_owner_only', `${mateMovesSeat.status} ${mateMovesSeat.json.error}`);

  const mateSharing = await call('mate', 'GET', `/api/characters/${sheet.id}/sharing`);
  check('a granted editor may not read the sharing list', mateSharing.status === 404, mateSharing.status);
  const mateDeletes = await call('mate', 'DELETE', `/api/characters/${sheet.id}`);
  check('a granted editor may not delete it', mateDeletes.status === 404, mateDeletes.status);

  const strangerGrant = await call('player', 'POST', `/api/characters/${sheet.id}/grants`, {
    subject_type: 'user', subject_id: 999999, access: 'view',
  });
  check('a grant cannot name someone from another table', strangerGrant.status === 400, strangerGrant.status);

  const revoked = await call('player', 'DELETE', `/api/characters/${sheet.id}/grants/${granted.json.sharing.grants[0].id}`);
  check('revoking leaves no grants', revoked.json.sharing?.grants?.length === 0, revoked.json.sharing?.grants?.length);
  const mateRevoked = await call('mate', 'GET', `/api/characters/${sheet.id}`);
  check('and closes the sheet again', mateRevoked.status === 404, mateRevoked.status);

  // ---- the GM's table-wide consent ----------------------------------------
  await call('player', 'PUT', `/api/characters/${sheet.id}/sharing`, { visibility: 'campaign' });
  const gmBefore = await call('gm', 'PUT', `/api/characters/${sheet.id}`, { version: 3, data: sheet });
  check('the GM cannot edit without consent', gmBefore.status === 403, gmBefore.status);

  const ask = await call('gm', 'PUT', `/api/campaigns/${campaignId}`, { requests_character_edit: true });
  check('the owner can ask for it', ask.json.campaign?.requests_character_edit === 1, ask.json.campaign?.requests_character_edit);

  const members = await call('gm', 'GET', `/api/campaigns/${campaignId}/members`);
  const playerMemberId = members.json.members?.find((m) => m.user_name === 'sharing-player')?.id;
  const ownerForces = await call('gm', 'PATCH', `/api/campaigns/${campaignId}/members/${playerMemberId}/permissions`, {
    permissions: { character_edit_consent: true, can_edit_self: true },
  });
  const afterForcing = await call('gm', 'PUT', `/api/characters/${sheet.id}`, { version: 3, data: sheet });
  check('the owner cannot grant it to themselves', afterForcing.status === 403, `${ownerForces.status} then ${afterForcing.status}`);

  await call('player', 'PUT', `/api/campaigns/${campaignId}/character-edit-consent`, { consent: true });
  const gmRead = await call('gm', 'GET', `/api/characters/${sheet.id}`);
  check('consent lets the GM edit', gmRead.json.character?.can_edit === true, gmRead.json.character?.can_edit);
  const gmEdit = await call('gm', 'PUT', `/api/characters/${sheet.id}`, {
    version: gmRead.json.character.version,
    data: { ...sheet, name: 'Bellara Quill, GM edit' },
  });
  check('and the write lands', gmEdit.status === 200, `${gmEdit.status} ${JSON.stringify(gmEdit.json).slice(0, 120)}`);

  // Consent covers characters seated later, which is why it is not a per-character grant.
  const second = { ...sheet, id: 'c1a2b3d4-0000-4000-8000-000000000002', name: 'Second Sheet' };
  await call('player', 'POST', '/api/characters', { id: second.id, data: second, campaign_id: campaignId });
  const gmSecond = await call('gm', 'GET', `/api/characters/${second.id}`);
  check('consent covers a character seated afterwards', gmSecond.json.character?.can_edit === true, gmSecond.json.character?.can_edit);

  await call('player', 'PUT', `/api/campaigns/${campaignId}/character-edit-consent`, { consent: false });
  const gmAfterWithdrawal = await call('gm', 'PUT', `/api/characters/${second.id}`, { version: 1, data: second });
  check('withdrawing it stops the GM writing', gmAfterWithdrawal.status === 403, gmAfterWithdrawal.status);

  // ---- the invite carries the ask and the answer --------------------------
  const preview = await call('anon', 'GET', `/api/invites/${inviteToken}`);
  check('the invite preview carries the ask', preview.json.campaign?.requests_character_edit === 1, preview.json.campaign?.requests_character_edit);

  await signUp('joiner', 'sharing-joiner');
  await call('joiner', 'POST', '/api/invites/join', { token: inviteToken, character_edit_consent: true });
  const joined = { ...sheet, id: 'c1a2b3d4-0000-4000-8000-000000000003', name: 'Joined With Consent' };
  await call('joiner', 'POST', '/api/characters', { id: joined.id, data: joined, campaign_id: campaignId });
  const gmJoined = await call('gm', 'GET', `/api/characters/${joined.id}`);
  check('consent given on the invite is honoured', gmJoined.json.character?.can_edit === true, gmJoined.json.character?.can_edit);

  // ---- deletion revokes the link ------------------------------------------
  const liveToken = (await call('player', 'GET', `/api/characters/${sheet.id}/sharing`)).json.sharing?.share_token;
  await call('player', 'PUT', `/api/characters/${sheet.id}/sharing`, { visibility: 'public' });
  check('the link works before deletion', (await call('anon', 'GET', `/api/shared/characters/${liveToken}`)).status === 200);
  await call('player', 'DELETE', `/api/characters/${sheet.id}`);
  check('deleting revokes the link', (await call('anon', 'GET', `/api/shared/characters/${liveToken}`)).status === 404);
}

async function main() {
  const dbDir = mkdtempSync(join(tmpdir(), 'dnd-sharing-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${join(dbDir, 'sharing.db').replaceAll('\\', '/')}`,
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
