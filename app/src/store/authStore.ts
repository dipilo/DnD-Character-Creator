// Not persisted: the httpOnly cookie is the record, so a cache would be a stale opinion.
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

/** A session means the server holds the record; none means localStorage is all there is. */
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

/** Once at boot; a failure leaves `anonymous`, because the builder works signed out. */
export function hydrateAuth(): Promise<void> {
  hydration ??= (async () => {
    useAuthStore.setState({ status: 'unknown', error: null });
    try {
      const user = await fetchCurrentUser();
      useAuthStore.setState({ status: user ? 'authenticated' : 'anonymous', user, error: null });
      applyIdentity(user);
    } catch (e) {
      console.warn('could not resolve the current session', errorCode(e));
      useAuthStore.setState({ status: 'anonymous', user: null, error: errorCode(e) });
      applyIdentity(null);
    }
  })().finally(() => { hydration = null; });
  return hydration;
}
