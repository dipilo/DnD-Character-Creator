import React, { useEffect, useState } from 'react';
import { listCampaigns, createCampaign, createInvite, deleteInvite, updateCampaign, deleteCampaign, leaveCampaign, reorderCampaigns, listInvites, patchInvite, listMembers, updateMemberPermissions, regenerateCampaignCode } from '../api';

/* eslint-disable react/prop-types, sonarjs/cognitive-complexity */

const hasWindow = typeof globalThis.window === 'object';

const dedupeById = (arr) => {
  const seen = new Set();
  const out = [];
  for (const c of arr || []) {
    const id = c?.id;
    if (id == null || seen.has(id)) continue;
    seen.add(id);
    out.push(c);
  }
  return out;
};

const getOrigin = () => (hasWindow ? globalThis.window.location.origin : '');

const hideCampaignMenu = (campaignId) => {
  const menu = globalThis.document?.getElementById(`campaign-menu-${campaignId}`);
  if (menu) menu.style.display = 'none';
};

const toPermissionsObject = (permissions) => {
  if (permissions && typeof permissions === 'object') return permissions;
  if (!permissions) return {};
  try {
    return JSON.parse(permissions);
  } catch (error) {
    console.debug('permissions parse failed', error);
    return {};
  }
};

const normalizePlayersView = (value) => {
  if (value === undefined) return true;
  return value !== 'none' && value !== false;
};

async function copyTextToClipboard(text) {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    console.debug('clipboard write failed', error);
  }
  return false;
}

