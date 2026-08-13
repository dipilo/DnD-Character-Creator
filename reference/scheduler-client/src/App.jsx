/* eslint-disable react/prop-types */
/* eslint-disable sonarjs/cognitive-complexity */
import React, { useEffect, useState } from 'react';
import PlayerList from './components/PlayerList';
import AvailabilityCalendar from './components/AvailabilityCalendar';
import AggregateCalendar from './components/AggregateCalendar';
import ColorManager from './components/ColorManager';
import PlayerEditor from './components/PlayerEditor';
import GroupManager from './components/GroupManager';
import CampaignManager from './components/CampaignManager';
import { fetchPlayers, pushToSheet, syncSheet, fetchSheetColumns, createPlayer, deletePlayer, reorderPlayers, joinWithInvite, getInvitePreview, listUnclaimedPlayers, confirmDiscordLink, API_BASE, waitForServerReady, isServerHealthy, listCampaigns, fetchInviteChallenge, completeInviteChallenge } from './api';
import ClaimModal from './components/ClaimModal';
import AuthModal from './components/AuthModal';
import WakeOverlay from './components/WakeOverlay';

function MainPanel({
  calendarMode,
  setCalendarMode,
  setShowColorManager,
  viewTZ,
  setViewTZ,
  selectedPlayer,
  groupFilterMemberIds,
  campaign,
  userId,
  canViewGroups,
  groupManagerSelfOnly,
  loadPlayers,
  setGroupFilterMemberIds,
  openFullGroupManager,
  groupManagerRef
}) {
  let calendarTitle = 'Aggregate availability';
  if (calendarMode === 'single') {
    calendarTitle = selectedPlayer ? `Availability — ${selectedPlayer.name}` : 'Availability';
  }

  let calendarContent = <AggregateCalendar viewTimeZone={viewTZ} memberFilter={groupFilterMemberIds} campaignId={campaign?.id} userId={userId} />;
  if (calendarMode === 'single') {
    calendarContent = selectedPlayer
      ? <AvailabilityCalendar player={selectedPlayer} viewTimeZone={viewTZ} groupMemberFilter={groupFilterMemberIds} campaignId={campaign?.id} userId={userId} />
      : <div style={{padding:12, color:'var(--muted)'}}>Select a campaign and player from the list to view and edit their availability.</div>;
  }

  return (
    <div className="main">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button onClick={()=> setCalendarMode((previousMode) => (previousMode === 'single' ? 'aggregate' : 'single'))}>
            Switch Calendar Mode
          </button>
          <button onClick={()=> setShowColorManager(true)}>Edit palette</button>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <label htmlFor="view-timezone-select" style={{fontSize:13, color:'var(--muted)'}}>View timezone</label>
          <select id="view-timezone-select" value={viewTZ} onChange={event=> setViewTZ(event.target.value)} style={{padding:6, borderRadius:6}}>
            {TIMEZONE_OPTIONS.map((timezoneOption) => <option key={timezoneOption.value} value={timezoneOption.value}>{timezoneOption.label}</option>)}
          </select>
        </div>
      </div>
      <h2>{calendarTitle}</h2>
      {calendarContent}
      <div style={{ marginTop: 14 }}>
        {canViewGroups ? (
          <div>
            <GroupManager
              campaignId={campaign?.id}
              userId={userId}
              selfOnly={groupManagerSelfOnly}
              onGroupsUpdated={loadPlayers}
              onSelectionChange={ (memberIds) => setGroupFilterMemberIds(memberIds) }
              onRequestOpenFull={openFullGroupManager}
            />
            <div ref={groupManagerRef} />
          </div>
        ) : (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Group Manager hidden — you don't have permission to view groups.</div>
        )}
      </div>
    </div>
  );
}

