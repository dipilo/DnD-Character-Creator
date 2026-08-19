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
} from './types';

/**
 * Characters stored server-side (MERGE_PLAN.md Phase 2). Listing returns summaries only: the
 * documents can carry a portrait data URL each, so a client fetches the ones it actually needs.
 */
export async function listCharacters(campaignId?: number): Promise<CharacterRecordSummary[]> {
  const query = campaignId === undefined ? '' : `?campaign_id=${encodeURIComponent(campaignId)}`;
  const body = await api.get<{ characters: CharacterRecordSummary[] }>(`/api/characters${query}`);
  return body.characters ?? [];
}

/**
 * Every character seated at a campaign, whoever owns it (MERGE_PLAN.md Phase 5) — the party view.
 * Summaries only, like every other character list; open the ones you want by id, which the server
 * allows for any campaign-mate of a seated character.
 */
export async function listCampaignCharacters(campaignId: number): Promise<CampaignCharacterSummary[]> {
  const body = await api.get<{ characters: CampaignCharacterSummary[] }>(`/api/campaigns/${campaignId}/characters`);
  return body.characters ?? [];
}

/**
 * Attach a character to a campaign seat, or take it off one. Deliberately not the document write:
 * no `version` rides along, because seating a character does not edit it — which also means a page
 * holding only the summary can do this without fetching the whole sheet.
 */
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

/**
 * The one-time upload offered when someone signs in with characters already in localStorage.
 *
 * Entries arrive already named and summarised, because only the owning system's cache knows how to
 * do either — a Kids on Bikes document has no `name` field and no character level.
 */
export async function importCharacters(entries: CharacterImportEntry[]): Promise<CharacterImportResult> {
  return await api.post<CharacterImportResult>('/api/characters/import', { characters: entries });
}

/* -------------------------------------------------------------------------
 * Sharing. Everything here is the owner's: a granted editor may write the
 * document and nothing else, so none of these routes answer to them.
 * ------------------------------------------------------------------------- */

/** The current sharing state. Reading it mints the share link if there is not one yet. */
export async function getCharacterSharing(id: string): Promise<CharacterSharing> {
  const body = await api.get<{ sharing: CharacterSharing }>(`/api/characters/${encodeURIComponent(id)}/sharing`);
  return body.sharing;
}

/**
 * Change who may open the sheet. One link serves every visibility, so narrowing a character
 * narrows every URL already handed out; `rotateToken` is the harder revoke that invalidates them.
 */
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

/**
 * Hand the sheet to one account, or to whoever runs one campaign. The subject has to be someone
 * the owner already shares a table with, so this cannot be used to probe for accounts.
 */
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

/**
 * Open a character from a share link. Signed out is a real case — that is what `public` means — so
 * this is the one character read that does not require a session; a link to a narrower character
 * simply 404s for anyone it does not cover.
 */
export async function getSharedCharacter(token: string): Promise<CharacterRecord> {
  const body = await api.get<{ character: CharacterRecord }>(`/api/shared/characters/${encodeURIComponent(token)}`);
  return body.character;
}
