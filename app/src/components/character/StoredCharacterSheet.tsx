// One stored document, rendered by whichever system's sheet owns it.
//
// Which system's screens to show is the *document's* answer and not the campaign's — a campaign's
// system is a default and a label, never a filter, so a row seated at a D&D table could still
// legitimately be a Kids on Bikes character. Shared by the party view and the share-link page so
// the branch exists once.
import type { ReactNode } from 'react';
import { CharacterSheetView } from '@/components/character/CharacterSheetView';
import { KobSheetView } from '@/components/kob/KobSheetView';
import type { StoredCharacterDocument } from '@/lib/api';
import { isKobDocument } from '@/lib/storedCharacter';
import type { Character } from '@/types/dnd';
import type { KobCharacter } from '@/types/kob';

interface StoredCharacterSheetProps {
  document: StoredCharacterDocument;
  actions?: ReactNode;
  leading?: ReactNode;
  note?: ReactNode;
  /** Omitting it is what renders the sheet read-only, exactly as in either view on its own. */
  onChange?: (patch: Partial<StoredCharacterDocument>) => void;
}

export function StoredCharacterSheet({ document, actions, leading, note, onChange }: Readonly<StoredCharacterSheetProps>) {
  if (isKobDocument(document)) {
    return (
      <KobSheetView
        character={document}
        actions={actions}
        leading={leading}
        note={note}
        onChange={onChange as ((patch: Partial<KobCharacter>) => void) | undefined}
      />
    );
  }

  return (
    <CharacterSheetView
      character={document}
      actions={actions}
      leading={leading}
      note={note}
      onChange={onChange as ((patch: Partial<Character>) => void) | undefined}
    />
  );
}
