import { useEffect, useMemo, useState } from 'react';
import { fetchAggregate } from '@/lib/api';
import type { AggregateInterval } from '@/lib/api';

interface GroupHeatmapProps {
  campaignId: number;
  memberIds: number[];
  /** How many days forward from today the grid covers. */
  days?: number;
}

const HOURS_PER_DAY = 24;
const HOUR_MS = 60 * 60 * 1000;

function startOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * How many of `memberIds` are free in the hour beginning at `cellStart`. An interval's
 * `player_ids` covers the whole campaign, so it is intersected with the group rather than trusted
 * as a count — a group of three inside a campaign of ten must never read as ten.
 */
function countForCell(intervals: AggregateInterval[], memberIds: number[], cellStart: number): number {
  const cellEnd = cellStart + HOUR_MS;
  let best = 0;
  for (const interval of intervals) {
    const start = new Date(interval.start).getTime();
    const end = new Date(interval.end).getTime();
    if (end <= cellStart || start >= cellEnd) continue;
    const overlap = interval.player_ids.filter((id) => memberIds.includes(id)).length;
    if (overlap > best) best = overlap;
  }
  return best;
}

/**
 * A thumbnail of when a group can meet: days across, hours down, darker where more of the group
 * is free. Deliberately small and unlabelled — it is a glance beside a group card, not a view.
 */
export function GroupHeatmap({ campaignId, memberIds, days = 7 }: Readonly<GroupHeatmapProps>) {
  // `memberKey` is the identity of the request: a fresh array holding the same ids must not
  // refetch, and a result tagged with an older key is stale rather than something to clear from
  // the effect body (CLAUDE.md's rule against setState in an effect).
  const memberKey = memberIds.join(',');
  const [loaded, setLoaded] = useState<{ key: string; intervals: AggregateInterval[] } | null>(null);

  useEffect(() => {
    if (memberKey === '') return;
    const controller = new AbortController();
    const start = startOfToday();
    const end = new Date(start.getTime() + days * 24 * HOUR_MS);
    const ids = memberKey.split(',').map(Number);
    fetchAggregate(campaignId, start.toISOString(), end.toISOString(), ids)
      .then((result) => {
        if (!controller.signal.aborted) setLoaded({ key: memberKey, intervals: result });
      })
      .catch((e: unknown) => {
        console.warn('heatmap load failed', e instanceof Error ? e.message : e);
        if (!controller.signal.aborted) setLoaded({ key: memberKey, intervals: [] });
      });
    return () => controller.abort();
  }, [campaignId, memberKey, days]);

  const cells = useMemo(() => {
    if (memberKey === '') return [];
    // A result carrying an older key belongs to a group that has since changed; treat it as absent
    // rather than shading this group with another one's numbers.
    const intervals = loaded?.key === memberKey ? loaded.intervals : [];
    const ids = memberKey.split(',').map(Number);
    const base = startOfToday().getTime();
    const result: { day: number; hour: number; count: number }[] = [];
    for (let day = 0; day < days; day += 1) {
      for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
        const cellStart = base + (day * HOURS_PER_DAY + hour) * HOUR_MS;
        result.push({ day, hour, count: countForCell(intervals, ids, cellStart) });
      }
    }
    return result;
  }, [loaded, memberKey, days]);

  if (memberIds.length === 0) {
    return <p className="text-xs text-muted-foreground">No members yet.</p>;
  }

  const maxCount = Math.max(1, ...cells.map((cell) => cell.count));
  const cellSize = 10;
  const gap = 2;

  return (
    <svg
      viewBox={`0 0 ${(cellSize + gap) * days} ${(cellSize + gap) * HOURS_PER_DAY}`}
      className="h-36 w-full text-primary"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Availability heatmap for the next ${days} days`}
    >
      {cells.map((cell) => (
        <rect
          key={`${cell.day}-${cell.hour}`}
          x={cell.day * (cellSize + gap)}
          y={cell.hour * (cellSize + gap)}
          width={cellSize}
          height={cellSize}
          rx={2}
          fill="currentColor"
          fillOpacity={cell.count === 0 ? 0.07 : 0.15 + 0.75 * (cell.count / maxCount)}
        />
      ))}
    </svg>
  );
}
