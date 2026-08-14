import { Palette, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { GAME_SYSTEM_LIST, type GameSystemId } from '@/data/gameSystems';
import { getEffectivePaletteId, useThemeStore } from '@/store/themeStore';
import { cn } from '@/lib/utils';

/** A palette's own accent, for the swatch — independent of whatever custom hue is applied. */
function swatchStyle(tokens: string | undefined) {
  return tokens ? { backgroundColor: `hsl(${tokens})` } : undefined;
}

export function AppearanceMenu() {
  const mode = useThemeStore((state) => state.mode);
  const paletteId = useThemeStore((state) => state.paletteId);
  const followActiveSystem = useThemeStore((state) => state.followActiveSystem);
  const accentHue = useThemeStore((state) => state.accentHue);
  const { setPalette, setFollowActiveSystem, setAccentHue } = useThemeStore.getState();

  // The route can override the stored choice, so the ticked row is the one on screen.
  const activePaletteId: GameSystemId = getEffectivePaletteId();
  const customHueLabel = accentHue === null ? "the palette's own" : `${accentHue}°`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance">
          <Palette className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-1.5rem)] space-y-4">
        <div>
          <p className="text-sm font-medium">Theme</p>
          <p className="text-xs text-muted-foreground">Each game brings its own colours.</p>
        </div>

        <div className="space-y-1">
          {GAME_SYSTEM_LIST.map((system) => {
            const selected = system.id === paletteId;
            return (
              <button
                key={system.id}
                type="button"
                onClick={() => setPalette(system.id)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left text-sm transition-colors',
                  selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/60',
                )}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-border"
                  style={swatchStyle(system.theme[mode].brand)}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{system.theme.label}</span>
                {system.id === activePaletteId ? (
                  <span className="shrink-0 text-xs text-muted-foreground">on screen</span>
                ) : null}
              </button>
            );
          })}
        </div>

        <Separator />

        <div className="flex items-start justify-between gap-3">
          <Label htmlFor="follow-system" className="font-normal leading-snug">
            Follow the game I'm building in
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
              Switches automatically on a system's builder.
            </span>
          </Label>
          <Switch
            id="follow-system"
            checked={followActiveSystem}
            onCheckedChange={setFollowActiveSystem}
          />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="accent-hue" className="font-normal">
              Accent hue
            </Label>
            <span className="text-xs text-muted-foreground">{customHueLabel}</span>
          </div>
          <Slider
            id="accent-hue"
            min={0}
            max={359}
            step={1}
            value={[accentHue ?? 0]}
            onValueChange={(value) => setAccentHue(value[0])}
            aria-label="Accent hue"
          />
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 w-full"
            onClick={() => setAccentHue(null)}
            disabled={accentHue === null}
          >
            <RotateCcw className="h-4 w-4" />
            Use the game's own colour
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
