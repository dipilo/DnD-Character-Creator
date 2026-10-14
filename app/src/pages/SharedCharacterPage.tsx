// One URL, every visibility, resolved server-side; read-only always.
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { StoredCharacterSheet } from '@/components/character/StoredCharacterSheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useRemoteCharacter } from '@/hooks/useRemoteCharacter';
import { useAuthStore } from '@/store/authStore';

export function SharedCharacterPage() {
  const { token } = useParams<{ token: string }>();
  const signedIn = useAuthStore((state) => Boolean(state.user));
  const { record, document, error, loading } = useRemoteCharacter({ kind: 'share', token: token ?? '' });

  const home = (
    <Button asChild variant="outline" size="sm">
      <Link to="/">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Home
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
        <p className="text-muted-foreground">
          {error ?? 'That link does not open a character.'}
        </p>
        {signedIn ? null : (
          <p className="text-sm text-muted-foreground">
            If this sheet is shared with a campaign rather than publicly, sign in with the account that plays there.
          </p>
        )}
        {home}
      </div>
    );
  }

  return (
    <StoredCharacterSheet
      document={document}
      leading={home}
      note={(
        <Badge variant="outline" className="mt-2">
          {record?.is_owner ? 'Your character, as anyone with this link sees it' : 'Shared with you, read-only'}
        </Badge>
      )}
    />
  );
}
