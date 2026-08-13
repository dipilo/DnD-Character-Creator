// Scheduler flow check (MERGE_PLAN.md Phase 4).
//
// The smoke harness proves each scheduler route answers the same way it did before a refactor.
// This proves something else: that the **sequence of calls the rewritten campaign pages make**
// actually works, and that the response shapes the typed client in `app/src/lib/api/` declares are
// the shapes the server sends. A page that reads `body.campaigns` off a route that answers a bare
// array is a runtime failure a status snapshot cannot see.
//
// It walks one campaign end to end as two accounts — the DM who owns it and a player who joins by
// invite — because the permission boundary only shows up when there are two of them.
//
//   node server/test/schedulerFlow.mjs      (npm run test:scheduler)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SCHEDULER_PORT || 3992);
const base = `http://127.0.0.1:${port}`;

/** One cookie jar per account: identity is the session cookie and nothing else. */
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

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok, detail: ok ? '' : String(detail) });

/** Tomorrow evening, so every block sits inside the calendar's validRange. */
function block(dayOffset, startHour, endHour) {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + dayOffset);
  const at = (hour) => {
    const d = new Date(day);
    d.setUTCHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  return { start_iso: at(startHour), end_iso: at(endHour) };
}

async function ownerSetsUpCampaign() {
  await call('dm', 'POST', '/auth/signup', { username: 'flow-dm', password: 'correct horse battery staple' });

  const created = await call('dm', 'POST', '/api/campaigns', { name: 'Flow Test Campaign' });
  check('CampaignsPage: create answers { campaign }', Boolean(created.json.campaign?.id), JSON.stringify(created.json).slice(0, 200));
  const campaignId = created.json.campaign.id;

  const list = await call('dm', 'GET', '/api/campaigns');
  check('CampaignsPage: list answers { campaigns: [...] }', Array.isArray(list.json.campaigns) && list.json.campaigns.length === 1, JSON.stringify(list.json).slice(0, 200));

  // CampaignLayout resolves the caller's own membership row out of the member list, and every
  // permission decision in the UI reads `role` and `permissions` off it.
  const members = await call('dm', 'GET', `/api/campaigns/${campaignId}/members`);
  const own = members.json.members?.find((m) => m.user_id != null);
  check('CampaignLayout: membership row carries role', own?.role === 'owner', JSON.stringify(members.json).slice(0, 200));

  return campaignId;
}

async function ownerBuildsRoster(campaignId) {
  const created = await call('dm', 'POST', '/api/players', { campaign_id: campaignId, name: 'Ysolde', timezone: 'Europe/London' });
  check('RosterPage: create answers { player }', Boolean(created.json.player?.id), JSON.stringify(created.json).slice(0, 200));
  check('no password hash rides along on a player', created.json.player?.password_hash === undefined, Object.keys(created.json.player ?? {}).join(','));

  const second = await call('dm', 'POST', '/api/players', { campaign_id: campaignId, name: 'Bram', timezone: 'Europe/London' });

  const roster = await call('dm', 'GET', `/api/players?campaign_id=${campaignId}`);
  check('RosterPage: list answers a bare array', Array.isArray(roster.json) && roster.json.length === 2, JSON.stringify(roster.json).slice(0, 200));
  check('RosterPage: seats start unclaimed', roster.json.every((p) => p.is_claimed === false), JSON.stringify(roster.json.map((p) => p.is_claimed)));

  // PlayerEditorDialog parses the notes, shows them, and only then saves them as blocks.
  const preview = await call('dm', 'POST', '/api/availability/preview', {
    text: 'Free every Tuesday 7pm-11pm',
    timezone: 'Europe/London',
    daysAhead: 14,
  });
  check('PlayerEditorDialog: preview answers { availability }', Array.isArray(preview.json.availability), JSON.stringify(preview.json).slice(0, 200));
  check('PlayerEditorDialog: preview found blocks', (preview.json.availability?.length ?? 0) > 0, preview.json.availability?.length);

  const saved = await call('dm', 'PUT', `/api/players/${created.json.player.id}`, {
    name: 'Ysolde',
    timezone: 'Europe/London',
    notes: 'Free every Tuesday 7pm-11pm',
    availability_preview_blocks: preview.json.availability,
  });
  check('PlayerEditorDialog: saving confirmed blocks succeeds', saved.status === 200, saved.status);

  return { ysolde: created.json.player.id, bram: second.json.player.id };
}

