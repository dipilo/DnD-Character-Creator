import { useCallback, useMemo, useState } from 'react';
import Calendar from '@fullcalendar/react';
import type { EventClickInfo, EventHoveringInfo, EventInput, EventSourceFuncInfo } from '@fullcalendar/react';
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

  // An event-source function, not `datesSet` plus `addEvent`: FullCalendar fires `datesSet` while
  // it initialises, before React has attached the ref the imperative version read, so the first
  // load found no API and returned — the view stayed empty until something forced a second fire.
  const loadIntervals = useCallback(
    async (info: EventSourceFuncInfo): Promise<EventInput[]> => {
      const intervals = await fetchAggregate(campaignId, info.start.toISOString(), info.end.toISOString(), playerFilter);
      return intervals
        .filter((interval) => interval.count > 0)
        .map((interval) => {
          const color = toRgba(paletteEntryForCount(palette, interval.count));
          return {
            id: `agg-${interval.start}-${interval.end}`,
            start: interval.start,
            end: interval.end,
            display: 'background',
            backgroundColor: color,
            borderColor: color,
            extendedProps: { count: interval.count, player_ids: interval.player_ids },
          };
        });
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
        plugins={timeGridPlugins}
        initialView={layout.initialView}
        headerToolbar={layout.headerToolbar}
        height={layout.height}
        timeZone={viewTimeZone}
        events={loadIntervals}
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
