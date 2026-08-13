import { api } from './client';
import type { Group, GroupSuggestionResult } from './types';

/** Tables within a campaign. Managing them needs ownership or `can_manage_groups`. */
export async function listGroups(campaignId: number): Promise<Group[]> {
  return await api.get<Group[]>(`/api/groups?campaign_id=${encodeURIComponent(campaignId)}`);
}

export async function createGroup(campaignId: number, name: string, memberIds: number[] = []): Promise<Group> {
  const body = await api.post<{ group: Group }>('/api/groups', {
    campaign_id: campaignId,
    name,
    member_ids: memberIds,
  });
  return body.group;
}

/** `member_ids` replaces the whole membership when present; omit it to rename only. */
export async function updateGroup(
  groupId: number,
  changes: { name?: string; member_ids?: number[] },
): Promise<Group> {
  const body = await api.put<{ group: Group }>(`/api/groups/${groupId}`, changes);
  return body.group;
}

export async function deleteGroup(groupId: number): Promise<void> {
  await api.delete(`/api/groups/${groupId}`);
}

export async function addGroupMember(groupId: number, playerId: number): Promise<Group> {
  const body = await api.post<{ group: Group }>(`/api/groups/${groupId}/members`, { player_id: playerId });
  return body.group;
}

export async function removeGroupMember(groupId: number, playerId: number): Promise<void> {
  await api.delete(`/api/groups/${groupId}/members/${playerId}`);
}

export async function reorderGroups(ids: number[]): Promise<void> {
  await api.post('/api/groups/reorder', { ids });
}

/**
 * Propose a split of the roster. The server sorts by how much availability each player has inside
 * the window and deals them round-robin, so the result is a starting point to edit, not an answer.
 */
export async function suggestGroups(
  campaignId: number,
  numGroups: number,
  window: { start: string; end: string },
): Promise<GroupSuggestionResult> {
  return await api.post<GroupSuggestionResult>('/api/groups/suggest', {
    campaign_id: campaignId,
    numGroups,
    window,
  });
}

export async function saveSuggestedGroups(
  campaignId: number,
  groups: { name: string; member_ids: number[] }[],
): Promise<Group[]> {
  const body = await api.post<{ groups: Group[] }>('/api/groups/save-suggestion', {
    campaign_id: campaignId,
    groups,
  });
  return body.groups ?? [];
}