async function calendarWritesAvailability(campaignId, playerId) {
  // AvailabilityCalendar coalesces a drag into one batch, then refetches.
  const batch = await call('dm', 'POST', '/api/availability/batch', {
    campaign_id: campaignId,
    operations: [
      { op: 'create', player_id: playerId, ...block(1, 18, 22) },
      { op: 'create', player_id: playerId, ...block(2, 18, 22) },
    ],
  });
  check('AvailabilityCalendar: batch create succeeds', batch.json.results?.every((r) => r.ok), JSON.stringify(batch.json).slice(0, 300));

  const rows = await call('dm', 'GET', `/api/availability?player_id=${playerId}&campaign_id=${campaignId}`);
  check('AvailabilityCalendar: list answers a bare array of rows', Array.isArray(rows.json) && rows.json.length >= 2, JSON.stringify(rows.json).slice(0, 200));
  const first = rows.json.find((r) => r.source === 'manual');
  check('AvailabilityCalendar: rows carry start_iso/end_iso/id', Boolean(first?.id && first?.start_iso && first?.end_iso), JSON.stringify(first));

  // A resize is an update; a click is a delete. Both go through the same batch route.
  const edited = await call('dm', 'POST', '/api/availability/batch', {
    campaign_id: campaignId,
    operations: [{ op: 'update', id: first.id, ...block(1, 19, 23) }],
  });
  check('AvailabilityCalendar: batch update succeeds', edited.json.results?.[0]?.ok === true, JSON.stringify(edited.json).slice(0, 200));

  return rows.json;
}

async function aggregateAndGroups(campaignId, players) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);

  const aggregate = await call('dm', 'GET', `/api/availability/aggregate?campaign_id=${campaignId}&start=${start.toISOString()}&end=${end.toISOString()}`);
  check('AggregateCalendar: answers { intervals }', Array.isArray(aggregate.json.intervals), JSON.stringify(aggregate.json).slice(0, 200));
  const busy = aggregate.json.intervals?.find((i) => i.count > 0);
  check('AggregateCalendar: an interval names its players', Array.isArray(busy?.player_ids) && busy.player_ids.length > 0, JSON.stringify(busy));

  // GroupHeatmap asks the same route filtered to one group's members.
  const filtered = await call('dm', 'GET', `/api/availability/aggregate?campaign_id=${campaignId}&start=${start.toISOString()}&end=${end.toISOString()}&player_ids=${players.bram}`);
  const bramBusy = filtered.json.intervals?.some((i) => i.count > 0);
  check('GroupHeatmap: filtering to a free-less seat counts nobody', bramBusy === false, JSON.stringify(filtered.json).slice(0, 200));

  const group = await call('dm', 'POST', '/api/groups', { campaign_id: campaignId, name: 'Tuesday table', member_ids: [players.ysolde] });
  check('GroupsPage: create answers { group } with members', group.json.group?.members?.length === 1, JSON.stringify(group.json).slice(0, 200));

  const groups = await call('dm', 'GET', `/api/groups?campaign_id=${campaignId}`);
  check('GroupsPage: list answers a bare array', Array.isArray(groups.json) && groups.json.length === 1, JSON.stringify(groups.json).slice(0, 200));

  const updated = await call('dm', 'PUT', `/api/groups/${group.json.group.id}`, { member_ids: [players.ysolde, players.bram] });
  check('GroupsPage: replacing members answers the reloaded group', updated.json.group?.members?.length === 2, JSON.stringify(updated.json).slice(0, 200));

  const suggestion = await call('dm', 'POST', '/api/groups/suggest', {
    campaign_id: campaignId,
    numGroups: 2,
    window: { start: start.toISOString(), end: end.toISOString() },
  });
  check('SuggestGroupsDialog: answers { groups } with scores', Array.isArray(suggestion.json.groups) && suggestion.json.groups.every((g) => typeof g.score === 'number'), JSON.stringify(suggestion.json).slice(0, 300));
  const flaggedZero = suggestion.json.groups?.flatMap((g) => g.members).some((m) => m.zero_availability === true);
  check('SuggestGroupsDialog: members with no availability are flagged', flaggedZero === true, JSON.stringify(suggestion.json.groups).slice(0, 300));
}

