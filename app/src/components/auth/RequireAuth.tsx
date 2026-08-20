import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AuthDialog } from '@/components/auth/AuthDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { useAuthStore } from '@/store/authStore';

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * The route guard Phase 3 deferred until there was something campaign-scoped to guard
 * (MERGE_PLAN.md §8). It gates the campaign screens and nothing else — **the builder stays usable
 * signed out**, which is the whole reason `characterStore` knows nothing about the network.
 *
 * It guards the *view*, not the data: every campaign route on the server resolves membership for
 * itself. Rendering a sign-in prompt instead of redirecting keeps the URL intact, so signing in
 * lands on the page that was asked for rather than the campaign list.
 */
export function RequireAuth({ children }: Readonly<RequireAuthProps>) {
  const status = useAuthStore((state) => state.status);
  const [dialogOpen, setDialogOpen] = useState(false);
  const location = useLocation();

  // `unknown` means `GET /api/me` is still in flight. Showing the prompt now would flash a
  // sign-in card at someone who is already signed in.
  if (status === 'unknown') {
    return (
      <output className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Checking your session...
      </output>
    );
  }

  if (status === 'authenticated') return <>{children}</>;

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to continue</CardTitle>
          <CardDescription>
            Campaigns, rosters and schedules belong to an account. You can keep building
            characters signed out.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button onClick={() => setDialogOpen(true)}>Sign in or create an account</Button>
          <Button asChild variant="ghost">
            <Link to="/builder" state={{ from: location.pathname }}>
              Back to the builder
            </Link>
          </Button>
        </CardContent>
      </Card>
      <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
