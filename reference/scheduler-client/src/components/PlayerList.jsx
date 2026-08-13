// client/src/components/PlayerList.jsx
import React, { useState, useRef } from 'react';
import PlayerEditor from './PlayerEditor';

export default function PlayerList({
  players = [],
  onSelect,
  selected,
  onPlayersChanged,
  onOpenPlayer,
  onReorderPlayers,
  onRemovePlayer,
  onAddPlayer
}) {
  const [editing, setEditing] = useState(null);
  const dragIndexRef = useRef(null);

  function handleDoubleClick(p) { setEditing(p); }
  function handleContextMenu(e, p) { e.preventDefault(); setEditing(p); }

  async function handleSaved() {
    setEditing(null);
    if (onPlayersChanged) await onPlayersChanged();
  }

  function onDragStart(e, idx) {
    dragIndexRef.current = idx;
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch (_) {}
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
  function onDrop(e, destIdx) {
    e.preventDefault();
    const srcIdx = (dragIndexRef.current != null) ? dragIndexRef.current : Number(e.dataTransfer.getData('text/plain'));
    if (isNaN(srcIdx) || srcIdx === destIdx) return;
    const next = players.slice();
    const [moved] = next.splice(srcIdx, 1);
    next.splice(destIdx, 0, moved);
    if (typeof onReorderPlayers === 'function') onReorderPlayers(next);
    dragIndexRef.current = null;
  }

  // render text with backlinks [[Name]] -> clickable token
  function renderWithBacklinks(text) {
    if (!text) return null;
    const parts = [];
    const regex = /\[\[([^\]]+?)\]\]/g;
    let lastIndex = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      const idx = m.index;
      if (idx > lastIndex) parts.push({ type: 'text', text: text.slice(lastIndex, idx) });
      parts.push({ type: 'link', text: m[1].trim() });
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < text.length) parts.push({ type: 'text', text: text.slice(lastIndex) });
    return parts.map((p, i) => {
      if (p.type === 'text') return <span key={i}>{p.text}</span>;
      return (
        <span
          key={i}
          className="backlink"
          tabIndex={0}
          onClick={(e)=> {
            e.stopPropagation();
            const q = (p.text || '').toLowerCase();
            const found = players.find(pp => (pp.name || '').toLowerCase() === q || (pp.discord || '').toLowerCase() === q);
            if (found) {
              if (typeof onOpenPlayer === 'function') onOpenPlayer(found);
              else setEditing(found);
            }
          }}
          onKeyDown={(e)=> { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}
          role="button"
          style={{ display:'inline-flex', alignItems:'center', gap:6 }}
        >
          <span className="bracket">[[</span>
          <span className="backlink-label">{p.text}</span>
          <span className="bracket">]]</span>
        </span>
      );
    });
  }

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
        <strong>Players</strong>
        <div style={{display:'flex', gap:8}}>
          <button onClick={() => { if (typeof onAddPlayer === 'function') onAddPlayer(); else {
            const tmp = { id: `temp-${Date.now()}`, name: '', discord: '', notes: '' };
            setEditing(tmp);
          }}}>Add player</button>
          <button onClick={() => { if (onPlayersChanged) onPlayersChanged(); }}>Refresh</button>
        </div>
      </div>

  {players.length === 0 && <div style={{color:'var(--muted)'}}>No players yet. Import from the sheet or add via the app.</div>}

      {players.map((p, idx) => (
        <div
          key={p.id}
          onClick={()=> onSelect && onSelect(p)}
          onDoubleClick={()=> handleDoubleClick(p)}
          onContextMenu={(e)=> handleContextMenu(e,p)}
          onDragOver={onDragOver}
          onDrop={(e)=> onDrop(e, idx)}
          style={{
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              padding:10,
              border: p.id===selected?.id ? '2px solid var(--accent)' : '1px solid var(--border)',
              cursor:'default',
              marginBottom:8,
              borderRadius:6,
              background: p.id===selected?.id ? 'rgba(74, 255, 144, 0.06)' : 'var(--panel)'
            }}>
          {/* drag handle only is draggable */}
          <div
            draggable
            onDragStart={(e)=> onDragStart(e, idx)}
            title="Drag to reorder"
            className="drag-handle"
            style={{ padding:6, userSelect: 'none' }}
          >☰</div>

          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {p.ddb_avatar_url ? (
                    <img src={p.ddb_avatar_url} alt="avatar" style={{ width:24, height:24, objectFit:'cover', borderRadius:4 }} />
                  ) : null}
                  <div style={{ fontWeight:700 }}>{p.name || '(no name)'} {(p.is_claimed !== undefined ? (p.is_claimed ? <span style={{ fontSize:12, color:'var(--muted)', marginLeft:8 }}>(claimed)</span> : <span style={{ fontSize:12, color:'var(--muted)', marginLeft:8 }}>(unclaimed)</span>) : ((p.discord_id || p.password_hash) ? <span style={{ fontSize:12, color:'var(--muted)', marginLeft:8 }}>(claimed)</span> : <span style={{ fontSize:12, color:'var(--muted)', marginLeft:8 }}>(unclaimed)</span>))}</div>
                </div>
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={(ev)=> { ev.stopPropagation(); setEditing(p); }}>Edit</button>
                <button onClick={(ev)=> { ev.stopPropagation(); if (typeof onRemovePlayer === 'function') onRemovePlayer(p); }}>🗑</button>
              </div>
            </div>

            <div style={{ fontSize:12, color:'var(--muted)' }}>
              {p.discord || ''}
              {p.ddb_url && (
                <>
                  {' '}
                  • <a href={p.ddb_url} target="_blank" rel="noreferrer">D&D Beyond</a>
                </>
              )}
            </div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:6 }}>
              { renderWithBacklinks(p.notes || '') }
            </div>
          </div>
        </div>
      ))}

      {editing && <PlayerEditor player={editing} onClose={()=> setEditing(null)} onSaved={handleSaved} />}
    </div>
  );
}
