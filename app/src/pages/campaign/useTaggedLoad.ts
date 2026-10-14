import { useCallback, useEffect, useState } from 'react';

/** Tagging keeps `loading` derived and stops one campaign rendering under another. */
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

/** `enabled` skips a read that would 403; `load` must be stable or it refetches. */
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
