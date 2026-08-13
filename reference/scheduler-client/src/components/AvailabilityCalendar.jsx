// client/src/components/AvailabilityCalendar.jsx
/* eslint-disable react/prop-types */
/* eslint-disable sonarjs/cognitive-complexity */
import React, { useEffect, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { fetchAvailability, postAvailabilityBatch } from '../api'

function removeEventSafely(ev) {
  try {
    ev?.remove();
  } catch (error_) {
    console.debug('remove event skipped', error_);
  }
}

function setEventDatesSafely(ev, startDate, endDate) {
  try {
    ev?.setDates(startDate, endDate);
  } catch (error_) {
    console.debug('setDates skipped', error_);
  }
}

function loadSingleColorRgba() {
  try {
    const raw = localStorage.getItem('singleColor_v1');
    if (raw) {
      const obj = JSON.parse(raw);
      const hex = obj.color || '#4682B4';
      // default opacity 100% if not explicitly set
      const op = (obj.opacity === undefined || obj.opacity === null) ? 1 : obj.opacity;
      const bigint = Number.parseInt(hex.replace('#',''), 16);
      const r = (bigint >> 16) & 255; const g = (bigint >> 8) & 255; const b = bigint & 255;
      return `rgba(${r},${g},${b},${op})`;
    }
  } catch (error_) {
    console.debug('singleColor_v1 parse failed', error_);
  }
  // fallback: use first aggregate color if present (use its opacity or 1.0)
  try {
    const raw = localStorage.getItem('aggPalette_v1');
    if (raw) {
      const arr = JSON.parse(raw);
      if (arr?.length) {
        const p = arr[0];
        const hex = p.color || '#4682B4'; const op = (p.opacity === undefined || p.opacity === null) ? 1 : p.opacity;
        const bigint = Number.parseInt(hex.replace('#',''), 16);
        const r = (bigint >> 16) & 255; const g = (bigint >> 8) & 255; const b = bigint & 255;
        return `rgba(${r},${g},${b},${op})`;
      }
    }
  } catch (error_) {
    console.debug('aggPalette_v1 parse failed', error_);
  }
  // final fallback: steelblue fully opaque
  return 'rgba(70,130,180,1)';
}

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export default function AvailabilityCalendar({ player, viewTimeZone, campaignId, userId }) {
  const calRef = useRef(null);
  const colorRef = useRef(loadSingleColorRgba());
  const reloadTimerRef = useRef(null);
  const pendingMutationsRef = useRef(0);
  const pendingOpsRef = useRef([]); // { op: 'create'|'update'|'delete', ... }
  const flushTimerRef = useRef(null);
  const lastScrollTopRef = useRef(null);
  const [repeatDialog, setRepeatDialog] = useState(null);
  const [repeatMode, setRepeatMode] = useState('count');
  const [repeatCount, setRepeatCount] = useState(4);
  const [repeatUntilDate, setRepeatUntilDate] = useState('');
  const [repeatForeverWeeks, setRepeatForeverWeeks] = useState(104);
  const hasWindow = typeof globalThis.window === 'object';
  const localUserId = userId || (hasWindow ? (localStorage.getItem('userId') || null) : null);
  const effectiveCampaignId = campaignId || player?.campaign_id || null;
  const isMobile = hasWindow ? globalThis.window.matchMedia('(max-width: 900px)').matches : false;
  const initialView = isMobile ? 'timeGridDay' : 'timeGridWeek';
  const headerToolbar = isMobile
    ? { left: 'prev,next', center: 'title', right: 'timeGridDay' }
    : { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' };

  // FullCalendar event source: fetches player's availability
  async function availabilityEventSource(info, successCallback, failureCallback) {
    try {
      if (!effectiveCampaignId || !player?.id) { successCallback([]); return; }
      const rowsRaw = await fetchAvailability(player.id, { campaignId: effectiveCampaignId, userId: localUserId });
      let rows = [];
      if (Array.isArray(rowsRaw)) {
        rows = rowsRaw;
      } else if (Array.isArray(rowsRaw?.availability)) {
        rows = rowsRaw.availability;
      }
      const mapped = rows.map(r => ({
        id: r.id?.toString(),
        start: r.start_iso,
        end: r.end_iso,
        title: player.name,
        backgroundColor: colorRef.current,
        borderColor: colorRef.current,
        extendedProps: { player_id: r.player_id ?? player.id }
      }));
      successCallback(mapped);
    } catch (e) {
      console.error('Failed loading availability:', e);
      failureCallback(e);
    }
  }

  function refetchWithScrollPreserve() {
    try {
      const scroller = document.querySelector('.fc-timegrid-body .fc-scroller, .fc-scroller-harness .fc-scroller');
      lastScrollTopRef.current = scroller ? scroller.scrollTop : null;
    } catch (error_) {
      console.debug('scroll capture failed', error_);
      lastScrollTopRef.current = null;
    }
    const cal = calRef.current?.getApi();
    if (cal) cal.refetchEvents();
  }

  function scheduleReload(delay = 200) {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      // only reload once after a burst of mutations
      if (pendingMutationsRef.current > 0) {
        pendingMutationsRef.current = 0;
      }
      refetchWithScrollPreserve();
    }, delay);
  }

  function enqueueOp(op) {
    pendingOpsRef.current.push(op);
    scheduleFlush(200);
  }

  function scheduleFlush(delay = 200) {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flush, delay);
  }

  async function flush() {
    if (!effectiveCampaignId) return;
    const ops = pendingOpsRef.current;
    if (!ops.length) return;
    pendingOpsRef.current = [];
    try {
      pendingMutationsRef.current += ops.length;
      await postAvailabilityBatch(ops, { userId: localUserId, campaignId: effectiveCampaignId });
    } catch (e) {
      console.error('batch save failed', e);
    } finally {
      scheduleReload(200);
    }
  }

  useEffect(()=> { refetchWithScrollPreserve(); }, [player]);

  useEffect(()=> {
    function onSingle() {
      colorRef.current = loadSingleColorRgba();
      const cal = calRef.current?.getApi();
      if (!cal) return;
      cal.getEvents().forEach(ev => {
        ev.setProp('backgroundColor', colorRef.current);
        ev.setProp('borderColor', colorRef.current);
      });
    }
    globalThis.window.addEventListener('singleColorChanged', onSingle);
    globalThis.window.addEventListener('aggPaletteChanged', onSingle);
    return ()=> {
      globalThis.window.removeEventListener('singleColorChanged', onSingle);
      globalThis.window.removeEventListener('aggPaletteChanged', onSingle);
    };
  }, []);

  async function handleSelect(selectionInfo) {
    if (!effectiveCampaignId) return;
    if (!localUserId) { alert('Please log in to save availability.'); return; }
    const s = new Date(selectionInfo.startStr);
    const e = new Date(selectionInfo.endStr);
    // If selection spans multiple calendar days, create one slot per-day using the same time-of-day window.
    try {
      // compute number of days between start date and end date (inclusive of start day)
      const startDate = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      const endDate = new Date(e.getFullYear(), e.getMonth(), e.getDate());
      const dayMs = 24 * 3600 * 1000;
      const days = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / dayMs) + 1);
      const startTime = { h: s.getHours(), m: s.getMinutes(), sec: s.getSeconds(), ms: s.getMilliseconds() };
      const endTime = { h: e.getHours(), m: e.getMinutes(), sec: e.getSeconds(), ms: e.getMilliseconds() };

      const newEvents = [];
      for (let i = 0; i < days; i++) {
        const d = new Date(startDate.getTime() + i * dayMs);
        const slotStart = new Date(d);
        slotStart.setHours(startTime.h, startTime.m, startTime.sec, startTime.ms);
        const slotEnd = new Date(d);
        slotEnd.setHours(endTime.h, endTime.m, endTime.sec, endTime.ms);
        // if end time is equal or earlier than start time, assume it crosses midnight to next day
        if (slotEnd <= slotStart) slotEnd.setDate(slotEnd.getDate() + 1);
        // only create slot if it overlaps original selection window
        if (slotEnd > s && slotStart < e) {
          // optimistic UI add
          newEvents.push({
            id: 'tmp_' + Math.random().toString(36).slice(2),
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            title: player.name,
            backgroundColor: colorRef.current,
            borderColor: colorRef.current,
            extendedProps: { player_id: player.id }
          });
          enqueueOp({ op: 'create', player_id: player.id, start_iso: slotStart.toISOString(), end_iso: slotEnd.toISOString() });
        }
      }
      if (newEvents.length) {
        // optionally add ephemeral events for instant feedback
        const cal = calRef.current?.getApi();
        if (cal) {
          for (const ev of newEvents) cal.addEvent(ev);
        }
      }
      // coalesced batch flush shortly
      scheduleFlush(150);
    } catch (e) {
      console.error('add failed', e);
    }
  }

  async function handleEventClick(clickInfo) {
    if (clickInfo?.jsEvent?.ctrlKey || clickInfo?.jsEvent?.metaKey) {
      const ev = clickInfo.event;
      const start = ev?.start;
      const end = ev?.end;
      if (!start || !end) return;
      setRepeatDialog({
        id: ev.id,
        startIso: start.toISOString(),
        endIso: end.toISOString()
      });
      setRepeatMode('count');
      setRepeatCount(4);
      setRepeatUntilDate(toDateInputValue(new Date(start.getTime() + (28 * 24 * 60 * 60 * 1000))));
      setRepeatForeverWeeks(104);
      return;
    }

    const ev = clickInfo.event;
    if (!confirm('Delete this availability block?')) return;
    const id = ev.id;
    try {
      if (!localUserId) { alert('Please log in to delete availability.'); return; }
      if (!id) return;
      // If this is an optimistic temp event, just drop it locally
      if (String(id).startsWith('tmp_')) {
        removeEventSafely(ev);
        return;
      }
      // queue a batched delete and optimistically remove from UI
      removeEventSafely(ev);
      enqueueOp({ op: 'delete', id });
      scheduleFlush(150);
    } catch (e) {
      console.error(e);
      alert('Failed to delete availability: ' + (e.message || e));
    }
  }

  function closeRepeatDialog() {
    setRepeatDialog(null);
  }

  function getRepeatDatesFromDialog() {
    if (!repeatDialog?.startIso || !repeatDialog?.endIso) return [];
    const start = new Date(repeatDialog.startIso);
    const end = new Date(repeatDialog.endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return [];

    const occurrences = [];
    if (repeatMode === 'count') {
      const count = Math.max(1, Number.parseInt(repeatCount, 10) || 0);
      for (let i = 1; i <= count; i += 1) {
        occurrences.push(i);
      }
      return occurrences;
    }

    if (repeatMode === 'until') {
      if (!repeatUntilDate) return [];
      const until = new Date(`${repeatUntilDate}T23:59:59`);
      if (Number.isNaN(until.getTime())) return [];
      let cursor = new Date(start);
      let weekIndex = 0;
      while (weekIndex < 520) {
        cursor = new Date(cursor.getTime() + (7 * 24 * 60 * 60 * 1000));
        weekIndex += 1;
        if (cursor > until) break;
        occurrences.push(weekIndex);
      }
      return occurrences;
    }

    const foreverWeeks = Math.max(1, Number.parseInt(repeatForeverWeeks, 10) || 104);
    for (let i = 1; i <= foreverWeeks; i += 1) {
      occurrences.push(i);
    }
    return occurrences;
  }

  function applyRepeats() {
    if (!repeatDialog || !effectiveCampaignId || !player?.id) return;
    const start = new Date(repeatDialog.startIso);
    const end = new Date(repeatDialog.endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return;

    const repeatOffsets = getRepeatDatesFromDialog();
    if (!repeatOffsets.length) {
      alert('No repeat dates were generated.');
      return;
    }

    const cal = calRef.current?.getApi();
    repeatOffsets.forEach((weekOffset) => {
      const startMs = start.getTime() + (weekOffset * 7 * 24 * 60 * 60 * 1000);
      const endMs = end.getTime() + (weekOffset * 7 * 24 * 60 * 60 * 1000);
      const startIso = new Date(startMs).toISOString();
      const endIso = new Date(endMs).toISOString();
      enqueueOp({ op: 'create', player_id: player.id, start_iso: startIso, end_iso: endIso });
      if (cal) {
        cal.addEvent({
          id: 'tmp_' + Math.random().toString(36).slice(2),
          start: startIso,
          end: endIso,
          title: player.name,
          backgroundColor: colorRef.current,
          borderColor: colorRef.current,
          extendedProps: { player_id: player.id }
        });
      }
    });
    scheduleFlush(150);
    closeRepeatDialog();
  }

  async function handleEventUpdate(changeInfo) {
    const ev = changeInfo.event;
    const id = ev.id;
    if (!id || !effectiveCampaignId) {
      refetchWithScrollPreserve();
      return;
    }
    try {
      // optimistic: update local instance immediately
      const updatedStart = ev.start?.toISOString();
      const updatedEnd = ev.end?.toISOString();
      // UI already reflects new dates; just enqueue for server merge
      // ignore updates for temp (not-yet-persisted) events
      if (!String(id).startsWith('tmp_')) {
        enqueueOp({ op: 'update', id, start_iso: updatedStart, end_iso: updatedEnd });
      }
      scheduleFlush(150);
    } catch (e) {
      console.error('update failed', e);
      scheduleReload(0);
    }
  }

  const fcTimezone = viewTimeZone || 'local';

  return (
    <>
      <FullCalendar
      key={`${player?.id || 'none'}-${effectiveCampaignId || 'none'}-${fcTimezone}`}
      ref={calRef}
      plugins={[ timeGridPlugin, interactionPlugin ]}
      initialView={initialView}
      headerToolbar={headerToolbar}
      selectable={true}
      select={handleSelect}
  eventClick={handleEventClick}
  eventDrop={handleEventUpdate}
  eventResize={handleEventUpdate}
      eventResizableFromStart={true}
      editable={true}
      slotDuration="00:30:00"
      allDaySlot={false}
  height={isMobile ? 'auto' : 650}
      nowIndicator={true}
      timeZone={fcTimezone}

      eventDidMount={(arg) => {
        const el = arg.el;
        if (el._rightClickHandlerAdded) return;
        const handler = async (mouseEvent) => {
          mouseEvent.preventDefault();
          try {
            const ev = arg.event;
            const evStart = ev.start;
            const evEnd = ev.end;
            if (!evStart || !evEnd) return;

            const startMs = evStart.getTime();
            const endMs = evEnd.getTime();
            const durationMs = Math.max(0, endMs - startMs);
            const slotMs = 30 * 60 * 1000;
            const totalSlots = Math.max(1, Math.round(durationMs / slotMs));
            const rect = el.getBoundingClientRect();
            const offsetY = Math.max(0, Math.min(rect.height - 1, mouseEvent.clientY - rect.top));
            const slotHeight = rect.height / totalSlots;
            let slotIndex = Math.floor(offsetY / slotHeight);
            slotIndex = Math.max(0, Math.min(totalSlots - 1, slotIndex));

            const slotStartMs = startMs + slotIndex * slotMs;
            const slotEndMs = slotStartMs + slotMs;

            if (slotEndMs <= startMs || slotStartMs >= endMs) return;

            const id = ev.id;

            // Use batched ops to avoid per-request churn and handle merge server-side
            const leftStartIso = new Date(startMs).toISOString();
            const leftEndIso = new Date(slotStartMs).toISOString();
            const rightStartIso = new Date(slotEndMs).toISOString();
            const rightEndIso = new Date(endMs).toISOString();

            // CASES with batching and optimistic UI updates
            if (slotStartMs <= startMs && slotEndMs >= endMs) {
              // delete entire event
              if (!String(id).startsWith('tmp_')) enqueueOp({ op: 'delete', id });
              removeEventSafely(ev);
              scheduleFlush(150);
              return;
            }

            if (slotStartMs <= startMs && slotEndMs < endMs) {
              if (!String(id).startsWith('tmp_')) enqueueOp({ op: 'update', id, start_iso: rightStartIso, end_iso: rightEndIso });
              setEventDatesSafely(ev, new Date(rightStartIso), new Date(rightEndIso));
              scheduleFlush(150);
              return;
            }

            if (slotStartMs > startMs && slotEndMs >= endMs) {
              if (!String(id).startsWith('tmp_')) enqueueOp({ op: 'update', id, start_iso: leftStartIso, end_iso: leftEndIso });
              setEventDatesSafely(ev, new Date(leftStartIso), new Date(leftEndIso));
              scheduleFlush(150);
              return;
            }

            // middle: shrink left piece and create right piece
            if (!String(id).startsWith('tmp_')) enqueueOp({ op: 'update', id, start_iso: leftStartIso, end_iso: leftEndIso });
            enqueueOp({ op: 'create', player_id: player.id, start_iso: rightStartIso, end_iso: rightEndIso });
            // optimistic UI: shrink existing and add temp right block
            setEventDatesSafely(ev, new Date(leftStartIso), new Date(leftEndIso));
            const cal = calRef.current?.getApi();
            if (cal) cal.addEvent({ id: 'tmp_' + Math.random().toString(36).slice(2), start: rightStartIso, end: rightEndIso, title: player.name, backgroundColor: colorRef.current, borderColor: colorRef.current, extendedProps: { player_id: player.id } });
            scheduleFlush(150);
          } catch (err) {
            console.error('right-click slot delete failed', err);
          }
        };

        el.addEventListener('contextmenu', handler);
        el._rightClickHandlerAdded = true;
        el._rightClickHandler = handler;
      }}
      eventWillUnmount={(arg) => {
        const el = arg.el;
        if (el?._rightClickHandler) {
          el.removeEventListener('contextmenu', el._rightClickHandler);
          el._rightClickHandler = null;
          el._rightClickHandlerAdded = false;
        }
      }}
      selectOverlap={false}
      selectMirror={false}
      selectLongPressDelay={0}
      selectConstraint={{
        start: '00:00',
        end: '24:00'
      }}
      validRange={{
        start: new Date().toISOString().split('T')[0]
      }}
      eventSources={[
        {
          id: 'availability',
          events: availabilityEventSource,
        }
      ]}
      eventsSet={() => {
        // remove any leftover temp events and restore scroll
        try {
          const cal = calRef.current?.getApi();
          if (cal) {
            cal.getEvents().forEach(ev => { if (String(ev.id||'').startsWith('tmp_')) ev.remove(); });
          }
        } catch (error_) {
          console.debug('temp event cleanup skipped', error_);
        }
        try {
          if (lastScrollTopRef.current !== null) {
            const scroller = document.querySelector('.fc-timegrid-body .fc-scroller, .fc-scroller-harness .fc-scroller');
            if (scroller) scroller.scrollTop = lastScrollTopRef.current;
            lastScrollTopRef.current = null;
          }
        } catch (error_) {
          console.debug('scroll restore skipped', error_);
        }
      }}
      />
      {repeatDialog && (
        <div className="modal-overlay">
          <dialog open className="modal-panel" style={{ width: 560 }}>
            <h3 style={{ marginTop: 0 }}>Repeat availability block</h3>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Ctrl+click opened repeat mode. Choose how many weekly copies to create.
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" checked={repeatMode === 'count'} onChange={() => setRepeatMode('count')} />
                <span>Repeat for this many additional weeks</span>
                <input
                  type="number"
                  min="1"
                  max="260"
                  value={repeatCount}
                  onChange={(event) => setRepeatCount(event.target.value)}
                  disabled={repeatMode !== 'count'}
                  style={{ width: 90, marginLeft: 'auto' }}
                />
              </label>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" checked={repeatMode === 'until'} onChange={() => setRepeatMode('until')} />
                <span>Repeat every week until</span>
                <input
                  type="date"
                  value={repeatUntilDate}
                  onChange={(event) => setRepeatUntilDate(event.target.value)}
                  disabled={repeatMode !== 'until'}
                  style={{ marginLeft: 'auto' }}
                />
              </label>

              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="radio" checked={repeatMode === 'forever'} onChange={() => setRepeatMode('forever')} />
                <span>Repeat every week forever</span>
                <input
                  type="number"
                  min="1"
                  max="520"
                  value={repeatForeverWeeks}
                  onChange={(event) => setRepeatForeverWeeks(event.target.value)}
                  disabled={repeatMode !== 'forever'}
                  style={{ width: 90, marginLeft: 'auto' }}
                />
              </label>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Forever mode materializes weekly blocks ahead of time. Increase the week count if you want a longer horizon.
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button type="button" onClick={closeRepeatDialog}>Cancel</button>
              <button type="button" onClick={applyRepeats}>Create Repeats</button>
            </div>
          </dialog>
        </div>
      )}
    </>
  );
}
