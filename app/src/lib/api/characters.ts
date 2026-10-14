import { api } from './client';
import type {
  CampaignCharacterSummary,
  CharacterGrantAccess,
  CharacterGrantSubject,
  CharacterSharing,
  CharacterVisibility,
  CharacterImportEntry,
  CharacterImportResult,
  CharacterRecord,
  CharacterRecordSummary,
  CharacterSeat,
  CharacterWritePayload,
  SharedCharacterSummary,
} from './types';

/** Listing returns summaries only: each document can carry a portrait data URL. */
export async function listCharacters(campaignId?: number): Promise<CharacterRecordSummary[]> {
  const query = campaignId === undefined ? '' : `?campaign_id=${encodeURIComponent(campaignId)}`;
  const body = await api.get<{ characters: CharacterRecordSummary[] }>(`/api/characters${query}`);
  return body.characters ?? [];
}

/** The party view; summaries only, opened by id like every other character list. */
export async function listCampaignCharacters(campaignId: number): Promise<CampaignCharacterSummary[]> {
  const body = await api.get<{ characters: CampaignCharacterSummary[] }>(`/api/campaigns/${campaignId}/characters`);
  return body.characters ?? [];
}

/** Nothing notifies a grantee, so this list is how they find out at all. */
export async function listSharedCharacters(): Promise<SharedCharacterSummary[]> {
  const body = await api.get<{ characters: SharedCharacterSummary[] }>('/api/characters/shared-with-me');
  return body.characters ?? [];
}

/** Not the document write: no `version`, so a page holding the summary can do it. */
export async function setCharacterSeat(id: string, seat: CharacterSeat): Promise<CharacterRecordSummary> {
  const body = await api.put<{ character: CharacterRecordSummary }>(
    `/api/characters/${encodeURIComponent(id)}/seat`,
    { campaign_id: seat.campaign_id, player_id: seat.player_id ?? null },
  );
  return body.character;
}

export async function getCharacter(id: string): Promise<CharacterRecord> {
  const body = await api.get<{ character: CharacterRecord }>(`/api/characters/${encodeURIComponent(id)}`);
  return body.character;
}

export async function createCharacter(payload: CharacterWritePayload): Promise<CharacterRecord> {
  const body = await api.post<{ character: CharacterRecord }>('/api/characters', payload);
  return body.character;
}

/** 409 with the server's copy rather than clobbering another device's edit. */
export async function updateCharacter(id: string, version: number, payload: CharacterWritePayload): Promise<CharacterRecord> {
  const body = await api.put<{ character: CharacterRecord }>(`/api/characters/${encodeURIComponent(id)}`, { ...payload, version });
  return body.character;
}

export async function deleteCharacter(id: string): Promise<void> {
  await api.delete(`/api/characters/${encodeURIComponent(id)}`);
}

/** Named and summarised by the owning cache: a KoB document has no `name` field. */
export async function importCharacters(entries: CharacterImportEntry[]): Promise<CharacterImportResult> {
  return await api.post<CharacterImportResult>('/api/characters/import', { characters: entries });
}

/** The current sharing state. Reading it mints the share link if there is not one yet. */
export async function getCharacterSharing(id: string): Promise<CharacterSharing> {
  const body = await api.get<{ sharing: CharacterSharing }>(`/api/characters/${encodeURIComponent(id)}/sharing`);
  return body.sharing;
}

/** One link serves every visibility; `rotateToken` is the harder revoke. */
export async function setCharacterSharing(
  id: string,
  patch: { visibility?: CharacterVisibility; rotateToken?: boolean },
): Promise<CharacterSharing> {
  const body = await api.put<{ sharing: CharacterSharing }>(`/api/characters/${encodeURIComponent(id)}/sharing`, {
    ...(patch.visibility ? { visibility: patch.visibility } : {}),
    rotate_token: Boolean(patch.rotateToken),
  });
  return body.sharing;
}

/** The subject must already share a table, so this cannot probe for accounts. */
export async function grantCharacterAccess(
  id: string,
  grant: { subjectType: CharacterGrantSubject; subjectId: number; access: CharacterGrantAccess },
): Promise<CharacterSharing> {
  const body = await api.post<{ sharing: CharacterSharing }>(`/api/characters/${encodeURIComponent(id)}/grants`, {
    subject_type: grant.subjectType,
    subject_id: grant.subjectId,
    access: grant.access,
  });
  return body.sharing;
}

export async function revokeCharacterAccess(id: string, grantId: number): Promise<CharacterSharing> {
  const body = await api.delete<{ sharing: CharacterSharing }>(
    `/api/characters/${encodeURIComponent(id)}/grants/${grantId}`,
  );
  return body.sharing;
}

/** The one character read needing no session; a narrower character simply 404s. */
export async function getSharedCharacter(token: string): Promise<CharacterRecord> {
  const body = await api.get<{ character: CharacterRecord }>(`/api/shared/characters/${encodeURIComponent(token)}`);
  return body.character;
}
