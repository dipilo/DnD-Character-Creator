import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, Link2, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  deleteCampaign,
  deleteInvite,
  leaveCampaign,
  listCampaignMembers,
  listInvites,
  regenerateCampaignCode,
  renameCampaign,
  updateMemberPermissions,
} from '@/lib/api';
import type { CampaignMember, CampaignPermissions, Invite } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CampaignSourcesCard } from '@/components/schedule/CampaignSourcesCard';
import { InviteSettingsDialog } from '@/components/schedule/InviteSettingsDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  CAMPAIGN_PERMISSION_FLAGS,
  isCampaignOwner,
  memberCan,
  parsePermissions,
  useCampaignStore,
} from '@/store/campaignStore';
import { useCampaignId } from '@/pages/campaign/useCampaignData';

function memberName(member: CampaignMember): string {
  return member.user_name || member.player_name || (member.user_discord ? `Discord ${member.user_discord}` : `Member #${member.id}`);
}

/** "expired" is worth saying out loud — a link that silently stops working reads as a bug. */
function expiryLabel(expiresAt: string): string {
  const when = new Date(expiresAt);
  if (Number.isNaN(when.getTime())) return 'expiry unknown';
  return when.getTime() < Date.now() ? 'expired' : `expires ${when.toLocaleDateString()}`;
}

