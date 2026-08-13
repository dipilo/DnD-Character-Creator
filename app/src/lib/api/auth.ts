import { api, isUnauthorized } from './client';
import type { AuthUser } from './types';

export interface Credentials {
  username: string;
  password: string;
}

/**
 * Who the cookie says we are, or null. The cookie is httpOnly, so this request is the only way the
 * client can learn its own identity — there is nothing in localStorage to read.
 */
export async function fetchCurrentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  try {
    const body = await api.get<{ user: AuthUser }>('/api/me', { signal });
    return body.user ?? null;
  } catch (e) {
    if (isUnauthorized(e)) return null;
    throw e;
  }
}

export async function login(credentials: Credentials): Promise<AuthUser> {
  const body = await api.post<{ user: AuthUser }>('/auth/login', credentials);
  return body.user;
}

export async function signup(credentials: Credentials): Promise<AuthUser> {
  const body = await api.post<{ user: AuthUser }>('/auth/signup', credentials);
  return body.user;
}

/** Sign out this device. The server revokes the session, so a copied cookie dies with it. */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

export async function logoutEverywhere(): Promise<void> {
  await api.post('/auth/logout-all');
}

/**
 * Discord sign-in is a full-page navigation, not a fetch: the callback establishes the session
 * server-side and redirects back, so no window messaging is involved any more (MERGE_PLAN.md §14).
 */
export function discordSignInUrl(returnTo: string = window.location.href): string {
  return `${import.meta.env.VITE_API_BASE ?? ''}/auth/discord?returnTo=${encodeURIComponent(returnTo)}`;
}
