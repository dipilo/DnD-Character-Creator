import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createInvite, updateInvite, type Invite, type InviteWritePayload } from '@/lib/api';

interface InviteSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: number;
  /** The invite being edited, or null to create a new one. */
  invite: Invite | null;
  onSaved: (invite: Invite) => void;
}

/** Expiry is offered as a span rather than a date: nobody picks "2026-09-12T14:03Z" by hand. */
const EXPIRY_OPTIONS: ReadonlyArray<{ value: string; label: string; hours: number | null }> = [
  { value: 'never', label: 'Never expires', hours: null },
  { value: '1h', label: 'In 1 hour', hours: 1 },
  { value: '24h', label: 'In 24 hours', hours: 24 },
  { value: '7d', label: 'In 7 days', hours: 24 * 7 },
  { value: '30d', label: 'In 30 days', hours: 24 * 30 },
];

const USE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '1', label: 'One person' },
  { value: '5', label: 'Up to 5 people' },
  { value: '10', label: 'Up to 10 people' },
  { value: '0', label: 'No limit' },
];

function expiryFromChoice(choice: string): string | null {
  const option = EXPIRY_OPTIONS.find((entry) => entry.value === choice);
  if (!option?.hours) return null;
  return new Date(Date.now() + option.hours * 60 * 60 * 1000).toISOString();
}

/**
 * The inner form is remounted by a `key` on the dialog rather than seeding its fields from an
 * effect — the same rule `PlayerEditorDialog` follows.
 */
function InviteForm({ campaignId, invite, onSaved, onOpenChange }: Readonly<Omit<InviteSettingsDialogProps, 'open'>>) {
  const [maxUses, setMaxUses] = useState(String(invite?.max_uses ?? 1));
  // An existing invite's expiry is a timestamp, not one of the spans, so editing defaults to
  // leaving it alone unless a new span is chosen.
  const [expiry, setExpiry] = useState(invite ? 'keep' : 'never');
  const [busy, setBusy] = useState(false);

  const currentExpiry = invite?.expires_at ? new Date(invite.expires_at).toLocaleString() : 'never';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const payload: InviteWritePayload = { max_uses: Number.parseInt(maxUses, 10) };
    if (expiry !== 'keep') payload.expires_at = expiryFromChoice(expiry);
    try {
      const saved = invite ? await updateInvite(invite.id, payload) : await createInvite(campaignId, payload);
      onSaved(saved);
      onOpenChange(false);
      toast.success(invite ? 'Invite updated' : 'Invite link created');
    } catch (e) {
      toast.error(invite ? 'Could not update that invite' : 'Could not create an invite', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5">
        <Label htmlFor="invite-max-uses">How many people can use it</Label>
        <Select value={maxUses} onValueChange={setMaxUses}>
          <SelectTrigger id="invite-max-uses" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {USE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {invite ? (
          <p className="text-xs text-muted-foreground">Used {invite.used_count} time(s) so far.</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invite-expiry">Expires</Label>
        <Select value={expiry} onValueChange={setExpiry}>
          <SelectTrigger id="invite-expiry" className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {invite ? <SelectItem value="keep">Leave as it is ({currentExpiry})</SelectItem> : null}
            {EXPIRY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" className="min-h-11" disabled={busy}>
          {invite ? 'Save' : 'Create link'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function InviteSettingsDialog({ open, onOpenChange, campaignId, invite, onSaved }: Readonly<InviteSettingsDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{invite ? 'Invite settings' : 'New invite link'}</DialogTitle>
          <DialogDescription>
            Anyone who opens the link joins this campaign, once they have an account.
          </DialogDescription>
        </DialogHeader>
        <InviteForm
          key={invite?.id ?? 'new'}
          campaignId={campaignId}
          invite={invite}
          onSaved={onSaved}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
