// client/src/components/AggregateCalendar.jsx
import React, { useRef, useEffect, useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { fetchAggregates, fetchPlayers } from '../api'

const DEFAULT_PALETTE = [
  { color: '#4682B4', opacity: 0.45 },
  { color: '#228B22', opacity: 0.45 },
  { color: '#FFA500', opacity: 0.45 },
  { color: '#DC143C', opacity: 0.45 }
];

function loadPalette() {
  try {
    const raw = localStorage.getItem('aggPalette_v1');
    if (!raw) return DEFAULT_PALETTE.slice();
    return JSON.parse(raw);
  } catch (e) { return DEFAULT_PALETTE.slice(); }
}

function hexToRgba(hex, opacity) {
  const h = hex.replace('#','');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}

export default function AggregateCalendar({ viewTimeZone, memberFilter = null, campaignId = null, userId = null }) {
  const calendarRef = useRef(null);
  const [palette, setPalette] = useState(loadPalette());
  const [playersMap, setPlayersMap] = useState({});
  const tooltipRef = useRef(null);
  const isMobile = (typeof window !== 'undefined') ? window.matchMedia('(max-width: 900px)').matches : false;
  const initialView = isMobile ? 'timeGridDay' : 'timeGridWeek';
  const headerToolbar = isMobile
    ? { left: 'prev,next', center: 'title', right: 'timeGridDay' }
    : { left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' };

  useEffect(() => {
    if (!campaignId) { setPlayersMap({}); return; }
    fetchPlayers({ campaignId, userId }).then(list => {
      const map = {};
      (list || []).forEach(p => map[p.id] = p.name || p.discord || ('#' + p.id));
      setPlayersMap(map);
    }).catch(console.error);

    function onPal() {
      setPalette(loadPalette());
      const cal = calendarRef.current?.getApi();
      if (!cal) return;
      const aggEvents = cal.getEvents().filter(e => e.id && e.id.startsWith('agg-'));
      const pal = loadPalette();
      aggEvents.forEach(ev => {
        const count = ev.extendedProps?.count || 1;
        const idx = Math.max(0, Math.min(pal.length - 1, count - 1));
        const p = pal[idx] || pal[pal.length - 1] || DEFAULT_PALETTE[DEFAULT_PALETTE.length - 1];
        const color = hexToRgba(p.color, p.opacity);
        try { ev.setProp('backgroundColor', color); ev.setProp('borderColor', color); } catch(e) {}
      });
    }

    window.addEventListener('aggPaletteChanged', onPal);
    return () => window.removeEventListener('aggPaletteChanged', onPal);
  }, [campaignId, userId]);

  // tooltip element creation
  useEffect(() => {
    const div = document.createElement('div');
    div.className = 'agg-tooltip';
    div.style.position = 'fixed';
    div.style.pointerEvents = 'none';
    div.style.background = 'rgba(0,0,0,0.85)';
    div.style.color = 'white';
    div.style.padding = '6px 8px';
    div.style.borderRadius = '6px';
    div.style.fontSize = '13px';
    div.style.zIndex = 2147483650;
    div.style.display = 'none';
    document.body.appendChild(div);
    tooltipRef.current = div;
    return () => { try { document.body.removeChild(div); } catch(e) {} };
  }, []);

  // helper to load aggregates for a start/end and current memberFilter
  const loadAggregates = useCallback(async (startIso, endIso) => {
    try {
      // don't load aggregates when no campaign is active
      if (!campaignId) {
        const cal = calendarRef.current?.getApi();
        if (cal) {
          const prev = cal.getEvents().filter(e => e.id && e.id.startsWith('agg-'));
          prev.forEach(e => e.remove());
        }
        return;
      }
      const res = await fetchAggregates(startIso, endIso, Array.isArray(memberFilter) ? memberFilter : null, { campaignId, userId });
      if (res && Array.isArray(res.intervals)) {
        const pal = loadPalette();
        const bg = res.intervals
          .filter(iv => typeof iv.count === 'number' && iv.count > 0 && iv.start && iv.end)
          .map(iv => {
          const idx = Math.min(Math.max(0, iv.count - 1), pal.length - 1);
          const colObj = pal[idx] || pal[pal.length - 1] || DEFAULT_PALETTE[DEFAULT_PALETTE.length - 1];
          const bgColor = hexToRgba(colObj.color, colObj.opacity);
          return {
            id: `agg-${iv.start}-${iv.end}`,
            start: iv.start,
            end: iv.end,
            display: 'background',
            backgroundColor: bgColor,
            borderColor: bgColor,
            color: bgColor,
            classNames: ['agg-bg'],
            extendedProps: { count: iv.count, player_ids: iv.player_ids }
          };
        });

        const cal = calendarRef.current.getApi();
        const prev = cal.getEvents().filter(e => e.id && e.id.startsWith('agg-'));
        prev.forEach(e => e.remove());
        bg.forEach(e => cal.addEvent(e));
      }
    } catch (e) { console.error('aggregate load failed', e); }
  }, [memberFilter, campaignId, userId]);

  async function handleDatesSet(arg) {
    const startIso = arg.start.toISOString();
    const endIso = arg.end.toISOString();
    if (!campaignId) {
      const cal = calendarRef.current?.getApi();
      if (cal) {
        const prev = cal.getEvents().filter(e => e.id && e.id.startsWith('agg-'));
        prev.forEach(e => e.remove());
      }
      return;
    }
    await loadAggregates(startIso, endIso);
  }

  // whenever memberFilter changes, re-run load for current view
  useEffect(() => {
    if (!campaignId) return; // nothing to load when no campaign
    const cal = calendarRef.current?.getApi();
    if (!cal) return;
    const view = cal.view;
    if (!view) return;
    const startIso = view.activeStart.toISOString();
    const endIso = view.activeEnd.toISOString();
    loadAggregates(startIso, endIso).catch(console.error);
  }, [memberFilter, loadAggregates]);

  function showTooltip(info) {
    const ev = info.event;
    if (!ev || !ev.extendedProps) return;
    const ids = ev.extendedProps.player_ids || [];
    const names = ids.map(id => playersMap[id] || ('#' + id));
    const txt = names.join(', ') || '(no players)';
    const d = tooltipRef.current;
    d.innerText = txt;
    d.style.display = 'block';

  // position at the mouse location in viewport coords (fixed positioning)
  const evt = info.jsEvent;
  const margin = 10;
  let left = (evt && evt.clientX != null) ? evt.clientX + margin : 12;
  let top = (evt && evt.clientY != null) ? evt.clientY + margin : 12;
    const tw = d.offsetWidth || 200;
    const th = d.offsetHeight || 24;
    if (left + tw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - tw - 8);
    if (top + th > window.innerHeight - 8) top = Math.max(8, window.innerHeight - th - 8);
    d.style.left = `${left}px`;
    d.style.top = `${top}px`;
  }

  function hideTooltip() {
    const d = tooltipRef.current;
    if (!d) return;
    d.style.display = 'none';
  }

  const fcTimezone = viewTimeZone || 'local';

  return (
    <FullCalendar
      ref={calendarRef}
      plugins={[ timeGridPlugin, interactionPlugin ]}
      initialView={initialView}
      headerToolbar={headerToolbar}
      datesSet={handleDatesSet}
      eventDidMount={(info) => {
        if (info.event && info.event.id && String(info.event.id).startsWith('agg-')) {
          const el = info.el;
          const c = info.event.backgroundColor || info.event.extendedProps?.color || info.event._def?.ui?.backgroundColor;
          if (c) {
            try { el.style.backgroundColor = c; el.style.borderColor = c; } catch(_){}
          }
        }
      }}
      eventOverlap={false}
      eventMouseEnter={(info)=> showTooltip(info)}
      eventMouseLeave={()=> hideTooltip()}
      slotDuration="00:30:00"
      allDaySlot={false}
      height={isMobile ? 'auto' : 650}
      nowIndicator={true}
      timeZone={fcTimezone}
    />
  );
}
