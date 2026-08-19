import type { StoredCharacterDocument } from '@/lib/api';
import type { KobCharacter } from '@/types/kob';

/**
 * Which system's document this is. A document with no `systemId` predates the second system, so it
 * is a D&D one — the discriminator is the document's own answer and never the campaign's, because
 * a campaign's system is a default and a label rather than a filter.
 */
export const isKobDocument = (document: StoredCharacterDocument): document is KobCharacter =>
  (document as KobCharacter).systemId === 'kids-on-bikes';
