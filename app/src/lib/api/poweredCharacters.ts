import { api } from './client';
import type { PoweredCharacter, PoweredCharacterData, PoweredCharacterPlayPatch } from './types';

/**
 * The Powered Character (Kids on Bikes, chapter 5). It belongs to a campaign, not to a user.
 *
 * Two writes, because the book gives the GM and the players different rights over the same card:
 * `updatePoweredCharacter` replaces the document and is the owner's, `playPoweredCharacter` moves
 * the Power Tokens and the Aspects and is every member's.
 */
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

/**
 * Replace the document. `version` is the one last seen: a player spending a Power Token bumps it,
 * so an edit written against a stale card is refused rather than undoing their move.
 */
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
