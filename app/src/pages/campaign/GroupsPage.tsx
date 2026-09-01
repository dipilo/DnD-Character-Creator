import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { deleteGroup, listGroups, reorderGroups, updateGroup } from '@/lib/api';
import type { CampaignCharacterSummary, Group, Player } from '@/lib/api';
import { GroupEditorDialog } from '@/components/schedule/GroupEditorDialog';
import { GroupHeatmap } from '@/components/schedule/GroupHeatmap';
import { GroupMembersEditor } from '@/components/schedule/GroupMembersEditor';
import { SuggestGroupsDialog } from '@/components/schedule/SuggestGroupsDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { groupColor } from '@/lib/groupColors';
import { cn } from '@/lib/utils';
import { memberCan, useCampaignStore } from '@/store/campaignStore';
import { playerLabel, useCampaignCharacters, useCampaignId, useRoster } from '@/pages/campaign/useCampaignData';

/** Which seats sit in more than one group. Two tables for one person is usually a mistake. */
function seatsInSeveralGroups(groups: readonly Group[]): Set<number> {
  const counts = new Map<number, number>();
  for (const group of groups) {
    for (const member of group.members) counts.set(member.id, (counts.get(member.id) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([id]) => id));
}

function seatsInAnyGroup(groups: readonly Group[]): Set<number> {
  return new Set(groups.flatMap((group) => group.members.map((member) => member.id)));
}

/** Per group, the seats sitting in some *other* group. A seat in this one is not elsewhere. */
function seatsElsewhereByGroup(groups: readonly Group[]): Map<number, Set<number>> {
  return new Map(
    groups.map((group) => [
      group.id,
      new Set(
        groups
          .filter((other) => other.id !== group.id)
          .flatMap((other) => other.members.map((member) => member.id)),
      ),
    ]),
  );
}

const NO_SEATS: ReadonlySet<number> = new Set<number>();

interface GroupCardProps {
  readonly campaignId: number;
  readonly group: Group;
  readonly roster: readonly Player[];
  readonly characterForPlayer: (playerId: number) => CampaignCharacterSummary | undefined;
  readonly doubled: ReadonlySet<number>;
  readonly placedElsewhere: ReadonlySet<number>;
  readonly canManage: boolean;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onMembers: (memberIds: number[]) => void;
  readonly onMove: (direction: -1 | 1) => void;
}

/** The characters actually sitting at this table, so a group reads as a party and not a rota. */
function GroupParty({
  group,
  characterForPlayer,
  campaignId,
}: Readonly<Pick<GroupCardProps, 'group' | 'characterForPlayer' | 'campaignId'>>) {
  const seated = group.members
    .map((member) => ({ member, character: characterForPlayer(member.id) }))
    .filter((entry): entry is { member: Player; character: CampaignCharacterSummary } => Boolean(entry.character));

  if (seated.length === 0) {
    return <p className="text-xs text-muted-foreground">No characters at this table yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {seated.map(({ member, character }) => (
        <li key={member.id}>
          <Link
            to={`/campaign/${campaignId}/party/${character.id}`}
            className="block rounded-md border bg-muted/30 px-2 py-1 transition-colors hover:bg-muted"
          >
            <span className="text-sm font-medium">{character.name ?? 'Unnamed character'}</span>
            <span className="ml-2 text-xs text-muted-foreground">{playerLabel(member)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function GroupCard({
  campaignId,
  group,
  roster,
  characterForPlayer,
  doubled,
  placedElsewhere,
  canManage,
  canMoveUp,
  canMoveDown,
  onEdit,
  onDelete,
  onMembers,
  onMove,
}: GroupCardProps) {
  const color = groupColor(group.color);
  const size = group.members.length;
  const target = group.target_size;
  const sizeLabel = target ? `${size} of ${target}` : `${size} ${size === 1 ? 'member' : 'members'}`;
  const offTarget = target !== null && size !== target;

  return (
    <Card className={cn(color && `border-l-4 ${color.soft}`)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {color ? <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', color.swatch)} /> : null}
            <div className="min-w-0">
              <CardTitle className="truncate text-base">{group.name || 'Unnamed group'}</CardTitle>
              <CardDescription className={cn(offTarget && 'text-amber-600 dark:text-amber-500')}>
                {sizeLabel}
              </CardDescription>
            </div>
          </div>
          {canManage ? (
            <div className="flex shrink-0 items-center">
              <Button
                size="icon"
                variant="ghost"
                disabled={!canMoveUp}
                onClick={() => onMove(-1)}
                aria-label={`Move ${group.name || 'this group'} up`}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={!canMoveDown}
                onClick={() => onMove(1)}
                aria-label={`Move ${group.name || 'this group'} down`}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onEdit} aria-label={`Edit ${group.name || 'this group'}`}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete} aria-label={`Delete ${group.name || 'this group'}`}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {group.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{group.notes}</p> : null}
        <GroupParty group={group} characterForPlayer={characterForPlayer} campaignId={campaignId} />
        <GroupHeatmap campaignId={campaignId} memberIds={group.members.map((m) => m.id)} showWindows />
        {canManage ? (
          <GroupMembersEditor group={group} roster={roster} placedElsewhere={placedElsewhere} onChange={onMembers} />
        ) : (
          <div className="flex flex-wrap gap-1">
            {group.members.map((member) => (
              <Badge key={member.id} variant="secondary">
                {playerLabel(member)}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary" className="min-h-11">
            <Link to={`/campaign/${campaignId}/schedule?group=${group.id}`}>Schedule</Link>
          </Button>
          <Button asChild size="sm" variant="ghost" className="min-h-11">
            <Link to={`/campaign/${campaignId}/party?group=${group.id}`}>Party</Link>
          </Button>
        </div>
        {group.members.some((member) => doubled.has(member.id)) ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Somebody here also sits at another table.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function GroupsPage() {
  const campaignId = useCampaignId();
  const membership = useCampaignStore((state) => state.membership);
  const { players } = useRoster(campaignId);
  const { characterForPlayer } = useCampaignCharacters(campaignId);
  const [attempt, setAttempt] = useState(0);
  // Tagged with the request it answers, so `loading` is derived rather than set from the effect
  // body — the same shape as `useRoster`, and for the same reason (CLAUDE.md).
  const [loaded, setLoaded] = useState<{ key: string; groups: Group[] } | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  /** Null while closed; a null group inside it means "creating a new one". */
  const [editing, setEditing] = useState<{ group: Group | null } | null>(null);

  const canManage = memberCan(membership, 'can_manage_groups');
  const key = `${campaignId}:${attempt}`;
  const fresh = loaded?.key === key ? loaded : null;
  const groups = useMemo(() => fresh?.groups ?? [], [fresh]);
  const loading = fresh === null;

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setGroups = useCallback((update: (current: Group[]) => Group[]) => {
    setLoaded((current) => (current ? { ...current, groups: update(current.groups) } : current));
  }, []);

  useEffect(() => {
    if (!Number.isFinite(campaignId)) return;
    let cancelled = false;
    listGroups(campaignId)
      .then((result) => {
        if (!cancelled) setLoaded({ key, groups: result });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoaded({ key, groups: [] });
        toast.error('Could not load groups', { description: e instanceof Error ? e.message : undefined });
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, key]);

  const doubled = useMemo(() => seatsInSeveralGroups(groups), [groups]);
  const placed = useMemo(() => seatsInAnyGroup(groups), [groups]);
  const elsewhere = useMemo(() => seatsElsewhereByGroup(groups), [groups]);
  const unassigned = players.filter((player) => !placed.has(player.id));

  const handleDelete = async (group: Group) => {
    try {
      await deleteGroup(group.id);
      setGroups((current) => current.filter((g) => g.id !== group.id));
    } catch (e) {
      toast.error('Could not delete that group', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleMembers = async (group: Group, memberIds: number[]) => {
    try {
      const updated = await updateGroup(group.id, { member_ids: memberIds });
      setGroups((current) => current.map((g) => (g.id === group.id ? updated : g)));
    } catch (e) {
      toast.error('Could not change that group', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleMove = async (group: Group, direction: -1 | 1) => {
    const index = groups.findIndex((g) => g.id === group.id);
    const next = index + direction;
    if (index === -1 || next < 0 || next >= groups.length) return;
    const reordered = groups.slice();
    [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
    setGroups(() => reordered);
    try {
      await reorderGroups(reordered.map((g) => g.id));
    } catch (e) {
      toast.error('Could not reorder', { description: e instanceof Error ? e.message : undefined });
      reload();
    }
  };

  const handleSaved = (saved: Group) => {
    setGroups((current) => {
      const exists = current.some((g) => g.id === saved.id);
      return exists ? current.map((g) => (g.id === saved.id ? saved : g)) : [...current, saved];
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Groups</h2>
          <p className="text-sm text-muted-foreground">
            Split the roster into tables. Each card shows when that table can meet.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" className="min-h-11" onClick={() => setSuggesting(true)}>
              <Wand2 className="h-4 w-4" />
              Suggest
            </Button>
            <Button className="min-h-11" onClick={() => setEditing({ group: null })}>
              <Plus className="h-4 w-4" />
              New group
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <output className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading groups...
        </output>
      ) : null}

      {!loading && groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No groups yet.{canManage ? ' Create one, or let the suggester propose a split.' : ''}
        </p>
      ) : null}

      {/* Who has no table. It used to be invisible: the roster and the groups were never compared. */}
      {!loading && unassigned.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Not in a group</CardTitle>
            <CardDescription>
              {unassigned.length} {unassigned.length === 1 ? 'seat has' : 'seats have'} no table yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {unassigned.map((player) => (
              <Badge key={player.id} variant="outline">
                {playerLabel(player)}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group, index) => (
          <GroupCard
            key={group.id}
            campaignId={campaignId}
            group={group}
            roster={players}
            characterForPlayer={characterForPlayer}
            doubled={doubled}
            placedElsewhere={elsewhere.get(group.id) ?? NO_SEATS}
            canManage={canManage}
            canMoveUp={index > 0}
            canMoveDown={index < groups.length - 1}
            onEdit={() => setEditing({ group })}
            onDelete={() => handleDelete(group)}
            onMembers={(memberIds) => handleMembers(group, memberIds)}
            onMove={(direction) => handleMove(group, direction)}
          />
        ))}
      </div>

      <GroupEditorDialog
        campaignId={campaignId}
        group={editing?.group ?? null}
        open={editing !== null}
        onOpenChange={(open) => setEditing(open ? editing : null)}
        onSaved={handleSaved}
      />

      <SuggestGroupsDialog
        campaignId={campaignId}
        open={suggesting}
        onOpenChange={setSuggesting}
        onSaved={() => {
          setSuggesting(false);
          reload();
        }}
      />
    </div>
  );
}
