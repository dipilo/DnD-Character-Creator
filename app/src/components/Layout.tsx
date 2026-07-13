import { Link, useLocation } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Dices, Users, Home, Sword, Download, FlaskConical } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const COMMUNITY_TESTING_MODE: boolean = false;

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
  const { darkMode, toggleDarkMode } = useCharacterStore();
  const location = useLocation();
  const isFullBleedBuilderRoute = location.pathname.startsWith('/builder/ability-scores') || location.pathname.startsWith('/dice');
  const showExtendedNavigation = COMMUNITY_TESTING_MODE === false;

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center px-4">
          <Link to="/builder" className="mr-6 flex items-center gap-2">
            <DragonMark className="h-6 w-6 text-primary" />
            <span className="hidden text-lg font-bold sm:inline">D&D Character Builder</span>
          </Link>

          <nav className="flex flex-1 items-center gap-1">
            <Link to="/builder">
              <Button
                variant={isActive('/builder') ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <Sword className="h-4 w-4" />
                <span className="hidden sm:inline">Builder</span>
              </Button>
            </Link>
            {showExtendedNavigation ? (
              <>
                <Link to="/">
                  <Button
                    variant={location.pathname === '/' ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Home className="h-4 w-4" />
                    <span className="hidden sm:inline">Home</span>
                  </Button>
                </Link>
                <Link to="/characters">
                  <Button
                    variant={isActive('/characters') ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">My Characters</span>
                  </Button>
                </Link>
                <Link to="/content/import">
                  <Button
                    variant={isActive('/content') ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">Import</span>
                  </Button>
                </Link>
                <Link to="/homebrew">
                  <Button
                    variant={isActive('/homebrew') ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <FlaskConical className="h-4 w-4" />
                    <span className="hidden sm:inline">Homebrew</span>
                  </Button>
                </Link>
                <Link to="/dice">
                  <Button
                    variant={isActive('/dice') ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Dices className="h-4 w-4" />
                    <span className="hidden sm:inline">Dice</span>
                  </Button>
                </Link>
              </>
            ) : null}
          </nav>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="ml-auto"
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <main className={isFullBleedBuilderRoute ? 'w-full flex-1' : 'mx-auto w-full max-w-7xl flex-1 px-4 py-6'}>
        {children}
      </main>

      <footer className="border-t py-6 mt-auto">
        <div className="mx-auto w-full max-w-7xl px-4 text-center text-xs text-muted-foreground">
          <p>D&D Character Builder</p>
        </div>
      </footer>
    </div>
  );
}
