import { useEffect, useState } from 'react';
import { listCampaignCharacters, listCharacters } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/**
 * The other characters seated at the same campaign as this one.
 *
 * The seat is row metadata, never part of the document (see CLAUDE.md), so the campaign a character
 * sits at is the server's to state and this asks it: the owner's own list carries `campaign_id`,
 * and the party list carries everyone else's. Signed out, or on a character with no seat, it simply
 * answers with nothing — a relationship to somebody who is not in the app is still a relationship,
 * and typing a name has to keep working.
 */
export interface PartyMate {
  id: string;
  name: string;
  summary: string | null;
  /** Who plays them, when the campaign has a seat for it. */
  playerName: string | null;
  ownerName: string | null;
}

interface PartyMatesResult {
  key: string;
  mates: PartyMate[];
}

export function useCharacterPartyMates(characterId: string | null | undefined) {
  const signedIn = useAuthStore((state) => Boolean(state.user));
  const [result, setResult] = useState<PartyMatesResult | null>(null);
  const key = `${characterId ?? ''}:${signedIn ? 'in' : 'out'}`;

  useEffect(() => {
    if (!characterId || !signedIn) {
      return;
    }

    let cancelled = false;
    loadPartyMates(characterId)
      .then((mates) => {
        if (!cancelled) setResult({ key, mates });
      })
      .catch((e: unknown) => {
        // An enhancement, not the feature: a relationship is still typed by hand without it.
        console.warn('could not list party mates', e instanceof Error ? e.message : e);
        if (!cancelled) setResult({ key, mates: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [characterId, key, signedIn]);

  const fresh = result?.key === key ? result : null;
  return {
    mates: fresh?.mates ?? [],
    loading: signedIn && Boolean(characterId) && fresh === null,
  };
}

async function loadPartyMates(characterId: string): Promise<PartyMate[]> {
  const own = await listCharacters();
  const campaignId = own.find((entry) => entry.id === characterId)?.campaign_id ?? null;
  if (campaignId === null) {
    return [];
  }

  const party = await listCampaignCharacters(campaignId);
  return party
    .filter((entry) => entry.id !== characterId)
    .map((entry) => ({
      id: entry.id,
      name: entry.name ?? 'Unnamed character',
      summary: entry.summary,
      playerName: entry.player_name,
      ownerName: entry.owner_name,
    }));
}
