// Production-ready API configuration
// Always use environment variable in production, fallback to localhost for development
const getApiBase = () => {
  // Production: Always use environment variable
  if (import.meta.env.VITE_API_BASE) {
    return import.meta.env.VITE_API_BASE;
  }
  
  // Development: Smart detection
  if (globalThis.window?.location) {
    const { protocol, hostname, port } = globalThis.window.location;
    
    // If we're on localhost and not on port 3001, assume dev setup
    if (hostname === 'localhost' && port !== '3001') {
      return `${protocol}//localhost:3001`;
    }
    
    // Otherwise use current origin (works for both dev and prod)
    return globalThis.window.location.origin;
  }
  
  // Fallback for non-browser environments
  return 'http://localhost:3001';
};

export const API_BASE = getApiBase();

// Track whether we've already hinted to the UI that the server may be waking
let wakeHintFired = false;

// Enhanced fetch with timeout and retry logic
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    throw error;
  }
}

function looksLikeBlockedProbeError(message = '') {
  return /blocked|adblock|ERR_BLOCKED|failed to fetch|network|ERR_INSUFFICIENT_RESOURCES|aborted|timeout/i.test(String(message));
}

// Broadcast a one-off hint that the server may be waking up
function notifyServerWaking(detail) {
  try {
    const reason = String(detail?.reason || '');
    const message = String(detail?.message || '');
    if (looksLikeBlockedProbeError(`${reason} ${message}`)) {
      return;
    }
    if (globalThis.window) {
      globalThis.window.dispatchEvent(new CustomEvent('server-waking', { detail }));
    }
  } catch (error_) { console.debug('notifyServerWaking failed', error_); }
}

function createWakeGuard(path, fullUrl) {
  let guardTimer;
  return {
    start: () => {
      if (wakeHintFired) return;
      guardTimer = setTimeout(async () => {
        try {
          const resp = await fetchWithTimeout(API_BASE + '/health', {}, 2000);
          if (!resp.ok) {
            notifyServerWaking({ reason: 'health-pending', path, url: fullUrl });
            wakeHintFired = true;
          }
        } catch (error_) {
          const message = error_?.message || String(error_);
          if (!looksLikeBlockedProbeError(message)) {
            notifyServerWaking({ reason: 'network-timeout', path, url: fullUrl, message });
            wakeHintFired = true;
          }
          console.debug('health guard probe failed', error_);
        }
      }, 1200);
    },
    clear: () => {
      if (!guardTimer) return;
      clearTimeout(guardTimer);
      guardTimer = null;
    }
  };
}

async function fetchWithRetries(fullUrl, fallbackPath, opts, retries, guard) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt === 0) guard.start();
      const response = await fetchWithTimeout(fullUrl, opts, 15000);
      guard.clear();
      return response;
    } catch (error_) {
      guard.clear();
      console.debug('fetchJson attempt failed', error_);
      if (attempt === retries) {
        try {
          return await fetchWithTimeout(fallbackPath, opts, 15000);
        } catch (fallbackError_) {
          const netMsg = fallbackError_?.message || String(fallbackError_);
          if (!looksLikeBlockedProbeError(netMsg)) {
            notifyServerWaking({ reason: 'network-timeout', path: fallbackPath, url: fullUrl, message: netMsg });
          }
          throw new Error(`Network error when fetching ${fullUrl}: ${netMsg}`);
        }
      }
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error('Unexpected retry exhaustion');
}

async function fetchJson(path, opts, retries = 2) {
  const fullUrl = API_BASE + path;
  const guard = createWakeGuard(path, fullUrl);
  const r = await fetchWithRetries(fullUrl, path, opts, retries, guard);
  
  if (!r.ok) {
    // For typical wake-up periods on free hosting, surface a friendly hint
    if ([502, 503, 504, 522, 524, 408].includes(r.status)) {
      notifyServerWaking({ reason: 'unavailable', status: r.status, path, url: fullUrl });
      wakeHintFired = true;
    }
    const body = await r.text().catch(()=>'(no body)');
    throw new Error(`HTTP ${r.status}: ${body}`);
  }
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) return r.json();
  return r.text();
}

