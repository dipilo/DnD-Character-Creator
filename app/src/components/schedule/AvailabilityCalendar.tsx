import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Calendar from '@fullcalendar/react';
import type { CalendarRef, DateSelectInfo, EventClickInfo, EventDropInfo, EventInput, EventResizeDoneInfo } from '@fullcalendar/react';
import { toast } from 'sonner';
import { applyAvailabilityOps, listAvailability } from '@/lib/api';
import type { AvailabilityOp, Player } from '@/lib/api';
import { toRgba, useSchedulePreferences } from '@/store/schedulePreferencesStore';
import { interactiveTimeGridPlugins } from '@/components/schedule/calendarTheme';
import { BlockActionsDialog } from '@/components/schedule/BlockActionsDialog';
import { RepeatBlockDialog } from '@/components/schedule/RepeatBlockDialog';
import { useCalendarLayout } from '@/components/schedule/useCalendarLayout';

interface AvailabilityCalendarProps {
  player: Player;
  campaignId: number;
  /** False when the viewer may look but not edit — a player reading someone else's seat. */
  editable?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** How long to gather operations before sending them as one batch. */
const FLUSH_DELAY_MS = 180;

function isOptimisticId(id: string): boolean {
  return id.startsWith('tmp_');
}

function optimisticId(): string {
  return `tmp_${globalThis.crypto.randomUUID()}`;
}

/**
 * A selection dragged across several days means "these hours, each of those days", not one block
 * running from the first morning to the last evening — which is what a single range would store.
 */
function splitSelectionByDay(startStr: string, endStr: string): { start: Date; end: Date }[] {
  const selectionStart = new Date(startStr);
  const selectionEnd = new Date(endStr);
  const firstDay = new Date(selectionStart.getFullYear(), selectionStart.getMonth(), selectionStart.getDate());
  const lastDay = new Date(selectionEnd.getFullYear(), selectionEnd.getMonth(), selectionEnd.getDate());
  const days = Math.max(1, Math.round((lastDay.getTime() - firstDay.getTime()) / DAY_MS) + 1);

  const blocks: { start: Date; end: Date }[] = [];
  for (let i = 0; i < days; i += 1) {
    const day = new Date(firstDay.getTime() + i * DAY_MS);
    const start = new Date(day);
    start.setHours(selectionStart.getHours(), selectionStart.getMinutes(), 0, 0);
    const end = new Date(day);
    end.setHours(selectionEnd.getHours(), selectionEnd.getMinutes(), 0, 0);
    // An end at or before the start reads as crossing midnight into the following day.
    if (end <= start) end.setDate(end.getDate() + 1);
    if (end > selectionStart && start < selectionEnd) blocks.push({ start, end });
  }
  return blocks;
}

/**
 * The editable calendar for one seat's availability.
 *
 * Writes are queued and flushed as one `/api/availability/batch` request: the server merges
 * overlapping blocks per operation, so a drag that produces seven blocks used to be seven round
 * trips racing each other's merges.
 */
export function AvailabilityCalendar({ player, campaignId, editable = true }: Readonly<AvailabilityCalendarProps>) {
  const calendarRef = useRef<CalendarRef>(null);
  const pendingOps = useRef<AvailabilityOp[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [repeatSource, setRepeatSource] = useState<{ start: Date; end: Date } | null>(null);
  // A tap has no modifier key, so on touch the two actions get a dialog instead of click and
  // ctrl-click. Holds the FullCalendar event id alongside the times so delete still has its id.
  const [tappedBlock, setTappedBlock] = useState<{ id: string; start: Date; end: Date } | null>(null);
  const ownColor = useSchedulePreferences((state) => state.ownColor);
  const viewTimeZone = useSchedulePreferences((state) => state.viewTimeZone);
  const layout = useCalendarLayout();
  const eventColor = useMemo(() => toRgba(ownColor), [ownColor]);

  const flush = useCallback(async () => {
    const operations = pendingOps.current;
    if (operations.length === 0) return;
    pendingOps.current = [];
    try {
      await applyAvailabilityOps(campaignId, operations);
    } catch (e) {
      toast.error('Could not save that change', {
        description: e instanceof Error ? e.message : 'The server refused the write.',
      });
    } finally {
      // Refetch either way: on success to pick up the server's merges, on failure to drop the
      // optimistic blocks that were never stored.
      calendarRef.current?.getApi().refetchEvents();
    }
  }, [campaignId]);

  const enqueue = useCallback(
    (op: AvailabilityOp) => {
      pendingOps.current.push(op);
      if (flushTimer.current) clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        void flush();
      }, FLUSH_DELAY_MS);
    },
    [flush],
  );

