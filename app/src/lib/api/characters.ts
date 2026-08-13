import { api } from './client';
import type { CharacterImportResult, CharacterRecord, CharacterRecordSummary, CharacterWritePayload } from './types';
import type { Character } from '@/types/dnd';

/**
 * Characters stored server-side (MERGE_PLAN.md Phase 2). Listing returns summaries only: the
 * documents can carry a portrait data URL each, so a client fetches the ones it actually needs.
 */
export async function listCharacters(campaignId?: number): Promise<CharacterRecordSummary[]> {
  const query = campaignId === undefined ? '' : `?campaign_id=${encodeURIComponent(campaignId)}`;
  const body = await api.get<{ characters: CharacterRecordSummary[] }>(`/api/characters${query}`);
  return body.characters ?? [];
}

export async function getCharacter(id: string): Promise<CharacterRecord> {
  const body = await api.get<{ character: CharacterRecord }>(`/api/characters/${encodeURIComponent(id)}`);
  return body.character;
}

export async function createCharacter(payload: CharacterWritePayload): Promise<CharacterRecord> {
  const body = await api.post<{ character: CharacterRecord }>('/api/characters', payload);
  return body.character;
}

/**
 * Update one character. `version` is the version last seen; the server answers 409 with its own
 * copy when the sheet moved on elsewhere, rather than clobbering the other device's edit.
 */
export async function updateCharacter(id: string, version: number, payload: CharacterWritePayload): Promise<CharacterRecord> {
  const body = await api.put<{ character: CharacterRecord }>(`/api/characters/${encodeURIComponent(id)}`, { ...payload, version });
  return body.character;
}

export async function deleteCharacter(id: string): Promise<void> {
  await api.delete(`/api/characters/${encodeURIComponent(id)}`);
}

/** The one-time upload offered when someone signs in with characters already in localStorage. */
export async function importCharacters(characters: Character[]): Promise<CharacterImportResult> {
  return await api.post<CharacterImportResult>('/api/characters/import', {
    characters: characters.map((character) => ({ id: character.id, name: character.name, data: character })),
  });
}
