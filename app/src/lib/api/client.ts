// The typed API client (MERGE_PLAN.md Phase 2). It replaces the scheduler's hand-rolled
// client/src/api.js, which is being retired rather than ported.
//
// Every request is same-origin by default and carries the session cookie: the SPA reaches the API
// through the Vercel rewrites for /api and /auth in production (MERGE_PLAN.md §5.2, §14) and the
// Vite dev proxy locally. That is what lets the cookie stay `SameSite=Lax` with no CSRF token, so
// pointing VITE_API_BASE at another origin gives that up — it exists for debugging, not for the
// deployed build.

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/+$/, '');

/** Status used for a request that never reached the server at all. */
export const NETWORK_ERROR_STATUS = 0;

export class ApiError extends Error {
  readonly status: number;
  /** The server's `error` string, or `network_error` when the request never landed. */
  readonly code: string;
  readonly body: unknown;

  constructor(status: number, code: string, body: unknown, message?: string) {
    super(message ?? `${status} ${code}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** The caller has no valid session. Not a failure in itself — the builder works signed out. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** The server refused a write because its copy moved on. See `version_conflict`. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

/**
 * The request never reached the server: offline, a cold-starting host, or no API at all in a
 * local build. The sync layer treats this as "try again later", never as data loss.
 */
export function isOffline(error: unknown): boolean {
  return error instanceof ApiError && error.status === NETWORK_ERROR_STATUS;
}

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // A proxy or an HTML error page; the text is more useful than a parse failure.
    return text;
  }
}

function errorCodeFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'error' in body) {
    const code = (body as { error: unknown }).error;
    if (typeof code === 'string') return code;
  }
  return `http_${status}`;
}

export async function apiRequest<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      // The session cookie is the only identity the server accepts, so it has to ride along even
      // when API_BASE makes the request cross-origin.
      credentials: 'include',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new ApiError(NETWORK_ERROR_STATUS, 'network_error', null, `${method} ${path} did not reach the server: ${message}`);
  }

  const body = await readBody(response);
  if (!response.ok) {
    throw new ApiError(response.status, errorCodeFrom(body, response.status), body);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => apiRequest<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => apiRequest<T>('PUT', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) => apiRequest<T>('PATCH', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => apiRequest<T>('DELETE', path, options),
};
