/** A hidden tab pings nothing; waking a slept host is the external pinger's job. */
const INTERVAL_MS = 10 * 60 * 1000;
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

let timer: ReturnType<typeof setInterval> | null = null;

function ping(): void {
  if (document.visibilityState !== 'visible') return;
  // No credentials and no error path: nothing depends on the answer, and a failed ping is the
  // host being down, which every real request will report far better than this can.
  fetch(`${API_BASE}/api/health`, { method: 'GET', cache: 'no-store' }).catch((e: unknown) => {
    console.debug('keep-alive ping failed', e instanceof Error ? e.message : e);
  });
}

export function startBackendKeepAlive(): void {
  if (timer !== null) return;
  timer = setInterval(ping, INTERVAL_MS);
  // A tab coming back to the foreground has missed however many pings; one now is what stops the
  // next click paying for the cold start.
  document.addEventListener('visibilitychange', ping);
}
