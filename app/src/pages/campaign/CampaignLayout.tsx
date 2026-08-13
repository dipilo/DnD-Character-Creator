import { useEffect, useMemo } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarRange, Mail, Swords, Users, UsersRound } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { isCampaignOwner, useCampaignStore } from '@/store/campaignStore';

const TABS = [
  { to: 'schedule', label: 'Schedule', icon: CalendarRange },
  { to: 'roster', label: 'Roster', icon: Users },
  { to: 'party', label: 'Party', icon: Swords },
  { to: 'groups', label: 'Groups', icon: UsersRound },
  { to: 'members', label: 'Members & invites', icon: Mail },
] as const;

/**
 * Resolves the campaign in the URL and the caller's membership in it, then hands both to the tab
 * pages through the store. Membership is what decides which controls are offered; the server
 * checks it again on every route, so this only ever hides work that would be refused.
 */
export function CampaignLayout() {
  const { campaignId: campaignIdParam } = useParams<{ campaignId: string }>();
  const campaignId = Number(campaignIdParam);
  const { campaigns, membership, loadCampaigns, loadMembership, setActiveCampaign } = useCampaignStore();

  const campaign = useMemo(() => campaigns.find((c) => c.id === campaignId) ?? null, [campaigns, campaignId]);

  useEffect(() => {
    if (!Number.isFinite(campaignId)) return;
    setActiveCampaign(campaignId);
    void loadCampaigns();
    void loadMembership(campaignId);
  }, [campaignId, setActiveCampaign, loadCampaigns, loadMembership]);

  if (!Number.isFinite(campaignId)) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">That is not a campaign id.</p>
        <Button asChild variant="outline">
          <Link to="/campaigns">Back to campaigns</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 short:space-y-2 sm:space-y-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/campaigns">
            <ArrowLeft className="h-4 w-4" />
            Campaigns
          </Link>
        </Button>
        <h1 className="min-w-0 break-words text-xl font-bold tracking-tight short:text-base sm:text-2xl">
          {campaign?.name ?? (
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <Spinner className="size-4" />
              Loading campaign...
            </span>
          )}
        </h1>
        {isCampaignOwner(membership) ? <Badge variant="secondary">Owner</Badge> : null}
      </div>

      {/* Five tabs wrap to three rows on a phone and the section header stops reading as one
          control. A single scrolling row keeps them in one line at any width. */}
      <nav className="scroll-strip -mx-3 border-b px-3 pb-2 short:pb-1 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1">
          {TABS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}>
              {({ isActive }) => (
                <span
                  className={cn(
                    'inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors',
                    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}
