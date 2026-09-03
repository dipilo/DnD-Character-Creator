import { useCallback, useEffect, useState } from 'react';

/**
 * One campaign-scoped load, tagged with the request it answers.
 *
 * Tagging is what keeps `loading` derived rather than set from an effect body, the shape the rest
 * of the campaign pages use (`useCampaignData.ts`), and it also stops one campaign's data
 * rendering under another's heading while a switch is in flight.
 */
interface Tagged<T> {
  key: string;
  data: T;
  error: string | null;
}

export interface Loaded<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Replace the held result after a write, so a page does not refetch to show its own change. */
  set: (data: T) => void;
}

function message(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

/**
 * `enabled` is false for a read the caller may not make — the GM's view of everybody's Pre-Game
 * Forms — so a page does not fire a request it already knows will 403.
 *
 * `load` must be stable (wrap it in `useCallback`): it is in the effect's dependency list, and an
 * inline arrow would refetch on every render.
 */
export function useTaggedLoad<T>(
  campaignId: number,
  enabled: boolean,
  load: (campaignId: number) => Promise<T>,
  fallbackError: string,
): Loaded<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Tagged<T> | null>(null);
  const key = `${campaignId}:${attempt}:${enabled}`;

  useEffect(() => {
    if (!Number.isFinite(campaignId) || !enabled) return;
    let cancelled = false;
    load(campaignId)
      .then((data) => {
        if (!cancelled) setResult({ key, data, error: null });
      })
      .catch((e: unknown) => {
        if (!cancelled) setResult({ key, data: null as T, error: message(e, fallbackError) });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, key, enabled, load, fallbackError]);

  const fresh = result?.key === key ? result : null;
  return {
    data: fresh?.data ?? null,
    loading: enabled && fresh === null,
    error: fresh?.error ?? null,
    reload: useCallback(() => setAttempt((n) => n + 1), []),
    set: useCallback((data: T) => setResult((current) => (current ? { ...current, data } : current)), []),
  };
}
