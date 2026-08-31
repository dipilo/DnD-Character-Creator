import { useState } from 'react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { setOwnAutoClaim, type AutoClaimMode, type Campaign, type CampaignMember } from '@/lib/api';
import { AUTO_CLAIM_MODES, autoClaimLabel, autoClaimSource, resolveAutoClaimMode } from '@/lib/autoClaim';
import { useCampaignStore } from '@/store/campaignStore';

const UNSET = 'unset';

interface OwnAutoClaimFieldProps {
  readonly campaignId: number;
  readonly campaign: Campaign | null;
  readonly membership: CampaignMember | null;
}

/**
 * The caller's own answer to "does a seat I make become mine?". Written by its holder alone, the
 * way `character_edit_consent` is; the owner's override sits above it and locks the control.
 */
export function OwnAutoClaimField({ campaignId, campaign, membership }: OwnAutoClaimFieldProps) {
  const [busy, setBusy] = useState(false);
  if (!membership) return null;

  const source = autoClaimSource(campaign, membership);
  const locked = source === 'override';
  const effective = resolveAutoClaimMode(campaign, membership);
  const fallback = resolveAutoClaimMode(campaign, { ...membership, auto_claim_preference: null });

  const change = (value: string) => {
    if (busy) return;
    setBusy(true);
    setOwnAutoClaim(campaignId, value === UNSET ? null : (value as AutoClaimMode))
      .then(() => useCampaignStore.getState().loadMembership(campaignId))
      .catch((e: unknown) => {
        toast.error('Could not save that', { description: e instanceof Error ? e.message : undefined });
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor="own-auto-claim">Claim a seat when I make one</Label>
      <Select
        value={locked ? effective : membership.auto_claim_preference ?? UNSET}
        disabled={locked || busy}
        onValueChange={change}
      >
        <SelectTrigger id="own-auto-claim" className="h-11 w-full sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>Follow the table ({autoClaimLabel(fallback).toLowerCase()})</SelectItem>
          {AUTO_CLAIM_MODES.map((mode) => (
            <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {locked ? (
        <p className="text-xs text-muted-foreground">Set for you by the campaign owner.</p>
      ) : null}
    </div>
  );
}
