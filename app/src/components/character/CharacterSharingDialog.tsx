// Who may open this sheet, and who may edit it. The owner's control panel for both.
//
// Visibility is the D&D Beyond-shaped choice and it is what a share link means: one URL serves
// every setting, so narrowing a character narrows every link already sent. Rotating the link is
// the harder revoke, for when the URL went somewhere it should not have.
//
// Grants are the named half — a specific player, or whoever runs a campaign. The server only
// accepts subjects the owner already shares a table with, so the picker is built from exactly
// that: the members of the campaigns they belong to.
import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Loader2, RefreshCw, Share2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getCharacterSharing,
  grantCharacterAccess,
  listCampaignMembers,
  listCampaigns,
  revokeCharacterAccess,
  setCharacterSharing,
  type CharacterGrantAccess,
  type CharacterGrantSubject,
  type CharacterSharing,
  type CharacterVisibility,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/authStore';

const VISIBILITY_OPTIONS: { value: CharacterVisibility; label: string; hint: string }[] = [
  { value: 'private', label: 'Private', hint: 'Only you, and anyone you name below.' },
  { value: 'campaign', label: 'Campaign only', hint: 'Everyone at the table this character is seated at.' },
  { value: 'public', label: 'Public', hint: 'Anyone with the link, signed in or not.' },
];

/** One person or seat the owner may hand the sheet to. `value` is what the picker commits. */
interface ShareCandidate {
  value: string;
  label: string;
  description: string;
  subjectType: CharacterGrantSubject;
  subjectId: number;
}

const candidateKey = (subjectType: CharacterGrantSubject, subjectId: number) => `${subjectType}:${subjectId}`;

/**
 * The share URL. `BASE_URL` is absolute in dev and prod alike (CLAUDE.md keeps the Vite base that
 * way), so a deploy under a subpath still produces a link that resolves.
 */
function shareUrlFor(token: string): string {
  return new URL(`${import.meta.env.BASE_URL}shared/${token}`, window.location.origin).toString();
}

