import { useMemo } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { PaletteEntry } from '@/store/schedulePreferencesStore';
import { useSchedulePreferences } from '@/store/schedulePreferencesStore';

interface ScheduleSettingsProps {
  filterAggregate: boolean;
  onFilterAggregateChange: (value: boolean) => void;
}

/** The zones offered in the view picker; 'local' means whatever the browser is set to. */
function viewTimeZoneOptions(): string[] {
  const withValues = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    return withValues.supportedValuesOf?.('timeZone') ?? [];
  } catch (e) {
    console.warn('could not list time zones', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Calendar appearance. This is what the old ColorManager screen was for; it is a popover beside
 * the calendars now because the settings only mean anything while you are looking at them.
 */
export function ScheduleSettings({ filterAggregate, onFilterAggregateChange }: Readonly<ScheduleSettingsProps>) {
  const { ownColor, aggregatePalette, viewTimeZone, setOwnColor, setAggregateEntry, setViewTimeZone, resetColors } =
    useSchedulePreferences();
  const zones = useMemo(() => viewTimeZoneOptions(), []);
  // The band's position in the ladder is its identity ("3 free"), so it is named once here rather
  // than keying the rows off the map index.
  const bands = useMemo(
    () =>
      aggregatePalette.map((entry, index) => ({
        id: `agg-color-${index + 1}`,
        index,
        label: index === aggregatePalette.length - 1 ? `${index + 1}+ free` : `${index + 1} free`,
        entry,
      })),
    [aggregatePalette],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4" />
          Display
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] max-h-[calc(100dvh-6rem)] space-y-4 overflow-y-auto">
        <div className="space-y-1.5">
          <Label htmlFor="view-timezone">Show times in</Label>
          <Input
            id="view-timezone"
            list="view-timezone-options"
            value={viewTimeZone}
            onChange={(e) => setViewTimeZone(e.target.value || 'local')}
          />
          <datalist id="view-timezone-options">
            <option value="local" />
            {zones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">`local` follows this device.</p>
        </div>

        <Separator />

        <ColorRow
          id="own-color"
          label="Your blocks"
          entry={ownColor}
          onChange={setOwnColor}
        />

        <Separator />

        <div className="space-y-3">
          <p className="text-sm font-medium">Overlap shading</p>
          {bands.map((band) => (
            <ColorRow
              key={band.id}
              id={band.id}
              label={band.label}
              entry={band.entry}
              onChange={(next) => setAggregateEntry(band.index, next)}
            />
          ))}
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="filter-aggregate" className="font-normal">
            Count only the selected seat
          </Label>
          <Switch id="filter-aggregate" checked={filterAggregate} onCheckedChange={onFilterAggregateChange} />
        </div>

        <Button variant="ghost" size="sm" className="w-full" onClick={resetColors}>
          Reset colours
        </Button>
      </PopoverContent>
    </Popover>
  );
}

interface ColorRowProps {
  id: string;
  label: string;
  entry: PaletteEntry;
  onChange: (entry: PaletteEntry) => void;
}

function ColorRow({ id, label, entry, onChange }: Readonly<ColorRowProps>) {
  return (
    <div className="flex items-center gap-3">
      <Input
        id={id}
        type="color"
        className="h-8 w-12 cursor-pointer p-1"
        value={entry.color}
        onChange={(e) => onChange({ ...entry, color: e.target.value })}
      />
      <Label htmlFor={id} className="flex-1 font-normal">
        {label}
      </Label>
      <Slider
        className="w-24"
        min={10}
        max={100}
        step={5}
        value={[Math.round(entry.opacity * 100)]}
        onValueChange={([value]) => onChange({ ...entry, opacity: value / 100 })}
        aria-label={`${label} opacity`}
      />
    </div>
  );
}