const TIMEZONE_OPTIONS = [
  { label: 'Local (browser)', value: 'local' },
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York (EST/EDT)', value: 'America/New_York' },
  { label: 'America/Chicago (CST/CDT)', value: 'America/Chicago' },
  { label: 'America/Denver (MST/MDT)', value: 'America/Denver' },
  { label: 'America/Los_Angeles (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'Europe/London (BST/GMT)', value: 'Europe/London' },
  { label: 'Europe/Paris (CET/CEST)', value: 'Europe/Paris' },
  { label: 'Asia/Tokyo (JST)', value: 'Asia/Tokyo' },
  { label: 'Australia/Sydney (AEST/AEDT)', value: 'Australia/Sydney' }
];

const STEP_CHALLENGE_CONFIG = {
  create_character: { label: 'Create Character', minScore: 90 },
  edit_character: { label: 'Edit Character', minScore: 70 }
};

const CHALLENGE_FEATURES_ENABLED = false;

function challengeFlowEnabled() {
  return CHALLENGE_FEATURES_ENABLED;
}

function getStepChallengeInfo(step) {
  return STEP_CHALLENGE_CONFIG[step] || { label: step, minScore: 80 };
}

function getStepChallengeStorageKey(step, campaignId = 'none', userId = 'anon') {
  return `dnd-step-challenge:${campaignId}:${userId}:${step}`;
}

function parseApiError(error) {
  try {
    const parsed = JSON.parse(error?.message || '{}');
    if (parsed?.error) return parsed.error;
  } catch (error_) {
    console.debug('parseApiError failed', error_);
  }
  return error?.message || String(error);
}

function isTrustedMessageOrigin(origin) {
  try {
    const apiOrigin = new URL(API_BASE).origin;
    return origin === apiOrigin || origin === globalThis.location?.origin;
  } catch (error_) {
    console.debug('isTrustedMessageOrigin fallback', error_);
    return origin === globalThis.location?.origin;
  }
}

function clearOAuthStartedFlag() {
  try {
    sessionStorage.removeItem('dnd-oauth-started');
  } catch (error_) {
    console.debug('session cleanup failed', error_);
  }
}

function setOAuthStartedFlag() {
  try {
    sessionStorage.setItem('dnd-oauth-started', '1');
  } catch (error_) {
    console.debug('session marker set failed', error_);
  }
}

function replaceCurrentUrlPath() {
  try {
    globalThis.window.history.replaceState({}, document.title, globalThis.window.location.pathname);
  } catch (error_) {
    console.debug('history replace failed', error_);
  }
}

function extractPendingMatchesFromStorage() {
  try {
    const pendingMatchesStr = localStorage.getItem('pendingMatches');
    if (!pendingMatchesStr) return [];
    const potentialMatches = JSON.parse(pendingMatchesStr);
    localStorage.removeItem('pendingMatches');
    return Array.isArray(potentialMatches) ? potentialMatches : [];
  } catch (error_) {
    console.warn('Failed to parse pending matches from localStorage', error_);
    return [];
  }
}

function normalizeMemberPermissions(rawPermissions) {
  const truthy = (value) => value === true || value === 'true' || value === 1 || value === '1';
  const perms = rawPermissions || {};
  const playersViewValue = perms.players_view;
  const playersView = playersViewValue !== 'none' && playersViewValue !== false;
  return {
    invites_create: !!perms.invites_create,
    invites_edit: !!perms.invites_edit,
    invites_delete: !!perms.invites_delete,
    players_create: !!perms.players_create,
    players_view: playersView,
    players_edit: !!perms.players_edit,
    players_delete: !!perms.players_delete,
    players_edit_availability: perms.players_edit_availability === undefined ? false : truthy(perms.players_edit_availability),
    players_self_view: perms.players_self_view === undefined ? true : truthy(perms.players_self_view),
    players_self_edit: perms.players_self_edit === undefined ? true : truthy(perms.players_self_edit),
    players_self_delete: perms.players_self_delete === undefined ? true : truthy(perms.players_self_delete),
    players_self_edit_availability: perms.players_self_edit_availability === undefined ? true : truthy(perms.players_self_edit_availability),
    groups_create: !!perms.groups_create,
    groups_view: !!perms.groups_view,
    groups_edit: !!perms.groups_edit,
    groups_delete: !!perms.groups_delete,
    groups_self_view: perms.groups_self_view === undefined ? true : truthy(perms.groups_self_view),
    groups_self_edit: perms.groups_self_edit === undefined ? false : truthy(perms.groups_self_edit),
    groups_self_delete: perms.groups_self_delete === undefined ? false : truthy(perms.groups_self_delete),
    members_manage: !!perms.members_manage
  };
}

function startDiscordLoginFlow(event, serverBase) {
  event?.preventDefault?.();
  const authUrl = serverBase.replace(/\/$/, '') + '/auth/discord?returnTo=' + encodeURIComponent(globalThis.window.location.href);
  setOAuthStartedFlag();
  const popupW = 520;
  const popupH = 700;
  const left = globalThis.window.screenX + Math.max(0, (globalThis.window.outerWidth - popupW) / 2);
  const top = globalThis.window.screenY + Math.max(0, (globalThis.window.outerHeight - popupH) / 2);
  const features = `width=${popupW},height=${popupH},left=${left},top=${top},resizable=yes,scrollbars=yes`;
  const openedWindow = globalThis.window.open(authUrl, 'discord_oauth', features);
  if (!openedWindow || openedWindow.closed || openedWindow.closed === undefined) {
    globalThis.window.location.href = authUrl;
  }
}


function useServerWakeHandlers({ campaign, userId, loadPlayers, setWakeMsg, setShowWake, setToast }) {
  useEffect(() => {
    (async () => {
      const ok = await isServerHealthy({ timeout: 1200 });
      if (ok === false) {
        setWakeMsg('Server is sleeping — waking up...');
        setShowWake(true);
        const awakened = await waitForServerReady({ interval: 3000, maxWait: 120000 });
        if (awakened) {
          setShowWake(false);
          setToast({ text: 'Server is awake — you can continue!', timeout: 3000 });
          try {
            await loadPlayers();
          } catch (error_) {
            console.debug('loadPlayers after wake failed', error_);
          }
        }
      }
    })();

    function onPlayersChanged() {
      if (campaign) loadPlayers();
    }
    globalThis.window.addEventListener('players-changed', onPlayersChanged);

    function onServerWaking(event) {
      const reason = event?.detail?.reason;
      const message = event?.detail?.message || '';
      if (/blocked|adblock|ERR_BLOCKED|failed to fetch|ERR_INSUFFICIENT_RESOURCES/i.test(`${reason} ${message}`)) {
        return;
      }
      setWakeMsg(reason ? `Server unavailable (${reason}).` : 'Server is waking...');
      setShowWake(true);
      (async () => {
        const ok = await waitForServerReady({ interval: 3000, maxWait: 120000 });
        if (ok) {
          setShowWake(false);
          setToast({ text: 'Server is awake — you can continue!', timeout: 3000 });
          try {
            await loadPlayers();
          } catch (error_) {
            console.debug('loadPlayers after server-waking failed', error_);
          }
        }
      })();
    }
    globalThis.window.addEventListener('server-waking', onServerWaking);

    let bc;
    try {
      bc = new BroadcastChannel('dnd-players');
      bc.onmessage = () => { if (campaign) loadPlayers(); };
    } catch (error_) {
      console.debug('BroadcastChannel not available', error_);
      bc = null;
    }

    return () => {
      globalThis.window.removeEventListener('players-changed', onPlayersChanged);
      globalThis.window.removeEventListener('server-waking', onServerWaking);
      if (bc) bc.close();
    };
  }, [campaign, userId, loadPlayers, setWakeMsg, setShowWake, setToast]);
}

function useOAuthSyncHandlers({
  pendingInviteToken,
  attemptInviteJoinForUser,
  setUserId,
  setPendingPlayerMatches,
  setShowMatchConfirmation,
  setInviteChallengeStatus,
  setToast,
  inviteChallengeRequiredRef,
  inviteChallengePassTokenRef
}) {
  useEffect(() => {
    function onMsg(event) {
      if (!isTrustedMessageOrigin(event?.origin)) return;
      if (event?.data?.type !== 'discord-auth' || !event.data.userId) return;

      const newUserId = String(event.data.userId);
      setUserId(newUserId);
      localStorage.setItem('userId', newUserId);
      clearOAuthStartedFlag();

      const potentialMatches = event.data.potentialMatches || [];
      if (potentialMatches.length > 0) {
        setPendingPlayerMatches(potentialMatches);
        setShowMatchConfirmation(true);
        return;
      }

      (async () => {
        try {
          await attemptInviteJoinForUser(newUserId);
        } catch (error_) {
          console.error('Auto-join after OAuth failed', error_);
          const message = parseApiError(error_);
          if (inviteChallengeRequiredRef.current && !inviteChallengePassTokenRef.current) {
            setInviteChallengeStatus('Complete challenge first, then join.');
          }
          setToast({ text: message, timeout: 6000 });
        }
      })();
    }

    globalThis.window.addEventListener('message', onMsg);
    return () => globalThis.window.removeEventListener('message', onMsg);
  }, [attemptInviteJoinForUser, inviteChallengePassTokenRef, inviteChallengeRequiredRef, setInviteChallengeStatus, setPendingPlayerMatches, setShowMatchConfirmation, setToast, setUserId]);

  useEffect(() => {
    function onStorage(event) {
      if (event?.key !== 'userId' || !event.newValue) return;
      const newUserId = String(event.newValue);
      setUserId(newUserId);
      clearOAuthStartedFlag();

      const potentialMatches = extractPendingMatchesFromStorage();
      if (potentialMatches.length > 0) {
        setPendingPlayerMatches(potentialMatches);
        setShowMatchConfirmation(true);
        return;
      }

      (async () => {
        try {
          await attemptInviteJoinForUser(newUserId);
        } catch (error_) {
          console.error('Auto-join after OAuth (storage) failed', error_);
          if (inviteChallengeRequiredRef.current && !inviteChallengePassTokenRef.current) {
            setInviteChallengeStatus('Complete challenge first, then join.');
          }
        }
      })();
    }

    globalThis.window.addEventListener('storage', onStorage);
    return () => globalThis.window.removeEventListener('storage', onStorage);
  }, [attemptInviteJoinForUser, inviteChallengePassTokenRef, inviteChallengeRequiredRef, pendingInviteToken, setInviteChallengeStatus, setPendingPlayerMatches, setShowMatchConfirmation, setUserId]);
}

// NOSONAR: App coordinates many UI flows; complexity is intentionally centralized.
export default function App() {
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [status, setStatus] = useState('');
  const [importMode, setImportMode] = useState(false);
  const [sheetIdInput, setSheetIdInput] = useState('');
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [showColorManager, setShowColorManager] = useState(false);
  const [pendingInviteToken, setPendingInviteToken] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [unclaimedPlayers, setUnclaimedPlayers] = useState([]);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [calendarMode, setCalendarMode] = useState('single');
  const [viewTZ, setViewTZ] = useState('local');
  const [groupFilterMemberIds, setGroupFilterMemberIds] = useState(null);
  const [editorPlayer, setEditorPlayer] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [userId, setUserId] = useState(localStorage.getItem('userId') || null);
  const [campaign, setCampaign] = useState(() => {
    try {
      const saved = localStorage.getItem('activeCampaign');
      return saved ? JSON.parse(saved) : null;
    } catch (error_) {
      console.warn('Failed to parse active campaign:', error_);
      return null; 
    }
  });
  const [currentUserPermissions, setCurrentUserPermissions] = useState({});
  const [groupSelfOnlyOverride, setGroupSelfOnlyOverride] = useState(null);
  const groupManagerRef = React.useRef(null);
  const [showFullManagerModal, setShowFullManagerModal] = useState(false);
  const [groupToView, setGroupToView] = useState(null);
  const [showCampaignShelf, setShowCampaignShelf] = useState(false);
  const [campaignsReloadKey, setCampaignsReloadKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [pendingPlayerMatches, setPendingPlayerMatches] = useState([]);
  const [showMatchConfirmation, setShowMatchConfirmation] = useState(false);
  const [invitePreview, setInvitePreview] = useState(null);
  const [invitePreviewLoading, setInvitePreviewLoading] = useState(false);
  const [inviteLoadingMessage, setInviteLoadingMessage] = useState('Loading campaign details...');
  const [inviteChallenge, setInviteChallenge] = useState(null);
  const [inviteChallengePassToken, setInviteChallengePassToken] = useState(null);
  const [inviteChallengeStatus, setInviteChallengeStatus] = useState('');
  const [zoopleChallengeScore, setZoopleChallengeScore] = useState(0);
  const [zoopleChallengeRunning, setZoopleChallengeRunning] = useState(false);
  const [zoopleChallengeEndsAt, setZoopleChallengeEndsAt] = useState(0);
  const [zoopleChallengeTimeLeftMs, setZoopleChallengeTimeLeftMs] = useState(0);
  const [zoopleGameSessionKey, setZoopleGameSessionKey] = useState(0);
  const [stepChallengeOpen, setStepChallengeOpen] = useState(false);
  const [stepChallengeStep, setStepChallengeStep] = useState(null);
  const [stepChallengeStatus, setStepChallengeStatus] = useState('');
  const [showWake, setShowWake] = useState(false);
  const [wakeMsg, setWakeMsg] = useState('');
  const inviteChallengePassTokenRef = React.useRef(null);
  const inviteChallengeRequiredRef = React.useRef(false);
  const pendingStepActionRef = React.useRef(null);

  const canViewGroups = !!(
    currentUserPermissions?.groups_view
    || currentUserPermissions?.groups_self_view
    || currentUserPermissions?.is_owner
    || (campaign && String(campaign.owner_user_id) === String(userId))
  );
  let groupManagerSelfOnly = groupSelfOnlyOverride;
  if (groupManagerSelfOnly === null) {
    if (currentUserPermissions?.groups_view) {
      groupManagerSelfOnly = false;
    } else {
      groupManagerSelfOnly = !!currentUserPermissions?.groups_self_view && !currentUserPermissions?.is_owner;
    }
  }

  function openFullGroupManager(group) {
    setGroupSelfOnlyOverride(null);
    setGroupToView(group || null);
    setShowFullManagerModal(true);
    try {
      groupManagerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error_) {
      console.debug('scrollIntoView failed', error_);
    }
  }

  function dismissFullManagerModal() {
    setShowFullManagerModal(false);
    setGroupToView(null);
  }

  function hasCompletedStepChallenge(step) {
    try {
      const key = getStepChallengeStorageKey(step, campaign?.id, userId);
      return localStorage.getItem(key) === '1';
    } catch (error_) {
      console.debug('read step challenge state failed', error_);
      return false;
    }
  }

  function markStepChallengeCompleted(step) {
    try {
      const key = getStepChallengeStorageKey(step, campaign?.id, userId);
      localStorage.setItem(key, '1');
    } catch (error_) {
      console.debug('write step challenge state failed', error_);
    }
  }

  function resetZoopleChallenge() {
    setZoopleChallengeScore(0);
    setZoopleChallengeRunning(false);
    setZoopleChallengeEndsAt(0);
    setZoopleChallengeTimeLeftMs(0);
  }

  function startZoopleChallenge(durationMs = 15000) {
    const endAt = Date.now() + durationMs;
    setZoopleChallengeScore(0);
    setZoopleChallengeRunning(true);
    setZoopleChallengeEndsAt(endAt);
    setZoopleChallengeTimeLeftMs(durationMs);
    setZoopleGameSessionKey((previous) => previous + 1);
  }

  async function runWithStepChallenge(step, action) {
    if (!challengeFlowEnabled() || hasCompletedStepChallenge(step)) {
      await action();
      return;
    }
    pendingStepActionRef.current = async () => {
      markStepChallengeCompleted(step);
      await action();
    };
    setStepChallengeStep(step);
    setStepChallengeStatus('Score enough points to unlock this step.');
    setStepChallengeOpen(true);
    startZoopleChallenge(12000);
  }

  async function completeStepChallenge() {
    const step = stepChallengeStep;
    if (!step) return;
    const cfg = getStepChallengeInfo(step);
    if (zoopleChallengeScore < cfg.minScore) {
      setStepChallengeStatus(`Need ${cfg.minScore} points. Current score: ${zoopleChallengeScore}.`);
      return;
    }
    setStepChallengeStatus('Challenge passed.');
    const pending = pendingStepActionRef.current;
    pendingStepActionRef.current = null;
    setStepChallengeOpen(false);
    setStepChallengeStep(null);
    resetZoopleChallenge();
    if (pending) {
      await pending();
    }
  }

  async function completeInviteJoin(result, joinedUserId) {
    if (!result?.campaign_id) return;
    setCampaign({ id: result.campaign_id, name: result.campaign_name || '' });
    setShowInviteModal(false);
    setPendingInviteToken(null);
    replaceCurrentUrlPath();
    setCampaignsReloadKey((current) => current + 1);
    setToast({ text: `Joined campaign: ${result.campaign_name || result.campaign_id}`, timeout: 3000 });
    await loadPlayers();
    try {
      const list = await listUnclaimedPlayers(result.campaign_id, joinedUserId).catch(() => ({ players: [] }));
      if (Array.isArray(list?.players) && list.players.length > 0) {
        setUnclaimedPlayers(list.players || []);
        setShowClaimModal(true);
      }
    } catch (error_) {
      console.warn('check unclaimed after oauth failed', error_);
    }
  }

  async function attemptInviteJoinForUser(newUserId) {
    if (!pendingInviteToken) return;
    const bodyPayload = challengeFlowEnabled() && inviteChallengePassTokenRef.current
      ? { challenge_pass_token: inviteChallengePassTokenRef.current }
      : undefined;
    const result = await joinWithInvite(pendingInviteToken, { userId: newUserId, body: bodyPayload });
    await completeInviteJoin(result, newUserId);
  }

  useOAuthSyncHandlers({
    pendingInviteToken,
    attemptInviteJoinForUser,
    setUserId,
    setPendingPlayerMatches,
    setShowMatchConfirmation,
    setInviteChallengeStatus,
    setToast,
    inviteChallengeRequiredRef,
    inviteChallengePassTokenRef
  });

  useEffect(()=> { if (campaign || userId) loadPlayers(); }, [campaign, userId]);

  // Persist active campaign to localStorage
  useEffect(() => {
    if (campaign) {
      try {
        localStorage.setItem('activeCampaign', JSON.stringify(campaign));
      } catch (e) { console.warn('Failed to save active campaign:', e); }
    } else {
      try {
        localStorage.removeItem('activeCampaign');
      } catch (e) { console.warn('Failed to remove active campaign:', e); }
    }
  }, [campaign]);

  // Listen for 'open-full-groups' events (from components) and clear self-only override
  useEffect(() => {
    function onOpenFull() { setGroupSelfOnlyOverride(false); }
    globalThis.window.addEventListener('open-full-groups', onOpenFull);
    return () => globalThis.window.removeEventListener('open-full-groups', onOpenFull);
  }, []);

  useServerWakeHandlers({ campaign, userId, loadPlayers, setWakeMsg, setShowWake, setToast });

  // load the current user's campaign member permissions whenever campaign or userId changes
  useEffect(() => {
    let mounted = true;
    async function loadPerms() {
      if (!campaign || !userId) { setCurrentUserPermissions({}); return; }
      try {
  const resp = await fetch((import.meta.env.VITE_API_BASE || API_BASE) + `/api/campaigns/${encodeURIComponent(campaign.id)}/members`, { headers: { 'X-User-Id': String(userId) } });
        if (!resp.ok) { setCurrentUserPermissions({}); return; }
        const body = await resp.json();
        // find member entry for this userId
  const me = (body.members || []).find(m => String(m.user_id) === String(userId) || String(m.player_id) === String(userId));
  if (!me) { setCurrentUserPermissions({}); return; }
  let rawPermissions = {};
  if (typeof me.permissions === 'object' && me.permissions) {
    rawPermissions = me.permissions;
  } else if (me.permissions) {
    rawPermissions = JSON.parse(me.permissions);
  }
  const normalized = normalizeMemberPermissions(rawPermissions);
  // mark owner so UI can treat owner as implicitly allowed
  const isOwner = (me.role === 'owner');
  if (mounted) setCurrentUserPermissions({ ...normalized, is_owner: isOwner });
      } catch (e) {
        console.warn('loadPerms failed', e);
        if (mounted) setCurrentUserPermissions({});
      }
    }
    loadPerms();
    return () => { mounted = false; };
  }, [campaign, userId]);

  async function loadPlayers(){
    try {
      if (!campaign) { setPlayers([]); return; }
      const list = await fetchPlayers({ campaignId: campaign.id, userId });
      let normalizedPlayers = [];
      if (Array.isArray(list)) {
        normalizedPlayers = list;
      } else if (Array.isArray(list?.players)) {
        normalizedPlayers = list.players;
      }
      setPlayers(normalizedPlayers);
    } catch(e){ console.error(e); setStatus('Failed to load players'); }
  }

  // Load campaigns on mount to validate persisted campaign
  useEffect(() => {
    if (!userId || !campaign) return;
    
    // Delay validation to ensure user is properly authenticated
    const timeoutId = setTimeout(async () => {
      try {
        const res = await listCampaigns(userId);
        if (res?.campaigns) {
          // Check if persisted campaign still exists
          const found = res.campaigns.find(c => c.id === campaign.id);
          if (!found) {
            // Persisted campaign no longer exists, clear it
            setCampaign(null);
          }
        }
      } catch (e) {
        console.warn('Failed to validate persisted campaign:', e);
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [userId, campaign?.id]);

  async function handlePushToSheet() {
    setStatus('Pushing to Google Sheet...');
    const payload = { action: 'sync_players', players };
    try {
      const txt = await pushToSheet(payload);
      setStatus('Push complete');
      console.log('Apps Script response:', txt);
    } catch (e) {
      console.error(e);
      setStatus('Push failed: ' + (e.message||e));
    }
  }

  function openImport(){ setImportMode(true); setSheetIdInput(''); setHeaders([]); setMapping({}); }

  async function fetchHeaders() {
    if (!sheetIdInput) { setStatus('Enter sheet URL or ID'); return; }
    try {
      setStatus('Fetching sheet columns...');
      const resp = await fetchSheetColumns(sheetIdInput);
      if (resp?.headers) {
        setHeaders(resp.headers);
        setStatus('Columns loaded — map fields then click Import');
        const init = {};
        const lower = (h) => h?.toLowerCase();
        const mapTo = (target, patterns) => {
          for (const h of resp.headers) {
            for (const p of patterns) {
              if (lower(h).includes(p)) return h;
            }
          }
          return '';
        };
        init.name = mapTo('name', ['name','player']);
        init.discord = mapTo('discord', ['discord']);
        init.timezone = mapTo('timezone', ['time','tz','zone']);
        init.notes = mapTo('notes', ['avail','note','when','free']);
        init.age = mapTo('age', ['age']);
        init.computer_access = mapTo('computer', ['computer']);
        init.pref_party_size = mapTo('party', ['party']);
        init.pref_session_length = mapTo('session','session');
        init.pref_vtt = mapTo('vtt', ['vtt','virtual']);
        init.pref_play_with = mapTo('play with', ['prefer','play with']);
        init.pref_play_not_with = mapTo('not play', ['prefer not','dont','do not play']);
        setMapping(init);
      } else {
        setStatus('Failed to get headers');
      }
    } catch (e) {
      console.error(e);
      setStatus('Failed to fetch headers: ' + e.message);
    }
  }

  async function doImport() {
    try {
      setStatus('Importing with mapping...');
      if (!campaign) throw new Error('No campaign selected');
  // Call syncSheet with campaignId so server assigns imported rows correctly
  const importMapping = { ...mapping };
  const r = await syncSheet(sheetIdInput, importMapping, campaign.id);
      if (r?.ok === false) {
        const body = await r.text();
        setStatus('Import failed: ' + r.status + ' ' + body);
        return;
      }
      const d = await r.json();
      setStatus('Imported ' + (d.imported || 0) + ' rows');
      setImportMode(false);
      await loadPlayers();
    } catch (e) {
      console.error(e);
      setStatus('Import failed: ' + (e.message || e));
    }
  }

  async function onPlayersChanged() { await loadPlayers(); if (selectedPlayer) setSelectedPlayer(players.find(p=>p.id===selectedPlayer.id) || null); }

  // Open editor for a player (passed into PlayerList so backlinks can open in parent)
  function openEditorFor(playerObj){
    runWithStepChallenge('edit_character', async () => {
      setEditorPlayer(playerObj);
      setShowEditor(true);
    });
  }
  function closeEditor(){
    setShowEditor(false);
    setEditorPlayer(null);
    // refresh players after potential update
    loadPlayers();
  }

  // apply persisted theme on mount
  useEffect(() => {
    const m = localStorage.getItem('darkMode');
    if (m === '1') document.documentElement.classList.add('dark');
  }, []);

  // detect invite token from URL on mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(globalThis.window.location.search);
      const inv = params.get('invite');
      if (inv) {
        setPendingInviteToken(inv);
        setShowInviteModal(true);
      }
    } catch(error_) { console.debug('invite token parse failed', error_); }
  }, []);
  // when invite modal opens, fetch invite info so we can show campaign name
  useEffect(() => {
    if (!showInviteModal || !pendingInviteToken) return;
    setInvitePreviewLoading(true);
    setInviteLoadingMessage('Loading campaign details...');
    
    // Show progressive loading messages for slow connections
    const loadingTimer1 = setTimeout(() => {
      if (invitePreviewLoading) {
        setInviteLoadingMessage('Still loading... (slow connection detected)');
      }
    }, 3000);
    
    const loadingTimer2 = setTimeout(() => {
      if (invitePreviewLoading) {
        setInviteLoadingMessage('Almost there... (retrying connection)');
      }
    }, 8000);

    setInviteChallenge(null);
    setInviteChallengePassToken(null);
    inviteChallengePassTokenRef.current = null;
    inviteChallengeRequiredRef.current = false;
    setInviteChallengeStatus('');
    resetZoopleChallenge();
    
    (async () => {
      try {
        // Use optimized API function with timeout and retry logic
        const j = await getInvitePreview(pendingInviteToken);
        if (j?.campaign) {
          // store a friendlier invite preview message
          setStatus('Invite for campaign: ' + (j.campaign.name || j.campaign.id));
          // stash preview info on state for render
          setInvitePreview(j);
          if (j?.invite?.challenge_enabled) {
            inviteChallengeRequiredRef.current = true;
            const challengeResp = await fetchInviteChallenge(pendingInviteToken);
            if (challengeResp?.required && challengeResp?.challenge) {
              setInviteChallenge(challengeResp.challenge);
              setInviteChallengeStatus('Complete challenge to unlock joining.');
            }
          } else {
            inviteChallengeRequiredRef.current = false;
          }
        } else {
          console.warn('Invite preview returned no campaign data');
          setStatus('An invite to join a campaign was detected.');
        }
      } catch (error_) { 
        console.error('invite preview failed', error_);
        setStatus('An invite to join a campaign was detected.');
        // For distant users, show a more helpful message
        if (error_?.message && (error_.message.includes('timeout') || error_.message.includes('Network error'))) {
          setStatus('Campaign invite detected (connection timeout - you can still join without preview).');
        }
      } finally {
        clearTimeout(loadingTimer1);
        clearTimeout(loadingTimer2);
        setInvitePreviewLoading(false);
        setInviteLoadingMessage('Loading campaign details...');
      }
    })();
  }, [showInviteModal, pendingInviteToken]);

  // invite preview details
  // avoid duplicate auto-join attempts
  const lastAutoJoinTokenRef = React.useRef(null);

  // Auto-join invite after same-tab auth: when userId becomes available while an invite is pending
  useEffect(() => {
    if (!userId || !pendingInviteToken || !showInviteModal) return;
    if (invitePreview?.invite?.challenge_enabled && !inviteChallengePassToken) return;
    if (lastAutoJoinTokenRef.current === pendingInviteToken) return;
    lastAutoJoinTokenRef.current = pendingInviteToken;
    (async () => {
      try {
        const result = await joinWithInvite(pendingInviteToken, {
          userId,
          body: inviteChallengePassToken ? { challenge_pass_token: inviteChallengePassToken } : undefined
        });
        if (result?.campaign_id) {
          setCampaign({ id: result.campaign_id, name: result.campaign_name || '' });
          setShowInviteModal(false);
          setPendingInviteToken(null);
          try { globalThis.window.history.replaceState({}, document.title, globalThis.window.location.pathname); } catch(error_){ console.debug('history replace failed', error_); }
          setCampaignsReloadKey(k=>k+1);
          setToast({ text: `Joined campaign: ${result.campaign_name || result.campaign_id}`, timeout: 3000 });
          await loadPlayers();
          // check for unclaimed players
          try {
            const list = await listUnclaimedPlayers(result.campaign_id, userId).catch(()=>({ players: [] }));
            if (list && Array.isArray(list.players) && list.players.length > 0) {
              setUnclaimedPlayers(list.players || []);
              setShowClaimModal(true);
            }
          } catch (error_) { console.warn('check unclaimed after same-tab oauth failed', error_); }
        }
      } catch (e) {
        console.error('Auto-join (same-tab) failed', e);
      }
    })();
  }, [userId, pendingInviteToken, showInviteModal, invitePreview, inviteChallengePassToken]);

  useEffect(() => {
    if (!zoopleChallengeRunning) return undefined;
    const timerId = setInterval(() => {
      const left = Math.max(0, zoopleChallengeEndsAt - Date.now());
      setZoopleChallengeTimeLeftMs(left);
      if (left <= 0) {
        setZoopleChallengeRunning(false);
        setZoopleChallengeEndsAt(0);
      }
    }, 100);
    return () => clearInterval(timerId);
  }, [zoopleChallengeRunning, zoopleChallengeEndsAt]);

  useEffect(() => {
    function onZoopleMessage(event) {
      if (!isTrustedMessageOrigin(event?.origin)) return;
      const data = event?.data;
      if (data?.type !== 'zoople-score-update') return;
      if (typeof data.score !== 'number') return;
      setZoopleChallengeScore(Math.max(0, Math.floor(data.score)));
    }
    globalThis.window.addEventListener('message', onZoopleMessage);
    return () => globalThis.window.removeEventListener('message', onZoopleMessage);
  }, []);

  function toggleDark() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('darkMode', isDark ? '1' : '0');
  }

  const challengeRequired = challengeFlowEnabled() && !!invitePreview?.invite?.challenge_enabled;
  const challengePassed = !challengeRequired || !!inviteChallengePassToken;

  async function handleCompleteInviteChallenge() {
    if (!pendingInviteToken || !inviteChallenge?.session_id) return;
    try {
      setInviteChallengeStatus('Checking challenge answers...');
      const response = await completeInviteChallenge(pendingInviteToken, {
        session_id: inviteChallenge.session_id,
        zoople_score: zoopleChallengeScore
      });
      if (response?.pass_token) {
        setInviteChallengePassToken(response.pass_token);
        inviteChallengePassTokenRef.current = response.pass_token;
        setInviteChallengeStatus('Challenge complete. You can now join.');
      }
    } catch (error_) {
      setInviteChallengePassToken(null);
      setInviteChallengeStatus(parseApiError(error_));
    }
  }

  useEffect(() => {
    if (!toast?.timeout) return undefined;
    const timerId = setTimeout(() => setToast(null), toast.timeout);
    return () => clearTimeout(timerId);
  }, [toast]);

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh' }}>
      <header className="app-header">
        <div style={{ fontWeight: 700, fontSize: 22 }}>DnD Scheduler</div>
        <div className="header-controls" style={{ gap: 12 }}>
          {campaign && (
            <span style={{ fontWeight: 500, color: 'var(--text)', background: 'var(--panel)', borderRadius: 6, padding: '4px 12px', fontSize: 15 }}>
              Campaign: <b>{campaign.name || 'Untitled'}</b>
            </span>
          )}
              {userId ? (
            <>
              <span style={{ color: 'var(--muted)', fontSize: 15 }}>Logged in</span>
              <button onClick={() => {
                localStorage.removeItem('userId');
                localStorage.removeItem('activeCampaign');
                setUserId(null);
                setCampaign(null);
                clearOAuthStartedFlag();
                // clear any stale auth markers so login can be initiated again
                globalThis.window.location.reload();
              }} style={{ marginLeft: 12, padding: '6px 16px', fontWeight: 600, background: 'var(--panel)', border: 'none', borderRadius: 4 }}>Log out</button>
            </>
          ) : (
                <>
                  <button onClick={() => setShowAuthModal(true)} style={{ padding: '6px 12px', marginRight:8 }}>Local login / signup</button>
                  <button onClick={(event) => startDiscordLoginFlow(event, (import.meta.env.VITE_API_BASE || API_BASE))} style={{ padding: '6px 16px', fontWeight: 600, background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 4 }}>Login with Discord</button>
                </>
          )}
          <button onClick={()=>setShowCampaignShelf(v=>!v)} style={{ padding: '6px 16px', fontWeight: 600, background: 'var(--panel)', border: 'none', borderRadius: 4 }}>Manage Campaigns</button>
          <button onClick={toggleDark} style={{ padding: '6px 12px', marginLeft:8, borderRadius:20, border:'none', background:'var(--panel)', color:'var(--text)' }} title="Toggle dark mode">🌓</button>
        </div>
      </header>
      
      {/* Player match confirmation - inline banner */}
      {showMatchConfirmation && pendingPlayerMatches.length > 0 && (
        <div style={{ 
          background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', 
          color: 'white', 
          padding: '16px 24px', 
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          position: 'sticky',
          top: 0,
          zIndex: 20
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '18px' }}>🎯 Player Match Found!</h3>
          <p style={{ margin: '0 0 16px 0', opacity: 0.9 }}>
            We found a player with your Discord username. Is this you?
          </p>
          {pendingPlayerMatches.map(match => (
            <div key={`${match.campaign_id}-${match.id}`} style={{ 
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: '8px', 
              padding: '12px', 
              marginBottom: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{match.name}</div>
                <div style={{ opacity: 0.8, fontSize: '14px' }}>
                  Campaign: {match.campaign_name}
                  {match.discord && <span> • Discord: {match.discord}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={async () => {
                    try {
                      const result = await confirmDiscordLink(match.id, match.campaign_id, userId);
                      if (result?.ok) {
                        setCampaign({ id: match.campaign_id, name: match.campaign_name });
                        setShowMatchConfirmation(false);
                        setPendingPlayerMatches([]);
                        setCampaignsReloadKey(k=>k+1);
                        setToast({ text: `Linked to ${match.name} in ${match.campaign_name}!`, timeout: 4000 });
                        await loadPlayers();
                      }
                    } catch (e) {
                      console.error('Confirm link failed:', e);
                      setToast({ text: 'Failed to link player: ' + (e.message || e), timeout: 4000 });
                    }
                  }}
                  style={{ 
                    background: 'rgba(255,255,255,0.9)', 
                    color: '#333', 
                    border: 'none', 
                    padding: '8px 16px', 
                    borderRadius: '6px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Yes, that's me
                </button>
                <button 
                  onClick={() => {
                    // Remove this specific match and check if there are more
                    const remaining = pendingPlayerMatches.filter(m => !(m.campaign_id === match.campaign_id && m.id === match.id));
                    setPendingPlayerMatches(remaining);
                    if (remaining.length === 0) {
                      setShowMatchConfirmation(false);
                      // Show claim modal if there are unclaimed players
                      setShowClaimModal(true);
                    }
                  }}
                  style={{ 
                    background: 'rgba(255,255,255,0.2)', 
                    color: 'white', 
                    border: '1px solid rgba(255,255,255,0.3)', 
                    padding: '8px 16px', 
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  No, not me
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="app-shell" style={{ position: 'relative' }}>
        {/* Main content area (Players, Calendar, etc.) */}
        <div className="sidebar">
          <h2>Players</h2>
          <PlayerList
            players={players}
            onSelect={p=> setSelectedPlayer(p)}
            selected={selectedPlayer}
            onPlayersChanged={onPlayersChanged}
            onOpenPlayer={openEditorFor}
            onAddPlayer={async () => {
              await runWithStepChallenge('create_character', async () => {
                setStatus('Creating player...');
                try {
                  if (!campaign) throw new Error('No campaign selected');
                  const resp = await createPlayer({ name: '', discord: '', notes: '', campaign_id: campaign.id }, { userId, campaignId: campaign.id });
                  if (resp?.player) {
                    setEditorPlayer(resp.player);
                    setShowEditor(true);
                    await loadPlayers();
                    setStatus('');
                  }
                } catch (e) {
                  console.error('create player failed', e);
                  setStatus('Create player failed: ' + (e.message || e));
                }
              });
            }}
            onRemovePlayer={async (playerToRemove) => {
              if (!playerToRemove?.id) return;
              if (!confirm(`Delete player ${playerToRemove.name || '(no name)'}?`)) return;
              try {
                await deletePlayer(playerToRemove.id, userId);
                await loadPlayers();
              } catch (e) {
                console.error('delete failed', e);
                setStatus('Delete failed: ' + (e.message || e));
              }
            }}
            onReorderPlayers={async (newOrder) => {
              setPlayers(newOrder); // optimistic
              try {
                await reorderPlayers(newOrder.map(p => p.id));
              } catch (e) {
                console.error('persist reorder failed', e);
                setStatus('Reorder save failed: ' + (e.message || e));
                await loadPlayers();
              }
            }}
          />
          
          {/* Show claim player button if user is logged in, in a campaign, but doesn't have a claimed player */}
          {userId && campaign && !((Array.isArray(players) ? players : []).some((p) => p.is_claimed && (p.claimed_user_id === userId || p.claimed_user_id === Number.parseInt(userId, 10)))) && (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--accent)', borderRadius: 6, background: 'rgba(74, 255, 144, 0.06)' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 8, color: 'var(--accent)' }}>No claimed player</div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 8 }}>
                You don't have a claimed player in this campaign yet.
              </div>
              <button 
                onClick={async () => {
                  try {
                    const list = await listUnclaimedPlayers(campaign.id, userId).catch(() => ({ players: [] }));
                    setUnclaimedPlayers(list.players || []);
                    setShowClaimModal(true);
                  } catch (e) {
                    console.error('Load unclaimed players failed:', e);
                    setToast({ text: 'Failed to load unclaimed players', timeout: 3000 });
                  }
                }}
                style={{ 
                  background: 'var(--accent)', 
                  color: 'var(--on-accent)', 
                  border: 'none', 
                  padding: '8px 16px', 
                  borderRadius: '4px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Claim a Player
              </button>
            </div>
          )}
          
          {importMode ? (
            <div style={{ marginTop: 12, padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--panel)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Import Google Sheet</h3>
                <button onClick={() => setImportMode(false)}>✕</button>
              </div>
              <div style={{ marginBottom: 12 }}>
                <input 
                  placeholder="Sheet URL or ID" 
                  value={sheetIdInput} 
                  onChange={e => setSheetIdInput(e.target.value)} 
                  style={{ width: '100%', marginBottom: 8 }} 
                />
                <button onClick={fetchHeaders} style={{ width: '100%' }}>Fetch Columns</button>
              </div>
              {headers.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 14 }}>Map columns:</h4>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {[
                      ['name','Name'],
                      ['discord','Discord Username'],
                      ['timezone','Time Zone'],
                      ['notes','Availability/Notes'],
                      ['age','Age'],
                      ['computer_access','Computer Access'],
                      ['pref_party_size','Preferred Party Size'],
                      ['pref_session_length','Preferred Session Length'],
                      ['pref_vtt','Preferred VTT'],
                      ['pref_play_with','Prefer play with'],
                      ['pref_play_not_with','Prefer NOT to play with']
                    ].map(([field, label]) => (
                      <div key={field} style={{ marginBottom: 8 }}>
                        <label style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginBottom: 2 }}>{label}</label>
                        <select 
                          value={mapping[field] || ''} 
                          onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          <option value=''>-- none --</option>
                          {headers.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setImportMode(false)} style={{ flex: 1 }}>Cancel</button>
                <button onClick={doImport} style={{ flex: 1 }}>Import</button>
              </div>
            </div>
          ) : (
            <div style={{marginTop:12}}>
              <button onClick={openImport}>Import Google Sheet (with mapping)</button>
              <button onClick={handlePushToSheet}>Push to Google Sheet</button>
            </div>
          )}
          <div style={{marginTop:12, color:'var(--muted)'}}>{status}</div>
        </div>
        <MainPanel
          calendarMode={calendarMode}
          setCalendarMode={setCalendarMode}
          setShowColorManager={setShowColorManager}
          viewTZ={viewTZ}
          setViewTZ={setViewTZ}
          selectedPlayer={selectedPlayer}
          groupFilterMemberIds={groupFilterMemberIds}
          campaign={campaign}
          userId={userId}
          canViewGroups={canViewGroups}
          groupManagerSelfOnly={groupManagerSelfOnly}
          loadPlayers={loadPlayers}
          setGroupFilterMemberIds={setGroupFilterMemberIds}
          openFullGroupManager={openFullGroupManager}
          groupManagerRef={groupManagerRef}
        />
        {/* CampaignManager shelf/modal */}
        {showCampaignShelf && (
          <div className="campaign-shelf">
            <button onClick={()=>setShowCampaignShelf(false)} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer' }} title="Close">×</button>
            <CampaignManager userId={userId} onSelectCampaign={(c)=>{ setCampaign(c); setShowCampaignShelf(false); }} selectedCampaignId={campaign?.id} onCampaignsChanged={() => setCampaignsReloadKey(k=>k+1)} key={campaignsReloadKey} />
          </div>
        )}
      </div>

      {showFullManagerModal && (
        <dialog
          className="modal-overlay"
          open
        >
          <div className="modal-panel" style={{ width: 960, maxHeight: '80vh', overflow: 'auto', position: 'relative' }}>
            <button onClick={dismissFullManagerModal} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer' }} title="Close">×</button>
            {/* If groupToView is null and user has permission, show full manager; otherwise show read-only group details */}
            {groupToView === null && (currentUserPermissions?.groups_view || currentUserPermissions?.is_owner) ? (
              <GroupManager
                campaignId={campaign?.id}
                userId={userId}
                selfOnly={false}
                onGroupsUpdated={() => { loadPlayers(); dismissFullManagerModal(); }}
                onSelectionChange={(memberIds) => setGroupFilterMemberIds(memberIds)}
              />
            ) : (
              <div style={{ padding: 12 }}>
                <h3>{groupToView ? (groupToView.name || `Group ${groupToView.id}`) : 'Groups'}</h3>
                {groupToView ? (
                  <div>
                    <div style={{ width: '100%', maxWidth: 820 }}>
                      <GroupManager
                        campaignId={campaign?.id}
                        userId={userId}
                        selfOnly={true}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--muted)' }}>You do not have permission to open the full manager.</div>
                )}
              </div>
            )}
          </div>
        </dialog>
      )}
      {showColorManager && (
        <div style={{position:'fixed', right:24, top:64, width:420, background:'var(--panel)', border:'1px solid var(--border)', padding:12, borderRadius:8, zIndex:2147483650}}>
          <ColorManager onClose={()=> setShowColorManager(false)} maxColors={calendarMode === 'single' ? 1 : undefined} />
        </div>
      )}
      {/* App-level PlayerEditor modal opened by double-click/right-click/backlink */}
      {showEditor && editorPlayer && (
        <PlayerEditor
          player={editorPlayer}
          onClose={closeEditor}
          onSaved={async ()=> { await onPlayersChanged(); }}
          onOpenPlayer={openEditorFor}
        />
      )}
      {showInviteModal && pendingInviteToken && (
        <div className="modal-overlay">
          <div className="modal-panel" style={{ width: 520 }}>
            <h3>Campaign invite</h3>
            {invitePreviewLoading ? (
              <div>
                <p>{inviteLoadingMessage}</p>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  You can join the campaign even if the preview doesn't load.
                </div>
              </div>
            ) : (
              <>
                <p>{status || 'An invite to join a campaign was detected.'}</p>
                {!invitePreview && (
                  <div style={{ padding: 8, background: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)', borderRadius: 4, marginTop: 8 }}>
                    <div style={{ fontSize: 14, color: '#856404' }}>
                      ⚠️ Could not load campaign details. The invite may be expired or invalid, but you can still try to join.
                    </div>
                  </div>
                )}
              </>
            )}
            {invitePreview?.campaign && (
              <div style={{ marginTop: 8, padding: 8, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6 }}>
                <div style={{ fontWeight: 700 }}>{invitePreview.campaign.name || ('Campaign #' + invitePreview.campaign.id)}</div>
                {invitePreview?.invite?.expires_at && <div style={{ fontSize:12, color:'var(--muted)' }}>Expires: {invitePreview.invite.expires_at}</div>}
                {invitePreview?.invite?.max_uses != null && <div style={{ fontSize:12, color:'var(--muted)' }}>Max uses: {invitePreview.invite.max_uses}</div>}
              </div>
            )}
            {challengeRequired && inviteChallenge && (
              <div style={{ marginTop: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--panel)' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Invite Challenge</div>
                <div style={{ fontSize: 13, marginBottom: 6 }}>
                  Zoople Clicker score: <b>{zoopleChallengeScore}</b> / {inviteChallenge.min_zoople_score}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <button
                    type="button"
                    onClick={() => startZoopleChallenge(15000)}
                    disabled={zoopleChallengeRunning}
                  >
                    {zoopleChallengeRunning ? 'Challenge Running' : 'Start Zoople Challenge (15s)'}
                  </button>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                    Time left: {Math.ceil((zoopleChallengeTimeLeftMs || 0) / 1000)}s
                  </div>
                </div>
                <iframe
                  key={`invite-${zoopleGameSessionKey}`}
                  title="Zoople Clicker Invite Challenge"
                  src={`/zoople-clicker.html?embedded=1&session=${zoopleGameSessionKey}`}
                  style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, background: '#000' }}
                />
                <div>
                  <button onClick={handleCompleteInviteChallenge} disabled={invitePreviewLoading || challengePassed}>
                    {challengePassed ? 'Challenge Passed' : 'Submit Challenge'}
                  </button>
                </div>
                {inviteChallengeStatus && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>{inviteChallengeStatus}</div>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button disabled={invitePreviewLoading} onClick={async ()=>{
                try {
                  startDiscordLoginFlow(null, (import.meta.env.VITE_API_BASE || API_BASE));
                } catch (e) {
                  console.error(e);
                }
              }}>Login with Discord</button>
              <button disabled={invitePreviewLoading || !challengePassed} onClick={async ()=>{
                try {
                  const bodyPayload = inviteChallengePassToken ? { challenge_pass_token: inviteChallengePassToken } : undefined;
                  const r = await joinWithInvite(pendingInviteToken, { body: bodyPayload });
                  if (r?.campaign_id) {
                    setShowInviteModal(false);
                    setCampaign({ id: r.campaign_id, name: r.campaign_name || '' });
                    globalThis.window.history.replaceState({}, document.title, globalThis.window.location.pathname);
                    setCampaignsReloadKey(k=>k+1);
                    setToast({ text: `Joined ${r.campaign_name || r.campaign_id}`, timeout: 3000 });
                    // After anonymous join, do not attempt to load players (requires authentication).
                    // Instead fetch unclaimed players so the user can claim one.
                    const list = await listUnclaimedPlayers(r.campaign_id, null).catch(()=>({ players: [] }));
                    setUnclaimedPlayers(list.players || []);
                    // open claim modal so user can claim or create a player
                    setShowClaimModal(true);
                  }
                } catch (e) {
                  const msg = parseApiError(e);
                  setToast({ text: msg, timeout: 6000 });
                }
              }}>Join anonymously</button>
              {/* Join & show claim options removed - joining anonymously should prompt claim flow */}
              <button disabled={invitePreviewLoading} onClick={()=> { setShowInviteModal(false); setPendingInviteToken(null); globalThis.window.history.replaceState({}, document.title, globalThis.window.location.pathname); }}>Dismiss</button>
            </div>
            {Array.isArray(unclaimedPlayers) && unclaimedPlayers.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <h4>Unclaimed players</h4>
                <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                  {unclaimedPlayers.map(p => (
                    <div key={p.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:8, border:'1px solid var(--border)', background:'var(--panel)' }}>
                      <div>
                        <div style={{ fontWeight:700 }}>{p.name}</div>
                        <div style={{ fontSize:12, color:'var(--muted)' }}>{p.discord || ''}</div>
                      </div>
                        <div>
                          <button onClick={async ()=>{ setShowClaimModal(true); }}>Claim</button>
                        </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <ClaimModal
        open={showClaimModal}
        campaignId={campaign?.id}
        unclaimedPlayers={unclaimedPlayers}
        userId={userId}
        onClose={() => setShowClaimModal(false)}
        onClaimed={async (newUserId) => {
          if (newUserId) {
            setUserId(newUserId);
            localStorage.setItem('userId', newUserId);
            // after claiming, close invite and refresh players
            setShowInviteModal(false);
            setCampaignsReloadKey(k=>k+1);
            await loadPlayers();
            setToast({ text: 'Player claimed', timeout: 3000 });
          } else {
            // no new user id returned, still reload players
            setShowInviteModal(false);
            await loadPlayers();
          }
          setShowClaimModal(false);
        }}
      />

      <AuthModal open={showAuthModal} onClose={() => setShowAuthModal(false)} onLoggedIn={(id) => {
        const newId = String(id);
        setUserId(newId);
        localStorage.setItem('userId', newId);
        setShowAuthModal(false);
        setCampaignsReloadKey(k=>k+1);
        loadPlayers();
      }} initialCampaignId={campaign?.id} />

      {stepChallengeOpen && stepChallengeStep && (
        <div className="modal-overlay">
          <div className="modal-panel" style={{ width: 520 }}>
            <h3>{getStepChallengeInfo(stepChallengeStep).label} Challenge</h3>
            <p style={{ marginTop: 0 }}>
              Complete this once to unlock this step for your current campaign.
            </p>
            <div style={{ fontSize: 13, marginBottom: 6 }}>
              Score: <b>{zoopleChallengeScore}</b> / {getStepChallengeInfo(stepChallengeStep).minScore}
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <button type="button" onClick={() => startZoopleChallenge(12000)} disabled={zoopleChallengeRunning}>
                {zoopleChallengeRunning ? 'Challenge Running' : 'Start Zoople Challenge (12s)'}
              </button>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Time left: {Math.ceil((zoopleChallengeTimeLeftMs || 0) / 1000)}s
              </div>
            </div>
            <iframe
              key={`step-${stepChallengeStep}-${zoopleGameSessionKey}`}
              title="Zoople Clicker Step Challenge"
              src={`/zoople-clicker.html?embedded=1&session=${zoopleGameSessionKey}`}
              style={{ width: '100%', height: 420, border: '1px solid var(--border)', borderRadius: 10, marginBottom: 8, background: '#000' }}
            />
            {stepChallengeStatus && <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{stepChallengeStatus}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  pendingStepActionRef.current = null;
                  setStepChallengeOpen(false);
                  setStepChallengeStep(null);
                  setStepChallengeStatus('');
                  resetZoopleChallenge();
                }}
              >
                Cancel
              </button>
              <button type="button" onClick={completeStepChallenge}>Unlock Step</button>
            </div>
          </div>
        </div>
      )}

      {showFeedback && (
        <div className="modal-overlay">
          <div className="modal-panel" style={{ width:520 }}>
            <h3>Send feedback / bug report</h3>
            <textarea value={feedbackMsg} onChange={e=> setFeedbackMsg(e.target.value)} style={{ width:'100%', height:120 }} placeholder="Describe the issue and steps to reproduce..." />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:8 }}>
              <button onClick={()=> setShowFeedback(false)}>Cancel</button>
              <button onClick={async ()=>{
                try {
                  const payload = { message: feedbackMsg, url: globalThis.window.location.href, userId };
                  await fetch((import.meta.env.VITE_API_BASE || API_BASE) + '/api/feedback', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
                  alert('Thanks — feedback submitted');
                  setShowFeedback(false);
                  setFeedbackMsg('');
                } catch (e) { console.error(e); alert('Submit failed: ' + (e.message||e)); }
              }}>Send</button>
            </div>
          </div>
        </div>
      )}
      {/* floating feedback button */}
      <button
        title="Send feedback"
        onClick={()=>setShowFeedback(true)}
        style={{
          position: 'fixed',
          right: 16,
          bottom: 16,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'var(--accent)',
          color: 'var(--on-accent)',
          border: 'none',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          cursor: 'pointer',
          zIndex: 1200
        }}
      >
        Feedback
      </button>

      {/* toast */}
      {toast && (
        <div style={{ position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 96, background: 'var(--panel)', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', zIndex: 2000 }}>
          {toast.text}
        </div>
      )}

      {/* Wake overlay and mini-game */}
      <WakeOverlay open={showWake} message={wakeMsg} onClose={() => setShowWake(false)} />
    </div>
  );
}
