// Character round-trip check (MERGE_PLAN.md Phase 2).
//
// The smoke harness proves the /api/characters routes answer correctly; this proves the one thing
// a status-and-body snapshot cannot. CLAUDE.md: "a saved character is an editable document, not a
// receipt" — anything the Review step writes has to read back into the builder, which needs
// abilityScoreChoiceModes, abilityScoreChoiceSelections, backgroundLanguageSelections,
// speciesLanguageSelections, toolProficiencySelections, abilityScoreMethod, rolledScores and
// rolledScoreAssignments all intact. A lossy store breaks that silently, so the document below is
// a full one and the assertion is byte equality.
//
// It also drives the Phase 2 gate end to end: two devices, one account, and a stale write that
// must be refused rather than clobber the other device's edit.
//
//   node server/test/characterRoundTrip.mjs      (npm run test:characters)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.ROUNDTRIP_PORT || 3991);
const base = `http://127.0.0.1:${port}`;

/** Everything the builder persists, including the choice state the builder reads back. */
const character = {
  id: '0f9d3d1e-6b4a-4d2f-9c7e-8a1b2c3d4e5f',
  name: 'Ysolde Vane',
  speciesId: 'elf',
  variantId: 'high-elf',
  size: 'Medium',
  backgroundId: 'sage',
  classes: [{ classId: 'warlock', subclassId: 'the-great-old-one', level: 5, hitDiceUsed: 1, spellsKnown: ['eldritch-blast'], preparedSpells: [], spellSlotsUsed: [0, 0] }],
  abilityScores: { strength: 8, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, charisma: 17 },
  abilityScoreBonuses: { charisma: 2, dexterity: 1 },
  abilityScoreChoiceModes: { 'background:sage': 'choose-two' },
  abilityScoreChoiceSelections: { 'background:sage': ['charisma', 'dexterity'] },
  backgroundLanguageSelections: ['Draconic', 'Celestial'],
  speciesLanguageSelections: ['Elvish'],
  toolProficiencySelections: { 'background:sage:tool-0': ["calligrapher's supplies"] },
  proficiencies: { skills: ['Arcana', 'History'], tools: [], languages: ['Common'], armor: ['Light armor'], weapons: ['Simple weapons'], saves: ['wisdom', 'charisma'] },
  equipment: [{ equipmentId: 'quarterstaff', quantity: 1, equipped: true }],
  spells: [{ spellId: 'hex', prepared: true, alwaysPrepared: false }],
  feats: ['alert'],
  features: [{ featureId: 'pact-boon', optionId: 'pact-of-the-tome' }],
  hp: { current: 33, maximum: 38, temporary: 5 },
  // Play state, written by the sheet rather than the builder. It is part of the same document, so
  // it has to survive the trip and has to survive being rebuilt by the Review step.
  deathSaves: { successes: 1, failures: 2 },
  inspiration: true,
  exhaustion: 2,
  conditions: ['Frightened', 'Prone'],
  spellSlotsUsed: [1, 0, 2],
  pactSlotsUsed: [0, 1],
  personality: { traits: 'Quiet', ideals: 'Knowledge', bonds: 'My tome', flaws: 'Curiosity', appearance: 'Tall', backstory: 'Long' },
  appearance: { age: '124', height: "5'9\"", weight: '130 lb', eyes: 'grey', skin: 'pale', hair: 'black' },
  faction: { name: 'The Whispered', symbolImageDataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
  portrait: { imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=' },
  notes: 'Owes a favour to something with too many eyes.',
  abilityScoreMethod: 'rolled',
  rolledScores: [17, 14, 13, 12, 10, 8],
  rolledScoreAssignments: { charisma: 17, dexterity: 14, constitution: 13, intelligence: 12, wisdom: 10, strength: 8 },
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
};

/**
 * A Kids on Bikes character. `/api/characters` is one collection per account rather than one per
 * game, so a second system's document has to survive the same trip byte for byte — that is the
 * whole reason a KoB character can hold a campaign seat. The server interprets neither shape.
 */
const kobCharacter = {
  id: '6c2a1f77-11d4-4a8b-9f30-2b7c5e8a41d9',
  systemId: 'kids-on-bikes',
  schemaVersion: 1,
  firstName: 'Marla',
  lastName: 'Okonkwo',
  pronouns: 'they/them',
  description: 'Always carrying a tape recorder.',
  tropeId: 'nosy-neighbor',
  age: 'Teen',
  fromScratch: false,
  statDice: { brains: 'd10', brawn: 'd4', fight: 'd6', flight: 'd8', charm: 'd12', grit: 'd6' },
  strengthIds: ['fast-talker', 'skilled-at'],
  skilledAt: 'picking locks',
  flawId: null,
  customFlaw: 'Cannot leave a question unanswered.',
  motivation: 'Prove the sightings were real.',
  fear: 'Being disbelieved.',
  obligations: 'Paper route every morning.',
  knacks: ['Knows every shortcut in town'],
  backpack: 'Tape recorder, spare batteries, a map with pins.',
  tropeAnswers: ['The Hendersons.', 'Because nobody else was looking.'],
  bike: { colorId: 'red', upgradeId: 'basket', name: 'Scoop', origin: 'Handed down.', favoriteMemory: 'The storm drain.' },
  relationships: [{ id: 'r1', who: 'Danny', connection: 'Neighbour', kind: 'positive', question: 'What do you owe them?', answer: 'A tape.' }],
  bondedActions: [{ actionId: 'cover-me', customName: '', withCharacter: 'Danny', backstory: 'Three summers.' }],
  adversityTokens: 5,
  notes: 'Session 2: the lights again.',
  createdAt: '2026-08-02T09:00:00.000Z',
  updatedAt: '2026-08-14T09:00:00.000Z',
};

/** The fields loadCharacterIntoBuilder needs; named so a failure says which one was dropped. */
const builderChoiceFields = [
  'abilityScoreChoiceModes',
  'abilityScoreChoiceSelections',
  'backgroundLanguageSelections',
  'speciesLanguageSelections',
  'toolProficiencySelections',
  'abilityScoreMethod',
  'rolledScores',
  'rolledScoreAssignments',
  'deathSaves',
  'inspiration',
  'exhaustion',
  'conditions',
  'spellSlotsUsed',
  'pactSlotsUsed',
];

// One cookie jar per simulated device: the same account signed in twice, which is what "open it on
// another device" means once identity is a session cookie.
const jars = {};

async function call(device, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(jars[device] ? { Cookie: jars[device] } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const setCookie = (res.headers.getSetCookie?.() ?? []).find((line) => line.startsWith('dnd_session='));
  if (setCookie && !setCookie.startsWith('dnd_session=;')) jars[device] = setCookie.split(';')[0];
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
const check = (name, ok, detail = '') => checks.push({ name, ok, detail });

async function scenario() {
  // Device A signs up and saves the character the builder would have produced.
  await call('a', 'POST', '/auth/signup', { username: 'ysolde-player', password: 'correct horse battery staple' });
  const created = await call('a', 'POST', '/api/characters', { id: character.id, data: character });
  check('create returns 201', created.status === 201, created.status);
  check('create starts at version 1', created.json.character?.version === 1, created.json.character?.version);

  // Device B: same account, its own session. This is the Phase 2 gate.
  await call('b', 'POST', '/auth/login', { username: 'ysolde-player', password: 'correct horse battery staple' });
  const listed = await call('b', 'GET', '/api/characters');
  check('device B lists one character', listed.json.characters?.length === 1, listed.json.characters?.length);

  const fetched = await call('b', 'GET', `/api/characters/${character.id}`);
  const roundTripped = fetched.json.character?.data;
  const identical = JSON.stringify(roundTripped) === JSON.stringify(character);
  check('device B document is byte-identical', identical, identical ? '' : JSON.stringify(roundTripped).slice(0, 300));

  const missing = builderChoiceFields.filter((field) => JSON.stringify(roundTripped?.[field]) !== JSON.stringify(character[field]));
  check('every builder choice field survived', missing.length === 0, missing.join(', '));

  // A second system's document in the same collection. Both come back from one list, which is why
  // the sync layer routes each record to its own cache by the document's `systemId`.
  const kobCreated = await call('a', 'POST', '/api/characters', {
    id: kobCharacter.id,
    name: 'Marla Okonkwo',
    summary: 'Teen Nosy Neighbor',
    data: kobCharacter,
  });
  check('a Kids on Bikes document is accepted', kobCreated.status === 201, kobCreated.status);

  const bothListed = await call('b', 'GET', '/api/characters');
  check('both systems list from one collection', bothListed.json.characters?.length === 2, bothListed.json.characters?.length);

  const kobFetched = await call('b', 'GET', `/api/characters/${kobCharacter.id}`);
  const kobRoundTripped = kobFetched.json.character?.data;
  const kobIdentical = JSON.stringify(kobRoundTripped) === JSON.stringify(kobCharacter);
  check('the Kids on Bikes document is byte-identical', kobIdentical, kobIdentical ? '' : JSON.stringify(kobRoundTripped).slice(0, 300));
  check('its systemId survives the trip', kobRoundTripped?.systemId === 'kids-on-bikes', kobRoundTripped?.systemId);

  // Device B edits it; device A still believes in version 1.
  const edited = { ...character, name: 'Ysolde Vane the Unseen', updatedAt: '2026-08-13T12:00:00.000Z' };
  const bWrite = await call('b', 'PUT', `/api/characters/${character.id}`, { version: 1, data: edited });
  check('device B write succeeds', bWrite.status === 200 && bWrite.json.character?.version === 2, bWrite.status);

  const aStale = await call('a', 'PUT', `/api/characters/${character.id}`, { version: 1, data: { ...character, name: 'Clobbered' } });
  check('stale device A write is refused with 409', aStale.status === 409 && aStale.json.error === 'version_conflict', `${aStale.status} ${aStale.json.error}`);
  check('the 409 carries the winning copy', aStale.json.character?.data?.name === 'Ysolde Vane the Unseen', aStale.json.character?.data?.name);

  // A different account must not be able to see it, and must not be able to tell it exists.
  await call('c', 'POST', '/auth/signup', { username: 'someone-else', password: 'hunter2hunter2' });
  const cRead = await call('c', 'GET', `/api/characters/${character.id}`);
  check('another account gets 404, not 403', cRead.status === 404, cRead.status);
  const cList = await call('c', 'GET', '/api/characters');
  check('another account lists nothing', cList.json.characters?.length === 0, cList.json.characters?.length);
}

async function main() {
  const dbDir = mkdtempSync(join(tmpdir(), 'dnd-roundtrip-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: `file:${join(dbDir, 'roundtrip.db').replaceAll('\\', '/')}`,
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
  console.log(`\nround-trip OK: ${checks.length} checks passed`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
