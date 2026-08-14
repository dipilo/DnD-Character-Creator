import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { createGroup, deleteGroup, listGroups, updateGroup } from '@/lib/api';
import type { Group } from '@/lib/api';
import { GroupHeatmap } from '@/components/schedule/GroupHeatmap';
import { SuggestGroupsDialog } from '@/components/schedule/SuggestGroupsDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { memberCan, useCampaignStore } from '@/store/campaignStore';
import { playerLabel, useCampaignId, useRoster } from '@/pages/campaign/useCampaignData';

export function GroupsPage() {
  const campaignId = useCampaignId();
  const membership = useCampaignStore((state) => state.membership);
  const { players } = useRoster(campaignId);
  const [attempt, setAttempt] = useState(0);
  // Tagged with the request it answers, so `loading` is derived rather than set from the effect
  // body — the same shape as `useRoster`, and for the same reason (CLAUDE.md).
  const [loaded, setLoaded] = useState<{ key: string; groups: Group[] } | null>(null);
  const [newName, setNewName] = useState('');
  const [suggesting, setSuggesting] = useState(false);

  const canManage = memberCan(membership, 'can_manage_groups');
  const key = `${campaignId}:${attempt}`;
  const fresh = loaded?.key === key ? loaded : null;
  const groups = fresh?.groups ?? [];
  const loading = fresh === null;

  const reload = useCallback(() => setAttempt((n) => n + 1), []);
  const setGroups = useCallback(
    (update: (current: Group[]) => Group[]) => {
      setLoaded((current) => (current ? { ...current, groups: update(current.groups) } : current));
    },
    [],
  );

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

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      const group = await createGroup(campaignId, name);
      setGroups((current) => [...current, group]);
      setNewName('');
    } catch (e) {
      toast.error('Could not create that group', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleDelete = async (group: Group) => {
    try {
      await deleteGroup(group.id);
      setGroups((current) => current.filter((g) => g.id !== group.id));
    } catch (e) {
      toast.error('Could not delete that group', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleMembership = async (group: Group, playerId: number, member: boolean) => {
    const memberIds = group.members.map((m) => m.id);
    const next = member ? [...new Set([...memberIds, playerId])] : memberIds.filter((id) => id !== playerId);
    try {
      const updated = await updateGroup(group.id, { member_ids: next });
      setGroups((current) => current.map((g) => (g.id === group.id ? updated : g)));
    } catch (e) {
      toast.error('Could not change that group', { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Groups</h2>
          <p className="text-sm text-muted-foreground">
            Split the roster into tables. The thumbnail under each one shows when that table can meet.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-end gap-2">
            <form className="flex items-start gap-2" onSubmit={handleCreate}>
              {/* No space-y here: the label is sr-only and out of flow, so its margin would land
                  on the input alone and push it below the button. */}
              <div>
                <Label htmlFor="new-group" className="sr-only">
                  Group name
                </Label>
                <Input
                  id="new-group"
                  placeholder="Thursday table"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={newName.trim().length === 0}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </form>
            <Button variant="secondary" onClick={() => setSuggesting(true)}>
              <Wand2 className="h-4 w-4" />
              Suggest
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
          No groups yet.{canManage ? ' Create one above, or let the suggester propose a split.' : ''}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <Card key={group.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="truncate text-base">{group.name || 'Unnamed group'}</CardTitle>
                  <CardDescription>
                    {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                  </CardDescription>
                </div>
                {canManage ? (
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(group)} aria-label="Delete group">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <GroupHeatmap campaignId={campaignId} memberIds={group.members.map((m) => m.id)} />
              {canManage ? (
                <fieldset className="space-y-2">
                  <legend className="text-xs font-medium text-muted-foreground">Members</legend>
                  <div className="flex flex-wrap gap-3">
                    {players.map((player) => {
                      const isMember = group.members.some((m) => m.id === player.id);
                      return (
                        <label
                          key={player.id}
                          className="flex items-center gap-2 text-sm"
                          htmlFor={`group-${group.id}-player-${player.id}`}
                        >
                          <Checkbox
                            id={`group-${group.id}-player-${player.id}`}
                            checked={isMember}
                            onCheckedChange={(state) => handleMembership(group, player.id, state === true)}
                          />
                          {playerLabel(player)}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {group.members.map((member) => (
                    <Badge key={member.id} variant="secondary">
                      {playerLabel(member)}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
