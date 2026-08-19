import type { PersistStorage, StorageValue } from 'zustand/middleware';

/**
 * zustand's `persist` middleware calls `setItem` synchronously inside the same `set()` that drives
 * the click that triggered it — `JSON.stringify` plus `localStorage.setItem` on a document full of
 * spells and equipment runs long enough to be felt as the button itself being slow. Debouncing the
 * write lets the state update (and the paint it produces) finish first; the write still lands within
 * a keystroke of the edit; and coalescing rapid edits (a slot toggled twice) avoids writing the
 * middle state at all.
 */
export function createDebouncedLocalStorage<T>(delayMs = 250): PersistStorage<T> {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    getItem: (name) => {
      const raw = localStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<T>) : null;
    },
    setItem: (name, value) => {
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.set(
        name,
        setTimeout(() => {
          timers.delete(name);
          localStorage.setItem(name, JSON.stringify(value));
        }, delayMs)
      );
    },
    removeItem: (name) => {
      const existing = timers.get(name);
      if (existing) clearTimeout(existing);
      timers.delete(name);
      localStorage.removeItem(name);
    }
  };
}
