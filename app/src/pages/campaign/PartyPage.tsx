// The party view (MERGE_PLAN.md Phase 5) — the payoff for merging the two apps.
//
// Everything before Phase 5 was consolidation. This page only works because the builder and the
// scheduler are one app: it lists the real characters the builder produced, seated at this
// campaign's real seats, and it is where a player attaches one or starts a new one already scoped
// to the sources this table plays with.
//
// Like the roster, it is server state held per page rather than in a store: the seat a character
// sits in is the server's to state, and a stale party list is worse than a brief spinner.
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, UserRoundPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { listCharacters, parseAllowedSourceIds, setCharacterSeat } from '@/lib/api';
import type { CampaignCharacterSummary, CharacterRecordSummary, Player } from '@/lib/api';
import { DEFAULT_GAME_SYSTEM_ID, getGameSystem, type GameSystemId } from '@/data/gameSystems';
import { getStoreHolding } from '@/store/documentStores';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/authStore';
import { useCampaignStore } from '@/store/campaignStore';
import { useCharacterStore } from '@/store/characterStore';
import { useKobCharacterStore } from '@/store/kobCharacterStore';
import { playerLabel, useCampaignCharacters, useCampaignId, useRoster } from '@/pages/campaign/useCampaignData';

const UNSEATED = 'unseated';

