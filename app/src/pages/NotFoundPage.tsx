import { Link, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { resolveActiveGameSystem, useGameSystemStore } from '@/store/gameSystemStore';

/**
 * Whatever the router could not match. A wrong link used to render an empty page, which reads as
 * the app having crashed rather than as a link that goes nowhere — the way back has to be visible.
 */
export function NotFoundPage() {
  const location = useLocation();
  const preferredSystemId = useGameSystemStore((state) => state.preferredSystemId);
  const system = resolveActiveGameSystem(location.pathname, preferredSystemId);

  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
        <Compass className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">There is nothing at this address</h1>
          <p className="text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{location.pathname}</code> is
            not a page in this app.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/">Home</Link>
          </Button>
          {system.navItems.slice(0, 1).map((item) => (
            <Button key={item.to} asChild variant="outline">
              <Link to={item.to}>{item.label}</Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
