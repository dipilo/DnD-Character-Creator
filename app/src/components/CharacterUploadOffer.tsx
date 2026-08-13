import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/authStore';
import { uploadLocalCharacters, useCharacterSyncStore } from '@/store/characterSync';
import { useCharacterStore } from '@/store/characterStore';
import { UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

/**
 * The one-time upload offered when someone signs in with characters already in localStorage
 * (MERGE_PLAN.md Phase 2). Signing in never publishes them on its own — characters built before
 * an account existed are the user's to hand over, and anything built after sign-in syncs anyway.
 */
export function CharacterUploadOffer() {
  const status = useAuthStore((state) => state.status);
  const unsyncedIds = useCharacterSyncStore((state) => state.unsyncedIds);
  const uploading = useCharacterSyncStore((state) => state.uploading);
  const dismissedAt = useCharacterStore((state) => state.uploadPromptDismissedAt);
  const dismiss = useCharacterStore((state) => state.dismissUploadPrompt);

  const count = unsyncedIds.length;
  if (status !== 'authenticated' || count === 0 || dismissedAt) return null;

  const handleUpload = async () => {
    try {
      const result = await uploadLocalCharacters();
      toast.success(`Uploaded ${result.imported} character${result.imported === 1 ? '' : 's'} to your account`);
    } catch (e) {
      console.error('character upload failed', e);
      toast.error('Upload failed. Your characters are still saved on this device.');
    }
  };

  const noun = count === 1 ? 'character' : 'characters';

  return (
    <Alert>
      <UploadCloud />
      <AlertTitle>Keep these characters on your account?</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <span>
          {count} {noun} on this device {count === 1 ? 'is' : 'are'} not in your account yet. Upload
          {count === 1 ? ' it' : ' them'} and {count === 1 ? 'it follows' : 'they follow'} you to any
          device you sign in on.
        </span>
        <span className="flex gap-2">
          <Button size="sm" onClick={() => void handleUpload()} disabled={uploading}>
            {uploading ? 'Uploading…' : `Upload ${count} ${noun}`}
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss} disabled={uploading}>
            Not now
          </Button>
        </span>
      </AlertDescription>
    </Alert>
  );
}
