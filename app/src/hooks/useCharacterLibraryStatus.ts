import { useAuthStore } from '@/store/authStore';
import { useCharacterSyncStore } from '@/store/characterSync';

export function useCharacterLibraryStatus() {
  const authStatus = useAuthStore((state) => state.status);
  const authError = useAuthStore((state) => state.error);
  const { status, enabled, lastSyncedAt, error } = useCharacterSyncStore();
  const sessionFailed = authStatus === 'anonymous' && Boolean(authError);
  const sessionExpired = authStatus === 'authenticated' && !enabled;
  const loading = authStatus === 'unknown' || status === 'syncing';
  const failed = sessionFailed || sessionExpired || status === 'offline' || status === 'error';
  const awaitingSync = authStatus === 'authenticated' && lastSyncedAt === null;
  return { loading, failed, sessionFailed, sessionExpired, error, emptyConfirmed: !loading && !failed && !awaitingSync };
}
