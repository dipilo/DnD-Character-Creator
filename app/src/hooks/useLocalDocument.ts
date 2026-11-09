// The owner's own copy, wherever their sheet is being shown: a campaign screen reading the server
// would be a second writer on a row the sync layer already owns.
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { DOCUMENT_STORES, getStoreHolding, type StoredDocument } from '@/store/documentStores';

export interface LocalDocument {
  document: StoredDocument;
  applyPatch: (patch: Partial<StoredDocument>) => void;
}

/** Null when no cache holds it, which is every character the reader does not own. */
export function useLocalDocument(id: string): LocalDocument | null {
  const subscribe = useCallback((listener: () => void) => {
    const stops = DOCUMENT_STORES.map((adapter) => adapter.subscribe(listener));
    return () => stops.forEach((stop) => stop());
  }, []);
  // `find` hands back the array's own entry, so the snapshot only changes when the document does.
  const held = useSyncExternalStore(subscribe, () => (id ? getStoreHolding(id)?.find(id) : undefined));

  return useMemo(() => {
    if (!held) return null;
    const store = getStoreHolding(id);
    if (!store) return null;
    return { document: held, applyPatch: (patch) => store.applyPatch(id, patch) };
  }, [held, id]);
}
