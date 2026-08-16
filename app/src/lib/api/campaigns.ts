import { api } from './client';
import type { Campaign, CampaignMember, CampaignPermissions, Player, UnclaimedPlayer } from './types';

/**
 * Campaigns and their membership (MERGE_PLAN.md Phase 4). Every campaign-scoped route on the
 * server resolves the campaign and checks membership, so a 403 `not_a_member` here is the
 * boundary working, not a bug to route around.
 */
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

/**
 * What a campaign grants people as they arrive. `member` covers every join; `invite` seeds new
 * invite links, which can still carry a blob of their own.
 */
export async function setCampaignDefaultPermissions(
  campaignId: number,
  scope: 'member' | 'invite',
  permissions: CampaignPermissions,
): Promise<Campaign> {
  const column = scope === 'member' ? 'default_member_permissions' : 'default_invite_permissions';
  const body = await api.put<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`, { [column]: permissions });
  return body.campaign;
}

/**
 * The sources this table plays with (MERGE_PLAN.md Phase 5). Owner-only, and an empty list means no
 * restriction — the same thing an empty selection means in the builder's own source filter.
 */
export async function setCampaignSources(campaignId: number, sourceIds: string[]): Promise<Campaign> {
  const body = await api.put<{ campaign: Campaign }>(`/api/campaigns/${campaignId}`, { allowed_source_ids: sourceIds });
  return body.campaign;
}

/**
 * Read a permission blob the server stored verbatim. Bad JSON reads as "grants nothing" rather
 * than throwing inside a render — the same posture `parseAllowedSourceIds` takes below.
 */
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

/**
 * Read a campaign's allowed sources. The server stores the array as JSON text and does not
 * interpret it, so this is the single place the client parses it — bad JSON reads as "unrestricted"
 * rather than throwing inside a render.
 */
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

/** Create a seat for the signed-in user in a campaign they have just joined. */
export async function addSelfAsPlayer(campaignId: number): Promise<Player> {
  const body = await api.post<{ player: Player }>(`/api/campaigns/${campaignId}/add-self`);
  return body.player;
}

/**
 * Seats nobody owns yet. Deliberately readable without a session so an invite landing page can
 * show them before the visitor has an account.
 */
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
