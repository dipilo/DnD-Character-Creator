import { Button } from '@/components/ui/button';
import { hydrateAuth } from '@/store/authStore';
import { syncCharacters } from '@/store/characterSync';
import { useCharacterLibraryStatus } from '@/hooks/useCharacterLibraryStatus';

export function CharacterSyncStatus() {
  const { loading, failed, sessionFailed, sessionExpired, error } = useCharacterLibraryStatus();
  const retry = async () => {
    if (sessionFailed || sessionExpired) await hydrateAuth();
    else await syncCharacters();
  };

  if (loading) return <p role="status" className="text-sm text-muted-foreground">Loading your account’s characters…</p>;
  if (!failed) return null;
  return (
    <div role="alert" className="space-y-2 rounded-lg border p-4">
      <p>Could not load your account’s characters. Any characters shown are saved on this device.</p>
      {error ? <p className="text-sm text-muted-foreground">{error}</p> : null}
      <Button variant="outline" onClick={() => void retry()}>Try again</Button>
    </div>
  );
}
