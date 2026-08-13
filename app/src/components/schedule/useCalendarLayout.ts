import { useSyncExternalStore } from 'react';
import type { ToolbarInput } from '@fullcalendar/react';

export interface CalendarLayout {
  /** Narrow enough that a seven-column week grid is unreadable. */
  isCompact: boolean;
  /** Coarse pointer — taps and drags, no hover and no modifier keys. */
  isTouch: boolean;
  initialView: string;
  headerToolbar: ToolbarInput;
  height: number;
  /** Touch gesture thresholds; 0 would turn every scroll into a drag-select. */
  selectLongPressDelay: number;
  eventLongPressDelay: number;
}

const COMPACT_QUERY = '(max-width: 900px)';
const PORTRAIT_QUERY = '(orientation: portrait)';
const TOUCH_QUERY = '(pointer: coarse)';

/** Long enough that a scroll is not read as a selection, short enough to feel deliberate. */
const TOUCH_LONG_PRESS_MS = 350;

const MIN_CALENDAR_HEIGHT = 300;
const MAX_CALENDAR_HEIGHT = 720;

const SERVER_LAYOUT: CalendarLayout = {
  isCompact: false,
  isTouch: false,
  initialView: 'timeGridWeek',
  headerToolbar: { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' },
  height: 650,
  selectLongPressDelay: TOUCH_LONG_PRESS_MS,
  eventLongPressDelay: TOUCH_LONG_PRESS_MS,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function computeLayout(): CalendarLayout {
  const isCompact = window.matchMedia(COMPACT_QUERY).matches;
  const isPortrait = window.matchMedia(PORTRAIT_QUERY).matches;
  const isTouch = window.matchMedia(TOUCH_QUERY).matches;

  // A week grid needs roughly 90px per day column to stay legible. Portrait phones never have it;
  // a landscape phone does, and forcing them to a single day there wastes the extra width.
  const showWeek = !isCompact || !isPortrait;

  let toolbar: ToolbarInput;
  if (isCompact) {
    toolbar = { left: 'prev,next', center: 'title', right: 'timeGridDay,timeGridWeek' };
  } else {
    toolbar = { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' };
  }

  return {
    isCompact,
    isTouch,
    initialView: showWeek ? 'timeGridWeek' : 'timeGridDay',
    headerToolbar: toolbar,
    // A landscape phone is ~390px tall, so `height: 'auto'` rendered a full 24-hour grid the page
    // had to scroll past. Sizing off the viewport keeps the scroll inside the calendar instead.
    // Quantised so a drag-resize does not re-render the grid on every pixel.
    height: clamp(Math.round((window.innerHeight * 0.72) / 20) * 20, MIN_CALENDAR_HEIGHT, MAX_CALENDAR_HEIGHT),
    selectLongPressDelay: isTouch ? TOUCH_LONG_PRESS_MS : 0,
    eventLongPressDelay: isTouch ? TOUCH_LONG_PRESS_MS : 0,
  };
}

/**
 * `useSyncExternalStore` compares snapshots with `Object.is`, so a fresh object every read would
 * loop forever. Cache one and replace it only when a field actually changes.
 */
let cached: CalendarLayout | null = null;

function readLayout(): CalendarLayout {
  const next = computeLayout();
  if (
    cached &&
    cached.isCompact === next.isCompact &&
    cached.isTouch === next.isTouch &&
    cached.initialView === next.initialView &&
    cached.height === next.height
  ) {
    return cached;
  }
  cached = next;
  return cached;
}

function subscribe(onChange: () => void): () => void {
  const queries = [COMPACT_QUERY, PORTRAIT_QUERY, TOUCH_QUERY].map((q) => window.matchMedia(q));
  for (const query of queries) query.addEventListener('change', onChange);
  // Rotating a phone changes the height the calendar is sized from without crossing a breakpoint.
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    for (const query of queries) query.removeEventListener('change', onChange);
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
}

/**
 * The responsive layout the scheduler's calendars share. Read through `useSyncExternalStore`
 * rather than an effect that mirrors `matchMedia` into state — the media query *is* an external
 * store, and CLAUDE.md rules out the setState-in-effect shape.
 */
export function useCalendarLayout(): CalendarLayout {
  return useSyncExternalStore(subscribe, readLayout, () => SERVER_LAYOUT);
}
