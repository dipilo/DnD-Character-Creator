import { api } from './client';
import type { PoweredCharacter, PoweredCharacterData, PoweredCharacterPlayPatch } from './types';

/** Two writes: the document is the owner's, the Tokens and Aspects every member's. */
export async function listPoweredCharacters(campaignId: number): Promise<PoweredCharacter[]> {
  const body = await api.get<{ powered_characters: PoweredCharacter[] }>(
    `/api/powered-characters?campaign_id=${encodeURIComponent(campaignId)}`,
  );
  return body.powered_characters ?? [];
}

export async function createPoweredCharacter(campaignId: number, data: Partial<PoweredCharacterData>): Promise<PoweredCharacter> {
  const body = await api.post<{ powered_character: PoweredCharacter }>('/api/powered-characters', {
    campaign_id: campaignId,
    data,
  });
  return body.powered_character;
}

/** A player's spend bumps the version, so a stale edit is refused, not their move undone. */
export async function updatePoweredCharacter(
  id: number,
  version: number,
  data: PoweredCharacterData,
): Promise<PoweredCharacter> {
  const body = await api.put<{ powered_character: PoweredCharacter }>(`/api/powered-characters/${id}`, { version, data });
  return body.powered_character;
}

export async function playPoweredCharacter(id: number, patch: PoweredCharacterPlayPatch): Promise<PoweredCharacter> {
  const body = await api.put<{ powered_character: PoweredCharacter }>(`/api/powered-characters/${id}/play`, patch);
  return body.powered_character;
}

export async function deletePoweredCharacter(id: number): Promise<void> {
  await api.delete(`/api/powered-characters/${id}`);
}
