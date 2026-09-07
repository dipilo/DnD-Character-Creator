import { useSyncExternalStore } from 'react';

export interface SheetLayout {
  /** The persistent quick-info rail is a side column rather than a strip above the tabs. */
  railIsColumn: boolean;
  /** Safe to pin the rail. A landscape phone reads as a tablet on width alone and has no height. */
  railIsSticky: boolean;
}

const COLUMN_QUERY = '(min-width: 1024px)';
const TALL_QUERY = '(min-height: 640px)';

const SERVER_LAYOUT: SheetLayout = { railIsColumn: false, railIsSticky: false };

/** `useSyncExternalStore` compares with `Object.is`, so a fresh object per read would loop. */
let cached: SheetLayout | null = null;

function readLayout(): SheetLayout {
  const railIsColumn = window.matchMedia(COLUMN_QUERY).matches;
  const next: SheetLayout = {
    railIsColumn,
    railIsSticky: railIsColumn && window.matchMedia(TALL_QUERY).matches,
  };
  if (cached && cached.railIsColumn === next.railIsColumn && cached.railIsSticky === next.railIsSticky) {
    return cached;
  }
  cached = next;
  return cached;
}

function subscribe(onChange: () => void): () => void {
  const queries = [COLUMN_QUERY, TALL_QUERY].map((query) => window.matchMedia(query));
  for (const query of queries) query.addEventListener('change', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    for (const query of queries) query.removeEventListener('change', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}

/**
 * Whether the sheet's quick-info rail has a column of its own. Read as an external store rather
 * than mirrored into state from an effect, and used to place saves and skills in exactly one
 * place — a rail at desktop width, a leading Stats tab below it.
 */
export function useSheetLayout(): SheetLayout {
  return useSyncExternalStore(subscribe, readLayout, () => SERVER_LAYOUT);
}
