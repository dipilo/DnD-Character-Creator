import { api } from './client';
import type { PreGameForm, PreGameFormData, PreGameFormSummary } from './types';

/** Three reads; the merge is the server's, or a client would be handed the forms first. */
export async function getMyPreGameForm(campaignId: number): Promise<PreGameForm | null> {
  const body = await api.get<{ form: PreGameForm | null }>(
    `/api/pre-game-form?campaign_id=${encodeURIComponent(campaignId)}`,
  );
  return body.form ?? null;
}

export async function savePreGameForm(campaignId: number, data: PreGameFormData): Promise<PreGameForm> {
  const body = await api.put<{ form: PreGameForm }>('/api/pre-game-form', { campaign_id: campaignId, data });
  return body.form;
}

/** Every member's form, with names. The campaign owner's alone; anyone else gets 403. */
export async function listPreGameForms(campaignId: number): Promise<PreGameForm[]> {
  const body = await api.get<{ forms: PreGameForm[] }>(
    `/api/pre-game-forms?campaign_id=${encodeURIComponent(campaignId)}`,
  );
  return body.forms ?? [];
}

export async function getPreGameFormSummary(campaignId: number): Promise<PreGameFormSummary> {
  const body = await api.get<{ summary: PreGameFormSummary }>(
    `/api/pre-game-form/summary?campaign_id=${encodeURIComponent(campaignId)}`,
  );
  return body.summary;
}
