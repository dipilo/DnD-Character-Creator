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

/**
 * The fields a sheet's trackers write, on either game's document.
 *
 * A version conflict over these is not a disagreement about the character: two people at one table
 * clicking spell slots and hit points is the case the shared sheet exists for, and asking which
 * whole document wins would throw one of their clicks away. Anything outside this list is a real
 * edit and still gets the question.
 *
 * `classes[].hitDiceUsed` is deliberately absent. It is nested inside an array of class entries, so
 * merging it means merging that array, and a level change lives in the same object.
 */
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

/**
 * Their document with this writer's tracker changes laid back on top, or null when the two have to
 * be chosen between.
 *
 * Last write per field, computed against the version this writer started from: a field they did not
 * touch keeps whatever the other writer put there, which is what makes this a merge rather than a
 * quieter way of picking "mine".
 */
export function mergeTrackerEdits<T extends object>(base: T, mine: T, theirs: T): T | null {
  const changed = changedKeys(base as Record<string, unknown>, mine as Record<string, unknown>);
  if (!changed.every((key) => TRACKER_FIELDS.has(key))) return null;

  const merged = { ...theirs } as Record<string, unknown>;
  for (const key of changed) merged[key] = (mine as Record<string, unknown>)[key];
  return merged as T;
}