const withUserHeader = (opts, userId) => {
  const copy = opts ? { ...opts } : {};
  copy.headers = opts?.headers ? { ...opts.headers } : {};
  if (userId) copy.headers['X-User-Id'] = String(userId);
  return copy;
};

function notifyPlayersChanged(detail) {
  try {
    if (globalThis.window) {
      globalThis.window.dispatchEvent(new CustomEvent('players-changed', { detail }));
      try {
        const bc = new BroadcastChannel('dnd-players');
        bc.postMessage(detail);
        bc.close();
      } catch (error_) {
        console.debug('BroadcastChannel failed', error_);
      }
    }
  } catch (error_) {
    console.debug('notifyPlayersChanged failed', error_);
  }
}

export async function fetchPlayers({ campaignId, userId } = {}){
  if (!campaignId) throw new Error('campaignId required');
  return fetchJson(`/api/players?campaign_id=${encodeURIComponent(campaignId)}`, withUserHeader(undefined, userId));
}

export async function fetchAvailability(playerId, opts = {}){
  const { campaignId, userId } = opts || {};
  if (!campaignId) throw new Error('campaignId required');
  return fetchJson(`/api/availability?player_id=${encodeURIComponent(playerId)}&campaign_id=${encodeURIComponent(campaignId)}`, withUserHeader(undefined, userId));
}

export async function previewAvailabilityFromText(payload = {}, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (opts?.userId) headers['X-User-Id'] = String(opts.userId);
  return fetchJson('/api/availability/preview', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  }, 0);
}

export async function postAvailability(payload = {}, opts = {}){
  const res = await fetch(API_BASE + '/api/availability', withUserHeader({ method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }, opts.userId));
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  return res.json();
}

export async function deleteAvailability(id, opts = {}){
  const res = await fetch(API_BASE + `/api/availability/${id}`, withUserHeader({ method: 'DELETE' }, opts.userId));
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  return res.json();
}

export async function updateAvailability(id, payload = {}, opts = {}){
  const res = await fetch(API_BASE + `/api/availability/${id}`, withUserHeader({ method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }, opts.userId));
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  return res.json();
}

// Batch availability: coalesce multiple creates/updates/deletes
export async function postAvailabilityBatch(operations = [], opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (opts?.userId) headers['X-User-Id'] = String(opts.userId);
  const body = JSON.stringify({ operations, campaign_id: opts.campaignId });
  return fetchJson('/api/availability/batch', { method: 'POST', headers, body }, 0);
}

export async function syncSheet(spreadsheetId, mapping, campaignId = null){
  const payload = { spreadsheetId, mapping };
  if (campaignId) payload.campaign_id = campaignId;
  const res = await fetch(API_BASE + '/api/sync', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
  return res;
}

export async function fetchSheetColumns(spreadsheetId){ return fetchJson('/api/sheet-columns', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ spreadsheetId }) }); }

export async function updatePlayer(playerId, payload, opts = {}){
  const res = await fetch(API_BASE + `/api/players/${playerId}`, withUserHeader({ method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }, opts.userId));
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  const json = await res.json();
  notifyPlayersChanged({ action: 'update', player: json.player || json });
  return json;
}

export function rebuildAvailability(playerId){ return fetchJson(`/api/rebuild/${playerId}`, { method: 'POST' }); }
export function pushToSheet(payload){ return fetchJson('/api/push-to-sheet', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); }

export function fetchAggregates(startIso, endIso, playerIds = null, opts = {}){
  const { campaignId, userId } = opts || {};
  const params = new URLSearchParams();
  params.set('start', startIso);
  params.set('end', endIso);
  if (Array.isArray(playerIds) && playerIds.length > 0) params.set('player_ids', playerIds.join(','));
  if (campaignId) params.set('campaign_id', String(campaignId));
  return fetchJson(`/api/availability/aggregate?${params.toString()}`, withUserHeader(undefined, userId));
}

