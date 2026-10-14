import { useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';

/** Rolling changes nothing, so a read-only party sheet may set it too. */
export function useRollAttribution(name: string | null | undefined): void {
  const setCharacterName = useSessionStore((state) => state.setCharacterName);

  useEffect(() => {
    setCharacterName(name ?? null);
    return () => setCharacterName(null);
  }, [name, setCharacterName]);
}
