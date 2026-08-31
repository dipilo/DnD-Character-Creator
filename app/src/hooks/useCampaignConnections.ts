import { useEffect, useState } from 'react';
import { listCampaignCharacters, listCharacters, listGroups, listPlayers } from '@/lib/api';
import type { Group, Player } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

/**
 * Everyone this character shares a table with: the other characters seated at its campaign, and
 * the seats nobody has built a character for yet.
 *
 * A relationship can point at a character (`characterId`, the pointer CLAUDE.md describes) or name
 * a person who has no character in the app — a seat is exactly that case, so it is offered as a
 * name to fill in rather than as a pointer to store. Group membership rides along so the list can
 * put the people this character actually plays with first.
 */
export interface CampaignConnection {
  /** Stable option value. A character's own id, or `seat:<playerId>` for a seat. */
  key: string;
  name: string;
  /** The character's summary, or who holds the seat. */
  detail: string | null;
  /** Set only for a real character: this is what `withCharacterId` stores. */
  characterId: string | null;
  groupNames: string[];
  /** In a group this character's own seat is also in. */
  shared: boolean;
}

export interface CampaignConnections {
  connections: CampaignConnection[];
  /** Null until resolved; null after resolving means this character sits at no campaign. */
  campaignId: number | null;
  loading: boolean;
}

interface Loaded {
  key: string;
  connections: CampaignConnection[];
  campaignId: number | null;
}

export function useCampaignConnections(characterId: string | null | undefined): CampaignConnections {
  const signedIn = useAuthStore((state) => Boolean(state.user));
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${characterId ?? ''}:${signedIn ? 'in' : 'out'}`;

  useEffect(() => {
    if (!characterId || !signedIn) return;
    let cancelled = false;
    load(characterId)
      .then((result) => {
        if (!cancelled) setLoaded({ key, ...result });
      })
      .catch((e: unknown) => {
        // An enhancement, not the feature: a relationship is still typed by hand without it.
        console.warn('could not list campaign connections', e instanceof Error ? e.message : e);
        if (!cancelled) setLoaded({ key, connections: [], campaignId: null });
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, key, signedIn]);

  const fresh = loaded?.key === key ? loaded : null;
  return {
    connections: fresh?.connections ?? [],
    campaignId: fresh?.campaignId ?? null,
    loading: signedIn && Boolean(characterId) && fresh === null,
  };
}

/** Which groups each seat is in, and which of them this character's own seat shares. */
function groupIndex(groups: Group[], ownPlayerId: number | null) {
  const byPlayer = new Map<number, string[]>();
  const ownGroups = new Set<number>();
  for (const group of groups) {
    const label = group.name || 'Unnamed group';
    for (const member of group.members) {
      const names = byPlayer.get(member.id) ?? [];
      names.push(label);
      byPlayer.set(member.id, names);
      if (ownPlayerId !== null && member.id === ownPlayerId) ownGroups.add(group.id);
    }
  }
  const sharedPlayers = new Set<number>();
  for (const group of groups) {
    if (!ownGroups.has(group.id)) continue;
    for (const member of group.members) sharedPlayers.add(member.id);
  }
  return { byPlayer, sharedPlayers };
}

function seatLabel(seat: Player): string {
  return seat.name || seat.discord || `Seat #${seat.id}`;
}

async function load(characterId: string): Promise<{ connections: CampaignConnection[]; campaignId: number | null }> {
  const own = await listCharacters();
  const mine = own.find((entry) => entry.id === characterId) ?? null;
  const campaignId = mine?.campaign_id ?? null;
  if (campaignId === null) return { connections: [], campaignId: null };

  const party = await listCampaignCharacters(campaignId);
  // The roster and the group list need membership, which the party list already proved. Losing
  // either only costs the group labels, so neither is allowed to empty the picker.
  const [seats, groups] = await Promise.all([
    listPlayers(campaignId).catch(() => [] as Player[]),
    listGroups(campaignId).catch(() => [] as Group[]),
  ]);

  const { byPlayer, sharedPlayers } = groupIndex(groups, mine?.player_id ?? null);
  const seatsWithCharacter = new Set(party.map((entry) => entry.player_id).filter((id): id is number => id != null));

  const connections: CampaignConnection[] = [];
  for (const entry of party) {
    if (entry.id === characterId) continue;
    const playerId = entry.player_id;
    connections.push({
      key: entry.id,
      name: entry.name ?? 'Unnamed character',
      detail: entry.summary ?? entry.player_name ?? entry.owner_name,
      characterId: entry.id,
      groupNames: playerId != null ? byPlayer.get(playerId) ?? [] : [],
      shared: playerId != null && sharedPlayers.has(playerId),
    });
  }
  for (const seat of seats) {
    if (seatsWithCharacter.has(seat.id)) continue;
    if (mine?.player_id != null && seat.id === mine.player_id) continue;
    connections.push({
      key: `seat:${seat.id}`,
      name: seatLabel(seat),
      detail: 'No character yet',
      characterId: null,
      groupNames: byPlayer.get(seat.id) ?? [],
      shared: sharedPlayers.has(seat.id),
    });
  }

  // People this character actually plays with first, then the rest of the table, each by name.
  connections.sort((a, b) => {
    if (a.shared !== b.shared) return a.shared ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return { connections, campaignId };
}
