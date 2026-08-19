// One of your own Kids on Bikes characters, out of the local cache. The sheet itself is
// `KobSheetView`, shared with the campaign party view — this page is the lookup, the owner's
// actions, and the one place the sheet's edits are written.
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CharacterSharingDialog } from '@/components/character/CharacterSharingDialog';
import { fullName } from '@/data/gameSystems/kidsOnBikes/rules';
import { KobSheetView } from '@/components/kob/KobSheetView';
import { useAuthStore } from '@/store/authStore';
import { useKobCharacterStore } from '@/store/kobCharacterStore';
import type { KobCharacter } from '@/types/kob';

export function KobSheetPage() {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const character = useKobCharacterStore((state) =>
    state.characters.find((entry) => entry.id === characterId),
  );
  const { updateCharacter } = useKobCharacterStore.getState();
  // Sharing is a server-side fact; a signed-out builder has nothing to share yet.
  const signedIn = useAuthStore((state) => Boolean(state.user));

  if (!character) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Character not found</h1>
        <Button onClick={() => navigate('/kob')}>Back to Kids on Bikes</Button>
      </div>
    );
  }

  const handleChange = (patch: Partial<KobCharacter>) => updateCharacter(character.id, patch);

  return (
    <KobSheetView
      character={character}
      onChange={handleChange}
      leading={(
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 min-h-11">
          <Link to="/kob">
            <ArrowLeft className="h-4 w-4" />
            Kids on Bikes
          </Link>
        </Button>
      )}
      actions={(
        <>
          <Button asChild variant="secondary" className="min-h-11">
            <Link to={`/kob/builder/${character.id}`}>
              <Pencil className="h-4 w-4" />
              Edit
            </Link>
          </Button>
          {signedIn ? <CharacterSharingDialog characterId={character.id} characterName={fullName(character) || 'this character'} /> : null}
        </>
      )}
    />
  );
}
