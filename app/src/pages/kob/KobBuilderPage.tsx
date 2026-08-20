import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KobBuilder } from '@/components/kob/KobBuilder';
import { useKobCharacterStore } from '@/store/kobCharacterStore';

export function KobBuilderPage() {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const character = useKobCharacterStore((state) =>
    state.characters.find((entry) => entry.id === characterId),
  );
  const { updateCharacter } = useKobCharacterStore.getState();

  if (!character) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Character not found</h1>
        <p className="text-muted-foreground">
          This character is not in this browser. Kids on Bikes characters are stored locally for now.
        </p>
        <Button onClick={() => navigate('/kob')}>Back to Kids on Bikes</Button>
      </div>
    );
  }

  return (
    <KobBuilder
      character={character}
      onChange={(changes) => updateCharacter(character.id, changes)}
      leading={(
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 min-h-11">
          <Link to="/kob">
            <ArrowLeft className="h-4 w-4" />
            Kids on Bikes
          </Link>
        </Button>
      )}
      actions={(
        <Button asChild variant="secondary" className="min-h-11">
          <Link to={`/kob/character/${character.id}`}>
            <FileText className="h-4 w-4" />
            View sheet
          </Link>
        </Button>
      )}
    />
  );
}
