// The server's own copy, as a `version_conflict` refusal attaches it.
//
// Both write paths need it: the sheet's debounced push and the builder's Review save. Which
// version wins is the player's answer to give, so nothing here decides — it only reads.
import { ApiError, isConflict } from '@/lib/api';
import type { CharacterRecord } from '@/lib/api';

export function conflictingRecord(error: unknown): CharacterRecord | null {
  if (!isConflict(error) || !(error instanceof ApiError)) return null;
  const body = error.body;
  if (!body || typeof body !== 'object' || !('character' in body)) return null;
  const record = (body as { character: unknown }).character;
  if (!record || typeof record !== 'object' || !('version' in record)) return null;
  return record as CharacterRecord;
}