export function CharacterSharingDialog({ characterId, characterName }: Readonly<{ characterId: string; characterName: string }>) {
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState<CharacterSharing | null>(null);
  const [candidates, setCandidates] = useState<ShareCandidate[]>([]);
  const [pickedCandidate, setPickedCandidate] = useState('');
  const [pickedAccess, setPickedAccess] = useState<CharacterGrantAccess>('edit');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getCharacterSharing(characterId)
      .then((state) => {
        if (!cancelled) setSharing(state);
      })
      .catch((e: unknown) => {
        if (!cancelled) toast.error('Could not read this sheet’s sharing', { description: describeError(e) });
      });
    loadShareCandidates(userId)
      .then((found) => {
        if (!cancelled) setCandidates(found);
      })
      .catch((e: unknown) => {
        console.warn('could not list people to share with', describeError(e));
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, open, userId]);

  const run = useCallback(async (action: () => Promise<CharacterSharing>, success: string) => {
    setBusy(true);
    try {
      setSharing(await action());
      toast.success(success);
    } catch (e) {
      toast.error('That change did not stick', { description: describeError(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  const handleVisibility = (value: string) => {
    void run(() => setCharacterSharing(characterId, { visibility: value as CharacterVisibility }), 'Visibility updated');
  };

  const handleRotate = () => {
    void run(
      () => setCharacterSharing(characterId, { rotateToken: true }),
      'New link minted — every link you sent before has stopped working',
    );
  };

  const handleCopy = async () => {
    if (!sharing?.share_token) return;
    try {
      await navigator.clipboard.writeText(shareUrlFor(sharing.share_token));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error('Could not copy the link', { description: describeError(e) });
    }
  };

  const handleGrant = () => {
    const candidate = candidates.find((entry) => entry.value === pickedCandidate);
    if (!candidate) return;
    void run(
      () => grantCharacterAccess(characterId, {
        subjectType: candidate.subjectType,
        subjectId: candidate.subjectId,
        access: pickedAccess,
      }),
      `${candidate.label} can now ${pickedAccess === 'edit' ? 'edit' : 'read'} this sheet`,
    ).then(() => setPickedCandidate(''));
  };

  const alreadyGranted = new Set((sharing?.grants ?? []).map((grant) => candidateKey(grant.subject_type, grant.subject_id)));
  const offerable = candidates.filter((entry) => !alreadyGranted.has(candidateKey(entry.subjectType, entry.subjectId)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {characterName}</DialogTitle>
          <DialogDescription>
            Choose who can open this sheet, and hand editing to your GM or a party-mate.
          </DialogDescription>
        </DialogHeader>

        {sharing ? (
          <div className="space-y-5">
            <RadioGroup value={sharing.visibility} onValueChange={handleVisibility} disabled={busy} className="gap-3">
              {VISIBILITY_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-start gap-3">
                  <RadioGroupItem value={option.value} id={`visibility-${option.value}`} className="mt-1" />
                  <Label htmlFor={`visibility-${option.value}`} className="cursor-pointer font-normal">
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="share-link">Link</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="share-link"
                  readOnly
                  value={sharing.share_token ? shareUrlFor(sharing.share_token) : ''}
                  className="min-w-0 flex-1"
                  onFocus={(event) => event.currentTarget.select()}
                />
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="Copy link" onClick={() => void handleCopy()}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" aria-label="Mint a new link" disabled={busy} onClick={handleRotate}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                One link, whatever the setting above: it lets in exactly the people that setting allows. Minting a new
                one stops every link you have already sent.
              </p>
            </div>

            <Separator />

            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-medium">Named people</h4>
                <p className="text-xs text-muted-foreground">
                  They can open this sheet whatever the setting above says — and edit it, if you say so.
                </p>
              </div>

              {sharing.grants.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nobody yet.</p>
              ) : (
                <ul className="space-y-2">
                  {sharing.grants.map((grant) => (
                    <li key={grant.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                      <div className="min-w-0">
                        <span className="break-words text-sm font-medium">{grant.label}</span>
                        <p className="text-xs text-muted-foreground">{grant.access === 'edit' ? 'Can edit' : 'Can read'}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11"
                        aria-label={`Stop sharing with ${grant.label}`}
                        disabled={busy}
                        onClick={() => void run(() => revokeCharacterAccess(characterId, grant.id), `${grant.label} no longer has access`)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              {offerable.length > 0 ? (
                <div className="flex flex-wrap items-start gap-2">
                  <div className="min-w-[12rem] flex-1">
                    <Select value={pickedCandidate} onValueChange={setPickedCandidate}>
                      <SelectTrigger className="min-h-11 w-full" aria-label="Person to share with">
                        <SelectValue placeholder="Someone at one of your tables" />
                      </SelectTrigger>
                      <SelectContent>
                        {offerable.map((candidate) => (
                          <SelectItem key={candidate.value} value={candidate.value}>
                            {candidate.label}
                            <span className="ml-2 text-xs text-muted-foreground">{candidate.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select value={pickedAccess} onValueChange={(value) => setPickedAccess(value as CharacterGrantAccess)}>
                    <SelectTrigger className="min-h-11 w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="view">Can read</SelectItem>
                      <SelectItem value="edit">Can edit</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" className="min-h-11" disabled={busy || !pickedCandidate} onClick={handleGrant}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Add
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  You can only share with people you already share a campaign with.
                </p>
              )}
            </div>
          </div>
        ) : (
          <output className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Reading this sheet’s sharing...
          </output>
        )}
      </DialogContent>
    </Dialog>
  );
}

function describeError(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

/**
 * Everyone the server will accept as a grant subject: the GM of each campaign the owner belongs to
 * (unless that is them), and every other member of those campaigns. Loading it here rather than
 * asking for a search endpoint keeps the rule that a grant can never name a stranger.
 */
async function loadShareCandidates(userId: number | null): Promise<ShareCandidate[]> {
  const campaigns = await listCampaigns();
  const byKey = new Map<string, ShareCandidate>();

  for (const campaign of campaigns) {
    const campaignName = campaign.name ?? `Campaign ${campaign.id}`;
    if (campaign.owner_user_id != null && Number(campaign.owner_user_id) !== Number(userId)) {
      byKey.set(candidateKey('campaign_owner', campaign.id), {
        value: candidateKey('campaign_owner', campaign.id),
        label: `GM of ${campaignName}`,
        description: 'Whoever runs that table, now or later',
        subjectType: 'campaign_owner',
        subjectId: campaign.id,
      });
    }

    const members = await listCampaignMembers(campaign.id).catch((e: unknown) => {
      console.warn('could not list members of campaign', campaign.id, e instanceof Error ? e.message : e);
      return [];
    });
    for (const member of members) {
      if (member.user_id == null || Number(member.user_id) === Number(userId)) continue;
      const key = candidateKey('user', member.user_id);
      if (byKey.has(key)) continue;
      byKey.set(key, {
        value: key,
        label: member.user_name || member.player_name || `Account ${member.user_id}`,
        description: campaignName,
        subjectType: 'user',
        subjectId: member.user_id,
      });
    }
  }

  return [...byKey.values()].sort((left, right) => left.label.localeCompare(right.label));
}