export async function createPlayer(payload = {}, opts = {}) {
  const res = await fetch(API_BASE + '/api/players', withUserHeader({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, opts.userId || payload._userId));
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  const json = await res.json();
  // notify other components/tabs that players changed
  notifyPlayersChanged({ action: 'create', player: json.player || json });
  return json;
}

export async function deletePlayer(id, userId) {
  const res = await fetch(API_BASE + `/api/players/${id}`, withUserHeader({ method: 'DELETE' }, userId));
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  const json = await res.json();
  notifyPlayersChanged({ action: 'delete', playerId: id });
  return json;
}

// Campaign & invites
export async function createCampaign(payload, userId) {
  const bodyPayload = payload || {};
  const res = await fetch(API_BASE + '/api/campaigns', { method: 'POST', headers: { 'Content-Type':'application/json', ...(userId?{'X-User-Id':userId}:{}) }, body: JSON.stringify(bodyPayload) });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
export async function listCampaigns(userId) {
  try {
    // use fetchJson wrapper so errors are normalized
    return fetchJson('/api/campaigns', withUserHeader(undefined, userId));
  } catch (e) {
    // Provide a clearer error for the UI to handle
    throw new Error('Network error fetching campaigns: ' + (e?.message || String(e)));
  }
}
export async function createInvite(campaignId, opts, userId) {
  const inviteOpts = opts || {};
  const res = await fetch(API_BASE + `/api/campaigns/${encodeURIComponent(campaignId)}/invites`, { method: 'POST', headers: { 'Content-Type':'application/json', ...(userId?{'X-User-Id':userId}:{}) }, body: JSON.stringify(inviteOpts) });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
export async function listInvites(campaignId, userId) {
  const res = await fetch(API_BASE + `/api/campaigns/${encodeURIComponent(campaignId)}/invites`, { headers: { ...(userId?{'X-User-Id':userId}:{}) } });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
export async function deleteInvite(inviteId, userId) {
  const res = await fetch(API_BASE + `/api/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE', headers: { ...(userId?{'X-User-Id':userId}:{}) } });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
// list campaign members
export async function listMembers(campaignId, userId) {
  const res = await fetch(API_BASE + `/api/campaigns/${encodeURIComponent(campaignId)}/members`, { headers: { ...(userId?{'X-User-Id':userId}:{}) } });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
export async function patchInvite(inviteId, payload, userId) {
  const bodyPayload = payload || {};
  const res = await fetch(API_BASE + `/api/invites/${encodeURIComponent(inviteId)}`, { method: 'PATCH', headers: { 'Content-Type':'application/json', ...(userId?{'X-User-Id':userId}:{}) }, body: JSON.stringify(bodyPayload) });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
export async function joinWithInvite(token, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (opts?.userId) headers['X-User-Id'] = String(opts.userId);
  const bodyPayload = opts?.body ? { token, ...opts.body } : { token };
  const res = await fetch(API_BASE + '/api/invites/join', { method: 'POST', headers, body: JSON.stringify(bodyPayload) });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}

export async function fetchInviteChallenge(token) {
  return fetchJson(`/api/invites/${encodeURIComponent(token)}/challenge`, undefined, 1);
}

export async function completeInviteChallenge(token, payload = {}) {
  return fetchJson(`/api/invites/${encodeURIComponent(token)}/challenge/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }, 0);
}

// Get invite preview with optimized timeout and retry logic
export async function getInvitePreview(token) {
  // Use shorter timeout but more retries for invite preview to fail fast and retry
  return await fetchJsonWithCustomTimeout(`/api/invites/${encodeURIComponent(token)}`, {}, 8000, 3); // 8 second timeout, 3 retries
}

// Custom fetchJson with configurable timeout
async function fetchJsonWithCustomTimeout(path, opts, timeout = 15000, retries = 2) {
  let r;
  const fullUrl = API_BASE + path;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      r = await fetchWithTimeout(fullUrl, opts, timeout);
      break;
    } catch (error_) {
      console.debug('fetchJsonWithCustomTimeout attempt failed', error_);
      // On final attempt, try same-origin relative path as fallback
      if (attempt === retries) {
        try {
          r = await fetchWithTimeout(path, opts, timeout);
          break;
        } catch (error_) {
          const netMsg = error_?.message || String(error_);
          throw new Error(`Network error when fetching ${fullUrl}: ${netMsg}`);
        }
      }
      
      // Wait before retry (shorter wait for invite previews)
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(1.5, attempt), 3000)));
      }
    }
  }
  
  if (!r.ok) {
    const body = await r.text().catch(()=>'(no body)');
    throw new Error(`HTTP ${r.status}: ${body}`);
  }
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) return r.json();
  return r.text();
}

