import type { AggregateInterval } from '@/lib/api';

/**
 * When a group can actually meet, read out of the same aggregate the heatmap shades.
 *
 * The heatmap answers "roughly when", which is a glance and not a plan. This answers "these three
 * stretches, at these times", because a group card that cannot name a single date is what the
 * Groups tab was missing. Only the fullest stretches are reported: a window three of five can make
 * is not the same offer as one the whole table can.
 */
export interface MeetingWindow {
  start: Date;
  end: Date;
  /** How many of the group are free for the whole stretch. */
  count: number;
}

const HOUR_MS = 60 * 60 * 1000;

/** Ignore slivers: a 20-minute overlap is not a session anybody is going to schedule. */
const MIN_WINDOW_MS = 2 * HOUR_MS;

interface Slice {
  start: number;
  end: number;
  count: number;
}

function slicesFor(intervals: readonly AggregateInterval[], memberIds: readonly number[]): Slice[] {
  const members = new Set(memberIds);
  const slices: Slice[] = [];
  for (const interval of intervals) {
    const start = new Date(interval.start).getTime();
    const end = new Date(interval.end).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const count = interval.player_ids.filter((id) => members.has(id)).length;
    if (count === 0) continue;
    slices.push({ start, end, count });
  }
  return slices.sort((a, b) => a.start - b.start);
}

/** Adjacent slices with the same count are one window; the aggregate cuts at every block edge. */
function mergeAdjacent(slices: readonly Slice[]): Slice[] {
  const merged: Slice[] = [];
  for (const slice of slices) {
    const last = merged[merged.length - 1];
    if (last && last.count === slice.count && last.end === slice.start) {
      last.end = slice.end;
      continue;
    }
    merged.push({ ...slice });
  }
  return merged;
}

export function bestMeetingWindows(
  intervals: readonly AggregateInterval[],
  memberIds: readonly number[],
  limit = 3,
): MeetingWindow[] {
  if (memberIds.length === 0) return [];
  const merged = mergeAdjacent(slicesFor(intervals, memberIds));
  const longEnough = merged.filter((slice) => slice.end - slice.start >= MIN_WINDOW_MS);
  if (longEnough.length === 0) return [];

  const fullest = Math.max(...longEnough.map((slice) => slice.count));
  return longEnough
    .filter((slice) => slice.count === fullest)
    .sort((a, b) => b.end - b.start - (a.end - a.start))
    .slice(0, limit)
    .sort((a, b) => a.start - b.start)
    .map((slice) => ({ start: new Date(slice.start), end: new Date(slice.end), count: slice.count }));
}

const DAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

/** "Sat 6 Sep, 6:00 PM - 10:00 PM", in the reader's own locale and zone. */
export function describeMeetingWindow(window: MeetingWindow): string {
  const sameDay = window.start.toDateString() === window.end.toDateString();
  const tail = sameDay
    ? TIME_FORMAT.format(window.end)
    : `${DAY_FORMAT.format(window.end)} ${TIME_FORMAT.format(window.end)}`;
  return `${DAY_FORMAT.format(window.start)}, ${TIME_FORMAT.format(window.start)} - ${tail}`;
}
