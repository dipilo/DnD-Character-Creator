// Characters somebody else granted this account.
//
// Nothing notifies a grantee, so before this there was no way to find out at all: you had to be
// sent the link or happen to open the right campaign's party page. Only explicit grants are
// listed — a table-wide "the GM may edit my sheets here" already has a home on that campaign's
// Party tab, and restating it under a heading that says somebody chose to share with *you* would
// be a different claim from the one the player made.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { listSharedCharacters } from '@/lib/api';
import type { SharedCharacterSummary } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/authStore';

/** The result tagged with the account it answers, so `loading` stays derived. */
interface Result {
  key: string;
  characters: SharedCharacterSummary[];
}

export function SharedWithYouList() {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [result, setResult] = useState<Result | null>(null);
  const key = String(userId ?? 'anonymous');

  useEffect(() => {
    if (userId === null) return;
    let cancelled = false;
    listSharedCharacters()
      .then((characters) => {
        if (!cancelled) setResult({ key, characters });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        // A grantee with nothing shared and a grantee who is briefly offline look the same here,
        // and neither is worth a red banner over somebody's own character list.
        console.debug('could not list shared characters', e instanceof Error ? e.message : e);
        setResult({ key, characters: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [key, userId]);

  if (userId === null) return null;
  const fresh = result?.key === key ? result : null;
  if (fresh === null) {
    return (
      <output className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Looking for characters shared with you...
      </output>
    );
  }
  if (fresh.characters.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Shared with you</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fresh.characters.map((character) => (
          <Card key={character.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">
                    {character.name ?? 'Unnamed character'}
                  </CardTitle>
                  <CardDescription className="truncate">
                    {character.summary ?? 'No summary recorded yet'}
                  </CardDescription>
                </div>
                <Badge variant={character.can_edit ? 'secondary' : 'outline'}>
                  {character.can_edit ? 'You can edit' : 'Read only'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="truncate text-sm text-muted-foreground">
                {sharedBy(character)}
              </p>
              <Button asChild size="sm" variant="secondary">
                <Link to={`/characters/shared/${character.id}`}>Open sheet</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** A grant naming a campaign reached you because you run it, which is worth saying. */
function sharedBy(character: SharedCharacterSummary): string {
  const owner = character.owner_name ?? 'an unnamed account';
  if (character.granted_via === 'campaign_owner') return `${owner}, to the campaign you run`;
  return `Shared by ${owner}`;
}