async function inviteFlow(campaignId, players) {
  const invite = await call('dm', 'POST', `/api/campaigns/${campaignId}/invites`, {});
  check('MembersPage: create answers { invite } with a token', typeof invite.json.invite?.token === 'string', JSON.stringify(invite.json).slice(0, 200));
  const token = invite.json.invite.token;

  // InviteLandingPage previews before the visitor has an account — deliberately not behind the
  // route guard, which is why this call carries no cookie at all.
  const preview = await call('anon', 'GET', `/api/invites/${token}`);
  check('InviteLandingPage: preview works signed out', preview.status === 200 && preview.json.campaign?.id === campaignId, `${preview.status} ${JSON.stringify(preview.json).slice(0, 150)}`);

  // ...but joining records nothing for an anonymous caller, so the page asks them to sign in.
  await call('player', 'POST', '/auth/signup', { username: 'flow-player', password: 'hunter2hunter2' });
  const joined = await call('player', 'POST', '/api/invites/join', { token });
  check('InviteLandingPage: join answers { campaign_id }', joined.json.campaign_id === campaignId, JSON.stringify(joined.json).slice(0, 200));

  const playerCampaigns = await call('player', 'GET', '/api/campaigns');
  check('the invited player now sees the campaign', playerCampaigns.json.campaigns?.some((c) => c.id === campaignId), JSON.stringify(playerCampaigns.json).slice(0, 200));

  // A plain member holds no permissions until the owner grants them: the roster page hides the
  // add button for exactly this reason, and the server is what makes it true.
  const refused = await call('player', 'POST', '/api/players', { campaign_id: campaignId, name: 'Uninvited' });
  check('a member without can_create_players is refused', refused.status === 403, `${refused.status} ${JSON.stringify(refused.json)}`);

  const claimed = await call('player', 'POST', `/api/campaigns/${campaignId}/claim-player`, { player_id: players.bram });
  check('RosterPage: claiming a seat answers { player }', claimed.json.player?.id === players.bram, JSON.stringify(claimed.json).slice(0, 200));

  // MembersPage's permission switches. The member row id comes from the member list, not the user.
  const members = await call('dm', 'GET', `/api/campaigns/${campaignId}/members`);
  const memberRow = members.json.members?.find((m) => m.role !== 'owner');
  const granted = await call('dm', 'PATCH', `/api/campaigns/${campaignId}/members/${memberRow.id}/permissions`, {
    permissions: { can_create_players: true },
  });
  check('MembersPage: PATCH answers the updated member', granted.json.member?.permissions?.includes('can_create_players'), JSON.stringify(granted.json).slice(0, 200));

  const allowed = await call('player', 'POST', '/api/players', { campaign_id: campaignId, name: 'Now allowed' });
  check('the granted permission takes effect', allowed.status === 200, `${allowed.status} ${JSON.stringify(allowed.json)}`);

  // A campaign the caller is not in must not be readable, whatever the UI would show.
  await call('stranger', 'POST', '/auth/signup', { username: 'flow-stranger', password: 'hunter2hunter2' });
  const strangerRoster = await call('stranger', 'GET', `/api/players?campaign_id=${campaignId}`);
  check('a non-member cannot read the roster', strangerRoster.status === 403, strangerRoster.status);
  const strangerAggregate = await call('stranger', 'GET', `/api/availability/aggregate?campaign_id=${campaignId}&start=${new Date().toISOString()}&end=${new Date().toISOString()}`);
  check('a non-member cannot read the aggregate', strangerAggregate.status === 403, strangerAggregate.status);
}

/**
 * Phase 5 — the join between the two halves. Everything above this proves the scheduler works;
 * this proves a *builder character* can sit at one of its seats, be read by the table, and stay its
 * owner's alone. The permission boundary is the whole point, so it is driven from both sides.
 */
