import { api } from './client';
import type {
  Player,
  SheetImportResult,
  SheetIntakeTemplate,
  SheetMapping,
  SheetPreview,
  SheetSyncRequest,
} from './types';

/** The schema is fetched, not declared: a copy in the client is a copy that drifts. */
export async function fetchIntakeTemplate(): Promise<SheetIntakeTemplate> {
  const body = await api.get<{ fields: SheetIntakeTemplate['fields']; templates: SheetIntakeTemplate['templates'] }>(
    '/api/sheet-template',
  );
  return { fields: body.fields, templates: body.templates };
}

/** Reads a sheet's header row and the mapping it auto-resolves to. */
export async function fetchSheetColumns(spreadsheetId: string, gid?: string): Promise<{
  headers: string[];
  mapping: SheetMapping;
  unmatchedHeaders: string[];
  missingRequired: string[];
}> {
  return await api.post('/api/sheet-columns', { spreadsheetId, gid });
}

/** Same body plus `dry_run` and the same shape, so one component renders both. */
export async function previewSheetImport(request: SheetSyncRequest): Promise<SheetPreview> {
  return await api.post<SheetPreview>('/api/sync', { ...request, dry_run: true });
}

export async function runSheetImport(request: SheetSyncRequest): Promise<SheetImportResult> {
  return await api.post<SheetImportResult>('/api/sync', request);
}

/** Re-parses one seat's notes into availability without touching the sheet. */
export async function rebuildSeatAvailability(playerId: number): Promise<number> {
  const body = await api.post<{ created: number }>(`/api/rebuild/${playerId}`, {});
  return body.created;
}

export type { Player };
