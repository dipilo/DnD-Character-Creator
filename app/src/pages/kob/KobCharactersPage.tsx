import { Link, useNavigate } from 'react-router-dom';
import { Bike, Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { describeKobCharacter, fullName, outstandingChoices } from '@/data/gameSystems/kidsOnBikes/rules';
import { useKobCharacterStore } from '@/store/kobCharacterStore';

export function KobCharactersPage() {
  const navigate = useNavigate();
  const characters = useKobCharacterStore((state) => state.characters);
  const { createCharacter, deleteCharacter, duplicateCharacter } = useKobCharacterStore.getState();

  const startNew = () => {
    const character = createCharacter();
    navigate(`/kob/builder/${character.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl short:text-xl">Kids on Bikes</h1>
          <p className="text-muted-foreground short:hidden">
            Small towns, strange happenings, and a bike to get away on.
          </p>
        </div>
        <Button onClick={startNew} className="min-h-11">
          <Plus className="h-4 w-4" />
          New character
        </Button>
      </div>

      {characters.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bike />
            </EmptyMedia>
            <EmptyTitle>No characters yet</EmptyTitle>
            <EmptyDescription>
              Pick a Trope, an age, two Strengths and a Flaw — that is most of a character.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={startNew}>
              <Plus className="h-4 w-4" />
              Start one
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((character) => {
          const missing = outstandingChoices(character);
          const name = fullName(character) || 'Unnamed';
          return (
            <Card key={character.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="truncate text-lg">{name}</CardTitle>
                <CardDescription className="capitalize">{describeKobCharacter(character)}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                {missing.length > 0 ? (
                  <Badge variant="outline">
                    {missing.length} thing{missing.length === 1 ? '' : 's'} left to choose
                  </Badge>
                ) : (
                  <Badge variant="secondary">Ready to play</Badge>
                )}
              </CardContent>
              <CardFooter className="flex-wrap gap-2">
                <Button asChild className="min-h-11 flex-1">
                  <Link to={`/kob/character/${character.id}`}>Sheet</Link>
                </Button>
                <Button asChild variant="secondary" className="min-h-11 flex-1">
                  <Link to={`/kob/builder/${character.id}`}>Edit</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11"
                  aria-label={`Duplicate ${name}`}
                  onClick={() => {
                    const copy = duplicateCharacter(character.id);
                    if (copy) toast.success(`Duplicated ${name}`);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-11"
                  aria-label={`Delete ${name}`}
                  onClick={() => {
                    deleteCharacter(character.id);
                    toast.success(`Deleted ${name}`);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