export async function listUnclaimedPlayers(campaignId, userId) {
  const opts = { 
    headers: { ...(userId ? {'X-User-Id': userId} : {}) } 
  };
  return await fetchJson(`/api/campaigns/${encodeURIComponent(campaignId)}/unclaimed-players`, opts, 2); // 2 retries for unclaimed list
}
export async function claimPlayer(campaignId, payload, userId) {
  const bodyPayload = payload || {};
  const opts = { 
    method: 'POST', 
    headers: { 
      'Content-Type': 'application/json', 
      ...(userId ? {'X-User-Id': userId} : {}) 
    }, 
    body: JSON.stringify(bodyPayload) 
  };
  return await fetchJson(`/api/campaigns/${encodeURIComponent(campaignId)}/claim-player`, opts, 3); // 3 retries for claiming
}

export async function unclaimPlayer(campaignId, playerId, userId) {
  const opts = { 
    method: 'POST', 
    headers: { 
      'Content-Type': 'application/json', 
      ...(userId ? {'X-User-Id': userId} : {}) 
    }, 
    body: JSON.stringify({ player_id: playerId }) 
  };
  return await fetchJson(`/api/campaigns/${encodeURIComponent(campaignId)}/unclaim-player`, opts, 3); // 3 retries for unclaiming
}

export async function updateMemberPermissions(campaignId, memberId, permissions, userId) {
  const normalizedPermissions = permissions || {};
  const res = await fetch(API_BASE + `/api/campaigns/${encodeURIComponent(campaignId)}/members/${memberId}/permissions`, { method: 'PATCH', headers: { 'Content-Type':'application/json', ...(userId?{'X-User-Id':userId}:{}) }, body: JSON.stringify({ permissions: normalizedPermissions }) });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}

export async function leaveCampaign(campaignId, userId) {
  const res = await fetch(API_BASE + `/api/campaigns/${encodeURIComponent(campaignId)}/leave`, { method: 'POST', headers: { 'Content-Type':'application/json', ...(userId?{'X-User-Id':userId}:{}) }, body: JSON.stringify({}) });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}

  export async function regenerateCampaignCode(campaignId, userId) {
    if (!campaignId) throw new Error('campaignId required');
    return fetchJson(`/api/campaigns/${campaignId}/regenerate-code`, withUserHeader({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) }, userId));
  }

export async function updateCampaign(campaignId, payload, userId) {
  const bodyPayload = payload || {};
  const res = await fetch(API_BASE + `/api/campaigns/${encodeURIComponent(campaignId)}`, { method: 'PUT', headers: { 'Content-Type':'application/json', ...(userId?{'X-User-Id':userId}:{}) }, body: JSON.stringify(bodyPayload) });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}

export async function deleteCampaign(campaignId, userId) {
  const res = await fetch(API_BASE + `/api/campaigns/${encodeURIComponent(campaignId)}`, { method: 'DELETE', headers: { ...(userId?{'X-User-Id':userId}:{}) } });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}

export async function reorderCampaigns(ids, userId) {
  const campaignIds = ids || [];
  const res = await fetch(API_BASE + '/api/campaigns/reorder', { method: 'POST', headers: { 'Content-Type':'application/json', ...(userId?{'X-User-Id':userId}:{}) }, body: JSON.stringify({ ids: campaignIds }) });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}

