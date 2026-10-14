import type { StoredCharacterDocument } from '@/lib/api';
import type { KobCharacter } from '@/types/kob';

/** The document's own answer, never the campaign's, which is a label not a filter. */
export const isKobDocument = (document: StoredCharacterDocument): document is KobCharacter =>
  (document as KobCharacter).systemId === 'kids-on-bikes';
