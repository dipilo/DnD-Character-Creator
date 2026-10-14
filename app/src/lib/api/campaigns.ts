import { api } from './client';
import type { AutoClaimMode, Campaign, CampaignMember, CampaignPermissions, Player, UnclaimedPlayer } from './types';

/** A 403 `not_a_member` is the boundary working, not something to route around. */
export async function listCampaigns(): Promise<Campaign[]> {
  const body = await api.get<{ campaigns: Campaign[] }>('/api/campaigns');
  return body.campaigns ?? [];
}

export async function createCampaign(name: string, systemId?: string): Promise<Campaign> {
  const body = await api.post<{ campaign: Campaign }>('/api/campaigns', { name, system_id: systemId ?? null });
  return body.campaign;
}

export async function renameCampaign(campaignId: number, name: string): Promise<Campaign> {
  const body = await api.put<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`, { name });
  return body.campaign;
}

/** The game a table plays. Changing it changes which builder its "new character" button opens. */
export async function setCampaignSystem(campaignId: number, systemId: string): Promise<Campaign> {
  const body = await api.put<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`, { system_id: systemId });
  return body.campaign;
}

/** `member` covers every join; `invite` seeds links that can still carry their own blob. */
export async function setCampaignDefaultPermissions(
  campaignId: number,
  scope: 'member' | 'invite',
  permissions: CampaignPermissions,
): Promise<Campaign> {
  const column = scope === 'member' ? 'default_member_permissions' : 'default_invite_permissions';
  const body = await api.put<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`, { [column]: permissions });
  return body.campaign;
}

/** Owner-only, and an empty list is no restriction, as in the builder's own filter. */
export async function setCampaignSources(campaignId: number, sourceIds: string[]): Promise<Campaign> {
  const body = await api.put<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`, { allowed_source_ids: sourceIds });
  return body.campaign;
}

/** Bad JSON reads as "grants nothing" rather than throwing inside a render. */
export function parsePermissionBlob(blob: string | null | undefined): CampaignPermissions {
  if (!blob) return {};
  try {
    const parsed: unknown = JSON.parse(blob);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as CampaignPermissions) : {};
  } catch (e) {
    console.warn('permission blob is not valid JSON', e instanceof Error ? e.message : e);
    return {};
  }
}

