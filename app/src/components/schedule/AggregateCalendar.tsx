import { useCallback, useMemo, useState } from 'react';
import Calendar from '@fullcalendar/react';
import type { DateClickInfo, EventInput, EventSourceFuncInfo } from '@fullcalendar/react';
import { fetchAggregate } from '@/lib/api';
import type { AggregateInterval, Player } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { PaletteEntry } from '@/store/schedulePreferencesStore';
import {
  paletteBandLabel,
  paletteEntryForCount,
  toRgba,
  useSchedulePreferences,
} from '@/store/schedulePreferencesStore';
import { interactiveTimeGridPlugins } from '@/components/schedule/calendarTheme';
import { useCalendarLayout } from '@/components/schedule/useCalendarLayout';

interface AggregateCalendarProps {
  campaignId: number;
  players: Player[];
  /** Restrict the count to these seats; null or empty counts the whole roster. */
  playerFilter?: number[] | null;
}

/** One shaded run: a stretch of time with the same people free for all of it. */
interface Band {
  start: string;
  end: string;
  count: number;
  playerIds: number[];
}

/**
 * The server slices the whole window at *every* block boundary in it, so one unbroken evening comes
 * back as however many slices anyone else's blocks happen to cut it into. Drawn one event per
 * slice, a single band was a row of abutting events and the reader saw seams that are not there.
 *
 * Runs are joined only when the same people are free, never merely the same number of them — the
 * panel names them, and a merge on count alone would name the wrong ones.
 */
function mergeBands(intervals: AggregateInterval[]): Band[] {
  const bands: Band[] = [];
  for (const interval of intervals) {
    if (interval.count <= 0) continue;
    const ids = [...interval.player_ids].sort((a, b) => a - b);
    const previous = bands.at(-1);
    if (previous && previous.end === interval.start && sameIds(previous.playerIds, ids)) {
      previous.end = interval.end;
      continue;
    }
    bands.push({ start: interval.start, end: interval.end, count: interval.count, playerIds: ids });
  }
  return bands;
}

function sameIds(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

/** The band covering an instant, or null when nobody is free then. */
function bandAt(bands: Band[], at: Date): Band | null {
  const time = at.getTime();
  return bands.find((band) => Date.parse(band.start) <= time && time < Date.parse(band.end)) ?? null;
}

/** The band's span, in whichever zone the calendars are set to show. */
function formatSpan(band: Band, timeZone: string): string {
  const zone = timeZone === 'local' ? undefined : timeZone;
  const day = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone });
  const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: zone });
  const start = new Date(band.start);
  return `${day.format(start)}, ${clock.format(start)} to ${clock.format(new Date(band.end))}`;
}

/**
 * When everyone is free, shaded by how many. Each band is drawn as a background event rather than
 * the client intersecting anything itself.
 *
 * Two things about FullCalendar 7 shape this component, and both fail silently:
 *
 *   - the shade comes from the `color` refiner, which replaced `backgroundColor`/`borderColor`.
 *     Unknown refiners are dropped without a word, so every band painted in the classic theme's
 *     default green whatever the count was;
 *   - a background event renders *under* the slot lanes and never receives a pointer, so
 *     `eventClick` and `eventMouseEnter` on one never fire. Picking a band goes through
 *     `dateClick` on the grid instead, which is also the only version of this a thumb can work.
 */
