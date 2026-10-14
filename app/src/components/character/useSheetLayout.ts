import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

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

/** An external store, so saves and skills are placed in exactly one spot. */
export function useSheetLayout(): SheetLayout {
  return useSyncExternalStore(subscribe, readLayout, () => SERVER_LAYOUT);
}

/** A column that does not fit is not pinned, so there is only ever one scroll surface. */
export function useFitsViewport(reservedPx: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fits, setFits] = useState(true);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === 'undefined') return undefined;

    const measure = () => setFits(node.scrollHeight <= window.innerHeight - reservedPx);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [reservedPx]);

  return { ref, fits };
}
