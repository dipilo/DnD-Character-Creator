// client/src/components/GroupManager.jsx
/* eslint-disable react/prop-types */
import React, { useEffect, useState, useRef } from 'react';
import {
  fetchPlayers, fetchGroups, suggestGroups, saveSuggestedGroups,
  deleteGroup, updateGroup, fetchAggregates, reorderGroups, removeGroupMember
} from '../api';
import GroupHeatmap from './GroupHeatmap';

function uid() { return Math.random().toString(36).slice(2,9); }
function preventDefault(e) { e.preventDefault(); }
function movedOrFallback(x) { return x; }
function arrayOrEmpty(value) { return Array.isArray(value) ? value : []; }

function setDragTransferData(e, mimeType, value) {
  try {
    e.dataTransfer?.setData(mimeType, value);
  } catch (err) {
    console.warn('drag dataTransfer.setData failed', err);
  }
}

function clampIndex(index, length) {
  if (index < 0) return 0;
  if (index > length) return length;
  return index;
}

function reorderWithinSavedMembers(srcGroup, srcIdx, dstIdx) {
  const members = srcGroup.editingMembers.slice();
  if (srcIdx < 0 || srcIdx >= members.length) return null;
  const [member] = members.splice(srcIdx, 1);
  if (!member) return null;
  let adjusted = dstIdx;
  if (srcIdx < dstIdx) adjusted -= 1;
  members.splice(clampIndex(adjusted, members.length), 0, member);
  return members;
}

function reorderAcrossSavedMembers(srcGroup, destGroup, srcIdx, dstIdx) {
  const srcMembers = srcGroup.editingMembers.slice();
  if (srcIdx < 0 || srcIdx >= srcMembers.length) return null;
  const [member] = srcMembers.splice(srcIdx, 1);
  if (!member) return null;
  const destMembers = destGroup.editingMembers.slice();
  destMembers.splice(clampIndex(dstIdx, destMembers.length), 0, member);
  return { srcMembers, destMembers };
}

function reorderSavedMembers(prev, srcGid, destGid, srcIdx, dstIdx) {
  const copy = { ...prev };
  const srcG = copy[srcGid];
  const destG = copy[destGid];
  if (!srcG || !destG) return prev;

  if (srcGid === destGid) {
    const reordered = reorderWithinSavedMembers(srcG, srcIdx, dstIdx);
    if (!reordered) return prev;
    copy[srcGid] = { ...srcG, editingMembers: reordered };
    return copy;
  }

  const moved = reorderAcrossSavedMembers(srcG, destG, srcIdx, dstIdx);
  if (!moved) return prev;
  copy[srcGid] = { ...srcG, editingMembers: moved.srcMembers };
  copy[destGid] = { ...destG, editingMembers: moved.destMembers };

  return copy;
}