export function AggregateCalendar({ campaignId, players, playerFilter = null }: Readonly<AggregateCalendarProps>) {
  const [bands, setBands] = useState<Band[]>([]);
  const [selected, setSelected] = useState<Band | null>(null);
  // Set when a tap landed where nobody is free. "Nothing here" is an answer, and leaving the
  // previous band on screen would read as the tap having missed.
  const [emptyPick, setEmptyPick] = useState(false);
  const palette = useSchedulePreferences((state) => state.aggregatePalette);
  const viewTimeZone = useSchedulePreferences((state) => state.viewTimeZone);
  const layout = useCalendarLayout();

  const playerNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const player of players) map.set(player.id, player.name || player.discord || `#${player.id}`);
    return map;
  }, [players]);

  const filterKey = playerFilter?.join(',') ?? '';

  // An event-source function, not `datesSet` plus `addEvent`: FullCalendar fires `datesSet` while
  // it initialises, before React has attached the ref the imperative version read, so the first
  // load found no API and returned — the view stayed empty until something forced a second fire.
  const loadIntervals = useCallback(
    async (info: EventSourceFuncInfo): Promise<EventInput[]> => {
      const intervals = await fetchAggregate(campaignId, info.start.toISOString(), info.end.toISOString(), playerFilter);
      const merged = mergeBands(intervals);
      // Inside the promise, never in an effect: the bands are what a click resolves against.
      setBands(merged);
      setSelected(null);
      setEmptyPick(false);
      return merged.map((band) => ({
        id: `agg-${band.start}-${band.end}`,
        start: band.start,
        end: band.end,
        display: 'background',
        color: toRgba(paletteEntryForCount(palette, band.count)),
      }));
    },
    [campaignId, playerFilter, palette],
  );

  const pickAt = (info: DateClickInfo) => {
    const band = bandAt(bands, info.date);
    setSelected(band);
    setEmptyPick(band === null);
  };

  const clearPick = () => {
    setSelected(null);
    setEmptyPick(false);
  };

  const rosterSize = playerFilter?.length || players.length;

  return (
    <div className="space-y-2">
      {/* `fc-aggregate` lifts the theme's flat 15% background-event opacity; see fullcalendar.css. */}
      <div className="fc-aggregate">
        <Calendar
          key={`${campaignId}-${viewTimeZone}-${filterKey}`}
          plugins={interactiveTimeGridPlugins}
          initialView={layout.initialView}
          headerToolbar={layout.headerToolbar}
          height={layout.height}
          timeZone={viewTimeZone}
          events={loadIntervals}
          dateClick={pickAt}
          longPressDelay={layout.selectLongPressDelay}
          slotDuration="00:30:00"
          allDaySlot={false}
          nowIndicator
        />
      </div>

      <BandDetails
        band={selected}
        emptyPick={emptyPick}
        rosterSize={rosterSize}
        timeZone={viewTimeZone}
        names={selected ? selected.playerIds.map((id) => playerNames.get(id) ?? `#${id}`) : []}
        isTouch={layout.isTouch}
        onClear={clearPick}
      />

      <Legend palette={palette} />
    </div>
  );
}

interface BandDetailsProps {
  band: Band | null;
  emptyPick: boolean;
  rosterSize: number;
  timeZone: string;
  names: string[];
  isTouch: boolean;
  onClear: () => void;
}

/**
 * Who is free in the slot that was picked. It sits under the calendar rather than floating: a card
 * anchored to the pointer has nowhere to go on a phone, and it cannot be read without holding a
 * finger on top of the thing it describes.
 */
function BandDetails({ band, emptyPick, rosterSize, timeZone, names, isTouch, onClear }: Readonly<BandDetailsProps>) {
  const verb = isTouch ? 'Tap' : 'Click';

  if (!band) {
    return (
      <div className="flex min-h-16 items-center rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        {emptyPick ? 'Nobody is free then.' : `${verb} anywhere in the grid to see who is free then.`}
      </div>
    );
  }

  return (
    <div className="min-h-16 rounded-lg border px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{formatSpan(band, timeZone)}</p>
          <p className="text-xs text-muted-foreground">
            {band.count} of {rosterSize} free
          </p>
        </div>
        <Button variant="ghost" size="sm" className="min-h-11" onClick={onClear}>
          Clear
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {names.map((name) => (
          <Badge key={name} variant="secondary" className="font-normal">
            {name}
          </Badge>
        ))}
      </div>
    </div>
  );
}

/** What the shades mean. Without it the ladder is only visible in the Display popover. */
function Legend({ palette }: Readonly<{ palette: PaletteEntry[] }>) {
  return (
    <div className="scroll-strip">
      <div className="flex min-w-max items-center gap-3 pb-1 text-xs text-muted-foreground">
        {palette.map((entry, index) => (
          <span key={paletteBandLabel(palette, index)} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-5 rounded-sm ring-1 ring-border"
              style={{ backgroundColor: toRgba(entry) }}
            />
            {paletteBandLabel(palette, index)}
          </span>
        ))}
      </div>
    </div>
  );
}
