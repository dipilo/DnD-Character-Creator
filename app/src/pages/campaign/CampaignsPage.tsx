import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError, createCampaign, findCampaignByCode, joinCampaign } from '@/lib/api';
import { randomCampaignName } from '@/data/campaignNames';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useCampaignStore } from '@/store/campaignStore';

/** Server error codes for the join flow, in the words a player would use. */
const joinErrors: Record<string, string> = {
  campaign_not_found: 'No campaign uses that code.',
  already_member: 'You are already in that campaign.',
  network_error: 'Could not reach the server. Check your connection and try again.',
};

function describeError(e: unknown, table: Record<string, string>): string {
  if (e instanceof ApiError) return table[e.code] ?? `That did not work (${e.code}).`;
  return e instanceof Error ? e.message : 'Something went wrong.';
}

export function CampaignsPage() {
  const navigate = useNavigate();
  const { campaigns, loading, loadCampaigns, upsertCampaign, setActiveCampaign } = useCampaignStore();
  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  // A lazy initializer, not a render-body call: Math.random() during render is impure and would
  // hand the field a different suggestion on every re-render.
  const [nameSuggestion, setNameSuggestion] = useState(() => randomCampaignName());

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const openCampaign = (campaignId: number) => {
    setActiveCampaign(campaignId);
    navigate(`/campaign/${campaignId}`);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const campaign = await createCampaign(name);
      upsertCampaign(campaign);
      setNewName('');
      setNameSuggestion(randomCampaignName());
      toast.success(`Created ${campaign.name}`);
      openCampaign(campaign.id);
    } catch (e) {
      toast.error('Could not create the campaign', { description: describeError(e, {}) });
    } finally {
      setBusy(false);
    }
  };

  const handleJoin = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = joinCode.trim();
    if (!code || busy) return;
    setBusy(true);
    try {
      // Two steps deliberately: the code resolves to a campaign anyone may look up, and joining it
      // is a separate authenticated write, so a bad code fails before anything is recorded.
      const campaign = await findCampaignByCode(code);
      await joinCampaign(campaign.id);
      await loadCampaigns();
      setJoinCode('');
      toast.success(`Joined ${campaign.name}`);
      openCampaign(campaign.id);
    } catch (e) {
      toast.error('Could not join', { description: describeError(e, joinErrors) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Campaigns</h1>
        <p className="text-muted-foreground">
          A campaign holds a roster, everyone's availability, and the tables you split them into.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start a campaign</CardTitle>
            <CardDescription>You become its owner and get an invite code to share.</CardDescription>
          </CardHeader>
          <CardContent>
            {/* items-start, and no space-y on the field: an sr-only label is out of flow, so
                space-y's margin lands on the input alone and drops it below the button. */}
            <form className="flex items-start gap-2" onSubmit={handleCreate}>
              <div className="flex-1">
                <Label htmlFor="campaign-name" className="sr-only">
                  Campaign name
                </Label>
                <Input
                  id="campaign-name"
                  placeholder={nameSuggestion}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={busy || newName.trim().length === 0}>
                <Plus className="h-4 w-4" />
                Create
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Join with a code</CardTitle>
            <CardDescription>Ask the DM for the campaign code, or follow their invite link.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="flex items-start gap-2" onSubmit={handleJoin}>
              <div className="flex-1">
                <Label htmlFor="campaign-code" className="sr-only">
                  Campaign code
                </Label>
                <Input
                  id="campaign-code"
                  placeholder="8-character code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" disabled={busy || joinCode.trim().length === 0}>
                Join
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {loading && campaigns.length === 0 ? (
        <output className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading your campaigns...
        </output>
      ) : null}

      {!loading && campaigns.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays />
            </EmptyMedia>
            <EmptyTitle>No campaigns yet</EmptyTitle>
            <EmptyDescription>
              Create one above, or join an existing one with the code your DM shared.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link to="/characters">Go to my characters</Link>
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((campaign) => (
          <Card key={campaign.id} className="flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg">{campaign.name || 'Untitled campaign'}</CardTitle>
              <CardDescription>
                {campaign.created_at ? `Created ${new Date(campaign.created_at).toLocaleDateString()}` : 'Campaign'}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1" />
            <CardFooter className="gap-2">
              <Button className="flex-1" onClick={() => openCampaign(campaign.id)}>
                <Users className="h-4 w-4" />
                Open
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
