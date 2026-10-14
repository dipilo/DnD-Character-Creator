// A grant need not come with a table, so a named account needs somewhere to read it.
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
