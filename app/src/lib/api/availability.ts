import { api } from './client';
import type { AggregateInterval, AvailabilityOp, AvailabilityPreview, AvailabilityRow } from './types';

/** One player's blocks inside a campaign. Both ids are required — the server checks membership. */
export async function listAvailability(playerId: number, campaignId: number): Promise<AvailabilityRow[]> {
  const query = `player_id=${encodeURIComponent(playerId)}&campaign_id=${encodeURIComponent(campaignId)}`;
  return await api.get<AvailabilityRow[]>(`/api/availability?${query}`);
}

/**
 * Coalesced writes. The calendar queues creates, updates and deletes during a drag and flushes
 * them in one request, because the server merges overlapping blocks per operation and doing that
 * one HTTP round trip at a time made a drag look like it was fighting the user.
 */
export async function applyAvailabilityOps(campaignId: number, operations: AvailabilityOp[]): Promise<void> {
  if (operations.length === 0) return;
  await api.post('/api/availability/batch', { campaign_id: campaignId, operations });
}

/**
 * How many players are free across a window, sliced at every block boundary. Used by both the
 * aggregate calendar and the group heatmap.
 */
export async function fetchAggregate(
  campaignId: number,
  startIso: string,
  endIso: string,
  playerIds?: number[] | null,
): Promise<AggregateInterval[]> {
  const params = new URLSearchParams({
    campaign_id: String(campaignId),
    start: startIso,
    end: endIso,
  });
  if (playerIds && playerIds.length > 0) params.set('player_ids', playerIds.join(','));
  const body = await api.get<{ intervals: AggregateInterval[] }>(`/api/availability/aggregate?${params}`);
  return body.intervals ?? [];
}

/**
 * Parse free-text notes into blocks without saving anything. The heuristics behind this are
 * loose (MERGE_PLAN.md §13), which is exactly why the player confirms the result before it is
 * written rather than the server rebuilding silently on save.
 */
export async function previewAvailabilityFromText(
  text: string,
  timezone: string,
  daysAhead = 14,
): Promise<AvailabilityPreview> {
  return await api.post<AvailabilityPreview>('/api/availability/preview', { text, timezone, daysAhead });
}