  useEffect(() => {
    return () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, []);

  const loadEvents = useCallback(async (): Promise<EventInput[]> => {
    const rows = await listAvailability(player.id, campaignId);
    return rows.map((row) => ({
      id: String(row.id),
      start: row.start_iso,
      end: row.end_iso,
      title: player.name ?? 'Available',
      color: eventColor,
      extendedProps: { player_id: row.player_id, source: row.source },
    }));
  }, [player.id, player.name, campaignId, eventColor]);

  const handleSelect = (info: DateSelectInfo) => {
    if (!editable) return;
    const api = calendarRef.current?.getApi();
    for (const block of splitSelectionByDay(info.startStr, info.endStr)) {
      const startIso = block.start.toISOString();
      const endIso = block.end.toISOString();
      api?.addEvent({
        id: optimisticId(),
        start: startIso,
        end: endIso,
        title: player.name ?? 'Available',
        color: eventColor,
      });
      enqueue({ op: 'create', player_id: player.id, start_iso: startIso, end_iso: endIso });
    }
    api?.unselect();
  };

  const removeBlock = useCallback(
    (id: string) => {
      calendarRef.current?.getApi().getEventById(id)?.remove();
      if (!isOptimisticId(id)) enqueue({ op: 'delete', id: Number(id) });
    },
    [enqueue],
  );

  const handleEventClick = (info: EventClickInfo) => {
    if (!editable) return;
    const { event, jsEvent } = info;

    // A touch screen has no modifier key and no second button, so a tap opens the actions instead
    // of destroying the block outright — an accidental tap that deletes an evening is unrecoverable.
    if (layout.isTouch) {
      if (event.start && event.end) setTappedBlock({ id: event.id, start: event.start, end: event.end });
      return;
    }

    // Ctrl/Cmd-click opens the repeat dialog instead of deleting; a plain click removes the block.
    if (jsEvent.ctrlKey || jsEvent.metaKey) {
      if (event.start && event.end) setRepeatSource({ start: event.start, end: event.end });
      return;
    }
    removeBlock(event.id);
  };

  const handleEventChange = (info: EventDropInfo | EventResizeDoneInfo) => {
    if (!editable) return;
    const { event } = info;
    if (!event.start || !event.end) return;
    if (isOptimisticId(event.id)) return; // still queued as a create; the create carries the times
    enqueue({
      op: 'update',
      id: Number(event.id),
      start_iso: event.start.toISOString(),
      end_iso: event.end.toISOString(),
    });
  };

  const applyRepeats = (weekOffsets: number[]) => {
    if (!repeatSource) return;
    const api = calendarRef.current?.getApi();
    for (const weeks of weekOffsets) {
      const shift = weeks * 7 * DAY_MS;
      const startIso = new Date(repeatSource.start.getTime() + shift).toISOString();
      const endIso = new Date(repeatSource.end.getTime() + shift).toISOString();
      api?.addEvent({
        id: optimisticId(),
        start: startIso,
        end: endIso,
        title: player.name ?? 'Available',
        color: eventColor,
      });
      enqueue({ op: 'create', player_id: player.id, start_iso: startIso, end_iso: endIso });
    }
    setRepeatSource(null);
  };

  return (
    <>
      <Calendar
        // Remounting on any of these is deliberate: the event source closes over them, and a
        // FullCalendar source is not re-read when its closure changes.
        key={`${player.id}-${campaignId}-${viewTimeZone}-${eventColor}`}
        ref={calendarRef}
        plugins={interactiveTimeGridPlugins}
        initialView={layout.initialView}
        headerToolbar={layout.headerToolbar}
        height={layout.height}
        timeZone={viewTimeZone}
        events={loadEvents}
        selectable={editable}
        editable={editable}
        eventResizableFromStart={editable}
        select={handleSelect}
        eventClick={handleEventClick}
        eventDrop={handleEventChange}
        eventResize={handleEventChange}
        selectOverlap={false}
        selectMirror={layout.isTouch}
        // 0 turned every touch scroll over the grid into a drag-select.
        selectLongPressDelay={layout.selectLongPressDelay}
        eventLongPressDelay={layout.eventLongPressDelay}
        longPressDelay={layout.selectLongPressDelay}
        slotDuration="00:30:00"
        allDaySlot={false}
        nowIndicator
        // A function rather than a literal: reading the clock during render is impure, and this
        // way the range also follows midnight without a remount.
        validRange={(nowDate: Date) => ({ start: new Date(nowDate.getTime() - DAY_MS) })}
      />
      <BlockActionsDialog
        block={tappedBlock}
        onOpenChange={(open) => {
          if (!open) setTappedBlock(null);
        }}
        onDelete={() => {
          if (tappedBlock) removeBlock(tappedBlock.id);
          setTappedBlock(null);
        }}
        onRepeat={() => {
          if (tappedBlock) setRepeatSource({ start: tappedBlock.start, end: tappedBlock.end });
          setTappedBlock(null);
        }}
      />
      <RepeatBlockDialog
        source={repeatSource}
        onOpenChange={(open) => {
          if (!open) setRepeatSource(null);
        }}
        onApply={applyRepeats}
      />
    </>
  );
}