export default function GroupManager({ onGroupsUpdated, onSelectionChange, campaignId = null, userId = null, selfOnly = false, onRequestOpenFull = null }) {
  const [players, setPlayers] = useState([]);
  const [groups, setGroups] = useState([]); // saved groups from DB
  const [preview, setPreview] = useState([]); // suggested groups array
  const [params, setParams] = useState({ numGroups: 3, targetSize: 4, daysWindow: 14 });
  const [weights, setWeights] = useState({ availability: 2, timezone: 1, age: 0.2, computer: 0.5, vtt: 0.6, prefer_with: 1.5, prefer_not: -3, pref_party_size: 0.2, pref_session_length: 0.2 });
  const [loading, setLoading] = useState(false);
  const [leftover, setLeftover] = useState([]);
  const [metaCounts, setMetaCounts] = useState({}); // per-player availability counts (ms) returned by suggest meta
  const dragRef = useRef(null);

  // selection states
  const [selectedPreviewGroupIds, setSelectedPreviewGroupIds] = useState(new Set());
  const [selectedSavedGroupIds, setSelectedSavedGroupIds] = useState(new Set());

  // edit state for saved groups
  const [savedEdit, setSavedEdit] = useState({});

  useEffect(() => {
    reload();
  }, [campaignId, userId]);

  useEffect(()=> { computeSavedGroupScores(groups); }, [params.daysWindow]); // recompute on window change

  // If this component is asked to render in self-only mode, show a simplified
  // view tailored to the current user's groups (no suggestion controls, no editing).
  if (selfOnly) {
    // sort by score desc so most relevant groups appear first
    const sorted = (groups || []).slice().sort((a,b) => (b.score || 0) - (a.score || 0));
    const count = sorted.length;
    const groupCountText = count > 1 ? `${count} groups you belong to` : `${count} group you belong to`;
    return (
      <div style={{ padding:12 }}>
        <h3>Your groups</h3>
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: 'var(--muted)' }}>{count === 0 ? 'You are not a member of any groups in this campaign.' : groupCountText}</div>
        </div>
        {count === 0 ? null : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
            {sorted.map(g => {
              // find the player's id(s) that belong to this user within this group
              const myPlayers = (players || []).filter(p => {
                const claimed = p.claimed_user_id ?? p.user_id ?? p.userId ?? null;
                return claimed != null && String(claimed) === String(userId);
              });
              const myPlayerIds = myPlayers.map(p => p.id);
              return (
                <div key={g.id} style={{ border: '1px solid var(--border)', padding: 8, borderRadius: 6, background: 'var(--panel)', display:'flex', gap:12, alignItems:'center' }}>
                  <div style={{ width: 220, flexShrink: 0 }}>
                    <GroupHeatmap memberIds={(g.members||[]).map(m=>m.id)} days={params.daysWindow || 7} campaignId={campaignId} userId={userId} />
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight: 700 }}>{g.name || `Group ${g.id}`}</div>
                    <div style={{ fontSize:13, color:'var(--muted)', marginTop:6 }}>{(g.members||[]).map(m => m.name).join(', ')}</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, minWidth:140 }}>
                    {myPlayerIds.length > 0 ? (
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <select defaultValue={myPlayerIds[0]} onChange={()=>{}} style={{ flex:1 }}>
                          {myPlayers.map(p => <option key={p.id} value={p.id}>{p.name || p.discord || p.id}</option>)}
                        </select>
                        <button onClick={async (e) => {
                          e.stopPropagation();
                          const pid = Number(e.currentTarget.previousSibling?.value || myPlayerIds[0]);
                          if (!confirm('Leave this group?')) return;
                          try { setLoading(true); await removeGroupMember(g.id, pid, userId); await reload(); } catch (err){ alert('Leave failed: ' + (err.message || err)); console.error(err); } finally { setLoading(false); }
                        }}>Leave</button>
                      </div>
                    ) : (
                      <div style={{ color:'var(--muted)', fontSize:13 }}>No linked player</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  async function reload() {
    if (!campaignId) {
      setPlayers([]);
      setGroups([]);
      return;
    }
    const pls = await fetchPlayers({ campaignId, userId });
    const normalizedPlayers = Array.isArray(pls) ? pls : arrayOrEmpty(pls?.players);
    setPlayers(normalizedPlayers);
    const gs = await fetchGroups({ campaignId, userId });
    const normalizedGroups = Array.isArray(gs) ? gs : arrayOrEmpty(gs?.groups);
    // if this view is self-only, filter groups to those that include any player linked to current userId
    let visible = normalizedGroups;
    if (selfOnly && userId) {
      try {
        // server annotates players with `claimed_user_id`; fall back to legacy fields if present
        const myPlayerIds = normalizedPlayers.filter(p => {
          const claimed = p.claimed_user_id ?? p.user_id ?? p.userId ?? null;
          return claimed != null && String(claimed) === String(userId);
        }).map(p => p.id);
        if (myPlayerIds.length > 0) {
          visible = visible.filter(g => arrayOrEmpty(g.members).some(m => myPlayerIds.includes(m.id)));
        } else {
          // no linked players for this user — show none
          visible = [];
        }
      } catch (err) { console.warn('selfOnly filtering failed', err); }
    }
    const withScore = (visible || []).map(g => ({ ...g, score: 0 }));
    setGroups(withScore);
    computeSavedGroupScores(withScore);
  }

  function computeScoreForMemberIds(memberIds = []) {
    if (!Array.isArray(memberIds) || memberIds.length === 0) return 0;
    let sumMs = 0;
    for (const id of memberIds) {
      const key = id in metaCounts ? id : String(id);
      sumMs += Number(metaCounts[key] || 0);
    }
    const hours = sumMs / 3600000;
    return Math.round(hours * 10) / 10;
  }

  async function computeSavedGroupScores(groupsArr = null) {
    const arr = Array.isArray(groupsArr) ? groupsArr : groups;
    if (!Array.isArray(arr) || arr.length === 0) return;

    const keys = Object.keys(metaCounts||{});
    if (keys.length > 0) {
      const next = arr.map(g => {
        const ids = (g.members||[]).map(m => m.id);
        return { ...g, score: computeScoreForMemberIds(ids) };
      });
      setGroups(next);
      return;
    }

    const start = new Date().toISOString();
    const end = new Date(Date.now() + (params.daysWindow||14)*24*3600*1000).toISOString();

    const promises = arr.map(async (g) => {
      const ids = (g.members||[]).map(m => m.id);
      if (ids.length === 0) return { id: g.id, score: 0 };
      try {
        const res = await fetchAggregates(start, end, ids, { campaignId, userId });
        if (res && Array.isArray(res.intervals)) {
          let sumMs = 0;
          for (const iv of res.intervals) {
            const s = new Date(iv.start).getTime();
            const e = new Date(iv.end).getTime();
            const dur = Math.max(0, e - s);
            const count = Array.isArray(iv.player_ids) ? iv.player_ids.length : (iv.count || 0);
            sumMs += dur * (count || 0);
          }
          const hours = Math.round((sumMs / 3600000) * 10) / 10;
          return { id: g.id, score: hours };
        }
      } catch (err) {
        console.warn('score compute failed for group', g.id, err);
      }
      return { id: g.id, score: 0 };
    });

    const results = await Promise.all(promises);
    const map = {};
    results.forEach(r => map[r.id] = r.score);
    const next = arr.map(g => ({ ...g, score: map[g.id] || 0 }));
    setGroups(next);
  }

  async function runSuggest() {
    setLoading(true);
    try {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + (params.daysWindow || 14) * 24 * 3600 * 1000).toISOString();
      const body = { numGroups: params.numGroups, targetSize: params.targetSize, window: { start, end }, weights, campaign_id: campaignId };
      const r = await suggestGroups(body);
      if (r?.groups) {
        const pre = r.groups.map(g => {
          const members = (g.members || []).map(m => ({ ...m }));
          const ids = members.map(m => m.id);
          return { id: uid(), name: g.name || '', members, score: computeScoreForMemberIds(ids) || (g.score || 0) };
        });
        setPreview(pre);
        setLeftover(r.leftover || []);
        setMetaCounts(r.meta?.counts || {});
        setSelectedPreviewGroupIds(new Set(pre.map(p => p.id)));
        emitSelection(pre, groups, new Set(pre.map(p => p.id)), selectedSavedGroupIds);
        computeSavedGroupScores(groups);
      }
    } catch (e) {
      alert('Suggest failed: ' + (e.message || e));
      console.error('Suggest error', e);
    } finally {
      setLoading(false);
    }
  }

  // ---------- drag / reorder for preview groups (unchanged) ----------
  function onGroupDragStart(e, srcIdx) {
    dragRef.current = { type: 'group-preview', srcIdx };
    setDragTransferData(e, 'text/plain', 'group-preview');
  }
  function onGroupDrop(e, destIdx) {
    e.preventDefault();
    const info = dragRef.current;
    if (info?.type !== 'group-preview') return;
    const next = preview.slice();
    const [m] = next.splice(info.srcIdx, 1);
    next.splice(destIdx, 0, movedOrFallback(m));
    setPreview(next);
    dragRef.current = null;
    emitSelection(next, groups, selectedPreviewGroupIds, selectedSavedGroupIds);
  }
  // ---------- saved-group reorder (persisted) ----------
  function onSavedGroupDragStart(e, srcIdx) {
    dragRef.current = { type: 'group-saved', srcIdx };
    setDragTransferData(e, 'text/plain', 'group-saved');
  }
  async function onSavedGroupDrop(e, destIdx) {
    e.preventDefault();
    const info = dragRef.current;
    if (info?.type !== 'group-saved') return;
    const next = groups.slice();
    const [moved] = next.splice(info.srcIdx, 1);
    next.splice(destIdx, 0, moved);
    setGroups(next);
    dragRef.current = null;
    emitSelection(preview, next, selectedPreviewGroupIds, selectedSavedGroupIds);

    // persist order to server
    try {
      await reorderGroups(next.map(g => g.id));
    } catch (err) {
      console.error('Failed to persist group reorder', err);
    }
  }
  // ---------- member drag for preview groups ----------
  function onMemberDragStart(e, srcGroupIdx, srcMemberIdx) {
    dragRef.current = { type: 'member-preview', srcGroupIdx, srcMemberIdx };
    setDragTransferData(e, 'text/plain', 'member-preview');
  }
  function onMemberDropOnGroup(e, destGroupIdx) {
    e.preventDefault();
    const info = dragRef.current;
    if (info?.type !== 'member-preview') return;
    const next = preview.slice().map(g => ({ ...g, members: g.members.slice() }));
    const [m] = next[info.srcGroupIdx].members.splice(info.srcMemberIdx, 1);
    next[destGroupIdx].members.push(m);
    next[info.srcGroupIdx] = { ...next[info.srcGroupIdx], score: computeScoreForMemberIds(next[info.srcGroupIdx].members.map(x=>x.id)) };
    next[destGroupIdx] = { ...next[destGroupIdx], score: computeScoreForMemberIds(next[destGroupIdx].members.map(x=>x.id)) };
    setPreview(next);
    dragRef.current = null;
    emitSelection(next, groups, selectedPreviewGroupIds, selectedSavedGroupIds);
  }
  function onMemberDropOnMember(e, destGroupIdx, destMemberIdx) {
    e.preventDefault();
    const info = dragRef.current;
    if (info?.type !== 'member-preview') return;
    const next = preview.slice().map(g => ({ ...g, members: g.members.slice() }));
    const [m] = next[info.srcGroupIdx].members.splice(info.srcMemberIdx, 1);
    let adjustedDest = destMemberIdx;
    if (info.srcGroupIdx === destGroupIdx && info.srcMemberIdx < destMemberIdx) adjustedDest = destMemberIdx - 1;
    next[destGroupIdx].members.splice(adjustedDest, 0, m);
    next[info.srcGroupIdx] = { ...next[info.srcGroupIdx], score: computeScoreForMemberIds(next[info.srcGroupIdx].members.map(x=>x.id)) };
    next[destGroupIdx] = { ...next[destGroupIdx], score: computeScoreForMemberIds(next[destGroupIdx].members.map(x=>x.id)) };
    setPreview(next);
    dragRef.current = null;
    emitSelection(next, groups, selectedPreviewGroupIds, selectedSavedGroupIds);
  }
// ---------- saved-group member drag/drop (edit mode) ----------
function onSavedMemberDragStart(e, gid, idx) {
  // store gid as string (object keys are strings in savedEdit) and ensure idx is numeric
  const payload = { gid: String(gid), idx: Number(idx) };
  dragRef.current = { type: 'saved-member', ...payload };
  setDragTransferData(e, 'application/json', JSON.stringify(payload));
}

function onSavedMemberDrop(e, gid, destIdx) {
  e.preventDefault();

  // prefer dragRef but fall back to dataTransfer payload
  let info = dragRef.current;
  if (info?.type !== 'saved-member') {
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        info = { type: 'saved-member', gid: String(parsed.gid), idx: Number(parsed.idx) };
      }
    } catch (err) {
      console.warn('failed to parse saved-member drag payload', err);
    }
  }
  if (info?.type !== 'saved-member') return;

  const srcGid = String(info.gid);
  const destGid = String(gid);
  const srcIdx = Number(info.idx);
  const dstIdx = Number(destIdx);

  setSavedEdit(prev => reorderSavedMembers(prev, srcGid, destGid, srcIdx, dstIdx));

  dragRef.current = null;
}

  // ---------- selection emitter (accept explicit sets to avoid stale state) ----------
  function emitSelection(previewArray = preview, savedArray = groups, selPreview = null, selSaved = null) {
    if (typeof onSelectionChange !== 'function') return;
    const previewSet = selPreview instanceof Set ? selPreview : selectedPreviewGroupIds;
    const savedSet = selSaved instanceof Set ? selSaved : selectedSavedGroupIds;

    const previewMembers = (Array.isArray(previewArray) ? previewArray : []).filter(g => previewSet.has(g.id)).reduce((acc,g) => acc.concat((g.members||[]).map(m => m.id)), []);
    const savedMembers = (Array.isArray(savedArray) ? savedArray : []).filter(g => savedSet.has(g.id)).reduce((acc,g) => acc.concat((g.members||[]).map(m => m.id)), []);
    const all = Array.from(new Set([].concat(previewMembers, savedMembers)));
    if (all.length === 0) return onSelectionChange(null);
    return onSelectionChange(all);
  }

  function togglePreviewSelection(groupId) {
    const next = new Set(selectedPreviewGroupIds);
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
    setSelectedPreviewGroupIds(next);
    emitSelection(preview, groups, next, selectedSavedGroupIds);
  }

  function toggleSavedSelection(groupId) {
    const next = new Set(selectedSavedGroupIds);
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
    setSelectedSavedGroupIds(next);
    // pass the freshly computed set so emitSelection doesn't read the stale state
    emitSelection(preview, groups, selectedPreviewGroupIds, next);
  }

  // ---------- preview helpers ----------
  function removeMemberFromPreview(groupIndex, memberIndex) {
    const next = preview.slice();
    next[groupIndex] = { ...next[groupIndex], members: next[groupIndex].members.slice() };
    next[groupIndex].members.splice(memberIndex, 1);
    next[groupIndex].score = computeScoreForMemberIds(next[groupIndex].members.map(m => m.id));
    setPreview(next);
    emitSelection(next, groups, selectedPreviewGroupIds, selectedSavedGroupIds);
  }
  function addPlayerToGroupFromLeftover(groupIndex, player) {
    const next = preview.slice();
    next[groupIndex] = { ...next[groupIndex], members: next[groupIndex].members.slice() };
    next[groupIndex].members.push(player);
    next[groupIndex].score = computeScoreForMemberIds(next[groupIndex].members.map(m => m.id));
    setLeftover(leftover.filter(p => p.id !== player.id));
    setPreview(next);
    emitSelection(next, groups, selectedPreviewGroupIds, selectedSavedGroupIds);
  }

  function createManualPreviewGroup() {
    const g = { id: uid(), name: `Manual ${preview.length+1}`, members: [], score: 0 };
    const next = preview.concat([g]);
    setPreview(next);
    const sel = new Set(selectedPreviewGroupIds);
    sel.add(g.id);
    setSelectedPreviewGroupIds(sel);
    emitSelection(next, groups, sel, selectedSavedGroupIds);
  }

  async function savePreviewToDb() {
    if (!confirm('Save selected suggested groups into the DB? This will create groups and members.')) return;
    try {
      const toSave = preview.filter(g => selectedPreviewGroupIds.has(g.id));
      if (toSave.length === 0) {
        alert('No preview groups selected to save.');
        return;
      }
      if (!campaignId) { alert('Please select a campaign before saving groups.'); return; }
  const localUserId = globalThis.window?.localStorage?.getItem('userId') || null;
  if (!localUserId) { alert('Please log in to save groups.'); return; }
      const payload = { groups: toSave.map((g, i) => ({ name: g.name || `Suggested ${i+1}`, member_ids: (g.members||[]).map(m => m.id) })), campaign_id: campaignId };
  const r = await saveSuggestedGroups(payload, localUserId);
      if (r?.created) {
        alert(`Created ${r.created.length} groups.`);
        if (typeof onGroupsUpdated === 'function') onGroupsUpdated();
        await reload();
        setPreview([]);
        setSelectedPreviewGroupIds(new Set());
        setSelectedSavedGroupIds(new Set());
        if (typeof onSelectionChange === 'function') onSelectionChange(null);
      }
    } catch (e) {
      alert('Save failed: ' + (e.message || e));
      console.error('savePreviewToDb error', e);
    }
  }

  // ---------- saved group editing ----------
  function startEditSavedGroup(gid, name, members) {
    setSavedEdit(prev => ({ ...prev, [gid]: { editingName: name || '', editingMembers: (members||[]).map(m => ({ ...m })) } }));
  }
  function savedRemoveMember(gid, idx) {
    setSavedEdit(prev => {
      const copy = { ...prev };
      if (!copy[gid]) return prev;
      const members = copy[gid].editingMembers.slice();
      members.splice(idx, 1);
      copy[gid] = { ...copy[gid], editingMembers: members };
      return copy;
    });
  }
  function savedAddMember(gid, playerObj) {
    setSavedEdit(prev => {
      const copy = { ...prev };
      if (!copy[gid]) return prev;
      const members = copy[gid].editingMembers.slice();
      if (!members.some(m=>m.id === playerObj.id)) members.push(playerObj);
      copy[gid] = { ...copy[gid], editingMembers: members };
      return copy;
    });
  }
  async function saveEditSavedGroup(gid) {
    const data = savedEdit[gid];
    if (!data) return;
    try {
      const member_ids = (data.editingMembers || []).map(m => m.id);
  await updateGroup(gid, { name: data.editingName, member_ids }, userId);
      setSavedEdit(prev => { const c = { ...prev }; delete c[gid]; return c; });
      await reload();
    } catch (e) {
      alert('Update failed: ' + (e.message || e));
      console.error('saveEditSavedGroup error', e);
    }
  }
  async function handleDeleteSavedGroup(gid) {
    if (!confirm('Delete this group?')) return;
    try {
  await deleteGroup(gid, userId);
      await reload();
      setSelectedSavedGroupIds(prev => { const s = new Set(prev); s.delete(gid); return s; });
      emitSelection(preview, groups, selectedPreviewGroupIds, selectedSavedGroupIds);
    } catch (e) {
      alert('Delete failed: ' + (e.message || e));
      console.error('handleDeleteSavedGroup error', e);
    }
  }

  return (
    <div style={{ padding:12 }}>
      <h3>Group Manager</h3>

      {selfOnly && (
        <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.03)', border: '1px solid var(--border)', borderRadius: 6 }}>
          <div style={{ fontWeight: 700 }}>Showing only groups you are a member of</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>You don't have permission to view or manage other groups in this campaign.</div>
        </div>
      )}

      {!selfOnly && (
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
        <div>
          <label htmlFor="num-groups-input">Number of groups</label><br/>
          <input id="num-groups-input" type="number" value={params.numGroups} onChange={e=>setParams(p=>({...p,numGroups:Math.max(1,Number(e.target.value)||1)}))} style={{width:80}} />
        </div>
        <div>
          <label htmlFor="target-size-input">Target size</label><br/>
          <input id="target-size-input" type="number" value={params.targetSize} onChange={e=>setParams(p=>({...p,targetSize:Math.max(1,Number(e.target.value)||1)}))} style={{width:80}} />
        </div>
        <div>
          <label htmlFor="window-days-input">Window (days)</label><br/>
          <input id="window-days-input" type="number" value={params.daysWindow} onChange={e=>setParams(p=>({...p,daysWindow:Math.max(1,Number(e.target.value)||1)}))} style={{width:80}} />
        </div>
          <div>
            <button onClick={runSuggest} disabled={loading}>{loading ? 'Suggesting...' : 'Suggest groups'}</button>
          </div>
          <div>
            <button onClick={createManualPreviewGroup}>Create group</button>
          </div>
          <div>
            <button onClick={savePreviewToDb} disabled={preview.length===0}>Save selected preview groups</button>
          </div>
        </div>
      )}

      <div style={{ marginTop:12 }}>
        <details>
          <summary>Weights (tune suggestion)</summary>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginTop:8 }}>
            {Object.keys(weights).map(k => (
              <div key={k}>
                <label style={{ fontSize:12 }}>{k} ({weights[k]})</label>
                <input type="range" min={k==='prefer_not' ? -5 : 0} max={5} step={0.1} value={weights[k]} onChange={e => setWeights(w=>({...w,[k]: Number(e.target.value)}))} />
              </div>
            ))}
          </div>
        </details>
      </div>

      <div style={{ marginTop:12, display:'flex', gap:16, alignItems:'flex-start' }}>
        <div style={{ minWidth:300 }}>
          <h4>Leftover / unassigned</h4>
          <div style={{ maxHeight:420, overflow:'auto', border:'1px solid var(--border)', padding:8, background:'var(--panel)' }}>
            {leftover.map(p => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:6, borderBottom:'1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight:700 }}>{p.name}</div>
                  <div style={{ fontSize:12, color:'var(--muted)' }}>{p.discord}</div>
                  {p.zero_availability && <div style={{ color:'crimson', fontSize:12 }}>⚠️ No availability in window</div>}
                </div>
                <div>
                  <button onClick={()=> {
                    if (preview.length===0) return;
                    addPlayerToGroupFromLeftover(0, p);
                  }}>Add to group</button>
                </div>
              </div>
            ))}
          </div>

          <h4 style={{ marginTop:12 }}>Saved groups (DB)</h4>
          <div style={{ maxHeight:260, overflow:'auto', border:'1px solid var(--border)', padding:6, background:'var(--panel)' }}>
            {groups.map((g, idx) => {
              const editing = savedEdit[g.id];
              return (
                <div // NOSONAR drag/drop container for saved group reorder
                  key={g.id}
                  onDragOver={preventDefault}
                  onDrop={(e)=> onSavedGroupDrop(e, idx)}
                  style={{ padding:6, borderBottom:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:6 }}
                >
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <input type="checkbox" checked={selectedSavedGroupIds.has(g.id)} onChange={()=>toggleSavedSelection(g.id)} />
                      { editing ? (
                        <input value={editing.editingName} onChange={e=> setSavedEdit(prev => ({ ...prev, [g.id]: { ...prev[g.id], editingName: e.target.value } }))} />
                      ) : (
                        <div style={{ fontWeight:700 }}>
                          {g.name || `Group ${g.id}`} <span style={{ fontSize:12, color:'var(--muted)', marginLeft:8 }}>({g.score ?? 0} hrs)</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      {/* saved group drag handle */}
                      {!selfOnly && (
                        <>
                          <button
                            type="button"
                            draggable
                            onDragStart={(e)=> onSavedGroupDragStart(e, idx)}
                            title="Drag to reorder saved groups"
                            style={{ cursor:'grab', padding:'6px', borderRadius:6, background:'var(--panel)' }}
                          >
                            ≡
                          </button>

                          { editing ? (
                            <>
                              <button onClick={()=> saveEditSavedGroup(g.id)}>Save</button>
                              <button onClick={()=> setSavedEdit(prev => { const c = {...prev}; delete c[g.id]; return c; })}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={()=> startEditSavedGroup(g.id, g.name, g.members)}>Edit</button>
                              <button onClick={()=> handleDeleteSavedGroup(g.id)}>Delete</button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  { editing ? (
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <div style={{ fontSize:12, color:'var(--muted)' }}>Members (drag to reorder)</div>
                      {(editing.editingMembers||[]).map((m, idx2)=>(
                        <div // NOSONAR drag/drop row container for saved member reorder
                          key={m.id}
                          draggable
                          onDragStart={(e)=> onSavedMemberDragStart(e, g.id, idx2)}
                          onDragOver={(e)=> e.preventDefault()}
                          onDrop={(e)=> onSavedMemberDrop(e, g.id, idx2)}
                          style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:6, border:'1px solid #eee' }}
                        >
                          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                            <span style={{ cursor:'grab', padding:'4px 6px', borderRadius:4, background:'var(--panel)', border:'1px solid var(--border)' }}>⋮</span>
                            <div>{m.name}</div>
                          </div>
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={()=> savedRemoveMember(g.id, idx2)}>Remove</button>
                          </div>
                        </div>
                      ))}
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <select defaultValue="" onChange={(e)=> {
                          const pid = Number(e.target.value);
                          if (!pid) return;
                          const p = players.find(x=>x.id === pid);
                          if (p) savedAddMember(g.id, p);
                          e.currentTarget.value = '';
                        }}>
                          <option value="">-- add player --</option>
                          {players.filter(p => !arrayOrEmpty(editing.editingMembers).some(m=>m.id===p.id)).map(p => (
                            <option key={p.id} value={p.id}>{p.name || p.discord || p.id}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize:13, marginTop:4 }}>{(g.members||[]).map(m => m.name).join(', ')}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Preview + reordering */}
        <div style={{ flex:1 }}>
          <h4>Preview suggested groups</h4>

          <div style={{ display:'flex', gap:12, alignItems:'flex-start', overflowX:'auto', paddingBottom:8 }}>
            {preview.map((g, gi) => (
              <div // NOSONAR drag/drop container for preview group reorder
                key={g.id}
                onDragOver={preventDefault}
                onDrop={(e)=> onGroupDrop(e, gi)}
                style={{ minWidth:300, border:'1px solid var(--border)', padding:8, borderRadius:6, background:'var(--panel)', position:'relative', display:'flex', flexDirection:'column' }}>

                {/* group header with drag handle */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <input type="checkbox" checked={selectedPreviewGroupIds.has(g.id)} onChange={()=>togglePreviewSelection(g.id)} />
                    <div style={{ fontWeight:700 }}>{g.name || `Group ${gi+1}`}</div>
                  </div>

                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <div style={{ fontSize:12, color:'var(--muted)', marginRight:6 }}>score: {g.score ?? 0}</div>
                    {/* group drag handle */}
                    <button
                      type="button"
                      draggable
                      onDragStart={(e)=> onGroupDragStart(e, gi)}
                      title="Drag to reorder groups"
                      style={{ cursor:'grab', padding:'6px', borderRadius:6, background:'var(--panel)' }}
                    >
                      ☰
                    </button>
                  </div>
                </div>

                <div style={{ marginTop:8, flex:1 }}>
                  {/* members — each member has a drag handle for reordering */}
                  {(g.members || []).map((m, mi) => (
                    <div // NOSONAR drag/drop row container for preview member reorder
                      key={m.id}
                      onDragOver={preventDefault}
                      onDrop={(e)=> onMemberDropOnMember(e, gi, mi)}
                      style={{ padding:6, border:'1px solid var(--border)', marginBottom:6, background: 'var(--panel)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        {/* member drag handle */}
                        <button
                          type="button"
                          draggable
                          onDragStart={(e)=> onMemberDragStart(e, gi, mi)}
                          title="Drag to reorder member"
                          style={{ cursor:'grab', padding:'4px', borderRadius:4, background:'var(--panel)', border:'1px solid var(--border)' }}
                        >
                          ⋮
                        </button>

                        <div>
                          <div style={{ fontWeight:700 }}>{m.name}</div>
                          <div style={{ fontSize:12, color:'var(--muted)' }}>{m.discord}</div>
                          {m.zero_availability && <div style={{ color:'crimson', fontSize:11 }}>⚠️ zero availability</div>}
                        </div>
                      </div>

                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={(e) => { e.stopPropagation(); removeMemberFromPreview(gi, mi); }}>Remove</button>
                      </div>
                    </div>
                  ))}

                  {/* drop target for appending members to this group */}
                  <div // NOSONAR drag/drop target for appending member
                    onDragOver={preventDefault}
                    onDrop={(e)=> onMemberDropOnGroup(e, gi)}
                    style={{ padding:8, border:'1px dashed var(--border)', borderRadius:6, textAlign:'center', color:'var(--muted)' }}
                  >
                    Drop here to move member to end
                  </div>

                  <div style={{ display:'flex', gap:8, marginTop:6 }}>
                    <select defaultValue="" onChange={(e)=> {
                      const pid = Number(e.target.value);
                      if (!pid) return;
                      const p = players.find(x=>x.id === pid);
                      if (p) addPlayerToGroupFromLeftover(gi, p);
                      e.currentTarget.value = '';
                    }}>
                      <option value="">-- add player --</option>
                      {players.filter(p => !arrayOrEmpty(g.members).some(m=>m.id===p.id)).map(p => (
                        <option key={p.id} value={p.id}>{p.name || p.discord || p.id}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ marginTop:8 }}>
                  <div style={{ fontSize:13, color:'var(--muted)', marginBottom:6 }}>Shared availability (heatmap)</div>
                  <div style={{ width:'100%', maxHeight:160, overflow:'auto', borderRadius:4 }}>
                    <GroupHeatmap memberIds={(g.members||[]).map(m=>m.id)} days={params.daysWindow || 7} campaignId={campaignId} userId={userId} />
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

    </div>
  );
}

