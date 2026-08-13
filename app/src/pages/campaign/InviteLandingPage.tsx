import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError, joinWithInvite, previewInvite } from '@/lib/api';
import type { InvitePreview } from '@/lib/api';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/authStore';
import { useCampaignStore } from '@/store/campaignStore';

const joinErrors: Record<string, string> = {
  invite_not_found: 'That invite link is not valid.',
  invite_expired: 'That invite has expired.',
  invite_maxed_out: 'That invite has already been used as many times as it allows.',
  challenge_required: 'This invite is gated behind a challenge that this app cannot show yet.',
};

/**
 * The invite landing page. It is deliberately **not** behind `RequireAuth`: an invite is a link
 * sent to someone who may not have an account yet, so the campaign is named first and the sign-in
 * prompt comes only when they choose to join. Membership itself still requires a session — the
 * server records nothing for an anonymous caller.
 */
export function InviteLandingPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const status = useAuthStore((state) => state.status);
  const loadCampaigns = useCampaignStore((state) => state.loadCampaigns);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    previewInvite(token)
      .then(setPreview)
      .catch((e: unknown) => {
        setError(e instanceof ApiError ? (joinErrors[e.code] ?? 'That invite link is not valid.') : 'That invite link is not valid.');
      });
  }, [token]);

  const handleJoin = async () => {
    if (!token) return;
    if (status !== 'authenticated') {
      setAuthOpen(true);
      return;
    }
    setJoining(true);
    try {
      const result = await joinWithInvite(token);
      await loadCampaigns();
      toast.success(`Joined ${result.campaign_name ?? 'the campaign'}`);
      navigate(`/campaign/${result.campaign_id}/roster`);
    } catch (e) {
      toast.error('Could not join', {
        description: e instanceof ApiError ? (joinErrors[e.code] ?? e.code) : undefined,
      });
    } finally {
      setJoining(false);
    }
  };

  const campaignName = preview?.campaign?.name ?? 'a campaign';

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You have been invited</CardTitle>
          <CardDescription>
            {error ?? (preview ? `${campaignName} wants you at the table.` : 'Checking the invite...')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!preview && !error ? (
            <output className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading
            </output>
          ) : null}
          {preview && status !== 'authenticated' ? (
            <p className="text-sm text-muted-foreground">
              Joining needs an account so the campaign knows who you are. Creating one takes a
              username and a password.
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleJoin} disabled={!preview || Boolean(error) || joining}>
            {status === 'authenticated' ? 'Join this campaign' : 'Sign in and join'}
          </Button>
          <Button variant="ghost" onClick={() => navigate('/campaigns')}>
            Not now
          </Button>
        </CardFooter>
      </Card>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </div>
  );
}
