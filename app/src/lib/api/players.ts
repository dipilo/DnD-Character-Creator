import { api } from './client';
import type { Player, PlayerWritePayload } from './types';

/**
 * Campaign seats. `campaign_id` is required on the list route — a request without one used to
 * mean "every player on the server", which is the cross-campaign leak the server now refuses.
 */
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
