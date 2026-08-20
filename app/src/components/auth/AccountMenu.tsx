import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { useAuthStore } from '@/store/authStore';
import { syncCharacters, uploadLocalCharacters, useCharacterSyncStore, type SyncStatus } from '@/store/characterSync';
import { CloudOff, LogIn, LogOut, RefreshCw, TriangleAlert, UploadCloud, User } from 'lucide-react';

/** One line about where this browser's characters currently live. */
const syncLabels: Record<SyncStatus, string> = {
  idle: 'Characters synced to your account',
  syncing: 'Syncing characters…',
  offline: 'Offline. Saved on this device.',
  error: 'Sync failed. Saved on this device.',
};

const syncIcons: Record<SyncStatus, typeof RefreshCw> = {
  idle: RefreshCw,
  syncing: RefreshCw,
  offline: CloudOff,
  error: TriangleAlert,
};

export function AccountMenu() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { pending, signOut, signOutEverywhere, status, user } = useAuthStore();
  const syncStatus = useCharacterSyncStore((state) => state.status);
  const unsyncedIds = useCharacterSyncStore((state) => state.unsyncedIds);
  const uploading = useCharacterSyncStore((state) => state.uploading);

  // 'unknown' only lasts as long as the first /api/me request. Rendering nothing then would make
  // the header jump; a disabled placeholder holds the space.
  if (status === 'unknown') {
    return (
      <Button variant="ghost" size="sm" className="gap-2" disabled>
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">Account</span>
      </Button>
    );
  }

  if (status === 'anonymous' || !user) {
    return (
      <>
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
          <LogIn className="h-4 w-4" />
          <span className="hidden sm:inline">Sign in</span>
        </Button>
        <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    );
  }

  const SyncIcon = syncIcons[syncStatus];
  const displayName = user.username ?? 'Your account';
  // The banner on My Characters can be dismissed for good, so the offer needs a home that does not
  // disappear with it.
  const unsyncedCount = unsyncedIds.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <User className="h-4 w-4" />
          <span className="hidden max-w-[10rem] truncate sm:inline">{displayName}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <span className="block font-medium">{displayName}</span>
          <span className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <SyncIcon className={syncStatus === 'syncing' ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
            {syncLabels[syncStatus]}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void syncCharacters()} disabled={syncStatus === 'syncing'}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Sync now
        </DropdownMenuItem>
        {unsyncedCount > 0 ? (
          <DropdownMenuItem onClick={() => void uploadLocalCharacters()} disabled={uploading}>
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload {unsyncedCount} local {unsyncedCount === 1 ? 'character' : 'characters'}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()} disabled={pending}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void signOutEverywhere()} disabled={pending}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out everywhere
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
