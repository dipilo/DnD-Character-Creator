import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * zustand's `persist` middleware calls `setItem` synchronously inside the same `set()` that drives
 * the click that triggered it — `JSON.stringify` plus `localStorage.setItem` on a document full of
 * spells and equipment runs long enough to be felt as the button itself being slow. Debouncing the
 * write lets the state update (and the paint it produces) finish first; the write still lands within
 * a keystroke of the edit; and coalescing rapid edits (a slot toggled twice) avoids writing the
 * middle state at all.
 *
 * The delay is only safe because every pending write is flushed when the page is hidden. A phone
 * browser freezes a backgrounded tab without running its timers, so an edit made in the last
 * quarter-second before the user switched apps was simply lost.
 */
export function createDebouncedLocalStorage<T>(delayMs = 250): PersistStorage<T> {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const queued = new Map<string, StorageValue<T>>();

  const write = (name: string) => {
    const value = queued.get(name);
    if (value === undefined) return;
    queued.delete(name);
    const timer = timers.get(name);
    if (timer) clearTimeout(timer);
    timers.delete(name);
    try {
      localStorage.setItem(name, JSON.stringify(value));
    } catch (error) {
      // A failed write is the whole document not saving, and it happens in a timer where nothing
      // is watching: say so rather than let it disappear.
      console.error(`Could not persist "${name}" to localStorage`, (error as Error)?.message ?? error);
    }
  };

  const flushAll = () => {
    const names = [...queued.keys()];
    for (const name of names) write(name);
  };

  // `beforeunload` does not fire reliably on mobile; `pagehide` and the hidden transition do.
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flushAll);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushAll();
    });
  }

  return {
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<T>) : null;
    },
    setItem: (name, value) => {
      queued.set(name, value);
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(name, setTimeout(() => write(name), delayMs));
    },
    removeItem: (name) => {
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.delete(name);
      queued.delete(name);
      localStorage.removeItem(name);
    }
  };
}
