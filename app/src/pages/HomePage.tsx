import { Link, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, CalendarRange, Dices } from 'lucide-react';
import type { GameSystemNavItem } from '@/data/gameSystems';
import { resolveActiveGameSystem, useGameSystemStore } from '@/store/gameSystemStore';

/**
 * Destinations that belong to no one game, so they are here rather than in the registry. Every
 * other card on this page comes from the active system — the page states no system's name, routes
 * or copy of its own.
 */
const SHARED_SHORTCUTS: GameSystemNavItem[] = [
  {
    to: '/campaigns',
    label: 'Campaigns',
    icon: CalendarRange,
    match: '/campaign',
    description: 'Schedule sessions, keep a roster, and seat characters at a table.',
  },
  {
    to: '/dice',
    label: 'Dice Roller',
    icon: Dices,
    match: '/dice',
    description: 'Roll 3D physics dice.',
  },
];

function ShortcutCard({ shortcut }: Readonly<{ shortcut: GameSystemNavItem }>) {
  const { to, icon: Icon, label, description } = shortcut;
  return (
    <Link to={to} className="group">
      <Card className="h-full transition-colors hover:border-primary">
        <CardHeader>
          <Icon className="mb-2 h-7 w-7 text-primary" />
          <CardTitle className="flex items-center justify-between gap-2">
            {label}
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      </Card>
    </Link>
  );
}

export function HomePage() {
  const location = useLocation();
  const preferredSystemId = useGameSystemStore((state) => state.preferredSystemId);
  const system = resolveActiveGameSystem(location.pathname, preferredSystemId);

  const [primary, ...rest] = system.navItems;
  const secondary = [...rest, ...SHARED_SHORTCUTS];
  const PrimaryIcon = primary.icon;

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{system.name}</h1>
        <p className="text-muted-foreground">{system.tagline}</p>
      </div>

      <Link to={primary.to} className="group block">
        <Card className="border-primary/40 bg-primary/5 transition-colors hover:border-primary">
          <CardContent className="flex flex-col gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <PrimaryIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-semibold">{primary.label}</p>
                {primary.description ? (
                  <p className="text-sm text-muted-foreground">{primary.description}</p>
                ) : null}
              </div>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </CardContent>
        </Card>
      </Link>

      <div className="grid gap-4 sm:grid-cols-2">
        {secondary.map((shortcut) => (
          <ShortcutCard key={shortcut.to} shortcut={shortcut} />
        ))}
      </div>
    </div>
  );
}