export function PartyPage() {
  const campaignId = useCampaignId();
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const campaigns = useCampaignStore((state) => state.campaigns);
  const membership = useCampaignStore((state) => state.membership);
  const { players } = useRoster(campaignId);
  const resetBuilder = useCharacterStore((state) => state.resetBuilder);
  const updateBuilderState = useCharacterStore((state) => state.updateBuilderState);
  const createKobCharacter = useKobCharacterStore((state) => state.createCharacter);
  const setKobPendingSeat = useKobCharacterStore((state) => state.setPendingSeat);

  const [attaching, setAttaching] = useState(false);
  const { characters, loading, error, reload } = useCampaignCharacters(campaignId);

  const campaign = useMemo(() => campaigns.find((c) => c.id === campaignId) ?? null, [campaigns, campaignId]);
  const allowedSourceIds = useMemo(() => parseAllowedSourceIds(campaign), [campaign]);
  // A table plays one game. Every system's characters are stored server-side now — one collection,
  // discriminated by the document's own `systemId` — so the only thing the system decides here is
  // which builder "new character" opens.
  const system = getGameSystem(campaign?.system_id);
  const usesBuilderState = system.id === DEFAULT_GAME_SYSTEM_ID;

  /**
   * Start a character already scoped to this table. Seeding the source filter is the whole point —
   * the campaign's own agreement about which books are in play becomes the builder's default rather
   * than something every player has to be told separately.
   *
   * Either way the seat is recorded as an *intent*: the character has only just been created
   * locally and may not have synced, and the builder has to work signed out (Phase 5).
   */
  const handleNewCharacter = () => {
    if (!usesBuilderState) {
      const character = createKobCharacter();
      setKobPendingSeat(character.id, { campaignId, playerId: membership?.player_id ?? null });
      navigate(`${system.builderPath}/${character.id}`);
      if (campaign?.name) {
        toast.message(`New ${system.shortName} character for ${campaign.name}`, {
          description: 'It appears in this party once it syncs.',
        });
      }
      return;
    }

    resetBuilder();
    updateBuilderState({
      selectedSourceIds: allowedSourceIds,
      forCampaignId: campaignId,
      forPlayerId: membership?.player_id ?? undefined,
      forCampaignName: campaign?.name ?? undefined,
    });
    navigate('/builder/species');
  };

  const handleUnseat = async (character: CampaignCharacterSummary) => {
    try {
      await setCharacterSeat(character.id, { campaign_id: null });
      reload();
      toast.success(`${character.name ?? 'That character'} left the party`);
    } catch (e) {
      toast.error('Could not detach that character', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const seatName = (character: CampaignCharacterSummary) => character.player_name ?? 'No seat';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Party</h2>
          <p className="text-sm text-muted-foreground">
            Every character at this table. This campaign plays {system.name}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAttaching(true)}>
            <UserRoundPlus className="h-4 w-4" />
            Attach a character
          </Button>
          <Button onClick={handleNewCharacter}>
            <Plus className="h-4 w-4" />
            New character for this campaign
          </Button>
        </div>
      </div>

      {system.hasSelectableSources && allowedSourceIds.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          New characters start filtered to this campaign's {allowedSourceIds.length} allowed source
          {allowedSourceIds.length === 1 ? '' : 's'}.
        </p>
      ) : null}

      {loading ? (
        <output className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading the party...
        </output>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!loading && !error && characters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No characters at this table yet. Attach one you have already built, or start a new one.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {characters.map((character) => {
          const isOwn = character.user_id === userId;
          return (
            <Card key={character.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{character.name ?? 'Unnamed character'}</CardTitle>
                    <CardDescription className="truncate">
                      {character.summary ?? 'No summary recorded yet'}
                    </CardDescription>
                  </div>
                  {isOwn ? <Badge>Yours</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">
                  <p className="truncate">Played by {character.owner_name ?? 'an unnamed account'}</p>
                  <p className="truncate">Seat: {seatName(character)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link to={`/campaign/${campaignId}/party/${character.id}`}>View sheet</Link>
                  </Button>
                  {isOwn ? (
                    <Button size="sm" variant="ghost" onClick={() => handleUnseat(character)}>
                      Detach
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AttachCharacterDialog
        campaignId={campaignId}
        open={attaching}
        players={players}
        systemId={system.id}
        systemName={system.name}
        defaultPlayerId={membership?.player_id ?? null}
        alreadyAttached={characters.map((c) => c.id)}
        onOpenChange={setAttaching}
        onAttached={() => {
          setAttaching(false);
          reload();
        }}
      />
    </div>
  );
}

interface AttachCharacterDialogProps {
  campaignId: number;
  open: boolean;
  players: Player[];
  /** The campaign's game. A table plays one, so only its characters are offered a seat. */
  systemId: GameSystemId;
  systemName: string;
  defaultPlayerId: number | null;
  alreadyAttached: string[];
  onOpenChange: (open: boolean) => void;
  onAttached: () => void;
}

/**
 * Attach one of your own characters to this campaign. It lists from the server rather than the
 * local cache on purpose: the character has to exist server-side before it can hold a seat, and a
 * character that has not synced yet is exactly the one that cannot.
 */
function AttachCharacterDialog({
  campaignId,
  open,
  players,
  systemId,
  systemName,
  defaultPlayerId,
  alreadyAttached,
  onOpenChange,
  onAttached,
}: Readonly<AttachCharacterDialogProps>) {
  // Remounting on each open resets the form; copying props into state in an effect is the shape
  // CLAUDE.md rules out, and `PlayerEditorDialog` keys its inner form for the same reason.
  if (!open) return null;
  return (
    <AttachCharacterForm
      campaignId={campaignId}
      players={players}
      systemId={systemId}
      systemName={systemName}
      defaultPlayerId={defaultPlayerId}
      alreadyAttached={alreadyAttached}
      onOpenChange={onOpenChange}
      onAttached={onAttached}
    />
  );
}

function AttachCharacterForm({
  campaignId,
  players,
  systemId,
  systemName,
  defaultPlayerId,
  alreadyAttached,
  onOpenChange,
  onAttached,
}: Readonly<Omit<AttachCharacterDialogProps, 'open'>>) {
  const [mine, setMine] = useState<CharacterRecordSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [characterId, setCharacterId] = useState<string>('');
  const [playerId, setPlayerId] = useState<string>(defaultPlayerId ? String(defaultPlayerId) : UNSEATED);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCharacters()
      .then((characters) => {
        if (!cancelled) setMine(characters);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setMine([]);
        setError(e instanceof Error ? e.message : 'Could not load your characters.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const attached = new Set(alreadyAttached);
  // A row's system is not on the summary, so it is read from whichever local cache holds the id.
  // These are the signed-in account's own characters, so a synced one is always in one of them; an
  // id neither holds has not been pulled yet and is offered rather than hidden.
  const available = (mine ?? []).filter((character) => {
    if (attached.has(character.id)) return false;
    const holder = getStoreHolding(character.id);
    return !holder || holder.systemId === systemId;
  });

  const handleAttach = async () => {
    if (!characterId) return;
    setSaving(true);
    try {
      await setCharacterSeat(characterId, {
        campaign_id: campaignId,
        player_id: playerId === UNSEATED ? null : Number(playerId),
      });
      toast.success('Character attached to this campaign');
      onAttached();
    } catch (e) {
      toast.error('Could not attach that character', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  let body;
  if (mine === null) {
    body = (
      <output className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading your characters...
      </output>
    );
  } else if (available.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        {error ?? `Every ${systemName} character you have synced is already at this table. Characters have to sync before they can take a seat.`}
      </p>
    );
  } else {
    body = (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="attach-character">Character</Label>
          <Select value={characterId} onValueChange={setCharacterId}>
            <SelectTrigger id="attach-character">
              <SelectValue placeholder="Choose one of your characters" />
            </SelectTrigger>
            <SelectContent>
              {available.map((character) => (
                <SelectItem key={character.id} value={character.id}>
                  {character.name ?? 'Unnamed character'}
                  {character.summary ? ` — ${character.summary}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="attach-seat">Seat</Label>
          <Select value={playerId} onValueChange={setPlayerId}>
            <SelectTrigger id="attach-seat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSEATED}>No seat — just at the table</SelectItem>
              {players.map((player) => (
                <SelectItem key={player.id} value={String(player.id)}>
                  {playerLabel(player)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            A seat is the roster entry whose availability the scheduler tracks. You can only use one
            you hold, unless you run the campaign.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach a character</DialogTitle>
          <DialogDescription>
            The campaign's members will be able to read the sheet. It stays yours — nobody else can
            edit it, and detaching takes it back out of view.
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAttach} disabled={!characterId || saving}>
            {saving ? 'Attaching...' : 'Attach'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
