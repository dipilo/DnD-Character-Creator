import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

async function loadTypeScript(path, transform = (source) => source) {
  const source = transform(readFileSync(new URL(path, import.meta.url), 'utf8'));
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { waitForDice } = await loadTypeScript('../src/lib/diceOperation.ts');
const { apiRequest, ApiError, isOffline } = await loadTypeScript(
  '../src/lib/api/client.ts', (source) => source.replaceAll('import.meta.env', '({})'),
);

const storeFixtureUrl = `data:text/javascript,${encodeURIComponent(`
  let auth;
  let sync;
  export const setSnapshot = (nextAuth, nextSync) => { auth = nextAuth; sync = nextSync; };
  export const useAuthStore = (selector) => selector(auth);
  export const useCharacterSyncStore = () => sync;
`)}`;
const { setSnapshot } = await import(storeFixtureUrl);
const { useCharacterLibraryStatus } = await loadTypeScript(
  '../src/hooks/useCharacterLibraryStatus.ts',
  (source) => source
    .replaceAll("'@/store/authStore'", JSON.stringify(storeFixtureUrl))
    .replaceAll("'@/store/characterSync'", JSON.stringify(storeFixtureUrl)),
);

test('an empty library is only confirmed after authentication and sync resolve', () => {
  const auth = { status: 'authenticated', error: null };
  const sync = { status: 'idle', enabled: true, lastSyncedAt: '2026-10-03T12:00:00Z', error: null };
  for (const status of ['syncing', 'offline', 'error']) {
    setSnapshot(auth, { ...sync, status });
    assert.equal(useCharacterLibraryStatus().emptyConfirmed, false, status);
  }
  setSnapshot(auth, { ...sync, lastSyncedAt: null });
  assert.equal(useCharacterLibraryStatus().emptyConfirmed, false, 'first download has not finished');
  setSnapshot({ status: 'unknown', error: null }, sync);
  assert.equal(useCharacterLibraryStatus().loading, true);
  setSnapshot({ status: 'anonymous', error: 'request_timeout' }, { ...sync, enabled: false });
  assert.equal(useCharacterLibraryStatus().sessionFailed, true);
  assert.equal(useCharacterLibraryStatus().emptyConfirmed, false);
  setSnapshot(auth, { ...sync, enabled: false });
  assert.equal(useCharacterLibraryStatus().sessionExpired, true);
  setSnapshot(auth, sync);
  assert.equal(useCharacterLibraryStatus().emptyConfirmed, true);
});

test('turning off a scene rejects an abandoned roll and releases its caller', async () => {
  const controller = new AbortController();
  let rolling = true;
  const pending = waitForDice(() => new Promise(() => {}), controller.signal)
    .finally(() => { rolling = false; });
  const rejected = assert.rejects(pending, /cancelled/);
  await Promise.resolve();
  controller.abort();
  await rejected;
  assert.equal(rolling, false);
  assert.deepEqual(await waitForDice(async () => [6], new AbortController().signal), [6]);
});

test('a cancelled scene never starts another engine operation', async () => {
  const controller = new AbortController();
  let invoked = false;
  const pending = waitForDice(async () => { invoked = true; }, controller.signal);
  controller.abort();
  await assert.rejects(pending);
  assert.equal(invoked, false);
  await assert.rejects(waitForDice(async () => { invoked = true; }, controller.signal));
  assert.equal(invoked, false);
});

test('late dice completion cannot settle a cancelled roll a second time', async () => {
  const controller = new AbortController();
  let finish;
  let settlements = 0;
  const pending = waitForDice(() => new Promise((resolve) => { finish = resolve; }), controller.signal)
    .then(() => { settlements += 1; }, () => { settlements += 1; });
  await Promise.resolve();
  controller.abort();
  await pending;
  finish([20]);
  await Promise.resolve();
  assert.equal(settlements, 1);
});

test('an interrupted response body is a retryable network failure', async (context) => {
  context.mock.method(globalThis, 'fetch', async () => ({
    ok: true,
    text: async () => { throw new DOMException('Response timed out', 'TimeoutError'); },
  }));
  await assert.rejects(apiRequest('GET', '/api/characters'), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'request_timeout');
    assert.ok(isOffline(error));
    return true;
  });
});

test('retry carries the session cookie and preserves HTTP authorization errors', async (context) => {
  let requests = 0;
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests += 1;
    assert.equal(options.credentials, 'include');
    assert.ok(options.signal instanceof AbortSignal);
    if (requests === 1) return new Response('{"error":"not_authenticated"}', { status: 401 });
    return new Response('{"characters":[{"id":"saved-on-another-device"}]}');
  });
  await assert.rejects(apiRequest('GET', '/api/characters'), (error) => error.status === 401 && !isOffline(error));
  assert.deepEqual(await apiRequest('GET', '/api/characters'), {
    characters: [{ id: 'saved-on-another-device' }],
  });
});