export async function reorderPlayers(ids = []) {
  const res = await fetch(API_BASE + '/api/players/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  return res.json();
}

// groups
export async function fetchGroups(opts = {}) {
  const { campaignId, userId } = opts;
  if (!campaignId) throw new Error('campaignId required');
  return fetchJson(`/api/groups?campaign_id=${encodeURIComponent(campaignId)}`, withUserHeader(undefined, userId));
}

export async function createGroup(payload, userId) {
  const bodyPayload = payload || {};
  const res = await fetch(API_BASE + '/api/groups', withUserHeader({ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(bodyPayload) }, userId));
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
export async function deleteGroup(id, userId) {
  const headers = {};
  if (userId) headers['X-User-Id'] = String(userId);
  const res = await fetch(API_BASE + `/api/groups/${id}`, { method:'DELETE', headers });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}

// Poll the server's health endpoint until it responds OK or timeout
export async function waitForServerReady({ interval = 3000, maxWait = 90000 } = {}) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < maxWait) {
    try {
      const r = await fetchWithTimeout(API_BASE + '/health', {}, 5000);
      if (r.ok) return true;
    } catch (error_) {
      lastError = error_;
      const message = error_?.message || String(error_);
      const isProbeBlocked = looksLikeBlockedProbeError(message);
      if (isProbeBlocked) {
        console.debug('waitForServerReady probe blocked or unavailable, proceeding without blocking the UI', error_);
        return false;
      }
      console.debug('waitForServerReady probe failed', error_);
    }
    if (maxWait <= 5000) return false;
    await new Promise(res => setTimeout(res, interval));
  }
  if (lastError) {
    console.debug('waitForServerReady timed out after probe failures', lastError);
  }
  return false;
}

export async function isServerHealthy({ timeout = 1500 } = {}) {
  try {
    const r = await fetchWithTimeout(API_BASE + '/health', {}, timeout);
    return r.ok;
  } catch (error_) {
    const message = error_?.message || String(error_);
    if (looksLikeBlockedProbeError(message)) {
      console.debug('isServerHealthy probe blocked or unavailable', error_);
      return null;
    }
    console.debug('isServerHealthy probe failed', error_);
    return false;
  }
}

export { notifyServerWaking };
export async function addGroupMember(groupId, playerId, userId) {
  const res = await fetch(API_BASE + `/api/groups/${groupId}/members`, withUserHeader({ method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ player_id: playerId }) }, userId));
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
export async function removeGroupMember(groupId, playerId, userId) {
  const headers = {};
  if (userId) headers['X-User-Id'] = String(userId);
  const res = await fetch(API_BASE + `/api/groups/${groupId}/members/${playerId}`, { method: 'DELETE', headers });
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
export async function saveSuggestedGroups(payload, userId) {
  if (!payload.campaign_id) throw new Error('campaign_id required');
  const headers = { 'Content-Type': 'application/json' };
  if (userId) headers['X-User-Id'] = String(userId);
  const res = await fetch(API_BASE + '/api/groups/save-suggestion', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
  return res.json();
}
export async function suggestGroups(params = {}) {
  if (!params.campaign_id) throw new Error('campaign_id required');
  const res = await fetch(API_BASE + '/api/groups/suggest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
  return res.json();
}
export async function updateGroup(groupId, payload, userId) {
  const bodyPayload = payload || {};
  const res = await fetch(API_BASE + `/api/groups/${groupId}`, withUserHeader({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyPayload) }, userId));
  if (!res.ok) { const body = await res.text(); throw new Error(body); }
  return res.json();
}
export async function reorderGroups(ids = []) {
  const res = await fetch(API_BASE + '/api/groups/reorder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids })
  });
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  return res.json();
}

export async function confirmDiscordLink(playerId, campaignId, userId) {
  const res = await fetch(API_BASE + '/api/discord/confirm-link', withUserHeader({ 
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ player_id: playerId, campaign_id: campaignId }) 
  }, userId));
  if (!res.ok) { const body = await res.text(); throw new Error(`${res.status}: ${body}`); }
  return res.json();
}
