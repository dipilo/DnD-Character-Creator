import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AccountMenu } from '@/components/auth/AccountMenu';
import { AppearanceMenu } from '@/components/AppearanceMenu';
import { GameSystemMenu } from '@/components/GameSystemMenu';
import type { GameSystemNavItem } from '@/data/gameSystems';
import { resolveActiveGameSystem, useGameSystemStore } from '@/store/gameSystemStore';
import { setRoutePalette } from '@/store/themeStore';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Dices, Home, CalendarRange, Menu } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const COMMUNITY_TESTING_MODE: boolean = false;

/**
 * Destinations that belong to no one game. Each system contributes its own on top of these
 * (`GameSystemDefinition.navItems`), so switching the game swaps the builder and its companions
 * and leaves the shared screens alone.
 */
const SHARED_NAV_ITEMS: GameSystemNavItem[] = [
  { to: '/', label: 'Home', icon: Home, match: '/', exact: true },
  { to: '/campaigns', label: 'Campaigns', icon: CalendarRange, match: '/campaign' },
  { to: '/dice', label: 'Dice', icon: Dices, match: '/dice' },
];

function DragonMark({ className }: Readonly<{ className?: string }>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 18c2.2-.2 3.9-1 5-2.5 1.2-1.8 1.3-4 .4-6.4 1.6 1.4 3.1 2.2 4.6 2.3-.3-1.5-1.1-2.9-2.4-4 1.9.2 3.6-.2 5.1-1.3-.5 2.2-1.8 3.9-3.8 5.1 1.3.8 2.4 1.9 3.1 3.4-1.8-.5-3.5-.4-5 .2-.6 1.8-1.9 3.1-3.9 4-2 .8-4.1 1-6.1.6 1-.6 2-1.4 3-2.4Z" />
      <path d="M13.5 7.5 15.8 5" />
      <path d="m16 9 2.8-.5" />
      <path d="M9.8 15.4c.9.5 1.9.8 3.1.8" />
      <path d="M16.4 12.1h.01" />
    </svg>
  );
}

export function Layout({ children }: Readonly<LayoutProps>) {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const preferredSystemId = useGameSystemStore((state) => state.preferredSystemId);
  // The path wins where it names a system; the stored preference answers for the screens that
  // belong to none of them, so the nav still offers the game you were last playing.
  const activeSystem = resolveActiveGameSystem(location.pathname, preferredSystemId);

  // A DOM write keyed off the resolved system, not state mirrored into state: the theme store
  // owns the palette, the router owns the path, and this tells the one about the other. It is the
  // *active* system rather than the route's, so the campaign and dice screens wear the colours of
  // the game you are playing instead of dropping back to the default.
  useEffect(() => {
    setRoutePalette(activeSystem.id);
  }, [activeSystem.id]);
  const isFullBleedBuilderRoute = location.pathname.startsWith('/builder/ability-scores') || location.pathname.startsWith('/dice');
  const showExtendedNavigation = COMMUNITY_TESTING_MODE === false;

  const items = showExtendedNavigation
    ? [...activeSystem.navItems, ...SHARED_NAV_ITEMS]
    : activeSystem.navItems.slice(0, 1);
  const isActive = (item: GameSystemNavItem) =>
    item.exact ? location.pathname === item.match : location.pathname.startsWith(item.match);

  // The header names the game you are in — "D&D Character Creator" over a Kids on Bikes sheet
  // reads as the wrong app.
  const brandLabel = `${activeSystem.shortName} Character Creator`;

  const mainClassName = isFullBleedBuilderRoute
    ? 'w-full flex-1'
    : 'mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-4 sm:py-6';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-safe mx-auto flex h-14 w-full max-w-7xl items-center gap-1 px-3 short:h-12 sm:px-4">
          {/* Below lg the nav lives in a sheet: seven destinations plus the account controls
              cannot share a 360px row, and icon-only buttons made them unguessable. */}
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
              <SheetHeader className="border-b p-4">
                <SheetTitle className="flex items-center gap-2">
                  <DragonMark className="h-5 w-5 text-primary" />
                  {brandLabel}
                </SheetTitle>
              </SheetHeader>
              <div className="border-b p-3">
                <GameSystemMenu activeSystem={activeSystem} onNavigate={() => setMenuOpen(false)} />
              </div>
              <nav className="flex flex-col gap-1 overflow-y-auto p-3">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>
                      <span
                        className={cn(
                          'flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                          isActive(item) ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to={activeSystem.homePath} className="flex min-w-0 items-center gap-2 lg:mr-4">
            <DragonMark className="h-6 w-6 shrink-0 text-primary" />
            {/* The name is the switcher's job below lg, where there is no room for both. */}
            <span className="hidden truncate text-base font-bold sm:inline sm:text-lg">{brandLabel}</span>
          </Link>

          <div className="hidden lg:block">
            <GameSystemMenu activeSystem={activeSystem} />
          </div>

          <nav className="hidden flex-1 items-center gap-1 lg:flex">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.to} to={item.to}>
                  <Button variant={isActive(item) ? 'default' : 'ghost'} size="sm" className="gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <AccountMenu />
            <AppearanceMenu />
          </div>
        </div>
      </header>

      <main className={mainClassName}>
        {children}
      </main>

      <footer className="pb-safe mt-auto border-t py-4 sm:py-6">
        <div className="mx-auto w-full max-w-7xl px-4 text-center text-xs text-muted-foreground">
          <p>{brandLabel}</p>
        </div>
      </footer>
    </div>
  );
}
