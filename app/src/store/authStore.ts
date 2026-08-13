// Account state (MERGE_PLAN.md Phase 3).
//
// Deliberately **not** persisted: the httpOnly session cookie is the source of truth and script
// cannot read it, so anything cached here would only be a second, stale opinion about who you are.
// The store is hydrated once from `GET /api/me` — see `hydrateAuth`, which `main.tsx` calls at
// boot rather than a component calling `setState` inside an effect (CLAUDE.md).
import { create } from 'zustand';
import { ApiError, fetchCurrentUser, login, logout, logoutEverywhere, signup } from '@/lib/api';
import type { AuthUser, Credentials } from '@/lib/api';
import { setSyncEnabled, syncCharacters } from '@/store/characterSync';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** A sign-in, sign-up or sign-out request is in flight. */
  pending: boolean;
  /** The server's error code for the last failed credential attempt, if any. */
  error: string | null;

  signIn: (credentials: Credentials) => Promise<boolean>;
  register: (credentials: Credentials) => Promise<boolean>;
  signOut: () => Promise<void>;
  signOutEverywhere: () => Promise<void>;
  clearError: () => void;
}

/**
 * Signing in and out is also the boundary the character cache syncs across: a session means the
 * server holds the record, and no session means localStorage is all there is.
 */
function applyIdentity(user: AuthUser | null): void {
  setSyncEnabled(Boolean(user));
  if (user) void syncCharacters();
}

function errorCode(e: unknown): string {
  if (e instanceof ApiError) return e.code;
  return e instanceof Error ? e.message : 'unknown_error';
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: 'unknown',
  user: null,
  pending: false,
  error: null,

  signIn: async (credentials) => {
    set({ pending: true, error: null });
    try {
      const user = await login(credentials);
      set({ status: 'authenticated', user, pending: false, error: null });
      applyIdentity(user);
      return true;
    } catch (e) {
      set({ pending: false, error: errorCode(e) });
      return false;
    }
  },

  register: async (credentials) => {
    set({ pending: true, error: null });
    try {
      const user = await signup(credentials);
      set({ status: 'authenticated', user, pending: false, error: null });
      applyIdentity(user);
      return true;
    } catch (e) {
      set({ pending: false, error: errorCode(e) });
      return false;
    }
  },

  signOut: async () => {
    set({ pending: true });
    try {
      await logout();
    } catch (e) {
      // The cookie may already be dead; the local state has to end up signed out either way.
      console.warn('sign out request failed', errorCode(e));
    }
    set({ status: 'anonymous', user: null, pending: false, error: null });
    applyIdentity(null);
  },

  signOutEverywhere: async () => {
    set({ pending: true });
    try {
      await logoutEverywhere();
    } catch (e) {
      console.warn('sign out everywhere failed', errorCode(e));
    }
    set({ status: 'anonymous', user: null, pending: false, error: null });
    applyIdentity(null);
  },

  clearError: () => set({ error: null }),
}));

let hydration: Promise<void> | null = null;

/**
 * Ask the server who the cookie belongs to. Runs once at boot; a failed request leaves the status
 * at `anonymous` rather than blocking the app, because the builder works signed out.
 */
export function hydrateAuth(): Promise<void> {
  hydration ??= (async () => {
    try {
      const user = await fetchCurrentUser();
      useAuthStore.setState({ status: user ? 'authenticated' : 'anonymous', user });
      applyIdentity(user);
    } catch (e) {
      console.warn('could not resolve the current session', errorCode(e));
      useAuthStore.setState({ status: 'anonymous', user: null });
      applyIdentity(null);
    }
  })();
  return hydration;
}
