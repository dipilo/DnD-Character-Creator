// client/src/components/GroupHeatmap.jsx
import React, { useEffect, useState } from 'react';
import { fetchAggregates } from '../api';
import { DateTime } from 'luxon';

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

export default function GroupHeatmap({ memberIds = [], days = 7, startIso = null, endIso = null, campaignId = null, userId = null }) {
  const [intervals, setIntervals] = useState([]);
  useEffect(()=> {
    async function load() {
      if (!memberIds || memberIds.length === 0) { setIntervals([]); return; }
      const start = startIso || DateTime.now().startOf('day').toUTC().toISO();
      const end = endIso || DateTime.now().plus({ days }).endOf('day').toUTC().toISO();
      try {
        // use API wrapper which supports campaign and user headers
        const obj = await fetchAggregates(start, end, Array.isArray(memberIds) ? memberIds : null, { campaignId, userId });
        if (obj && obj.intervals) setIntervals(obj.intervals); else setIntervals([]);
      } catch (e) {
        console.error('Heatmap load failed', e);
        setIntervals([]);
      }
    }
    load();
  }, [memberIds.join(','), days, startIso, endIso, campaignId, userId]);

  if (!memberIds || memberIds.length === 0) {
    return <div style={{ color:'var(--muted)', fontSize:12 }}>No members</div>;
  }

  // build a regular grid: days x 24 hours
  const now = DateTime.now().startOf('day').toUTC();
  const slots = [];
  for (let d=0; d<days; d++) {
    for (let h=0; h<24; h++) {
      const s = now.plus({ days: d, hours: h }).toISO();
      const e = now.plus({ days: d, hours: h+1 }).toISO();
      // compute count of players overlapping [s,e)
      let count = 0;
      for (const it of intervals) {
        if (!(new Date(it.end) <= new Date(s) || new Date(it.start) >= new Date(e))) {
          // it.player_ids contains players overlapping this interval - but may not be restricted to group; use length intersection
          if (Array.isArray(it.player_ids)) {
            const inter = it.player_ids.filter(pid => memberIds.includes(pid));
            if (inter.length > 0) count = Math.max(count, inter.length);
          } else {
            // fallback: use it.count
            count = Math.max(count, it.count || 0);
          }
        }
      }
      slots.push({ day: d, hour: h, count });
    }
  }

  // find max count to scale darkness
  const maxCount = Math.max(1, ...slots.map(s=>s.count));

  // render as simple grid
  const cellW = 10, cellH = 10, gap = 2;
  const svgW = (cellW + gap) * days;
  const svgH = (cellH + gap) * 24;

  // render a scaled thumbnail: SVG fills width, fixed height; preserveAspectRatio ensures it scales uniformly
  return (
    <div style={{ width: '100%', height: 140, overflow: 'hidden', boxSizing: 'border-box' }}>
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style={{ display: 'block' }}>
        {slots.map((s, i) => {
          const x = s.day * (cellW + gap);
          const y = s.hour * (cellH + gap);
          const alpha = clamp(s.count / maxCount, 0, 1);
          const gray = Math.round(220 - alpha * 160);
          const fill = `rgb(${gray},${gray},${gray})`;
          return (
            <g key={i}>
              <rect x={x} y={y} width={cellW} height={cellH} rx={2} ry={cellH} fill={fill} stroke="var(--border)" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