async function copyToClipboard(value: string, what: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${what} copied`);
  } catch (e) {
    toast.error(`Could not copy the ${what.toLowerCase()}`, {
      description: e instanceof Error ? e.message : undefined,
    });
  }
}

export function MembersPage() {
  const campaignId = useCampaignId();
  const navigate = useNavigate();
  const { campaigns, membership, upsertCampaign, removeCampaign } = useCampaignStore();
  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  // null means "not edited"; the field then shows the campaign's own name. Mirroring the name into
  // state from an effect would fight every rename that lands from elsewhere.
  const [draftName, setDraftName] = useState<string | null>(null);
  const name = draftName ?? campaign?.name ?? '';

  const isOwner = isCampaignOwner(membership);
  const canInvite = memberCan(membership, 'can_create_invites');

  useEffect(() => {
    if (!Number.isFinite(campaignId)) return;
    let cancelled = false;
    listCampaignMembers(campaignId)
      .then((result) => {
        if (!cancelled) setMembers(result);
      })
      .catch((e: unknown) => {
        toast.error('Could not load members', { description: e instanceof Error ? e.message : undefined });
      });
    listInvites(campaignId)
      .then((result) => {
        if (!cancelled) setInvites(result);
      })
      .catch((e: unknown) => {
        // A member can read the campaign without being allowed to read its invites. That is not an
        // error worth shouting about; the invites card simply stays empty.
        console.warn('could not load invites', e instanceof Error ? e.message : e);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const handleRename = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      upsertCampaign(await renameCampaign(campaignId, name.trim()));
      setDraftName(null);
      toast.success('Renamed');
    } catch (e) {
      toast.error('Could not rename', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleRegenerate = async () => {
    try {
      upsertCampaign(await regenerateCampaignCode(campaignId));
      toast.success('New code generated', { description: 'The previous code no longer works.' });
    } catch (e) {
      toast.error('Could not regenerate the code', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleDeleteCampaign = async () => {
    try {
      await deleteCampaign(campaignId);
      removeCampaign(campaignId);
      toast.success('Campaign deleted');
      navigate('/campaigns');
    } catch (e) {
      toast.error('Could not delete the campaign', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const handleLeave = async () => {
    try {
      await leaveCampaign(campaignId);
      removeCampaign(campaignId);
      toast.success('You left the campaign');
      navigate('/campaigns');
    } catch (e) {
      toast.error('Could not leave', { description: e instanceof Error ? e.message : undefined });
    }
  };

  /** Null while the dialog is closed; `{ invite: null }` means "creating a new one". */
  const [inviteDialog, setInviteDialog] = useState<{ invite: Invite | null } | null>(null);

  const handleInviteSaved = (saved: Invite) => {
    setInvites((current) => {
      const exists = current.some((entry) => entry.id === saved.id);
      return exists ? current.map((entry) => (entry.id === saved.id ? saved : entry)) : [...current, saved];
    });
  };

  const handleDeleteInvite = async (invite: Invite) => {
    try {
      await deleteInvite(invite.id);
      setInvites((current) => current.filter((i) => i.id !== invite.id));
    } catch (e) {
      toast.error('Could not delete that invite', { description: e instanceof Error ? e.message : undefined });
    }
  };

  const togglePermission = async (member: CampaignMember, flag: keyof CampaignPermissions, value: boolean) => {
    const permissions = { ...parsePermissions(member), [flag]: value };
    try {
      const updated = await updateMemberPermissions(campaignId, member.id, permissions);
      setMembers((current) => current.map((m) => (m.id === member.id ? { ...m, permissions: updated.permissions } : m)));
    } catch (e) {
      toast.error('Could not change permissions', { description: e instanceof Error ? e.message : undefined });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
          <CardDescription>
            Owners hold every permission. Everything else is granted per member.
          </CardDescription>
        </CardHeader>
        {/* Below md the permission grid becomes one card per member. A horizontally scrolling
            table scrolls the name out of view, which leaves a row of unlabelled switches. */}
        <CardContent className="space-y-3 md:hidden">
          {members.map((member) => {
            const permissions = parsePermissions(member);
            const owner = member.role === 'owner';
            return (
              <div key={member.id} className="space-y-3 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{memberName(member)}</span>
                  {owner ? <Badge variant="secondary">Owner</Badge> : null}
                  <span className="text-sm text-muted-foreground">{member.player_name ?? 'No seat'}</span>
                </div>
                {isOwner ? (
                  <div className="space-y-2">
                    {CAMPAIGN_PERMISSION_FLAGS.map((flag) => (
                      <div key={flag.key} className="flex min-h-9 items-center justify-between gap-3">
                        <span className="text-sm">{flag.label}</span>
                        <Switch
                          checked={owner || Boolean(permissions[flag.key])}
                          disabled={owner}
                          aria-label={`${flag.label} for ${memberName(member)}`}
                          onCheckedChange={(value) => togglePermission(member, flag.key, value)}
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>

        <CardContent className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Seat</TableHead>
                {isOwner ? CAMPAIGN_PERMISSION_FLAGS.map((flag) => <TableHead key={flag.key}>{flag.label}</TableHead>) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => {
                const permissions = parsePermissions(member);
                const owner = member.role === 'owner';
                return (
                  <TableRow key={member.id}>
                    <TableCell className="whitespace-nowrap">
                      {memberName(member)}
                      {owner ? <Badge className="ml-2" variant="secondary">Owner</Badge> : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {member.player_name ?? 'No seat'}
                    </TableCell>
                    {isOwner
                      ? CAMPAIGN_PERMISSION_FLAGS.map((flag) => (
                          <TableCell key={flag.key}>
                            <Switch
                              checked={owner || Boolean(permissions[flag.key])}
                              disabled={owner}
                              aria-label={`${flag.label} for ${memberName(member)}`}
                              onCheckedChange={(value) => togglePermission(member, flag.key, value)}
                            />
                          </TableCell>
                        ))
                      : null}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Invites</CardTitle>
              <CardDescription>An invite link joins whoever opens it, once they have an account.</CardDescription>
            </div>
            {canInvite ? (
              <Button size="sm" className="min-h-11" onClick={() => setInviteDialog({ invite: null })}>
                <Plus className="h-4 w-4" />
                New invite
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {campaign?.campaign_code ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Campaign code</span>
              <code className="rounded bg-muted px-2 py-1 text-sm">{campaign.campaign_code}</code>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(campaign.campaign_code ?? '', 'Campaign code')}
              >
                <Copy className="h-4 w-4" />
              </Button>
              {isOwner ? (
                <Button size="sm" variant="ghost" onClick={handleRegenerate}>
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </Button>
              ) : null}
            </div>
          ) : null}

          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invite links yet.</p>
          ) : null}

          <ul className="space-y-2">
            {invites.map((invite) => {
              const url = `${window.location.origin}/invite/${invite.token}`;
              return (
                <li key={invite.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
                  <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {/* Full-width on a phone: sharing the row with the counter and two buttons left
                      the link truncated to about four characters. */}
                  <code className="w-full min-w-0 flex-1 truncate text-xs sm:w-auto">{url}</code>
                  <span className="text-xs text-muted-foreground">
                    used {invite.used_count}
                    {invite.max_uses ? ` / ${invite.max_uses}` : ' / unlimited'}
                    {invite.expires_at ? ` · ${expiryLabel(invite.expires_at)}` : ''}
                  </span>
                  <Button size="sm" variant="ghost" className="min-h-11" onClick={() => copyToClipboard(url, 'Invite link')} aria-label="Copy invite link">
                    <Copy className="h-4 w-4" />
                  </Button>
                  {canInvite ? (
                    <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setInviteDialog({ invite })} aria-label="Invite settings">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {canInvite ? (
                    <Button size="sm" variant="ghost" className="min-h-11" onClick={() => handleDeleteInvite(invite)} aria-label="Delete invite">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <CampaignSourcesCard campaign={campaign} canEdit={isOwner} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isOwner ? (
            <form className="flex flex-wrap items-end gap-2" onSubmit={handleRename}>
              <div className="w-full space-y-1.5 sm:w-auto">
                <Label htmlFor="campaign-rename">Name</Label>
                <Input
                  id="campaign-rename"
                  className="w-full sm:w-64"
                  value={name}
                  onChange={(e) => setDraftName(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={!name.trim() || name === campaign?.name}>
                Rename
              </Button>
            </form>
          ) : null}

          <Separator />

          {isOwner ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">Delete this campaign</p>
              <p className="text-sm text-muted-foreground">
                Seats, availability and invites go. Characters are only unseated.
              </p>
              <Button variant="destructive" size="sm" onClick={handleDeleteCampaign}>
                Delete campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">Leave this campaign</p>
              <p className="text-sm text-muted-foreground">
                Your seat stays behind for someone else to claim; your characters stay yours.
              </p>
              <Button variant="outline" size="sm" onClick={handleLeave}>
                Leave campaign
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <InviteSettingsDialog
        open={inviteDialog !== null}
        onOpenChange={(open) => setInviteDialog(open ? inviteDialog : null)}
        campaignId={campaignId}
        invite={inviteDialog?.invite ?? null}
        onSaved={handleInviteSaved}
      />
    </div>
  );
}
