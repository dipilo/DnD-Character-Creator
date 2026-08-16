import { useNavigate } from 'react-router-dom';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GAME_SYSTEM_LIST, type GameSystemDefinition } from '@/data/gameSystems';
import { useGameSystemStore } from '@/store/gameSystemStore';
import { cn } from '@/lib/utils';

interface GameSystemMenuProps {
  /** The system whose screens are on display, which is not always the stored preference. */
  readonly activeSystem: GameSystemDefinition;
  readonly onNavigate?: () => void;
}

/**
 * Switches the game the app is being used for. Choosing a system records the preference *and*
 * goes to that system's home screen — leaving the nav pointing at another game's builder while
 * its pages are still open would say two different things at once.
 */
export function GameSystemMenu({ activeSystem, onNavigate }: GameSystemMenuProps) {
  const navigate = useNavigate();
  const setPreferredSystem = useGameSystemStore((state) => state.setPreferredSystem);

  const choose = (system: GameSystemDefinition) => {
    setPreferredSystem(system.id);
    navigate(system.homePath);
    onNavigate?.();
  };

  const ActiveIcon = activeSystem.icon;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 min-w-0 gap-2"
          aria-label={`Game system: ${activeSystem.shortName}. Change game`}
        >
          <ActiveIcon className="h-4 w-4 shrink-0" />
          <span className="truncate">{activeSystem.shortName}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 max-w-[calc(100vw-1.5rem)] p-1">
        <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Game system</p>
        {GAME_SYSTEM_LIST.map((system) => {
          const Icon = system.icon;
          const selected = system.id === activeSystem.id;
          return (
            <button
              key={system.id}
              type="button"
              disabled={!system.available}
              onClick={() => choose(system)}
              className={cn(
                'flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors',
                selected && 'bg-accent text-accent-foreground',
                !selected && system.available && 'hover:bg-accent/60',
                !system.available && 'cursor-not-allowed opacity-50',
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{system.name}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{system.tagline}</span>
              </span>
              {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
