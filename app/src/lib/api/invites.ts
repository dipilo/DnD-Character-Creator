import { api } from './client';
import type { CampaignPermissions, Invite, InviteJoinResult, InvitePreview } from './types';

export interface InviteWritePayload {
  expires_at?: string | null;
  /** Empty or non-positive means unlimited; the server stores that as NULL. */
  max_uses?: number | string | null;
  challenge_enabled?: boolean;
  challenge_min_score?: number;
  /** Omitted takes the campaign's default; an empty object is an explicit "grant nothing". */
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

/** Identity comes from the cookie: a body `discord_id` let anyone join any user. */
export async function joinWithInvite(token: string, characterEditConsent = false): Promise<InviteJoinResult> {
  return await api.post<InviteJoinResult>('/api/invites/join', {
    token,
    character_edit_consent: characterEditConsent,
  });
}
