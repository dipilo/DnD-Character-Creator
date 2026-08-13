import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Sparkles, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { claimPlayer, deletePlayer, parseAllowedSourceIds, unclaimPlayer } from '@/lib/api';
import type { Player } from '@/lib/api';
import { DdbSeedDialog } from '@/components/schedule/DdbSeedDialog';
import { PlayerEditorDialog } from '@/components/schedule/PlayerEditorDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Spinner } from '@/components/ui/spinner';
import { isCampaignOwner, memberCan, membershipPlayerId, useCampaignStore } from '@/store/campaignStore';
import { playerLabel, useCampaignCharacters, useCampaignId, useRoster } from '@/pages/campaign/useCampaignData';

/**
 * What an empty seat says. A seat carrying a legacy `ddb_json` blob gets a way out of it — that
 * import was the scheduler's character storage, and Phase 5 replaces it with a real builder
 * character rather than continuing to render the blob as a sheet.
 */
function EmptySeatNote({ player, onSeed }: Readonly<{ player: Player; onSeed: () => void }>) {
  if (!player.ddb_json) {
    return <p className="text-xs text-muted-foreground">No character in this seat yet.</p>;
  }
  return (
    <div className="space-y-1.5 rounded-md border border-dashed p-2">
      <p className="text-xs text-muted-foreground">
        No builder character yet — this seat still carries a D&D Beyond import.
      </p>
      <Button size="sm" variant="outline" onClick={onSeed}>
        <Sparkles className="h-4 w-4" />
        Start from it
      </Button>
    </div>
  );
}

export function RosterPage() {
  const campaignId = useCampaignId();
  const campaigns = useCampaignStore((state) => state.campaigns);
  const membership = useCampaignStore((state) => state.membership);
  const { players, loading, error, reload, replacePlayer } = useRoster(campaignId);
  // Phase 5: a seat shows the character sitting in it — a real builder sheet, not the D&D Beyond
  // blob the scheduler used to keep on `players.ddb_json`.
  const { characterForPlayer } = useCampaignCharacters(campaignId);
  const [editing, setEditing] = useState<Player | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Player | null>(null);
  const [seeding, setSeeding] = useState<Player | null>(null);

  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const allowedSourceIds = parseAllowedSourceIds(campaign);

  const ownSeatId = membershipPlayerId(membership);
  const isOwner = isCampaignOwner(membership);
  const canAdd = memberCan(membership, 'can_create_players');
  const canDeleteAny = memberCan(membership, 'can_delete_players');

  const canEdit = (player: Player) => isOwner || player.id === ownSeatId;
  const canDelete = (player: Player) =>
    canDeleteAny || (player.id === ownSeatId && memberCan(membership, 'players_self_delete'));

  const handleClaim = async (player: Player) => {
    try {
      const claimed = await claimPlayer(campaignId, { player_id: player.id });
      replacePlayer(claimed);
      toast.success(`You now hold ${playerLabel(claimed)}`);
      // The membership row gained a player_id; the permission helpers read it.
      void useCampaignStore.getState().loadMembership(campaignId);
    } catch (e) {
      toast.error('Could not claim that seat', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleUnclaim = async (player: Player) => {
    try {
      await unclaimPlayer(campaignId, player.id);
      reload();
      void useCampaignStore.getState().loadMembership(campaignId);
      toast.success(`Released ${playerLabel(player)}`);
    } catch (e) {
      toast.error('Could not release that seat', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePlayer(confirmDelete.id);
      reload();
      toast.success(`Removed ${playerLabel(confirmDelete)}`);
    } catch (e) {
      toast.error('Could not remove that seat', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Roster</h2>
          <p className="text-sm text-muted-foreground">
            A seat can sit unclaimed until someone takes it — that is how a roster imported from a
            sheet starts out.
          </p>
        </div>
        {canAdd ? (
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            Add a seat
          </Button>
        ) : null}
      </div>

      {loading ? (
        <output className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading the roster...
        </output>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => {
          const isOwnSeat = player.id === ownSeatId;
          const character = characterForPlayer(player.id);
          return (
            <Card key={player.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{playerLabel(player)}</CardTitle>
                    <CardDescription className="truncate">
                      {player.timezone || 'No timezone set'}
                    </CardDescription>
                  </div>
                  {isOwnSeat ? <Badge>You</Badge> : null}
                  {!isOwnSeat && player.is_claimed ? <Badge variant="secondary">Claimed</Badge> : null}
                  {!player.is_claimed ? <Badge variant="outline">Unclaimed</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {character ? (
                  <Link
                    to={`/campaign/${campaignId}/party/${character.id}`}
                    className="block rounded-md border bg-muted/30 p-2 transition-colors hover:bg-muted"
                  >
                    <p className="truncate text-sm font-medium">{character.name ?? 'Unnamed character'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {character.summary ?? 'Open the sheet'}
                    </p>
                  </Link>
                ) : (
                  <EmptySeatNote player={player} onSeed={() => setSeeding(player)} />
                )}
                <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary">
                  <Link to={`/campaign/${campaignId}/schedule?player=${player.id}`}>Schedule</Link>
                </Button>
                {canEdit(player) ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(player)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
                {!player.is_claimed && !ownSeatId ? (
                  <Button size="sm" variant="ghost" onClick={() => handleClaim(player)}>
                    <UserCheck className="h-4 w-4" />
                    Claim
                  </Button>
                ) : null}
                {isOwnSeat || (isOwner && player.is_claimed) ? (
                  <Button size="sm" variant="ghost" onClick={() => handleUnclaim(player)}>
                    <UserPlus className="h-4 w-4" />
                    Release
                  </Button>
                ) : null}
                {canDelete(player) ? (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(player)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DdbSeedDialog
        campaignId={campaignId}
        campaignName={campaign?.name ?? undefined}
        player={seeding}
        allowedSourceIds={allowedSourceIds}
        onOpenChange={(open) => {
          if (!open) setSeeding(null);
        }}
      />

      <PlayerEditorDialog
        campaignId={campaignId}
        player={editing === 'new' ? null : editing}
        open={editing !== null}
        roster={players}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={(player) => {
          replacePlayer(player);
          setEditing(null);
        }}
      />

      <AlertDialog open={confirmDelete !== null} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDelete ? playerLabel(confirmDelete) : 'this seat'}?</AlertDialogTitle>
            <AlertDialogDescription>
              The seat and its availability go. Any character sitting in it is unseated but not
              deleted — a character belongs to its player's account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
