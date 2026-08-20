import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { PermissionToggles } from '@/components/schedule/PermissionToggles';
import { GAME_SYSTEM_LIST, getGameSystem, type GameSystemId } from '@/data/gameSystems';
import {
  parsePermissionBlob,
  setCampaignCharacterEditRequest,
  setCampaignDefaultPermissions,
  setCampaignSystem,
  type Campaign,
  type CampaignPermissions,
} from '@/lib/api';

interface CampaignDefaultsCardProps {
  readonly campaign: Campaign | null;
  readonly canEdit: boolean;
  readonly onCampaignChange: (campaign: Campaign) => void;
}

/**
 * The two things a table decides once and applies to everyone who arrives afterwards: which game
 * it plays, and what a new member is allowed to do.
 *
 * Defaults apply *on the way in*, never retroactively — changing them cannot silently re-grant or
 * revoke anything for people already at the table, whose rows the Members grid edits directly.
 */
function DefaultsForm({ campaign, canEdit, onCampaignChange }: Readonly<CampaignDefaultsCardProps & { campaign: Campaign }>) {
  const [systemId, setSystemId] = useState<GameSystemId>(getGameSystem(campaign.system_id).id);
  const [memberDefaults, setMemberDefaults] = useState<CampaignPermissions>(
    () => parsePermissionBlob(campaign.default_member_permissions),
  );
  const [inviteDefaults, setInviteDefaults] = useState<CampaignPermissions>(
    () => parsePermissionBlob(campaign.default_invite_permissions),
  );
  const [busy, setBusy] = useState(false);
  const asksCharacterEdit = Boolean(campaign.requests_character_edit);

  const save = async (run: () => Promise<Campaign>, what: string) => {
    if (busy) return;
    setBusy(true);
    run()
      .then((updated) => {
        onCampaignChange(updated);
        toast.success(`${what} saved`);
      })
      .catch((e: unknown) => {
        toast.error(`Could not save ${what.toLowerCase()}`, {
          description: e instanceof Error ? e.message : undefined,
        });
      })
      .finally(() => setBusy(false));
  };

  return (
    <CardContent className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="campaign-system-select">Game</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={systemId}
            disabled={!canEdit || busy}
            onValueChange={(value) => setSystemId(value as GameSystemId)}
          >
            <SelectTrigger id="campaign-system-select" className="h-11 w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GAME_SYSTEM_LIST.filter((system) => system.available).map((system) => (
                <SelectItem key={system.id} value={system.id}>{system.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canEdit ? (
            <Button
              variant="secondary"
              className="min-h-11"
              disabled={busy || systemId === getGameSystem(campaign.system_id).id}
              onClick={() => save(() => setCampaignSystem(campaign.id, systemId), 'Game')}
            >
              Save
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Decides which builder the party page opens when someone starts a character here.
        </p>
      </div>

      <Separator />

      {/* The ask, and only the ask. It is not a permission the owner can grant themselves: each
          player answers it on their own membership row, which this page cannot write. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Ask players to let you edit their characters</p>
          <p className="text-xs text-muted-foreground">
            Asks players for permission to edit their characters on this campaign&apos;s invite links and Party page.
          </p>
        </div>
        <Switch
          checked={asksCharacterEdit}
          disabled={!canEdit || busy}
          aria-label="Ask players to let you edit their characters"
          onCheckedChange={(next) => save(() => setCampaignCharacterEditRequest(campaign.id, next), 'Character editing request')}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">New members get</p>
          <p className="text-xs text-muted-foreground">
            Applied when someone joins with the campaign code or claims a seat. It does not change
            anyone already at the table.
          </p>
        </div>
        <PermissionToggles
          idPrefix="campaign-member-default"
          value={memberDefaults}
          onChange={setMemberDefaults}
          disabled={!canEdit || busy}
        />
        {canEdit ? (
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={busy}
            onClick={() => save(() => setCampaignDefaultPermissions(campaign.id, 'member', memberDefaults), 'Member defaults')}
          >
            Save member defaults
          </Button>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">New invite links start with</p>
          <p className="text-xs text-muted-foreground">
            Seeds each new link. A link can still be given its own set, which wins over this.
          </p>
        </div>
        <PermissionToggles
          idPrefix="campaign-invite-default"
          value={inviteDefaults}
          onChange={setInviteDefaults}
          disabled={!canEdit || busy}
        />
        {canEdit ? (
          <Button
            variant="secondary"
            className="min-h-11"
            disabled={busy}
            onClick={() => save(() => setCampaignDefaultPermissions(campaign.id, 'invite', inviteDefaults), 'Invite defaults')}
          >
            Save invite defaults
          </Button>
        ) : null}
      </div>
    </CardContent>
  );
}

export function CampaignDefaultsCard({ campaign, canEdit, onCampaignChange }: Readonly<CampaignDefaultsCardProps>) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Game and defaults</CardTitle>
        <CardDescription>What this table plays, and what everyone who joins it can do.</CardDescription>
      </CardHeader>
      {campaign ? (
        // Keyed on the campaign so switching campaigns remounts the form rather than seeding its
        // fields from an effect — the rule `PlayerEditorDialog` already follows.
        <DefaultsForm
          key={campaign.id}
          campaign={campaign}
          canEdit={canEdit}
          onCampaignChange={onCampaignChange}
        />
      ) : (
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading this campaign&apos;s settings...</p>
        </CardContent>
      )}
    </Card>
  );
}
