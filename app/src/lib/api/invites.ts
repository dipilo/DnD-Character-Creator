import { api } from './client';
import type { CampaignPermissions, Invite, InviteJoinResult, InvitePreview } from './types';

export interface InviteWritePayload {
  expires_at?: string | null;
  /** Empty or non-positive means unlimited; the server stores that as NULL. */
  max_uses?: number | string | null;
  challenge_enabled?: boolean;
  challenge_min_score?: number;
  /**
   * What this link grants whoever joins on it. Omit the field entirely to leave the server's
   * inheritance alone — on create that means "take the campaign's invite default", and sending an
   * empty object instead is an explicit "grant nothing".
   */
  permissions?: CampaignPermissions;
}

export async function listInvites(campaignId: number): Promise<Invite[]> {
  const body = await api.get<{ invites: Invite[] }>(`/api/campaigns/${campaignId}/invites`);
  return body.invites ?? [];
}

export async function createInvite(campaignId: number, payload: InviteWritePayload = {}): Promise<Invite> {
  const body = await api.post<{ invite: Invite }>(`/api/campaigns/${campaignId}/invites`, payload);
  return body.invite;
}

export async function updateInvite(inviteId: number, payload: InviteWritePayload): Promise<Invite> {
  const body = await api.patch<{ invite: Invite }>(`/api/invites/${inviteId}`, payload);
  return body.invite;
}

export async function deleteInvite(inviteId: number): Promise<void> {
  await api.delete(`/api/invites/${inviteId}`);
}

/** Read an invite without consuming it, so a landing page can name the campaign first. */
export async function previewInvite(token: string): Promise<InvitePreview> {
  return await api.get<InvitePreview>(`/api/invites/${encodeURIComponent(token)}`);
}

/**
 * Redeem an invite. Membership is only recorded when the caller has a session — the server used to
 * accept a `discord_id` in the body, which let an anonymous caller join any Discord user to the
 * campaign, so identity now comes from the cookie or not at all.
 */
export async function joinWithInvite(token: string): Promise<InviteJoinResult> {
  return await api.post<InviteJoinResult>('/api/invites/join', { token });
}