/** The single place the client parses it; bad JSON reads as unrestricted. */
export function parseAllowedSourceIds(campaign: Pick<Campaign, 'allowed_source_ids'> | null | undefined): string[] {
  if (!campaign?.allowed_source_ids) return [];
  try {
    const parsed: unknown = JSON.parse(campaign.allowed_source_ids);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch (e) {
    console.warn('campaign allowed_source_ids is not valid JSON', e instanceof Error ? e.message : e);
    return [];
  }
}

export async function deleteCampaign(campaignId: number): Promise<void> {
  await api.delete(`/api/campaigns/${campaignId}`);
}

/** Owners cannot leave — the server answers `owners_cannot_leave`; delete the campaign instead. */
export async function leaveCampaign(campaignId: number): Promise<void> {
  await api.post(`/api/campaigns/${campaignId}/leave`);
}

export async function reorderCampaigns(ids: number[]): Promise<void> {
  await api.post('/api/campaigns/reorder', { ids });
}

/** The join code is a credential: regenerating it invalidates whatever was shared before. */
export async function regenerateCampaignCode(campaignId: number): Promise<Campaign> {
  const body = await api.post<{ campaign: Campaign }>(`/api/campaigns/${campaignId}/regenerate-code`);
  return body.campaign;
}

export async function findCampaignByCode(code: string): Promise<Campaign> {
  const body = await api.get<{ campaign: Campaign }>(`/api/campaigns/code/${encodeURIComponent(code)}`);
  return body.campaign;
}

/** Join a campaign the caller already knows the id of. 400 `already_member` when they are in it. */
export async function joinCampaign(campaignId: number): Promise<Campaign> {
  const body = await api.post<{ campaign: Campaign }>(`/api/campaigns/${campaignId}/members`);
  return body.campaign;
}

export async function listCampaignMembers(campaignId: number): Promise<CampaignMember[]> {
  const body = await api.get<{ members: CampaignMember[] }>(`/api/campaigns/${campaignId}/members`);
  return body.members ?? [];
}

export async function updateMemberPermissions(
  campaignId: number,
  memberId: number,
  permissions: CampaignPermissions,
): Promise<CampaignMember> {
  const body = await api.patch<{ member: CampaignMember }>(
    `/api/campaigns/${campaignId}/members/${memberId}/permissions`,
    { permissions },
  );
  return body.member;
}

/** Takes back the membership only: the seat unclaims and the characters leave, undeleted. */
export async function removeCampaignMember(campaignId: number, memberId: number): Promise<void> {
  await api.delete(`/api/campaigns/${campaignId}/members/${memberId}`);
}

/** Take a character off this table. The document stays its owner's; only the seat is given up. */
export async function removeCampaignCharacter(campaignId: number, characterId: string): Promise<void> {
  await api.delete(`/api/campaigns/${campaignId}/characters/${encodeURIComponent(characterId)}`);
}

/** Create a seat for the signed-in user in a campaign they have just joined. */
export async function addSelfAsPlayer(campaignId: number): Promise<Player> {
  const body = await api.post<{ player: Player }>(`/api/campaigns/${campaignId}/add-self`);
  return body.player;
}

/** Readable without a session, so an invite landing page can show them. */
export async function listUnclaimedPlayers(campaignId: number): Promise<UnclaimedPlayer[]> {
  const body = await api.get<{ players: UnclaimedPlayer[] }>(`/api/campaigns/${campaignId}/unclaimed-players`);
  return body.players ?? [];
}

export interface ClaimPlayerPayload {
  /** Omit to have the server create a new seat instead of claiming an existing one. */
  player_id?: number;
  /** Required when claiming anonymously: it names the account the server creates on the spot. */
  name?: string;
  password?: string;
}

export async function claimPlayer(campaignId: number, payload: ClaimPlayerPayload): Promise<Player> {
  const body = await api.post<{ player: Player }>(`/api/campaigns/${campaignId}/claim-player`, payload);
  return body.player;
}

export async function unclaimPlayer(campaignId: number, playerId: number): Promise<void> {
  await api.post(`/api/campaigns/${campaignId}/unclaim-player`, { player_id: playerId });
}

/** The table's default for whether making a seat also takes it. Owner-only; null is no opinion. */
export async function setCampaignAutoClaim(campaignId: number, mode: AutoClaimMode | null): Promise<Campaign> {
  const body = await api.put<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`, {
    default_auto_claim_seats: mode,
  });
  return body.campaign;
}

/** The caller's own auto-claim setting at this table. Theirs alone, as the consent flag is. */
export async function setOwnAutoClaim(campaignId: number, mode: AutoClaimMode | null): Promise<CampaignMember> {
  const body = await api.put<{ membership: CampaignMember }>(`/api/campaigns/${campaignId}/auto-claim`, { mode });
  return body.membership;
}

/** The owner's override for one member. Null hands the decision back to that member. */
export async function setMemberAutoClaim(
  campaignId: number,
  memberId: number,
  mode: AutoClaimMode | null,
): Promise<CampaignMember> {
  const body = await api.patch<{ member: CampaignMember }>(
    `/api/campaigns/${campaignId}/members/${memberId}/auto-claim`,
    { mode },
  );
  return body.member;
}

/** Owner-only, and only the question: nothing is granted until a player answers. */
export async function setCampaignCharacterEditRequest(campaignId: number, requested: boolean): Promise<Campaign> {
  const body = await api.put<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`, {
    requests_character_edit: requested,
  });
  return body.campaign;
}

/** Covers every character they seat here; the owner cannot grant it to themselves. */
export async function setCharacterEditConsent(campaignId: number, consent: boolean): Promise<CampaignMember> {
  const body = await api.put<{ membership: CampaignMember }>(
    `/api/campaigns/${campaignId}/character-edit-consent`,
    { consent },
  );
  return body.membership;
}
