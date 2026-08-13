import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { listCampaignCharacters, listPlayers } from '@/lib/api';
import type { CampaignCharacterSummary, Player } from '@/lib/api';

/** The campaign in the URL. Every page under `/campaign/:campaignId` reads it from here. */
export function useCampaignId(): number {
  const { campaignId } = useParams<{ campaignId: string }>();
  return Number(campaignId);
}

/**
 * What a load produced, tagged with the campaign and attempt it belongs to.
 *
 * Tagging is what lets `loading` be *derived* rather than stored: a result whose key does not
 * match the request in flight is by definition stale. That keeps every `setState` inside a
 * promise callback, which is the shape CLAUDE.md's rule against `setState` in an effect body
 * asks for — and it also stops one campaign's roster flashing up under another's heading.
 */
interface RosterResult {
  key: string;
  players: Player[];
  error: string | null;
}

interface RosterState {
  players: Player[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Replace one seat in place after a write, so the page does not refetch the whole roster. */
  replacePlayer: (player: Player) => void;
}

/**
 * The campaign roster. Held per page rather than in a store: it is server state with no offline
 * story, unlike characters, and a stale roster shown from a cache is worse than a brief spinner.
 */
export function useRoster(campaignId: number): RosterState {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<RosterResult | null>(null);
  const key = `${campaignId}:${attempt}`;

  useEffect(() => {
    if (!Number.isFinite(campaignId)) return;
    let cancelled = false;
    listPlayers(campaignId)
      .then((players) => {
        if (!cancelled) setResult({ key, players, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({ key, players: [], error: e instanceof Error ? e.message : 'Could not load the roster.' });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, key]);

  const replacePlayer = useCallback((player: Player) => {
    setResult((current) => {
      if (!current) return current;
      const index = current.players.findIndex((p) => p.id === player.id);
      const players = index === -1 ? [...current.players, player] : current.players.slice();
      if (index !== -1) players[index] = player;
      return { ...current, players };
    });
  }, []);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const fresh = result?.key === key ? result : null;

  return {
    players: fresh?.players ?? [],
    loading: fresh === null,
    error: fresh?.error ?? null,
    reload,
    replacePlayer,
  };
}

interface PartyResult {
  key: string;
  characters: CampaignCharacterSummary[];
  error: string | null;
}

interface PartyState {
  characters: CampaignCharacterSummary[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** The character seated at one roster entry, when there is one (MERGE_PLAN.md Phase 5). */
  characterForPlayer: (playerId: number) => CampaignCharacterSummary | undefined;
}

/**
 * Every character seated at this campaign, whoever owns it. Held per page for the same reason as
 * the roster: which seat a character sits in is the server's to state, and a stale party list read
 * from a cache is worse than a brief spinner.
 */
export function useCampaignCharacters(campaignId: number): PartyState {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<PartyResult | null>(null);
  const key = `${campaignId}:${attempt}`;

  useEffect(() => {
    if (!Number.isFinite(campaignId)) return;
    let cancelled = false;
    listCampaignCharacters(campaignId)
      .then((characters) => {
        if (!cancelled) setResult({ key, characters, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({ key, characters: [], error: e instanceof Error ? e.message : 'Could not load the party.' });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const fresh = result?.key === key ? result : null;
  const characters = fresh?.characters ?? [];

  return {
    characters,
    loading: fresh === null,
    error: fresh?.error ?? null,
    reload,
    characterForPlayer: (playerId) => characters.find((c) => c.player_id === playerId),
  };
}

/** A seat's display name, falling back through the fields that might carry one. */
export function playerLabel(player: Pick<Player, 'id' | 'name' | 'discord'>): string {
  return player.name || player.discord || `Player #${player.id}`;
}
