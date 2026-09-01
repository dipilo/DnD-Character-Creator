// Two people saved one sheet. The refused edit is still held, so this asks which version wins
// rather than picking one.
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { RemoteCharacterConflict } from '@/hooks/useRemoteCharacter';

interface SaveConflictAlertProps {
  readonly conflict: RemoteCharacterConflict;
  readonly onResolve: (choice: 'mine' | 'theirs') => void;
}

function savedWhen(at: string | null): string {
  if (!at) return '';
  const when = new Date(at);
  return Number.isNaN(when.getTime()) ? '' : ` at ${when.toLocaleTimeString()}`;
}

export function SaveConflictAlert({ conflict, onResolve }: SaveConflictAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Someone else saved this sheet{savedWhen(conflict.savedAt)}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>Your change has not been sent yet. Keep it, or take their version and drop it.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="min-h-11" onClick={() => onResolve('mine')}>
            Keep my change
          </Button>
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => onResolve('theirs')}>
            Take their version
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
