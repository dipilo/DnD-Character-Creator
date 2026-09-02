// A character somebody granted this account, opened by its id rather than by a share link.
//
// The party page already opens a shared sheet where the campaign's other screens are, but a grant
// does not have to come with a table: the owner can name an account directly. That character had
// nowhere to be read, which is the other half of "nobody is told they were granted access".
//
// Editing follows the grant, exactly as it does on the party sheet: `applyPatch` is handed to the
// sheet only when the server said this reader may write, and its absence is what makes the view
// read-only.
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SaveConflictAlert } from '@/components/character/SaveConflictAlert';
import { StoredCharacterSheet } from '@/components/character/StoredCharacterSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useRemoteCharacter } from '@/hooks/useRemoteCharacter';

export function SharedWithYouPage() {
  const { characterId } = useParams<{ characterId: string }>();
  const { record, document, error, loading, saving, applyPatch, conflict, resolveConflict } =
    useRemoteCharacter({ kind: 'id', id: characterId ?? '' });

  const back = (
    <Button asChild variant="outline" size="sm">
      <Link to="/characters">
        <ArrowLeft className="mr-2 h-4 w-4" />
        My Characters
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <output className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Opening the sheet...
      </output>
    );
  }

  if (!document) {
    return (
      <div className="space-y-4 py-20 text-center">
        <p className="text-muted-foreground">{error ?? 'That character is not shared with you.'}</p>
        {back}
      </div>
    );
  }

  const canEdit = Boolean(record?.can_edit);

  return (
    <div className="space-y-4">
      {conflict ? <SaveConflictAlert conflict={conflict} onResolve={resolveConflict} /> : null}
      <StoredCharacterSheet
        document={document}
        leading={back}
        actions={
          <Badge variant={canEdit ? 'secondary' : 'outline'}>
            {canEdit ? 'You can edit' : 'Read only'}
          </Badge>
        }
        note={saving ? 'Saving...' : undefined}
        onChange={canEdit ? applyPatch : undefined}
      />
    </div>
  );
}
