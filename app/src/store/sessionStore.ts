/**
 * The table's shared dice history.
 *
 * A campaign can have one session open at a time; while it is, every roll anybody at that table
 * makes is posted to it, so the DM and the players read the same feed. The store knows the session
 * and the feed; `startSessionBroadcast` is what watches the dice tray from outside and posts, the
 * same direction `characterSync` watches `characterStore`.
 *
 * Nothing here is persisted. A session is a server fact, and a stale one cached in localStorage
 * would have this tab posting rolls into a game that ended yesterday.
 */
import { create } from 'zustand';
import {
  endGameSession,
  listGameSessions,
  listSessionRolls,
  postSessionRoll,
  startGameSession,
  type GameSession,
  type SessionRoll
} from '@/lib/api';
import { useDiceTrayStore, type DiceRollLogEntry } from '@/store/diceTrayStore';

/** How often the feed asks for what is new while a session is open. */
export const SESSION_POLL_MS = 6000;

interface SessionState {
  campaignId: number | null;
  session: GameSession | null;
  /** Every session this campaign has run, newest first. */
  history: GameSession[];
  canManage: boolean;
  rolls: SessionRoll[];
  loading: boolean;
  error: string | null;

  load: (campaignId: number) => Promise<void>;
  start: (name: string, groupId?: number) => Promise<void>;
  end: () => Promise<void>;
  /** Fetch whatever has been rolled since the last roll this tab holds. */
  poll: () => Promise<void>;
  /** The name to put on rolls this tab posts, so the feed says who rolled what. */
  setCharacterName: (name: string | null) => void;
  clear: () => void;
}

/**
 * Which session this tab posts into, and under whose name. Module-level rather than store state
 * because the broadcast watcher reads it on every settled roll and must not re-subscribe.
 */
let activeSessionId: number | null = null;
let activeCharacterName: string | null = null;

const describeError = (error: unknown) =>
  error instanceof Error ? error.message : 'The session could not be loaded.';

export const useSessionStore = create<SessionState>()((set, get) => ({
  campaignId: null,
  session: null,
  history: [],
  canManage: false,
  rolls: [],
  loading: false,
  error: null,

  load: async (campaignId) => {
    set({ loading: true, error: null, campaignId });
    try {
      const { sessions, canManage } = await listGameSessions(campaignId);
      const open = sessions.find((entry) => entry.is_open) ?? null;
      activeSessionId = open?.id ?? null;
      const rolls = open ? await listSessionRolls(open.id, 0) : [];
      set({ session: open, history: sessions, canManage, rolls, loading: false });
    } catch (error) {
      activeSessionId = null;
      set({ loading: false, error: describeError(error) });
    }
  },

  start: async (name, groupId) => {
    const campaignId = get().campaignId;
    if (campaignId === null) return;
    set({ error: null });
    try {
      const session = await startGameSession(campaignId, { name, groupId });
      activeSessionId = session.id;
      set({ session, history: [session, ...get().history], rolls: [] });
    } catch (error) {
      set({ error: describeError(error) });
    }
  },

  end: async () => {
    const session = get().session;
    if (!session) return;
    set({ error: null });
    try {
      const ended = await endGameSession(session.id);
      activeSessionId = null;
      set({
        session: null,
        history: get().history.map((entry) => (entry.id === ended.id ? ended : entry))
      });
    } catch (error) {
      set({ error: describeError(error) });
    }
  },

  poll: async () => {
    const session = get().session;
    if (!session) return;
    const held = get().rolls;
    const after = held.length > 0 ? held[held.length - 1].id : 0;
    try {
      const fresh = await listSessionRolls(session.id, after);
      if (fresh.length > 0) set({ rolls: [...get().rolls, ...fresh] });
    } catch (error) {
      // A failed poll is the next poll's problem: the feed is a view of a server fact, and
      // reporting every dropped request would bury the session in error text.
      console.debug('session feed poll failed', error instanceof Error ? error.message : error);
    }
  },

  setCharacterName: (name) => {
    activeCharacterName = name;
  },

  clear: () => {
    activeSessionId = null;
    activeCharacterName = null;
    set({ campaignId: null, session: null, history: [], canManage: false, rolls: [], error: null });
  }
}));

/** Whether this tab is posting rolls anywhere. Read by the broadcast watcher on every roll. */
export const getActiveSessionId = () => activeSessionId;

function toRollPayload(entry: DiceRollLogEntry) {
  return {
    label: entry.label,
    notation: entry.notation,
    total: entry.total,
    detail: entry.detail,
    note: entry.note ?? undefined,
    characterName: activeCharacterName ?? undefined,
    results: entry.results.map((result, index) => ({
      value: result.value ?? 0,
      sides: result.sides ?? 0,
      // A die advantage discarded is still shown, so the feed says what was thrown.
      dropped: Boolean(entry.keptIndexes && !entry.keptIndexes.includes(index))
    }))
  };
}

/**
 * Post every roll this tab settles into the open session.
 *
 * Started once from `main.tsx`, because a roll made on a character sheet has to reach the feed
 * just as much as one made on the dice page — a watcher that only ran while the session screen was
 * open would collect nothing anybody actually rolled.
 */
export function startSessionBroadcast(): void {
  let lastSeenId: string | null = useDiceTrayStore.getState().log[0]?.id ?? null;

  useDiceTrayStore.subscribe((state) => {
    const newest = state.log[0];
    if (!newest || newest.id === lastSeenId) return;
    lastSeenId = newest.id;

    const sessionId = activeSessionId;
    if (sessionId === null) return;

    void postSessionRoll(sessionId, toRollPayload(newest))
      .then((roll) => {
        // The poll would pick it up anyway; adding it now is what makes your own roll appear at
        // once rather than up to a poll interval later.
        const store = useSessionStore.getState();
        if (store.session?.id !== sessionId || store.rolls.some((entry) => entry.id === roll.id)) return;
        useSessionStore.setState({ rolls: [...store.rolls, roll] });
      })
      .catch((error: unknown) => {
        console.warn('a roll could not be shared with the table', error instanceof Error ? error.message : error);
      });
  });
}
