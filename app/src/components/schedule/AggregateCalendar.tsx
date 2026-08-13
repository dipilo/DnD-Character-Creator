import { useCallback, useMemo, useRef, useState } from 'react';
import Calendar from '@fullcalendar/react';
import type { CalendarRef, DatesSetInfo, EventClickInfo, EventHoveringInfo, EventInput } from '@fullcalendar/react';
import { fetchAggregate } from '@/lib/api';
import type { Player } from '@/lib/api';
import { paletteEntryForCount, toRgba, useSchedulePreferences } from '@/store/schedulePreferencesStore';
import { timeGridPlugins } from '@/components/schedule/calendarTheme';
import { useCalendarLayout } from '@/components/schedule/useCalendarLayout';

interface AggregateCalendarProps {
  campaignId: number;
  players: Player[];
  /** Restrict the count to these seats; null or empty counts the whole roster. */
  playerFilter?: number[] | null;
}

interface HoverInfo {
  x: number;
  y: number;
  names: string[];
}

/** Enough to keep the card fully on screen; it is capped at max-w-xs and a few lines tall. */
const TOOLTIP_WIDTH = 240;
const TOOLTIP_HEIGHT = 96;

/**
 * When everyone is free, shaded by how many. The server slices the window at every block boundary
 * and returns a count per slice, so each band is drawn as a background event rather than the
 * client intersecting anything itself.
 */
export function AggregateCalendar({ campaignId, players, playerFilter = null }: Readonly<AggregateCalendarProps>) {
  const calendarRef = useRef<CalendarRef>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const palette = useSchedulePreferences((state) => state.aggregatePalette);
  const viewTimeZone = useSchedulePreferences((state) => state.viewTimeZone);
  const layout = useCalendarLayout();

  const playerNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const player of players) map.set(player.id, player.name || player.discord || `#${player.id}`);
    return map;
  }, [players]);

  const filterKey = playerFilter?.join(',') ?? '';

  const loadIntervals = useCallback(
    async (info: DatesSetInfo) => {
      const api = calendarRef.current?.getApi();
      if (!api) return;
      const startIso = info.start.toISOString();
      const endIso = info.end.toISOString();
      try {
        const intervals = await fetchAggregate(campaignId, startIso, endIso, playerFilter);
        for (const event of api.getEvents()) {
          if (event.id.startsWith('agg-')) event.remove();
        }
        for (const interval of intervals) {
          if (interval.count <= 0) continue;
          const color = toRgba(paletteEntryForCount(palette, interval.count));
          const event: EventInput = {
            id: `agg-${interval.start}-${interval.end}`,
            start: interval.start,
            end: interval.end,
            display: 'background',
            backgroundColor: color,
            borderColor: color,
            extendedProps: { count: interval.count, player_ids: interval.player_ids },
          };
          api.addEvent(event);
        }
      } catch (e) {
        console.warn('could not load the aggregate view', e instanceof Error ? e.message : e);
      }
    },
    [campaignId, playerFilter, palette],
  );

  const namesFor = (ids: unknown): string[] | null => {
    if (!Array.isArray(ids)) return null;
    return ids.map((id: number) => playerNames.get(id) ?? `#${id}`);
  };

  /** Offsets off the pointer, then keeps the card on screen near the right or bottom edge. */
  const place = (clientX: number, clientY: number) => ({
    x: Math.max(8, Math.min(clientX + 12, window.innerWidth - TOOLTIP_WIDTH)),
    y: Math.max(8, Math.min(clientY + 12, window.innerHeight - TOOLTIP_HEIGHT)),
  });

  const showHover = (info: EventHoveringInfo) => {
    const names = namesFor(info.event.extendedProps.player_ids);
    if (!names) return;
    setHover({ ...place(info.jsEvent.clientX, info.jsEvent.clientY), names });
  };

  // Hover is a pointer affordance a touch screen does not have, so "hover a band to see who"
  // was unreachable on a phone. A tap does the same thing, and taps the card away again.
  const toggleOnClick = (info: EventClickInfo) => {
    const names = namesFor(info.event.extendedProps.player_ids);
    if (!names) return;
    setHover((current) => (current ? null : { ...place(info.jsEvent.clientX, info.jsEvent.clientY), names }));
  };

  return (
    <div className="relative">
      <Calendar
        key={`${campaignId}-${viewTimeZone}-${filterKey}`}
        ref={calendarRef}
        plugins={timeGridPlugins}
        initialView={layout.initialView}
        headerToolbar={layout.headerToolbar}
        height={layout.height}
        timeZone={viewTimeZone}
        datesSet={loadIntervals}
        eventMouseEnter={showHover}
        eventMouseLeave={() => setHover(null)}
        eventClick={toggleOnClick}
        longPressDelay={layout.selectLongPressDelay}
        slotDuration="00:30:00"
        allDaySlot={false}
        nowIndicator
      />
      {hover ? (
        <div
          className="pointer-events-none fixed z-50 max-w-xs rounded-md bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md ring-1 ring-border"
          style={{ left: hover.x, top: hover.y }}
        >
          {hover.names.length > 0 ? hover.names.join(', ') : 'Nobody'}
        </div>
      ) : null}
    </div>
  );
}
