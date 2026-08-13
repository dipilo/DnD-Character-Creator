// client/src/components/ColorManager.jsx
import React, { useEffect, useState, useRef } from 'react';
const AGG_KEY = 'aggPalette_v1';
const SINGLE_KEY = 'singleColor_v1';
const DEFAULT = [
  { color: '#4682B4', opacity: 0.45 },
  { color: '#228B22', opacity: 0.45 },
  { color: '#FFA500', opacity: 0.45 },
  { color: '#DC143C', opacity: 0.45 }
];
const DEFAULT_SINGLE = { color: '#4682B4', opacity: 1.0 }; // 100% opacity for single-mode fallback

function loadAgg() {
  try {
    const raw = localStorage.getItem(AGG_KEY);
    if (!raw) return DEFAULT.slice();
    return JSON.parse(raw);
  } catch (e) { return DEFAULT.slice(); }
}
function saveAgg(arr) {
  localStorage.setItem(AGG_KEY, JSON.stringify(arr));
  window.dispatchEvent(new Event('aggPaletteChanged'));
}

function loadSingle() {
  try {
    const raw = localStorage.getItem(SINGLE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}
function saveSingle(obj) {
  localStorage.setItem(SINGLE_KEY, JSON.stringify(obj));
  window.dispatchEvent(new Event('singleColorChanged'));
}

export default function ColorManager({ onClose, maxColors }) {
  const isSingle = typeof maxColors === 'number' && maxColors === 1;
  const [palette, setPalette] = useState(isSingle ? (() => {
    const s = loadSingle();
    if (s) return [s];
    const a = loadAgg();
    if (a && a.length) {
      const first = a[0];
      return [{ color: first.color || DEFAULT_SINGLE.color, opacity: (first.opacity === undefined || first.opacity === null) ? DEFAULT_SINGLE.opacity : first.opacity }];
    }
    return [DEFAULT_SINGLE];
  })() : loadAgg());

  useEffect(() => {
    if (isSingle) {
      const s = loadSingle();
      if (s) setPalette([s]);
      else {
        const a = loadAgg();
        setPalette([ a[0] ? { color: a[0].color, opacity: (a[0].opacity === undefined || a[0].opacity === null) ? DEFAULT_SINGLE.opacity : a[0].opacity } : DEFAULT_SINGLE ]);
      }
    } else {
      setPalette(loadAgg());
    }
  }, [isSingle]);

  const dragIndexRef = useRef(null);

  function persist(newPal) {
    if (isSingle) {
      const first = newPal[0] || DEFAULT_SINGLE;
      saveSingle(first);
      setPalette([first]);
    } else {
      saveAgg(newPal);
      setPalette(newPal);
    }
  }

  function addAt(i = null) {
    if (isSingle) return;
    const next = palette.slice();
    const newEntry = { color: '#888888', opacity: 0.45 };
    if (i === null) next.push(newEntry); else next.splice(i+1, 0, newEntry);
    persist(next);
  }
  function removeIndex(i) {
    if (isSingle) return;
    const next = palette.slice(); next.splice(i,1); persist(next);
  }
  function changeColor(i, hex) {
    if (isSingle && i !== 0) return;
    const next = palette.slice();
    next[i] = { ...next[i], color: hex };
    persist(next);
  }
  function setOpacityPct(i, pct) {
    if (isSingle && i !== 0) return;
    const next = palette.slice();
    next[i] = { ...next[i], opacity: Math.max(0, Math.min(1, pct/100)) };
    persist(next);
  }

  function onOpacityWheel(e, i) {
    e.preventDefault(); e.stopPropagation();
    const delta = e.deltaY < 0 ? 2 : -2;
    const cur = Math.round((palette[i]?.opacity || 0.45) * 100);
    setOpacityPct(i, cur + delta);
  }

  function onHandleDragStart(e, i) { dragIndexRef.current = i; e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; }
  function onRowDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  function onRowDrop(e, toIndex) {
    if (isSingle) return;
    e.preventDefault();
    const fromStr = e.dataTransfer.getData('text/plain');
    if (!fromStr) return;
    const from = parseInt(fromStr, 10);
    if (Number.isNaN(from) || from === toIndex) return;
    const arr = palette.slice();
    const [item] = arr.splice(from,1);
    arr.splice(toIndex, 0, item);
    persist(arr);
  }

  function reset() {
    if (isSingle) {
      saveSingle(DEFAULT_SINGLE);
      setPalette([loadSingle() || DEFAULT_SINGLE]);
    } else {
      saveAgg(DEFAULT.slice());
      setPalette(loadAgg());
    }
  }

  return (
    <div style={{ padding:8 }}>
      <h3 style={{ marginTop:0 }}>{isSingle ? 'Single calendar color' : 'Aggregate color palette'}</h3>
  <p style={{ marginTop: 0, color:'var(--muted)' }}>
        {isSingle ? 'This color is used for per-player availability blocks.' : 'Each color corresponds to a count (1 = first color, 2 = second color, ...). Hover percent and scroll to change opacity.'}
      </p>

      <div style={{ display:'grid', gap:8 }}>
        {palette.map((p,i)=>(
          <div key={i} onDragOver={onRowDragOver} onDrop={(e)=> onRowDrop(e,i)} style={{ display:'flex', alignItems:'center', gap:8, padding:8, border:'1px solid var(--border)', borderRadius:6, background:'var(--panel)' }}>
              <div
              draggable={!isSingle}
              onDragStart={(e)=> onHandleDragStart(e,i)}
              title="Drag to reorder"
              style={{ cursor: isSingle ? 'default' : 'grab', width:20, display:'flex', justifyContent:'center', alignItems:'center', color:'var(--muted)', zIndex:3 }}
              onMouseDown={(e)=> { /* prevent underlying color-input click */ e.stopPropagation(); }}
            >
              ≡
            </div>

            {/* color swatch + hidden color input */}
            <div style={{ position:'relative', width:40, height:28, borderRadius:4, border:'1px solid var(--border)', background:p.color, cursor:'pointer', zIndex:1 }}>
              <input
                type="color"
                value={p.color}
                onChange={(e)=> changeColor(i, e.target.value)}
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0, cursor:'pointer', border:0, padding:0, margin:0 }}
                onMouseDown={(e)=> e.stopPropagation()}
              />
            </div>

            <div style={{ minWidth:28, fontSize:13 }}>{isSingle ? '' : `+${i+1}`}</div>

            <div style={{ display:'flex', flexDirection:'column', gap:4, flex:1 }}>
              <div style={{ fontSize:12, color:'var(--muted)' }}>{isSingle ? 'Opacity' : 'Opacity'}</div>
              <div onWheel={(e)=> onOpacityWheel(e,i)} style={{ display:'flex', alignItems:'center', gap:8, userSelect:'none', cursor:'ns-resize' }} title="Scroll to change opacity">
                <div style={{ minWidth:48, textAlign:'right', fontFamily:'monospace' }}>{Math.round((p.opacity||0)*100)}%</div>
                {(() => {
                  const pct = Math.round((p.opacity || 0) * 100);
                  // full width so gradient aligns with thumb
                  const bg = `linear-gradient(90deg, ${p.color} ${pct}%, var(--panel) ${pct}%)`;
                  return (
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={pct}
                      onChange={(e)=> setOpacityPct(i, parseInt(e.target.value,10))}
                      onWheel={(e)=> onOpacityWheel(e,i)}
                      style={{ width:'100%', height:12, borderRadius:6, background: bg, appearance:'none', padding:0, margin:0 }}
                    />
                  );
                })()}
              </div>
            </div>

            <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
              {!isSingle && <button title="Remove color" onClick={()=> removeIndex(i)} style={{ width:28, height:28, padding:0 }}>−</button>}
              {!isSingle && <button title="Add color below" onClick={()=> addAt(i)} style={{ width:28, height:28, padding:0 }}>+</button>}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
        <button onClick={reset}>Reset</button>
        <button onClick={()=> onClose && onClose()}>Close</button>
      </div>
    </div>
  );
}