export default function CampaignManager({ userId, onSelectCampaign, selectedCampaignId = null, onCampaignsChanged = null }) {
  const [campaigns, setCampaigns] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isCurrentUserOwner, setIsCurrentUserOwner] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const dragIndexRef = React.useRef(null);
  const reqIdRef = React.useRef(0);
  const lastLoadRef = React.useRef(0);

  async function load() {
    // throttle to avoid tight loops in error/strict-mode; ignore loads <800ms apart
    const now = Date.now();
    if (now - lastLoadRef.current < 800) return;
    lastLoadRef.current = now;

    setLoading(true);
    setError(null);
    const myReqId = ++reqIdRef.current;
    try {
      if (!userId) throw new Error('not_authenticated: missing userId');
      const res = await listCampaigns(userId);
      // ignore out-of-order responses
      if (myReqId !== reqIdRef.current) return;
      if (res?.campaigns) setCampaigns(dedupeById(res.campaigns));
      // Do not call onCampaignsChanged unconditionally here — it can cause rendering loops.
      // If the parent needs notification, the parent should compare values or request an update.
    } catch (e) {
      console.error('listCampaigns failed', e);
      // show more friendly messages for common cases
      const msg = e?.message ? e.message : String(e);
      if (msg.includes('not_authenticated')) setError('Not authenticated. Please login to see campaigns.');
      else if (msg.includes('Network error')) setError('Network error contacting server. Is the backend running?');
      else setError(msg);
    } finally { setLoading(false); }
  }

  useEffect(()=>{
    let mounted = true;
    if (userId && mounted) load();
    return () => { mounted = false; };
  }, [userId]);

  async function handleCreate() {
    try {
      const res = await createCampaign({ name: name || 'New Campaign' }, userId);
      if (res?.campaign) {
        setCampaigns(prev => dedupeById([res.campaign, ...(prev||[])]));
        setName('');
      }
    } catch (e) { console.error('createCampaign failed', e); }
  }

  // Invite management modal state
  const [showInvitesModal, setShowInvitesModal] = useState(false);
  const [invitesList, setInvitesList] = useState([]);
  const [inviteEdit, setInviteEdit] = useState({});
  const [currentInvitesCampaignId, setCurrentInvitesCampaignId] = useState(null);
  const mergeInviteEdit = (inviteId, patch) => {
    setInviteEdit(prev => {
      const current = prev[inviteId];
      return {
        ...prev,
        [inviteId]: current ? { ...current, ...patch } : { ...patch }
      };
    });
  };

  async function openManageInvites(campId) {
    try {
      const res = await listInvites(campId, userId);
      if (!res?.invites) throw new Error('No invites');
      setInvitesList(res.invites);
      setCurrentInvitesCampaignId(campId);
      const drafts = {};
      res.invites.forEach(i => {
        drafts[i.id] = {
          token: i.token,
          max_uses: i.max_uses === null ? '' : String(i.max_uses || ''),
          expires_at: i.expires_at || '',
          challenge_enabled: !!i.challenge_enabled,
          challenge_min_score: String(i.challenge_min_score || 200)
        };
      });
      setInviteEdit(drafts);
      setShowInvitesModal(true);
    } catch (e) { alert('Open invites failed: ' + (e.message || e)); }
  }

  async function saveInviteEdit(campaignId, inviteId) {
    try {
      const draft = inviteEdit[inviteId];
      if (!draft) return;
      const body = {};
      if (draft.token !== undefined) body.token = draft.token || null;
      const maxUses = draft.max_uses;
      if (maxUses === '' || maxUses === '0' || maxUses === 0) body.max_uses = null;
      else if (maxUses != null) body.max_uses = Number.parseInt(maxUses, 10);
      body.expires_at = draft.expires_at === '' ? null : draft.expires_at;
      body.challenge_enabled = !!draft.challenge_enabled;
      const parsedMin = Number.parseInt(String(draft.challenge_min_score || '200'), 10);
      body.challenge_min_score = Number.isNaN(parsedMin) || parsedMin < 1 ? 200 : parsedMin;
      await patchInvite(inviteId, body, userId);
      const res = await listInvites(campaignId, userId);
      setInvitesList(res.invites || []);
      alert('Invite saved');
    } catch (e) { alert('Save invite failed: ' + (e.message || e)); }
  }

  async function handleRename(campaignId, newName) {
    try {
      const r = await updateCampaign(campaignId, { name: newName }, userId);
      if (r?.campaign) {
        setCampaigns(campaigns.map(c => c.id === campaignId ? r.campaign : c));
      }
    } catch (e) { console.error('rename failed', e); alert('Rename failed: ' + (e.message||e)); }
  }

  async function handleDelete(campaignId) {
    if (!confirm('Delete this campaign? This will remove it from the server.')) return;
    try {
      await deleteCampaign(campaignId, userId);
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
    } catch (e) { console.error('delete campaign failed', e); alert('Delete failed: ' + (e.message||e)); }
  }

  async function handleLeave(campaignId) {
    if (!confirm('Leave this campaign? You will no longer have access to it.')) return;
    try {
      await leaveCampaign(campaignId, userId);
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      alert('Left campaign successfully');
    } catch (e) { 
      console.error('leave campaign failed', e); 
      const errorMsg = e?.message || String(e);
      if (errorMsg.includes('owners_cannot_leave')) {
        alert('Campaign owners cannot leave. Please delete the campaign instead or transfer ownership first.');
      } else {
        alert('Leave failed: ' + errorMsg);
      }
    }
  }

  async function handleJoinByCampaignCode() {
    if (!joinCode.trim()) return;
    try {
      const code = joinCode.trim();
      // First try to get campaign info by code
      const response = await fetch((import.meta.env.VITE_API_BASE || 'http://localhost:3001') + `/api/campaigns/code/${encodeURIComponent(code)}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Campaign not found');
      }
      
      const result = await response.json();
      if (!result.campaign) {
        throw new Error('Campaign not found');
      }
      
      // Create a campaign member entry (join the campaign)
      const joinResponse = await fetch((import.meta.env.VITE_API_BASE || 'http://localhost:3001') + `/api/campaigns/${result.campaign.id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userId ? {'X-User-Id': userId} : {})
        },
        body: JSON.stringify({})
      });
      
      if (!joinResponse.ok) {
        const errorText = await joinResponse.text();
        throw new Error(errorText || 'Failed to join campaign');
      }
      
      // Success - reload campaigns and select the new one
      await load();
      setJoinCode('');
      if (onSelectCampaign) {
        onSelectCampaign(result.campaign);
      }
      alert(`Successfully joined "${result.campaign.name || result.campaign.id}"!`);
      
    } catch (e) {
      console.error('Join by code failed:', e);
      let errorMsg = e.message || 'Failed to join campaign';
      if (errorMsg.includes('not_authenticated')) {
        errorMsg = 'Please log in first to join a campaign';
      } else if (errorMsg.includes('already_member')) {
        errorMsg = 'You are already a member of this campaign';
      }
      alert('Join failed: ' + errorMsg);
    }
  }

  // Manage members modal state and helpers
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [membersList, setMembersList] = useState([]);
  const [memberEdit, setMemberEdit] = useState({});
  const mergeMemberEdit = (memberId, patch) => {
    setMemberEdit(prev => {
      const current = prev[memberId];
      return {
        ...prev,
        [memberId]: current ? { ...current, ...patch } : { ...patch }
      };
    });
  };
  const membersReadOnly = !isCurrentUserOwner;

  async function openManageMembers(campId) {
    try {
      const resp = await listMembers(campId, userId);
      if (!resp?.members) throw new Error('failed to load members');
      setMembersList(resp.members);
      // initialize memberEdit as objects with known permission keys
      const drafts = {};
      resp.members.forEach(m => {
        const raw = toPermissionsObject(m.permissions);
        // helper to robustly coerce stored permission values to boolean
        const truthy = (v) => (v === true || v === 'true' || v === 1 || v === '1');
        // map legacy short keys (can_unclaim, can_edit_self, can_create_invites) into canonical keys
        const perms = { ...raw };
        if (raw.can_unclaim) perms.players_self_delete = true;
        if (raw.can_edit_self) perms.players_self_edit = true;
        if (raw.can_create_invites) perms.invites_create = true;

        // initialize a complete canonical permissions draft so UI has consistent keys
        // Use the same sensible defaults as the rendering layer so uninitialized perms
        // are pre-checked where appropriate (self-view/edit, edit availability, etc.)
        drafts[m.id] = {
          // Campaign
          delete_campaign: !!perms.delete_campaign,
          rename_campaign: !!perms.rename_campaign,
          regenerate_code: !!perms.regenerate_code,
          // Invites (nested under Campaign)
          invites_create: !!perms.invites_create,
          invites_edit: !!perms.invites_edit,
          invites_delete: !!perms.invites_delete,
          // Players
          players_create: !!perms.players_create,
          // players_view: treat missing as true (can view); normalize to boolean
          players_view: normalizePlayersView(perms.players_view),
          players_edit: !!perms.players_edit,
          players_delete: !!perms.players_delete,
          // default to FALSE for editing availability when unspecified (only allow editing your own availability)
          players_edit_availability: (perms.players_edit_availability === undefined ? false : truthy(perms.players_edit_availability)),
          // Players -> self (nested under Players)
          players_self_view: (perms.players_self_view === undefined ? true : truthy(perms.players_self_view)),
          players_self_edit: (perms.players_self_edit === undefined ? true : truthy(perms.players_self_edit)),
          // default to TRUE so players can delete/unclaim their own record by default
          players_self_delete: (perms.players_self_delete === undefined ? true : truthy(perms.players_self_delete)),
          players_self_edit_availability: (perms.players_self_edit_availability === undefined ? true : truthy(perms.players_self_edit_availability)),
          // Groups
          groups_create: !!perms.groups_create,
          groups_view: !!perms.groups_view,
          groups_edit: !!perms.groups_edit,
          groups_delete: !!perms.groups_delete,
          // Groups -> self (nested under Groups)
          groups_self_view: (perms.groups_self_view === undefined ? true : truthy(perms.groups_self_view)),
          // self-edit OFF by default
          groups_self_edit: (perms.groups_self_edit === undefined ? false : truthy(perms.groups_self_edit)),
          groups_self_delete: (perms.groups_self_delete === undefined ? false : truthy(perms.groups_self_delete)),
          // Members
          members_manage: !!perms.members_manage
        };
      });
      setMemberEdit(drafts);
      // determine if current user is owner of this campaign
      try {
        const myMember = resp.members.find(x => String(x.user_id) === String(userId));
        setIsCurrentUserOwner(myMember?.role === 'owner');
      } catch (e) {
        console.debug('owner lookup failed', e);
        setIsCurrentUserOwner(false);
      }
      setShowMembersModal(true);
    } catch (e) {
      alert('Load members failed: ' + (e.message || e));
    }
  }

  async function saveMemberPermissions(campaignId, memberId) {
    try {
      const draft = memberEdit[memberId] || {};
      let parsed = {};
      if (typeof draft === 'object') parsed = draft;
      else {
        try { parsed = JSON.parse(draft); } catch (e) { alert('Invalid JSON: ' + e.message); return; }
      }
      await updateMemberPermissions(campaignId, memberId, parsed, userId);
      alert('Permissions updated');
      const resp = await listMembers(campaignId, userId);
      setMembersList(resp.members || []);
    } catch (e) {
      alert('Save failed: ' + (e.message || e));
    }
  }

  async function handleRegenerateCode(campaignId) {
    if (!confirm('Regenerate campaign code? This will change the short code for this campaign.')) return;
    try {
      const res = await regenerateCampaignCode(campaignId, userId);
      if (res?.campaign) {
        setCampaigns(prev => prev.map(x => x.id === campaignId ? res.campaign : x));
        alert('Campaign code rotated');
      }
    } catch (e) {
      alert('Regenerate failed: ' + (e.message || e));
    }
  }

  let campaignListContent = null;
  if (loading) {
    campaignListContent = <div>Loading...</div>;
  } else if (error) {
    campaignListContent = (
      <div style={{ padding:8 }}>
        <div style={{ color: 'var(--danger)' }}>Could not load campaigns: {error}</div>
        <div style={{ marginTop:8 }}><button onClick={load}>Retry</button></div>
      </div>
    );
  } else {
    campaignListContent = (
      <ul style={{ paddingLeft: 0, marginLeft: 0, listStyle: 'none', marginTop: 8 }}>
        {campaigns.map((c, idx) => (
          <li key={c.id}
            draggable
            onDragStart={(e) => {
              dragIndexRef.current = idx;
              try {
                e.dataTransfer.setData('text/plain', String(idx));
              } catch (error) {
                console.debug('drag dataTransfer set failed', error);
              }
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(e)=>{ e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e) => {
              e.preventDefault();
              const srcIdx = dragIndexRef.current ?? Number(e.dataTransfer.getData('text/plain'));
              const destIdx = idx;
              if (Number.isNaN(srcIdx) || srcIdx === destIdx) { dragIndexRef.current = null; return; }
              const arr = campaigns.slice();
              const [moved] = arr.splice(srcIdx, 1);
              arr.splice(destIdx, 0, moved);
              setCampaigns(arr);
              dragIndexRef.current = null;
              reorderCampaigns(arr.map(a => a.id), userId).catch((error) => {
                console.debug('reorderCampaigns failed', error);
              });
            }}
            style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="drag-handle" style={{ padding:6, userSelect:'none' }} title="Drag to reorder">☰</div>
            <div style={{ flex: 1 }}>
              <button onClick={() => onSelectCampaign(c)} style={{ marginRight: 8, background: (selectedCampaignId && selectedCampaignId === c.id) ? 'var(--accent)' : undefined, color: (selectedCampaignId && selectedCampaignId === c.id) ? 'var(--on-accent)' : undefined, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name || ''}</button>
            </div>
            <div style={{ width: 120, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
              {c.campaign_code ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>Code: {c.campaign_code}</div>
              ) : null}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <button onClick={() => {
                  const menu = globalThis.document?.getElementById('campaign-menu-' + c.id);
                  if (menu) menu.style.display = (menu.style.display === 'block') ? 'none' : 'block';
                }}>⋯</button>
                <div id={'campaign-menu-' + c.id} style={{ display: 'none', position: 'absolute', right: 0, background: 'var(--panel)', border: '1px solid var(--border)', padding: 6, zIndex: 1000 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => { const newName = prompt('Rename campaign', c.name || ''); if (newName !== null) { handleRename(c.id, newName); } hideCampaignMenu(c.id); }}>Rename</button>
                      <button onClick={() => { openManageInvites(c.id); hideCampaignMenu(c.id); }}>Invites</button>
                      { (c.owner_user_id && String(c.owner_user_id) === String(userId)) ? (
                        <button onClick={() => { openManageMembers(c.id); hideCampaignMenu(c.id); }}>Manage Members</button>
                      ) : null }
                      { (c.owner_user_id && String(c.owner_user_id) === String(userId)) ? (
                        <button onClick={async () => {
                          await handleRegenerateCode(c.id);
                          hideCampaignMenu(c.id);
                        }}>Regenerate code</button>
                      ) : null }
                      { (c.owner_user_id && String(c.owner_user_id) === String(userId)) ? (
                        <button onClick={() => { if (confirm('Delete this campaign?')) { handleDelete(c.id); } hideCampaignMenu(c.id); }}>Delete</button>
                      ) : (
                        <button onClick={() => { handleLeave(c.id); hideCampaignMenu(c.id); }}>Leave Campaign</button>
                      ) }
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div style={{ border: '1px solid var(--border)', padding: 12, borderRadius: 6, background: 'var(--panel)', color: 'var(--text)' }}>
      <h3>Campaigns</h3>
      {userId ? (
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input name="campaign_name" value={name} onChange={e=>setName(e.target.value)} placeholder="New campaign name" />
            <button onClick={handleCreate}>Create</button>
          </div>
          {campaignListContent}
            
            {/* Join Campaign by Code */}
            <div style={{ marginTop: 20, padding: 16, border: '2px dashed var(--border)', borderRadius: 8, background: 'var(--panel)' }}>
              <h4 style={{ margin: '0 0 12px 0', color: 'var(--accent)' }}>Join Campaign by Code</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                <input
                  placeholder="Enter campaign code"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  style={{ flex: 1, minWidth: '180px', padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border)' }}
                  onKeyDown={e => e.key === 'Enter' && handleJoinByCampaignCode()}
                />
                <button
                  onClick={handleJoinByCampaignCode}
                  disabled={!joinCode.trim()}
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--on-accent)',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: 4,
                    fontWeight: 600,
                    cursor: joinCode.trim() ? 'pointer' : 'not-allowed',
                    opacity: joinCode.trim() ? 1 : 0.5,
                    flexShrink: 0
                  }}
                >
                  Join
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                Ask the campaign owner for the campaign code to join without an invite link.
              </div>
            </div>
            
            {/* Manage Invites Modal */}
            {showInvitesModal && (
              <div className="modal-overlay">
                <div className="modal-panel" style={{ width: 720 }}>
                  <h3>Manage Invites</h3>
                  <div style={{ marginBottom: 8 }}>
                    <button onClick={() => { openManageInvites(campaigns?.[0]?.id); }}>Refresh</button>
                  </div>
                  <div style={{ marginBottom: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                    <h4 style={{ margin: '6px 0' }}>Create invite</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 180px 120px', gap: 8, alignItems: 'center' }}>
                      <input placeholder="Token (optional)" value={inviteEdit.__new_token || ''} onChange={e => setInviteEdit(prev => ({ ...prev, __new_token: e.target.value }))} />
                      <input placeholder="Max uses (empty or 0 = unlimited)" value={inviteEdit.__new_max_uses || ''} onChange={e => setInviteEdit(prev => ({ ...prev, __new_max_uses: e.target.value }))} />
                      <input placeholder="Expires at (ISO)" value={inviteEdit.__new_expires_at || ''} onChange={e => setInviteEdit(prev => ({ ...prev, __new_expires_at: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <button onClick={async () => {
                          try {
                            const body = {};
                            if (inviteEdit.__new_token) body.token = inviteEdit.__new_token;
                            const mu = inviteEdit.__new_max_uses;
                            if (mu === '' || mu === undefined || mu === null || String(mu) === '0') body.max_uses = null;
                            else body.max_uses = Number.parseInt(mu, 10);
                            if (inviteEdit.__new_expires_at) body.expires_at = inviteEdit.__new_expires_at;
                            body.challenge_enabled = !!inviteEdit.__new_challenge_enabled;
                            const parsedMinScore = Number.parseInt(String(inviteEdit.__new_challenge_min_score || '200'), 10);
                            body.challenge_min_score = Number.isNaN(parsedMinScore) || parsedMinScore < 1 ? 200 : parsedMinScore;
                            const inviteCampaignId = currentInvitesCampaignId || invitesList[0]?.campaign_id || campaigns?.[0]?.id;
                            const r = await createInvite(inviteCampaignId, body, userId);
                            if (r?.invite) {
                              alert('Invite created');
                              const refreshed = await listInvites(r.invite?.campaign_id || invitesList[0]?.campaign_id, userId);
                              setInvitesList(refreshed.invites || []);
                              // clear new fields
                              setInviteEdit(prev => ({
                                ...prev,
                                __new_token: '',
                                __new_max_uses: '',
                                __new_expires_at: '',
                                __new_challenge_enabled: false,
                                __new_challenge_min_score: '200'
                              }));
                            }
                          } catch (e) { alert('Create invite failed: ' + (e.message || e)); }
                        }}>Create</button>
                      </div>
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                      <label>
                        <input
                          type="checkbox"
                          checked={!!inviteEdit.__new_challenge_enabled}
                          onChange={e => setInviteEdit(prev => ({ ...prev, __new_challenge_enabled: e.target.checked }))}
                        />{' '}
                        Skill-gated signup (riddle + fake captcha + Zoople score)
                      </label>
                      <input
                        style={{ width: 190 }}
                        placeholder="Zoople score required"
                        value={inviteEdit.__new_challenge_min_score || '200'}
                        onChange={e => setInviteEdit(prev => ({ ...prev, __new_challenge_min_score: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div style={{ maxHeight: 420, overflow: 'auto' }}>
                    {invitesList.map(i => (
                      <div key={i.id} style={{ borderBottom: '1px solid var(--border)', padding: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontWeight: 700 }}>Token: {i.token}</div>
                            <button onClick={() => {
                              const url = getOrigin() + '/?invite=' + encodeURIComponent(i.token);
                              copyTextToClipboard(url).then((ok) => {
                                alert((ok ? 'Invite URL copied to clipboard:\n' : 'Copy failed — here is the URL:\n') + url);
                              });
                            }}>Copy</button>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                            Uses: {i.used_count}/{i.max_uses === null ? '∞' : (i.max_uses || '1')} Expires: {i.expires_at || 'never'}
                            {' · '}
                            Skill gate: {i.challenge_enabled ? `ON (Zoople ≥ ${i.challenge_min_score || 200})` : 'OFF'}
                          </div>
                          <div style={{ marginTop: 8 }}>
                            <label htmlFor={`invite-token-${i.id}`} style={{ display: 'block', fontSize: 12, marginBottom: 6 }}>Token</label>
                            <input id={`invite-token-${i.id}`} value={inviteEdit[i.id]?.token || ''} onChange={e => mergeInviteEdit(i.id, { token: e.target.value })} style={{ width: '100%' }} />
                            <label htmlFor={`invite-max-uses-${i.id}`} style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Max uses (empty = unlimited)</label>
                            <input id={`invite-max-uses-${i.id}`} value={inviteEdit[i.id]?.max_uses || ''} onChange={e => mergeInviteEdit(i.id, { max_uses: e.target.value })} style={{ width: '100%' }} />
                            <label htmlFor={`invite-expires-${i.id}`} style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Expires at (ISO or empty)</label>
                            <input id={`invite-expires-${i.id}`} value={inviteEdit[i.id]?.expires_at || ''} onChange={e => mergeInviteEdit(i.id, { expires_at: e.target.value })} style={{ width: '100%' }} />
                            <label style={{ display: 'block', fontSize: 12, marginTop: 8 }}>
                              <input
                                type="checkbox"
                                checked={!!inviteEdit[i.id]?.challenge_enabled}
                                onChange={e => mergeInviteEdit(i.id, { challenge_enabled: e.target.checked })}
                              />{' '}
                              Skill-gated signup enabled
                            </label>
                            <label htmlFor={`invite-min-score-${i.id}`} style={{ display: 'block', fontSize: 12, marginTop: 8 }}>Required Zoople score</label>
                            <input id={`invite-min-score-${i.id}`} value={inviteEdit[i.id]?.challenge_min_score || '200'} onChange={e => mergeInviteEdit(i.id, { challenge_min_score: e.target.value })} style={{ width: '100%' }} />
                            <div style={{ marginTop: 8 }}>
                              <div style={{ fontSize:12, color:'var(--muted)' }}>Leave Max uses empty or set to 0 for unlimited uses</div>
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button onClick={() => saveInviteEdit(i.campaign_id || invitesList[0]?.campaign_id, i.id)}>Save</button>
                          <button onClick={async () => {
                            if (!confirm('Delete invite?')) return;
                            try {
                              await deleteInvite(i.id, userId);
                              const refreshed = await listInvites(i.campaign_id || invitesList[0]?.campaign_id, userId);
                              setInvitesList(refreshed.invites || []);
                            } catch (e) { alert('Delete failed: ' + (e.message || e)); }
                          }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                    <button onClick={() => setShowInvitesModal(false)}>Close</button>
                  </div>
                </div>
              </div>
            )}
        </div>
      ) : <div>Login (Discord) to manage campaigns</div>}
      {/* Manage Members Modal */}
      {showMembersModal && (
        <div className="modal-overlay">
          <div className="modal-panel" style={{ width: 720 }}>
            <h3>Manage Members</h3>
            <div style={{ maxHeight: 400, overflow: 'auto' }}>
              {membersList.map(m => {
                const perms = toPermissionsObject(m.permissions);
                // helper to coerce common truthy values
                const truthy = v => (v === true || v === 'true' || v === 1 || v === '1');
                // build a complete default permission object coming from stored perms
                const defaults = {
                  delete_campaign: !!perms.delete_campaign,
                  rename_campaign: !!perms.rename_campaign,
                  regenerate_code: !!perms.regenerate_code,
                  invites_create: !!perms.invites_create,
                  invites_edit: !!perms.invites_edit,
                  invites_delete: !!perms.invites_delete,
                  players_create: !!perms.players_create,
                  // players_view default => true
                  players_view: normalizePlayersView(perms.players_view),
                  players_edit: !!perms.players_edit,
                  players_delete: !!perms.players_delete,
                  players_edit_availability: (perms.players_edit_availability === undefined ? true : truthy(perms.players_edit_availability)),
                  // Self permissions: default sensible values (view/edit/edit_availability = true, delete = false)
                  players_self_view: (perms.players_self_view === undefined ? true : truthy(perms.players_self_view)),
                  players_self_edit: (perms.players_self_edit === undefined ? true : truthy(perms.players_self_edit)),
                  players_self_delete: (perms.players_self_delete === undefined ? false : truthy(perms.players_self_delete)),
                  players_self_edit_availability: (perms.players_self_edit_availability === undefined ? true : truthy(perms.players_self_edit_availability)),
                  groups_create: !!perms.groups_create,
                  groups_view: !!perms.groups_view,
                  groups_edit: !!perms.groups_edit,
                  groups_delete: !!perms.groups_delete,
                  // Self group permissions default: view/edit = true, delete = false
                  groups_self_view: (perms.groups_self_view === undefined ? true : truthy(perms.groups_self_view)),
                  groups_self_edit: (perms.groups_self_edit === undefined ? true : truthy(perms.groups_self_edit)),
                  groups_self_delete: (perms.groups_self_delete === undefined ? false : truthy(perms.groups_self_delete)),
                  members_manage: !!perms.members_manage
                };
                // overlay any live edits from memberEdit so UI shows current draft state
                const draft = memberEdit[m.id] ? { ...defaults, ...memberEdit[m.id] } : defaults;
                return (
                  <div key={m.id} style={{ borderBottom: '1px solid var(--border)', padding: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{m.user_name || ('user #' + m.user_id || m.id)} {m.role ? <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>({m.role})</span> : null}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>Member id: {m.id} user_id: {m.user_id}</div>
                        <div style={{ marginTop: 8 }}>
                          {/* Campaign-level permissions */}
                          <details style={{ marginTop: 8 }}>
                            <summary style={{ fontWeight:700 }}>Campaign permissions</summary>
                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                              <label title="Allow deleting the campaign"><input type="checkbox" checked={!!draft.delete_campaign} onChange={e => mergeMemberEdit(m.id, { delete_campaign: e.target.checked })} /> Delete</label>
                              <label title="Allow renaming the campaign"><input type="checkbox" checked={!!draft.rename_campaign} onChange={e => mergeMemberEdit(m.id, { rename_campaign: e.target.checked })} /> Rename</label>
                              <label title="Allow regenerating the campaign short code"><input type="checkbox" checked={!!draft.regenerate_code} onChange={e => mergeMemberEdit(m.id, { regenerate_code: e.target.checked })} /> Regenerate Code</label>
                              <label title="Allow managing other members' roles & permissions"><input type="checkbox" checked={!!draft.members_manage} onChange={e => mergeMemberEdit(m.id, { members_manage: e.target.checked })} /> Manage members</label>
                            </div>

                            <details style={{ marginTop: 8, marginLeft: 8 }}>
                              <summary style={{ fontWeight:600 }}>Invite permissions</summary>
                              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                                <label title="Allow creating invites for this campaign"><input type="checkbox" checked={!!draft.invites_create} onChange={e => mergeMemberEdit(m.id, { invites_create: e.target.checked })} /> Create</label>
                                <label title="Allow editing existing invites"><input type="checkbox" checked={!!draft.invites_edit} onChange={e => mergeMemberEdit(m.id, { invites_edit: e.target.checked })} /> Edit</label>
                                <label title="Allow deleting invites"><input type="checkbox" checked={!!draft.invites_delete} onChange={e => mergeMemberEdit(m.id, { invites_delete: e.target.checked })} /> Delete</label>
                              </div>
                            </details>
                          </details>

                          {/* Player permissions (collapsible) */}
                          <details style={{ marginTop: 12 }}>
                            <summary style={{ fontWeight:700 }}>Player permissions</summary>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                              <label title="Allow creating player records for this campaign"><input type="checkbox" checked={draft.players_create || false} onChange={e => mergeMemberEdit(m.id, { players_create: e.target.checked })} /> Create</label>
                              <label title="Allow viewing player records"><input type="checkbox" checked={!!draft.players_view} onChange={e => mergeMemberEdit(m.id, { players_view: e.target.checked })} /> View</label>
                              <label title="Allow editing player records"><input type="checkbox" checked={draft.players_edit || false} onChange={e => mergeMemberEdit(m.id, { players_edit: e.target.checked })} /> Edit</label>
                              <label title="Allow deleting players"><input type="checkbox" checked={draft.players_delete || false} onChange={e => mergeMemberEdit(m.id, { players_delete: e.target.checked })} /> Delete</label>
                              <label title="Allow editing players' availability windows"><input type="checkbox" checked={draft.players_edit_availability || false} onChange={e => mergeMemberEdit(m.id, { players_edit_availability: e.target.checked })} /> Edit Availability</label>

                              <details style={{ marginTop: 12, width: '100%', marginLeft: 12 }}>
                                <summary style={{ fontWeight:600 }}>Self permissions (player)</summary>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                                  <label title="Allow viewing own player record"><input type="checkbox" checked={!!draft.players_self_view} onChange={e => mergeMemberEdit(m.id, { players_self_view: e.target.checked })} /> View</label>
                                  <label title="Allow editing own player record"><input type="checkbox" checked={!!draft.players_self_edit} onChange={e => mergeMemberEdit(m.id, { players_self_edit: e.target.checked })} /> Edit</label>
                                  <label title="Allow deleting own player record"><input type="checkbox" checked={!!draft.players_self_delete} onChange={e => mergeMemberEdit(m.id, { players_self_delete: e.target.checked })} /> Delete</label>
                                  <label title="Allow editing availability on own player record"><input type="checkbox" checked={!!draft.players_self_edit_availability} onChange={e => mergeMemberEdit(m.id, { players_self_edit_availability: e.target.checked })} /> Edit Availability</label>
                                </div>
                              </details>
                            </div>
                          </details>

                          {/* Group permissions (collapsible) */}
                          <details style={{ marginTop: 12 }}>
                            <summary style={{ fontWeight:700 }}>Group permissions</summary>
                            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                              <label title="Allow creating/managing groups"><input type="checkbox" checked={draft.groups_create || false} onChange={e => mergeMemberEdit(m.id, { groups_create: e.target.checked })} /> Create</label>
                              <label title="Allow seeing the Group Manager and group lists"><input type="checkbox" checked={draft.groups_view || false} onChange={e => mergeMemberEdit(m.id, { groups_view: e.target.checked })} /> View</label>
                              <label title="Allow editing group metadata and composition"><input type="checkbox" checked={draft.groups_edit || false} onChange={e => mergeMemberEdit(m.id, { groups_edit: e.target.checked })} /> Edit</label>
                              <label title="Allow deleting groups"><input type="checkbox" checked={draft.groups_delete || false} onChange={e => mergeMemberEdit(m.id, { groups_delete: e.target.checked })} /> Delete</label>

                              <details style={{ marginTop: 12, width: '100%', marginLeft: 12 }}>
                                <summary style={{ fontWeight:600 }}>Self group permissions</summary>
                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                                  <label title="Allow viewing groups this member is in"><input type="checkbox" checked={!!draft.groups_self_view} onChange={e => mergeMemberEdit(m.id, { groups_self_view: e.target.checked })} /> View</label>
                                  <label title="Allow editing groups this member is in"><input type="checkbox" checked={!!draft.groups_self_edit} onChange={e => mergeMemberEdit(m.id, { groups_self_edit: e.target.checked })} /> Edit</label>
                                  <label title="Allow leaving or deleting groups this member is in"><input type="checkbox" checked={!!draft.groups_self_delete} onChange={e => mergeMemberEdit(m.id, { groups_self_delete: e.target.checked })} /> Delete</label>
                                </div>
                              </details>
                            </div>
                          </details>

                          {/* Members manage handled under Campaign permissions above */}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button disabled={membersReadOnly} title={membersReadOnly ? 'Only campaign owners can update member permissions' : ''} onClick={() => saveMemberPermissions(m.campaign_id || membersList[0]?.campaign_id, m.id)}>Save</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                <button disabled={membersReadOnly} title={membersReadOnly ? 'Only campaign owners can update member permissions' : ''} onClick={async () => {
                  try {
                    const campaignId = membersList[0]?.campaign_id || null;
                    for (const mid of Object.keys(memberEdit)) {
                      const changes = memberEdit[mid];
                      await updateMemberPermissions(campaignId, Number.parseInt(mid, 10), changes, userId);
                    }
                    alert('Saved');
                    const resp = await listMembers(membersList[0]?.campaign_id || null, userId);
                    setMembersList(resp.members || []);
                    setShowMembersModal(false);
                  } catch (e) { alert('Save failed: ' + (e.message || e)); }
                }}>Save</button>
                <button onClick={() => setShowMembersModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
