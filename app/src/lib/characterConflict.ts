// Read by both write paths; which version wins is the player's answer.
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

/** Tracker fields merge; `classes[].hitDiceUsed` is absent, since a level lives in that array. */
const TRACKER_FIELDS = new Set([
  'hp',
  'deathSaves',
  'inspiration',
  'exhaustion',
  'conditions',
  'spellSlotsUsed',
  'pactSlotsUsed',
  'classResourcesUsed',
  // Concentration is dropped and taken up as fast as a slot is spent, and by the same click.
  'concentration',
  // Kids on Bikes keeps one tracker, and it is spent in play exactly like the rest of these.
  'adversityTokens',
]);

/** `updatedAt` moves on every edit, so it says nothing about what was edited. */
const IGNORED_FIELDS = new Set(['updatedAt', 'id']);

const sameValue = (left: unknown, right: unknown) =>
  left === right || JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

function changedKeys(base: Record<string, unknown>, mine: Record<string, unknown>): string[] {
  const keys = new Set([...Object.keys(base), ...Object.keys(mine)]);
  return [...keys].filter((key) => !IGNORED_FIELDS.has(key) && !sameValue(base[key], mine[key]));
}

/** Last write per field against the version started from, which is what makes it a merge. */
export function mergeTrackerEdits<T extends object>(base: T, mine: T, theirs: T): T | null {
  const changed = changedKeys(base as Record<string, unknown>, mine as Record<string, unknown>);
  if (!changed.every((key) => TRACKER_FIELDS.has(key))) return null;

  const merged = { ...theirs } as Record<string, unknown>;
  for (const key of changed) merged[key] = (mine as Record<string, unknown>)[key];
  return merged as T;
}
