import { api } from './client';
import type { Player, PlayerWritePayload } from './types';

/** `campaign_id` is required: without one this meant every player on the server. */
export async function listPlayers(campaignId: number): Promise<Player[]> {
  return await api.get<Player[]>(`/api/players?campaign_id=${encodeURIComponent(campaignId)}`);
}

export async function createPlayer(campaignId: number, payload: PlayerWritePayload): Promise<Player> {
  const body = await api.post<{ player: Player }>('/api/players', { ...payload, campaign_id: campaignId });
  return body.player;
}

export async function updatePlayer(playerId: number, payload: PlayerWritePayload): Promise<Player> {
  const body = await api.put<{ player: Player }>(`/api/players/${playerId}`, payload);
  return body.player;
}

export async function deletePlayer(playerId: number): Promise<void> {
  await api.delete(`/api/players/${playerId}`);
}

export async function reorderPlayers(ids: number[]): Promise<void> {
  await api.post('/api/players/reorder', { ids });
}
