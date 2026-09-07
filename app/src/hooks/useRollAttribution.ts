import { useEffect } from 'react';
import { useSessionStore } from '@/store/sessionStore';

/**
 * Whose rolls these are, for as long as a sheet is open.
 *
 * A roll shared with the table says "Clementine: Dexterity save" rather than the account name, so
 * the page holding a sheet names it. Rolling changes nothing about the character, which is why a
 * read-only party sheet may set it too.
 */
export function useRollAttribution(name: string | null | undefined): void {
  const setCharacterName = useSessionStore((state) => state.setCharacterName);

  useEffect(() => {
    setCharacterName(name ?? null);
    return () => setCharacterName(null);
  }, [name, setCharacterName]);
}
