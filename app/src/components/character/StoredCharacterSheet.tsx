// Which screens to show is the *document's* answer; a campaign's system is a label.
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
  /** Follows an unfinished-choice link. Only the 5e sheet has one; see `CharacterSheetView`. */
  onOpenBuilder?: (path: string) => void;
}

export function StoredCharacterSheet({
  document,
  actions,
  leading,
  note,
  onChange,
  onOpenBuilder
}: Readonly<StoredCharacterSheetProps>) {
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
      onOpenBuilder={onOpenBuilder}
    />
  );
}