async function partyFlow(campaignId, players) {
  // The campaign's content agreement. Owner-only to write, readable by every member — the party
  // page seeds the builder's source filter from it.
  const sources = await call('dm', 'PUT', `/api/campaigns/${campaignId}`, {
    allowed_source_ids: ['phb-2024', 'basic-rules-2024'],
  });
  check('CampaignSourcesCard: PUT answers the updated campaign', sources.json.campaign?.allowed_source_ids === '["phb-2024","basic-rules-2024"]', JSON.stringify(sources.json).slice(0, 200));

  const refused = await call('player', 'PUT', `/api/campaigns/${campaignId}`, { allowed_source_ids: [] });
  check('CampaignSourcesCard: a member cannot set the sources', refused.status === 403, `${refused.status} ${JSON.stringify(refused.json)}`);

  const asMember = await call('player', 'GET', '/api/campaigns');
  const seen = asMember.json.campaigns?.find((c) => c.id === campaignId);
  check('PartyPage: a member reads the allowed sources off the campaign', seen?.allowed_source_ids === '["phb-2024","basic-rules-2024"]', JSON.stringify(seen).slice(0, 200));

  // The player builds a character and seats it. The seat is a separate write from the document —
  // it carries no version, because seating a character is not editing it.
  const created = await call('player', 'POST', '/api/characters', {
    id: 'flow-char-bram',
    name: 'Bram Ashvale',
    summary: 'Level 3 Human Fighter 3 (Champion)',
    data: { id: 'flow-char-bram', name: 'Bram Ashvale', speciesId: 'human', classes: [{ classId: 'fighter', level: 3 }] },
  });
  check('the player can create a character', created.status === 201, `${created.status} ${JSON.stringify(created.json).slice(0, 150)}`);
  check('the summary is stored as sent', created.json.character?.summary === 'Level 3 Human Fighter 3 (Champion)', JSON.stringify(created.json.character).slice(0, 200));

  const seated = await call('player', 'PUT', '/api/characters/flow-char-bram/seat', {
    campaign_id: campaignId,
    player_id: players.bram,
  });
  check('PartyPage: seating answers the updated summary', seated.json.character?.player_id === players.bram, JSON.stringify(seated.json).slice(0, 200));

  // Both sides see it now. This is the read the whole phase exists for.
  const dmParty = await call('dm', 'GET', `/api/campaigns/${campaignId}/characters`);
  const row = dmParty.json.characters?.find((c) => c.id === 'flow-char-bram');
  check('PartyPage: the DM sees a member\'s seated character', Boolean(row), JSON.stringify(dmParty.json).slice(0, 250));
  check('PartyPage: the row names its owner and its seat', row?.owner_name === 'flow-player' && row?.player_name === 'Bram', JSON.stringify(row));
  check('PartyPage: the row carries the summary, so no document is fetched to list it', row?.summary === 'Level 3 Human Fighter 3 (Champion)', JSON.stringify(row));

  const sheet = await call('dm', 'GET', '/api/characters/flow-char-bram');
  check('CampaignCharacterPage: the DM can read the seated sheet', sheet.status === 200 && sheet.json.character?.data?.name === 'Bram Ashvale', `${sheet.status} ${JSON.stringify(sheet.json).slice(0, 150)}`);

  // ...but reading is all. A shared sheet is not a writable one.
  const clobber = await call('dm', 'PUT', '/api/characters/flow-char-bram', { version: 1, data: { name: 'DM edit' } });
  check('a shared sheet is still read-only to everyone but its owner', clobber.status === 404, `${clobber.status} ${JSON.stringify(clobber.json)}`);

  const strangerParty = await call('stranger', 'GET', `/api/campaigns/${campaignId}/characters`);
  check('a non-member cannot read the party', strangerParty.status === 403, strangerParty.status);
  const strangerSheet = await call('stranger', 'GET', '/api/characters/flow-char-bram');
  check('a non-member gets 404 for a seated sheet, not 403', strangerSheet.status === 404, strangerSheet.status);

  // Detaching takes it back out of the campaign's view, which is what makes attaching a real choice.
  await call('player', 'PUT', '/api/characters/flow-char-bram/seat', { campaign_id: null });
  const afterDetach = await call('dm', 'GET', `/api/campaigns/${campaignId}/characters`);
  check('PartyPage: detaching removes it from the party', !afterDetach.json.characters?.some((c) => c.id === 'flow-char-bram'), JSON.stringify(afterDetach.json).slice(0, 200));
  const afterDetachSheet = await call('dm', 'GET', '/api/characters/flow-char-bram');
  check('detaching takes the DM\'s read with it', afterDetachSheet.status === 404, afterDetachSheet.status);

  // The character itself is untouched by any of that: it belongs to a user, not to a campaign.
  const stillMine = await call('player', 'GET', '/api/characters/flow-char-bram');
  check('the character survives every detach, seated or not', stillMine.status === 200, `${stillMine.status} ${JSON.stringify(stillMine.json).slice(0, 150)}`);

  // Leaving the campaign has to take the shared sheets with it, or a former member's character
  // stays readable by a table they are no longer at.
  await call('player', 'PUT', '/api/characters/flow-char-bram/seat', { campaign_id: campaignId, player_id: players.bram });
  await call('player', 'POST', `/api/campaigns/${campaignId}/leave`);
  const afterLeave = await call('dm', 'GET', `/api/campaigns/${campaignId}/characters`);
  check('leaving the campaign detaches the characters shared with it', !afterLeave.json.characters?.some((c) => c.id === 'flow-char-bram'), JSON.stringify(afterLeave.json).slice(0, 200));
  const orphaned = await call('player', 'GET', '/api/characters/flow-char-bram');
  check('...and the character is still its owner\'s', orphaned.status === 200, orphaned.status);
}

async function scenario() {
  const campaignId = await ownerSetsUpCampaign();
  const players = await ownerBuildsRoster(campaignId);
  await calendarWritesAvailability(campaignId, players.ysolde);
  await aggregateAndGroups(campaignId, players);
  await inviteFlow(campaignId, players);
  await partyFlow(campaignId, players);
}

async function main() {
  const dbDir = mkdtempSync(join(tmpdir(), 'dnd-scheduler-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${join(dbDir, 'scheduler.db').replaceAll('\\', '/')}`,
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
    await new Promise((r) => child.once('exit', r));
    try { rmSync(dbDir, { recursive: true, force: true }); } catch { /* windows file lock */ }
  }

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok || !c.detail ? '' : `  → ${c.detail}`}`);
  if (failed.length > 0) {
    console.error(`\n${failed.length} of ${checks.length} checks FAILED`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nscheduler flow OK: ${checks.length} checks passed`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
