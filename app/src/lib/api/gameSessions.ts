import { api } from './client';
import type { GameSession, SessionRoll } from './types';

/**
 * Play sessions and the roll feed they collect.
 *
 * The feed is polled with `after`, the last roll id already held, so a poll asks for what is new
 * rather than for the whole session again.
 */
export async function listGameSessions(campaignId: number): Promise<{ sessions: GameSession[]; canManage: boolean }> {
  const body = await api.get<{ sessions: GameSession[]; can_manage: boolean }>(
    `/api/game-sessions?campaign_id=${encodeURIComponent(campaignId)}`,
  );
  return { sessions: body.sessions ?? [], canManage: Boolean(body.can_manage) };
}

export async function startGameSession(
  campaignId: number,
  options: { name?: string; groupId?: number } = {},
): Promise<GameSession> {
  const body = await api.post<{ session: GameSession }>('/api/game-sessions', {
    campaign_id: campaignId,
    name: options.name,
    group_id: options.groupId,
  });
  return body.session;
}

export async function endGameSession(sessionId: number): Promise<GameSession> {
  const body = await api.post<{ session: GameSession }>(`/api/game-sessions/${sessionId}/end`, {});
  return body.session;
}

export async function listSessionRolls(sessionId: number, after = 0): Promise<SessionRoll[]> {
  const body = await api.get<{ rolls: SessionRoll[] }>(
    `/api/game-sessions/${sessionId}/rolls?after=${encodeURIComponent(after)}`,
  );
  return body.rolls ?? [];
}

export async function postSessionRoll(sessionId: number, roll: {
  label: string;
  notation: string;
  total: number;
  detail?: string;
  note?: string;
  characterName?: string;
  results?: Array<{ value: number; sides: number; dropped?: boolean }>;
}): Promise<SessionRoll> {
  const body = await api.post<{ roll: SessionRoll }>(`/api/game-sessions/${sessionId}/rolls`, {
    label: roll.label,
    notation: roll.notation,
    total: roll.total,
    detail: roll.detail,
    note: roll.note,
    character_name: roll.characterName,
    results: roll.results,
  });
  return body.roll;
}
