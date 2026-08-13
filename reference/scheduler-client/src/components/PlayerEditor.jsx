// client/src/components/PlayerEditor.jsx
/* eslint-disable react/prop-types */
import React, { useEffect, useRef, useState } from 'react';
import CharacterSheet from './CharacterSheet';
import { updatePlayer, createPlayer, fetchPlayers, updateMemberPermissions, previewAvailabilityFromText } from '../api';

function domToCanonical(rootEl) {
  if (!rootEl) return '';
  const ph = rootEl.querySelector('.placeholder');
  if (ph) ph.remove();
  return rootEl.textContent || '';
}

function toLocalDateTimeValue(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalDateTimeValue(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeEditableAvailabilityBlocks(blocks = []) {
  return (Array.isArray(blocks) ? blocks : [])
    .map((block) => {
      const startIso = block?.start_iso || block?.start || null;
      const endIso = block?.end_iso || block?.end || null;
      if (!startIso || !endIso) return null;
      const start = new Date(startIso);
      const end = new Date(endIso);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
      return {
        id: block?.id || `preview_${Math.random().toString(36).slice(2)}`,
        start_iso: start.toISOString(),
        end_iso: end.toISOString()
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.start_iso).getTime() - new Date(b.start_iso).getTime());
}

// Plain-text TokenEditor that keeps [[Name]] as real characters
function TokenEditor({ value, onChange, players = [], placeholder = '', singleLine = false, style = {}, onOpenPlayer }) {
  const rootRef = useRef(null);
  const [internal, setInternal] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestRange, setSuggestRange] = useState(null);

  useEffect(() => { setInternal(value || ''); }, [value]);

  // render canonical string into the editor as plain text (no spans for tokens)
  function renderFromCanonical(raw) {
    const el = rootRef.current;
    if (!el) return;
    // keep placeholder visible when empty
    if (!raw) {
      el.textContent = '';
      if (placeholder) {
        // Use a lightweight placeholder node (so caret behavior is unmodified)
        if (!el.querySelector('.placeholder')) {
          const ph = document.createElement('span');
          ph.className = 'placeholder';
          ph.textContent = placeholder;
          ph.style.color = 'var(--muted)';
          el.appendChild(ph);
        }
      }
      return;
    }
    // if there's a placeholder inside, clear it
    const phNode = el.querySelector('.placeholder');
    if (phNode) phNode.remove();

    // Only update DOM if different — assigning textContent preserves caret if same text,
    // otherwise selection may move; we only call this from parent-change effect or after inserts.
    if (el.textContent !== raw) el.textContent = raw;
  }

  // compute caret index by summing text lengths before the anchor
  function getCaretIndexFromSelection() {
    const sel = globalThis.window?.getSelection?.();
    const root = rootRef.current;
    if (!sel || !root) return null;
    if (!root.contains(sel.anchorNode)) return null;

    // create a range from start of root to selection anchor and measure length
    const range = document.createRange();
    range.setStart(root, 0);
    try {
      range.setEnd(sel.anchorNode, sel.anchorOffset);
    } catch (e) { // fallback if selection problems
      console.debug('selection range set failed', e);
      return null;
    }
    const text = range.toString();
    return text.length;
  }

  // helper: given a DOM node + offset (from caretRangeFromPoint), compute canonical char index
  function computeIndexForNodeOffset(node, offset) {
    const root = rootRef.current;
    if (!root) return null;
    // Walk root childNodes and accumulate text lengths
    let idx = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let cur;
    while ((cur = walker.nextNode())) {
      if (cur === node) {
        return idx + Math.min(offset, (cur.nodeValue || '').length);
      }
      idx += (cur.nodeValue || '').length;
    }
    // if node not found and node is element (e.g. root), we can fallback to total length
    return idx;
  }

  // handle mouse clicks: determine if click landed inside a [[...]] token
  function onMouseDown(e) {
    const root = rootRef.current;
    if (!root) return;

    // Use caret position from point (cross-browser)
    let rangeAtPoint = null;
    if (document.caretPositionFromPoint) { // Firefox
      const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) rangeAtPoint = { node: pos.offsetNode, offset: pos.offset };
    } else if (document.caretRangeFromPoint) { // Webkit
      const r = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (r) rangeAtPoint = { node: r.startContainer, offset: r.startOffset };
    }

    if (!rangeAtPoint) return; // let normal behavior happen

    // make sure the click is inside our root
    if (!root.contains(rangeAtPoint.node)) return;

    const idx = computeIndexForNodeOffset(rangeAtPoint.node, rangeAtPoint.offset);
    if (idx === null) return;

    const raw = domToCanonical(root);
    // check whether idx is inside a [[...]] range
    const openIdx = raw.lastIndexOf('[[' , idx);
    if (openIdx === -1) return; // not in or after an open token
    const closeIdx = raw.indexOf(']]', openIdx + 2);
    if (closeIdx !== -1 && idx > closeIdx + 2) return; // outside token (after close)
    if (closeIdx !== -1 && idx > closeIdx) return; // after closing brackets
    // if closeIdx exists and idx <= closeIdx + 2 then it's either inside token or at/after close
    // compute token boundaries
    const tokenStart = openIdx;
    const tokenEnd = (closeIdx === -1) ? raw.length : closeIdx + 2;

    if (idx >= tokenStart && idx <= tokenEnd) {
      // click happened inside or on the token: open player modal and prevent caret placement
      e.preventDefault();
      e.stopPropagation();

      // extract token inner name
      const inner = raw.slice(openIdx + 2, (closeIdx === -1 ? raw.length : closeIdx));
      const name = inner.trim();
      // find player by name/discord
      const found = (players || []).find(p => (p.name || '').toLowerCase() === name.toLowerCase() || (p.discord || '').toLowerCase() === name.toLowerCase());
      if (found && typeof onOpenPlayer === 'function') {
        // small timeout to ensure any outer handlers don't fight
        setTimeout(()=> onOpenPlayer(found), 0);
      }
    }
    // otherwise let normal caret placement happen
  }

  // input handler: DOM -> canonical string; suggestions detection unchanged (you can reuse your suggestions code)
  function onInputHandler() {
    const el = rootRef.current;
    if (!el) return;
    const canonical = domToCanonical(el);
    setInternal(canonical);
    if (typeof onChange === 'function') onChange(canonical);

    // keep your existing suggestion detection logic using getCaretIndexFromSelection() if desired:
    const caretIdx = getCaretIndexFromSelection();
    if (caretIdx === null) { setShowSuggest(false); setSuggestions([]); setSuggestRange(null); return; }
    const before = canonical.slice(0, caretIdx);
    const openIdx = before.lastIndexOf('[[');
    if (openIdx === -1) { setShowSuggest(false); setSuggestions([]); setSuggestRange(null); return; }
    const closeIdx = before.indexOf(']]', openIdx + 2);
    if (closeIdx !== -1) { setShowSuggest(false); setSuggestions([]); setSuggestRange(null); return; }
    const typed = before.slice(openIdx + 2).toLowerCase();
    const matches = (players || []).filter(p => {
      const name = (p.name || '').toLowerCase();
      const disc = (p.discord || '').toLowerCase();
      return name.includes(typed) || disc.includes(typed);
    }).slice(0, 8);
    if (!matches.length) { setShowSuggest(false); setSuggestions([]); setSuggestRange(null); return; }
    setSuggestions(matches);
    setShowSuggest(true);
    setSuggestRange({ startIndex: openIdx, endIndex: caretIdx });
  }

  function applySuggestion(player) {
    if (!suggestRange) return;
    const raw = internal;
    const before = raw.slice(0, suggestRange.startIndex);
    const after = raw.slice(suggestRange.endIndex);
    const insert = `[[${player.name}]]`;
    const next = before + insert + after;
    setInternal(next);
    if (typeof onChange === 'function') onChange(next);
    setShowSuggest(false);
    setSuggestions([]);
    setSuggestRange(null);
    // update DOM and place caret after inserted token
    requestAnimationFrame(() => {
      renderFromCanonical(next);
      // place caret after inserted text (end)
      const root = rootRef.current;
      const range = document.createRange();
      // walk to last text node and set caret to its length
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      let last = null, node;
      while ((node = walker.nextNode())) last = node;
      if (last) {
        range.setStart(last, (last.nodeValue || '').length);
      } else {
        range.selectNodeContents(root);
        range.collapse(false);
      }
      const sel = globalThis.window?.getSelection?.();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);
      root.focus();
    });
  }

  function onKeyDown(e) {
    if (singleLine && e.key === 'Enter') e.preventDefault();
    if (e.key === 'Escape') {
      setShowSuggest(false);
      setSuggestions([]);
      setSuggestRange(null);
    }
    // optionally handle Enter to open token when caret inside token
    if (e.key === 'Enter') {
      const caretIdx = getCaretIndexFromSelection();
      if (caretIdx !== null) {
        const raw = internal;
        const openIdx = raw.lastIndexOf('[[' , caretIdx);
        const closeIdx = raw.indexOf(']]', openIdx + 2);
        if (openIdx !== -1 && (closeIdx === -1 || caretIdx <= closeIdx + 2)) {
          const inner = raw.slice(openIdx + 2, (closeIdx === -1 ? raw.length : closeIdx));
          const name = inner.trim();
          const found = (players || []).find(p => (p.name || '').toLowerCase() === name.toLowerCase() || (p.discord || '').toLowerCase() === name.toLowerCase());
          if (found && typeof onOpenPlayer === 'function') {
            e.preventDefault();
            onOpenPlayer(found);
          }
        }
      }
    }
  }

  // initial render + when parent value changes
  useEffect(() => {
    renderFromCanonical(internal || value || '');
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'relative', ...style }}>
      <div
        ref={rootRef}
        className="token-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={onInputHandler}
        onKeyDown={onKeyDown}
        onBlur={() => { setTimeout(()=> { setShowSuggest(false); setSuggestions([]); }, 150); }}
        onMouseDown={onMouseDown}
        style={{
          minHeight: singleLine ? 30 : 120,
          border: '1px solid var(--border)',
          padding: 8,
          borderRadius: 6,
          outline: 'none',
          whiteSpace: 'pre-wrap',
          overflow: 'auto',
          font: 'inherit'
        }}
      />
      {showSuggest && suggestions.length > 0 && (
        <div style={{
          position: 'absolute',
          left: 8,
          right: 8,
          bottom: -6 - (Math.min(6, suggestions.length) * 36),
          maxHeight: 220,
          overflow: 'auto',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          zIndex: 2147483660,
          boxShadow: '0 6px 20px rgba(0,0,0,0.08)'
        }}>
          {suggestions.map(s => (
            <button
              key={s.id}
              type="button"
              style={{ width: '100%', textAlign: 'left', padding: '8px 10px', cursor: 'pointer', borderBottom: '1px solid var(--border)', background: 'transparent', borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
              onMouseDown={(ev) => { ev.preventDefault(); applySuggestion(s); }}
            >
              <div style={{ fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.discord}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- PlayerEditor using TokenEditor for fields (replaces prior simple inputs) ---
export default function PlayerEditor({ player, onClose, onSaved, onOpenPlayer }) {
  const [form, setForm] = useState({
    name: player.name || '',
    discord: player.discord || '',
    age: player.age || '',
    timezone: player.timezone || '',
    notes: player.notes || '',
    computer_access: player.computer_access || '',
    pref_party_size: player.pref_party_size || '',
    pref_session_length: player.pref_session_length || '',
    pref_vtt: player.pref_vtt || '',
    pref_play_with: player.pref_play_with || '',
    pref_play_not_with: player.pref_play_not_with || '',
    ddb_url: player.ddb_url || '',
    ddb_json: player.ddb_json || '',
    ddb_avatar_url: player.ddb_avatar_url || ''
  });
  const [saving, setSaving] = useState(false);
  const [playersList, setPlayersList] = useState([]);
  const [showSheet, setShowSheet] = useState(false);
  const localUserId = localStorage.getItem('userId') || null;
  const [memberPermissions, setMemberPermissions] = useState({
    invites_create: false,
    invites_edit: false,
    invites_delete: false,
    players_create: false,
    players_view: 'all',
    players_edit: false,
    players_delete: false,
    players_edit_availability: false,
    players_self_view: false,
    players_self_edit: false,
    players_self_delete: false,
    players_self_edit_availability: false,
    groups_create: false,
    groups_view: false,
    groups_edit: false,
    groups_delete: false,
    members_manage: false
  });
  const [viewerPermissions, setViewerPermissions] = useState({});
  const [permLoading, setPermLoading] = useState(false);
  const [showAutoPopulateModal, setShowAutoPopulateModal] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewSummary, setPreviewSummary] = useState(null);
  const [previewBlocks, setPreviewBlocks] = useState([]);
  const [usePreviewBlocks, setUsePreviewBlocks] = useState(false);

  useEffect(() => {
    setForm({
      name: player.name || '',
      discord: player.discord || '',
      age: player.age || '',
      timezone: player.timezone || '',
      notes: player.notes || '',
      computer_access: player.computer_access || '',
      pref_party_size: player.pref_party_size || '',
      pref_session_length: player.pref_session_length || '',
      pref_vtt: player.pref_vtt || '',
      pref_play_with: player.pref_play_with || '',
      pref_play_not_with: player.pref_play_not_with || '',
      ddb_url: player.ddb_url || '',
      ddb_json: player.ddb_json || '',
      ddb_avatar_url: player.ddb_avatar_url || ''
    });
    setPreviewBlocks([]);
    setPreviewSummary(null);
    setPreviewError('');
    setUsePreviewBlocks(false);
    setShowAutoPopulateModal(false);
    // only fetch players for suggestions if we have a campaign context
    if (player && player.campaign_id) {
      fetchPlayers({ campaignId: player.campaign_id, userId: localUserId }).then(list => setPlayersList(list || [])).catch(()=>setPlayersList([]));
    } else {
      setPlayersList([]);
    }
  }, [player]);

  async function loadAvailabilityPreview() {
    setPreviewLoading(true);
    setPreviewError('');
    try {
      const response = await previewAvailabilityFromText({
        text: form.notes || '',
        timezone: form.timezone || '',
        daysAhead: 14
      }, { userId: localUserId });
      setPreviewSummary(response?.preview || null);
      setPreviewBlocks(normalizeEditableAvailabilityBlocks(response?.availability || []));
    } catch (e) {
      setPreviewSummary(null);
      setPreviewBlocks([]);
      setPreviewError(e?.message || String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function openAvailabilityPreview() {
    setShowAutoPopulateModal(true);
    await loadAvailabilityPreview();
  }

  useEffect(() => {
    // load existing member permissions if this player is linked to a member
    async function loadPerms() {
      try {
        if (!player || !player.campaign_id || !player.id) return;
        // find campaign_members row for this player and current campaign
  const resp = await fetch((import.meta.env.VITE_API_BASE || (globalThis.window?.location?.origin)) + `/api/campaigns/${player.campaign_id}/members`, { headers: { ...(localUserId?{'X-User-Id':localUserId}:{}) } });
        if (!resp.ok) return;
        const j = await resp.json();
        if (!j || !Array.isArray(j.members)) return;
        const mm = j.members.find(m => m.player_id === player.id || m.user_id === (localUserId?Number(localUserId):null));
        if (!mm) return;
        const perms = mm.permissions ? (typeof mm.permissions === 'string' ? JSON.parse(mm.permissions) : mm.permissions) : {};
        // map legacy keys
        if (perms.can_create_invites) perms.invites_create = true;
        if (perms.can_unclaim) perms.players_self_delete = true;
        if (perms.can_edit_self) perms.players_self_edit = true;
        const truthy = v => (v === true || v === 'true' || v === 1 || v === '1');
        setMemberPermissions({
          invites_create: !!perms.invites_create,
          invites_edit: !!perms.invites_edit,
          invites_delete: !!perms.invites_delete,
          players_create: !!perms.players_create,
          // players_view default => true
          players_view: (perms.players_view === undefined ? true : (perms.players_view === 'none' || perms.players_view === false ? false : true)),
          players_edit: !!perms.players_edit,
          players_delete: !!perms.players_delete,
          // default to FALSE for editing availability when unspecified (only allow editing your own availability)
          players_edit_availability: (perms.players_edit_availability === undefined ? false : truthy(perms.players_edit_availability)),
          // Self permissions defaults: view/edit/edit_availability = true, delete = true
          players_self_view: (perms.players_self_view === undefined ? true : truthy(perms.players_self_view)),
          players_self_edit: (perms.players_self_edit === undefined ? true : truthy(perms.players_self_edit)),
          // default to TRUE so players can delete/unclaim their own record by default
          players_self_delete: (perms.players_self_delete === undefined ? true : truthy(perms.players_self_delete)),
          players_self_edit_availability: (perms.players_self_edit_availability === undefined ? true : truthy(perms.players_self_edit_availability)),
          groups_create: !!perms.groups_create,
          groups_view: !!perms.groups_view,
          groups_edit: !!perms.groups_edit,
          groups_delete: !!perms.groups_delete,
          // Self group defaults: view true, edit OFF by default, delete false
          groups_self_view: (perms.groups_self_view === undefined ? true : truthy(perms.groups_self_view)),
          groups_self_edit: (perms.groups_self_edit === undefined ? false : truthy(perms.groups_self_edit)),
          groups_self_delete: (perms.groups_self_delete === undefined ? false : truthy(perms.groups_self_delete)),
          members_manage: !!perms.members_manage
        });
        // store the member id for saving
        setForm(prev => ({ ...prev, _memberId: mm.id }));
        // also find the viewer's membership row (if different) to determine what actions are allowed
        const viewerRow = j.members.find(m => String(m.user_id) === String(localUserId));
        const viewerPerms = (viewerRow && viewerRow.permissions) ? (typeof viewerRow.permissions === 'string' ? JSON.parse(viewerRow.permissions) : viewerRow.permissions) : {};
        
        // Determine if viewer can unclaim: owner can always unclaim, or user with unclaim permissions
        const isOwner = viewerRow && viewerRow.role === 'owner';
        const canUnclaimFromPerms = viewerPerms.can_unclaim || viewerPerms.players_self_delete;
        const canUnclaim = isOwner || canUnclaimFromPerms;
        
        setViewerPermissions({ ...viewerPerms, can_unclaim: canUnclaim, is_owner: isOwner });
      } catch (e) { /* ignore */ }
    }
    loadPerms();
  }, [player]);

  function setField(k, v){
    setForm(prev => ({ ...prev, [k]: v }));
    if (k === 'notes' || k === 'timezone') {
      setUsePreviewBlocks(false);
      setPreviewSummary(null);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const numericId = Number(player && player.id);
      const isExisting = Number.isFinite(numericId) && numericId > 0;
      const availabilityPreviewBlocks = usePreviewBlocks
        ? normalizeEditableAvailabilityBlocks(previewBlocks).map(block => ({ start_iso: block.start_iso, end_iso: block.end_iso }))
        : undefined;
      const savePayload = {
        ...form,
        campaign_id: player.campaign_id,
        rebuildOnSave: true,
        ...(availabilityPreviewBlocks ? { availability_preview_blocks: availabilityPreviewBlocks } : {})
      };

      if (!isExisting) {
        const resp = await createPlayer(savePayload, { userId: localUserId });
        if (!resp || !resp.player) throw new Error('create failed');
        if (onSaved) await onSaved();
        onClose();
        return;
      }

      await updatePlayer(player.id, savePayload, { userId: localUserId });
      if (onSaved) await onSaved();
      onClose();
    } catch (e) {
      alert('Save failed: ' + (e.message || e));
      console.error('PlayerEditor save error', e);
    } finally {
      setSaving(false);
    }
  }

  async function handleUnclaim() {
    if (!player || !player.id) return;
    if (!confirm('Mark this player as unclaimed? This will remove any linked account mapping.')) return;
    try {
      const response = await fetch((import.meta.env.VITE_API_BASE || (globalThis.window?.location?.origin)) + `/api/campaigns/${player.campaign_id}/unclaim-player`, { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          ...(localUserId ? {'X-User-Id': localUserId} : {}) 
        }, 
        body: JSON.stringify({ player_id: player.id }) 
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.error || 'Unknown error');
      }
      
      // Provide immediate feedback and close modal
      if (onSaved) await onSaved();
      onClose();
      // Show success message after modal closes
      setTimeout(() => {
        alert('Player unclaimed successfully! The player is now unclaimed and available for others to claim.');
      }, 100);
    } catch (e) { 
      console.error('Unclaim error:', e);
      alert('Unclaim failed: ' + (e.message || e)); 
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width:720 }}>
        <h3>Edit player — {player.name || '(no name)'}</h3>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <input value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Name" />
          <input value={form.discord} onChange={e => setField('discord', e.target.value)} placeholder="Discord" />
          <TokenEditor value={form.age} onChange={(v)=>setField('age', v)} players={playersList} placeholder="Age" singleLine={true} onOpenPlayer={onOpenPlayer} />
          <TokenEditor value={form.timezone} onChange={(v)=>setField('timezone', v)} players={playersList} placeholder="Timezone (e.g. EST)" singleLine={true} onOpenPlayer={onOpenPlayer} />
          <TokenEditor value={form.computer_access} onChange={(v)=>setField('computer_access', v)} players={playersList} placeholder="Computer access" singleLine={true} onOpenPlayer={onOpenPlayer} />
          <TokenEditor value={form.pref_vtt} onChange={(v)=>setField('pref_vtt', v)} players={playersList} placeholder="Preferred VTT" singleLine={true} onOpenPlayer={onOpenPlayer} />
        </div>

        <div style={{ marginTop:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <div>General availability / notes</div>
            <button type="button" onClick={openAvailabilityPreview} disabled={previewLoading || !String(form.notes || '').trim()}>
              {previewLoading ? 'Loading preview...' : 'Preview Auto-Population'}
            </button>
          </div>
          <TokenEditor value={form.notes} onChange={(v)=>setField('notes', v)} players={playersList} placeholder="When are you most frequently and consistently free?" singleLine={false} style={{ minHeight:120 }} onOpenPlayer={onOpenPlayer} />
          <div style={{ marginTop:6, fontSize:12, color:'var(--muted)' }}>
            {usePreviewBlocks && previewBlocks.length > 0
              ? `${previewBlocks.length} auto-populated availability blocks will be saved from your edited preview.`
              : 'Use Preview Auto-Population to review and edit generated availability before saving.'}
          </div>
        </div>

        {/* D&D Beyond integration */}
        <div style={{ marginTop:10, padding:10, border:'1px solid var(--border)', borderRadius:6 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:700 }}>D&D Beyond</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => {
                try {
                  const txt = globalThis.window?.prompt?.('Paste D&D Beyond character JSON');
                  if (!txt) return;
                  let parsed;
                  try { parsed = JSON.parse(txt); } catch (e) { alert('Invalid JSON'); return; }
                  setField('ddb_json', JSON.stringify(parsed));
                  const avatar = parsed?.character?.decorations?.avatarUrl || parsed?.avatarUrl || parsed?.character?.avatarUrl;
                  if (avatar) setField('ddb_avatar_url', avatar);
                  alert('Character JSON stored. Click Save to persist.');
                } catch(error_) { console.debug('Paste JSON failed', error_); }
              }}>Paste JSON</button>
              {form.ddb_json && (
                <button onClick={() => {
                  try {
                    const parsed = JSON.parse(form.ddb_json);
                    const nm = parsed?.character?.name || parsed?.name;
                    const avatar = parsed?.character?.decorations?.avatarUrl || parsed?.avatarUrl || parsed?.character?.avatarUrl;
                    if (nm) setField('name', nm);
                    if (avatar) setField('ddb_avatar_url', avatar);
                  } catch(error_) { console.debug('Apply from JSON failed', error_); }
                }} title="Apply basic fields (name, avatar) from the stored JSON">Apply from JSON</button>
              )}
              {form.ddb_json && (
                <button onClick={() => {
                  try {
                    const data = JSON.parse(form.ddb_json);
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `${(player.name || 'character')}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch(_) { alert('Stored JSON is not valid'); }
                }}>Download JSON</button>
              )}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:8, marginTop:8 }}>
            <div style={{ display:'flex', gap:8 }}>
              <input value={form.ddb_url} onChange={e => setField('ddb_url', e.target.value)} placeholder="D&D Beyond character URL (optional)" style={{ flex:1 }} />
              {(form.ddb_json || form.ddb_url) && (
                <button onClick={() => setShowSheet(true)}>View Sheet</button>
              )}
            </div>
            {form.ddb_json && (() => {
              try {
                const data = JSON.parse(form.ddb_json);
                const name = data?.character?.name || data?.name || '';
                const classes = (data?.character?.classes || data?.classes || []).map(c => {
                  const n = c?.definition?.name || c?.name || 'Class';
                  const lvl = c?.level || c?.levels || c?.levelTotal || '';
                  return lvl ? `${n} ${lvl}` : n;
                }).join(', ');
                const level = data?.character?.level || data?.level || '';
                const hp = data?.character?.baseHitPoints || data?.baseHitPoints || '';
                const avatar = form.ddb_avatar_url || data?.character?.decorations?.avatarUrl || data?.avatarUrl || '';
                return (
                  <div style={{ display:'flex', gap:12, alignItems:'center', background:'var(--panel)', border:'1px solid var(--border)', padding:8, borderRadius:6 }}>
                    {avatar ? <img src={avatar} alt="avatar" style={{ width:48, height:48, objectFit:'cover', borderRadius:6 }} /> : null}
                    <div>
                      <div style={{ fontWeight:700 }}>{name || '(character)'}</div>
                      <div style={{ fontSize:12, color:'var(--muted)' }}>{classes || (level?`Level ${level}`:'')}{hp? ` • HP ${hp}`:''}</div>
                      <div style={{ fontSize:11, color:'var(--muted)' }}>JSON stored ({(form.ddb_json.length/1024).toFixed(1)} KB)</div>
                    </div>
                    {form.ddb_url ? <a href={form.ddb_url} target="_blank" rel="noreferrer" style={{ marginLeft:'auto' }}>Open on DDB →</a> : null}
                  </div>
                );
              } catch(_){
                return <div style={{ fontSize:12, color:'var(--muted)' }}>Stored JSON present (unable to summarize)</div>;
              }
            })()}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
          <TokenEditor value={form.pref_party_size} onChange={(v)=>setField('pref_party_size', v)} players={playersList} placeholder="Preferred party size" singleLine={true} onOpenPlayer={onOpenPlayer} />
          <TokenEditor value={form.pref_session_length} onChange={(v)=>setField('pref_session_length', v)} players={playersList} placeholder="Preferred session length" singleLine={true} onOpenPlayer={onOpenPlayer} />
          <TokenEditor value={form.pref_play_with} onChange={(v)=>setField('pref_play_with', v)} players={playersList} placeholder="Players they prefer to play with (comma-separated)" singleLine={true} onOpenPlayer={onOpenPlayer} />
          <TokenEditor value={form.pref_play_not_with} onChange={(v)=>setField('pref_play_not_with', v)} players={playersList} placeholder="Players they prefer NOT to play with (comma-separated)" singleLine={true} onOpenPlayer={onOpenPlayer} />
        </div>

        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:14 }}>
          <button onClick={onClose} disabled={saving}>Cancel</button>
          <button onClick={handleUnclaim} disabled={saving || !viewerPermissions.can_unclaim} style={{ marginRight: 8 }} title={viewerPermissions.can_unclaim ? '' : 'You do not have permission to unclaim players'}>Unclaim</button>
          <button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save & Rebuild Availability'}</button>
        </div>
        {/* Member permissions section - only visible to campaign owners or users with member management permissions */}
        {(viewerPermissions.is_owner || viewerPermissions.members_manage) && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <h4>Member permissions</h4>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <details>
              <summary style={{ fontWeight:700 }}>Player permissions</summary>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:6 }}>
                <label title="Allow creating player records for this campaign"><input type="checkbox" checked={memberPermissions.players_create} onChange={e => setMemberPermissions(prev => ({ ...prev, players_create: e.target.checked }))} /> Create</label>
                <label title="Allow viewing player records"><input type="checkbox" checked={!!memberPermissions.players_view} onChange={e => setMemberPermissions(prev => ({ ...prev, players_view: e.target.checked }))} /> View</label>
                <label title="Allow editing player records"><input type="checkbox" checked={memberPermissions.players_edit} onChange={e => setMemberPermissions(prev => ({ ...prev, players_edit: e.target.checked }))} /> Edit</label>
                <label title="Allow deleting players"><input type="checkbox" checked={memberPermissions.players_delete} onChange={e => setMemberPermissions(prev => ({ ...prev, players_delete: e.target.checked }))} /> Delete</label>
                <label title="Allow editing players' availability windows"><input type="checkbox" checked={memberPermissions.players_edit_availability} onChange={e => setMemberPermissions(prev => ({ ...prev, players_edit_availability: e.target.checked }))} /> Edit Availability</label>

                <details style={{ marginTop:8 }}>
                  <summary style={{ fontWeight:600 }}>Self permissions</summary>
                  <div style={{ display:'flex', gap:12, marginTop:6 }}>
                    <label title="Allow viewing own player record"><input type="checkbox" checked={memberPermissions.players_self_view} onChange={e => setMemberPermissions(prev => ({ ...prev, players_self_view: e.target.checked }))} /> View</label>
                    <label title="Allow editing own player record"><input type="checkbox" checked={memberPermissions.players_self_edit} onChange={e => setMemberPermissions(prev => ({ ...prev, players_self_edit: e.target.checked }))} /> Edit</label>
                    <label title="Allow deleting own player record"><input type="checkbox" checked={memberPermissions.players_self_delete} onChange={e => setMemberPermissions(prev => ({ ...prev, players_self_delete: e.target.checked }))} /> Delete</label>
                    <label title="Allow editing availability on own player record"><input type="checkbox" checked={memberPermissions.players_self_edit_availability} onChange={e => setMemberPermissions(prev => ({ ...prev, players_self_edit_availability: e.target.checked }))} /> Edit Availability</label>
                  </div>
                </details>
              </div>
            </details>

            <details style={{ marginLeft: 12 }}>
              <summary style={{ fontWeight:700 }}>Group permissions</summary>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:6 }}>
                <label title="Allow creating/managing groups"><input type="checkbox" checked={memberPermissions.groups_create} onChange={e => setMemberPermissions(prev => ({ ...prev, groups_create: e.target.checked }))} /> Create</label>
                <label title="Show Group Manager and group lists"><input type="checkbox" checked={memberPermissions.groups_view} onChange={e => setMemberPermissions(prev => ({ ...prev, groups_view: e.target.checked }))} /> View</label>
                <label title="Allow editing groups"><input type="checkbox" checked={memberPermissions.groups_edit} onChange={e => setMemberPermissions(prev => ({ ...prev, groups_edit: e.target.checked }))} /> Edit</label>
                <label title="Allow deleting groups"><input type="checkbox" checked={memberPermissions.groups_delete} onChange={e => setMemberPermissions(prev => ({ ...prev, groups_delete: e.target.checked }))} /> Delete</label>

                <details style={{ marginTop:8 }}>
                  <summary style={{ fontWeight:600 }}>Self group permissions</summary>
                  <div style={{ display:'flex', gap:12, marginTop:6 }}>
                    <label title="Allow viewing groups this member is in"><input type="checkbox" checked={memberPermissions.groups_self_view} onChange={e => setMemberPermissions(prev => ({ ...prev, groups_self_view: e.target.checked }))} /> View</label>
                    <label title="Allow editing groups this member is in"><input type="checkbox" checked={memberPermissions.groups_self_edit} onChange={e => setMemberPermissions(prev => ({ ...prev, groups_self_edit: e.target.checked }))} /> Edit</label>
                    <label title="Allow leaving or deleting groups this member is in"><input type="checkbox" checked={memberPermissions.groups_self_delete} onChange={e => setMemberPermissions(prev => ({ ...prev, groups_self_delete: e.target.checked }))} /> Delete</label>
                  </div>
                </details>
              </div>
            </details>

            <div style={{ marginLeft: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label title="Allow creating invites for this campaign"><input type="checkbox" checked={memberPermissions.invites_create} onChange={e => setMemberPermissions(prev => ({ ...prev, invites_create: e.target.checked }))} /> Can create invites</label>
              <label title="Allow managing members and permissions"><input type="checkbox" checked={memberPermissions.members_manage} onChange={e => setMemberPermissions(prev => ({ ...prev, members_manage: e.target.checked }))} /> Can manage members</label>
            </div>

            <div style={{ display:'flex', alignItems:'center', marginLeft: 12 }}>
              <button disabled={permLoading || !form._memberId || (!viewerPermissions.members_manage && !viewerPermissions.is_owner)} title={(!viewerPermissions.members_manage && !viewerPermissions.is_owner) ? 'You do not have permission to manage members' : ''} onClick={async () => {
                if (!form._memberId) return alert('No member record found for this player');
                setPermLoading(true);
                try {
                  await updateMemberPermissions(player.campaign_id, form._memberId, memberPermissions, localUserId);
                  alert('Permissions saved');
                } catch (e) { alert('Save failed: ' + (e.message || e)); }
                setPermLoading(false);
              }}>{permLoading ? 'Saving...' : 'Save permissions'}</button>
            </div>
          </div>
        </div>
        )}
        {/* Character Sheet Modal */}
        {showSheet && (
          <div className="modal-overlay" role="button" tabIndex={0} onClick={() => setShowSheet(false)} onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setShowSheet(false); }}>
            <div className="modal-panel" role="dialog" aria-modal="true" tabIndex={-1} style={{ width: 820, maxHeight:'80vh', overflow:'auto' }} onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setShowSheet(false); }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <h3 style={{ margin:0 }}>Character Sheet</h3>
                <button onClick={() => setShowSheet(false)}>✕</button>
              </div>
              <div style={{ marginTop:10 }}>
                <CharacterSheet json={form.ddb_json} avatarUrl={form.ddb_avatar_url} />
              </div>
            </div>
          </div>
        )}
        {showAutoPopulateModal && (
          <div className="modal-overlay" role="button" tabIndex={0} onClick={() => setShowAutoPopulateModal(false)} onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setShowAutoPopulateModal(false); }}>
            <div className="modal-panel" role="dialog" aria-modal="true" tabIndex={-1} style={{ width: 860, maxHeight:'85vh', overflow:'auto' }} onClick={e => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') setShowAutoPopulateModal(false); }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <div>
                  <h3 style={{ margin:'0 0 4px 0' }}>Auto-populated availability preview</h3>
                  <div style={{ fontSize:12, color:'var(--muted)' }}>
                    Review the generated blocks, edit them if needed, then apply them to the next save.
                  </div>
                </div>
                <button type="button" onClick={() => setShowAutoPopulateModal(false)}>✕</button>
              </div>

              <div style={{ marginTop:12, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button type="button" onClick={loadAvailabilityPreview} disabled={previewLoading}>
                  {previewLoading ? 'Refreshing…' : 'Refresh From Notes'}
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBlocks(prev => [...prev, {
                    id: `preview_${Math.random().toString(36).slice(2)}`,
                    start_iso: new Date().toISOString(),
                    end_iso: new Date(Date.now() + (60 * 60 * 1000)).toISOString()
                  }])}
                >
                  Add Block
                </button>
                {previewSummary && (
                  <div style={{ fontSize:12, color:'var(--muted)' }}>
                    Generated {previewSummary.count} blocks over the next {previewSummary.daysAhead} days using {previewSummary.timezone}.
                  </div>
                )}
              </div>

              {previewError && (
                <div style={{ marginTop:12, padding:10, border:'1px solid #b33', borderRadius:6, color:'#b33' }}>
                  {previewError}
                </div>
              )}

              <div style={{ marginTop:12, display:'grid', gap:10 }}>
                {previewBlocks.length === 0 && !previewLoading && !previewError && (
                  <div style={{ padding:12, border:'1px dashed var(--border)', borderRadius:6, color:'var(--muted)' }}>
                    No blocks were generated from the current notes. You can adjust the notes and refresh, or add blocks manually here.
                  </div>
                )}

                {previewBlocks.map((block, index) => (
                  <div key={block.id} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:8, alignItems:'end', border:'1px solid var(--border)', borderRadius:6, padding:10 }}>
                    <label style={{ display:'grid', gap:6 }}>
                      <span style={{ fontSize:12, color:'var(--muted)' }}>Start</span>
                      <input
                        type="datetime-local"
                        value={toLocalDateTimeValue(block.start_iso)}
                        onChange={(e) => {
                          const nextIso = fromLocalDateTimeValue(e.target.value);
                          if (!nextIso) return;
                          setPreviewBlocks(prev => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, start_iso: nextIso } : entry));
                        }}
                      />
                    </label>
                    <label style={{ display:'grid', gap:6 }}>
                      <span style={{ fontSize:12, color:'var(--muted)' }}>End</span>
                      <input
                        type="datetime-local"
                        value={toLocalDateTimeValue(block.end_iso)}
                        onChange={(e) => {
                          const nextIso = fromLocalDateTimeValue(e.target.value);
                          if (!nextIso) return;
                          setPreviewBlocks(prev => prev.map((entry, entryIndex) => entryIndex === index ? { ...entry, end_iso: nextIso } : entry));
                        }}
                      />
                    </label>
                    <button type="button" onClick={() => setPreviewBlocks(prev => prev.filter((_, entryIndex) => entryIndex !== index))}>Remove</button>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:16 }}>
                <button type="button" onClick={() => setShowAutoPopulateModal(false)}>Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    setPreviewBlocks(prev => normalizeEditableAvailabilityBlocks(prev));
                    setUsePreviewBlocks(true);
                    setShowAutoPopulateModal(false);
                  }}
                >
                  Apply These Blocks To Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
