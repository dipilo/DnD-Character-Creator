import React, { useState } from 'react';
import { API_BASE } from '../api';

export default function AuthModal({ open, onClose, onLoggedIn, initialCampaignId = null }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [campaignId, setCampaignId] = useState(initialCampaignId || '');
  const [pendingInviteToken, setPendingInviteToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function doLogin() {
    setError('');
    if (!username) return setError('username required');
    setLoading(true);
    try {
      const body = { username };
      if (password) body.password = password;
      // prefer invite token if present
      if (pendingInviteToken) {
        body.invite_token = pendingInviteToken;
      } else if (campaignId) body.campaign_id = campaignId;
  const res = await fetch((import.meta.env.VITE_API_BASE || API_BASE) + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || res.status);
      const j = JSON.parse(txt);
      if (j && j.user_id) {
        onLoggedIn && onLoggedIn(String(j.user_id));
        onClose && onClose();
      }
    } catch (e) { setError(e && e.message ? e.message : String(e)); } finally { setLoading(false); }
  }

  async function doSignup() {
    setError('');
    if (!username) return setError('username required');
    // if no password, campaignId or invite token must be provided (campaign-scoped account)
    if (!password && !campaignId && !pendingInviteToken) return setError('Provide a password or a campaign link to create a campaign-scoped account');
    setLoading(true);
    try {
      const body = { username };
      if (password) body.password = password;
      if (pendingInviteToken) body.invite_token = pendingInviteToken;
      else if (campaignId) body.campaign_id = campaignId;
      const res = await fetch((import.meta.env.VITE_API_BASE || API_BASE) + '/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt || res.status);
      const j = JSON.parse(txt);
      if (j && j.user) {
        onLoggedIn && onLoggedIn(String(j.user.id));
        onClose && onClose();
      }
    } catch (e) { setError(e && e.message ? e.message : String(e)); } finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-panel" style={{ width: 520 }}>
        <h3>{mode === 'login' ? 'Login' : 'Sign up'}</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button onClick={() => setMode('login')} style={{ fontWeight: mode === 'login' ? 700 : 400 }}>Login</button>
          <button onClick={() => setMode('signup')} style={{ fontWeight: mode === 'signup' ? 700 : 400 }}>Sign up</button>
        </div>
        <div>
          <label>Username</label>
          <input value={username} onChange={e => setUsername(e.target.value)} style={{ width: '100%', padding: 8 }} />
          <label style={{ marginTop: 8 }}>Password {mode === 'signup' ? '(optional for campaign-scoped accounts)' : ''}</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: 8 }} />
          <label style={{ marginTop: 8 }}>Campaign ID (optional; required for campaign-scoped signup)</label>
          <input value={campaignId} onChange={e => { setCampaignId(e.target.value); setPendingInviteToken(null); }} onBlur={async (e) => {
            const v = e.target.value && e.target.value.trim();
            if (!v) return;
            // if looks like a URL with ?invite= or /?invite=, extract token
            try {
              let token = null;
              try { const u = new URL(v); const qp = new URLSearchParams(u.search); if (qp.get('invite')) token = qp.get('invite'); } catch(_) { /* not a URL */ }
              // if token not found and value looks like a short token (alnum and -_ chars), treat as token
              if (!token && /^[A-Za-z0-9_-]{6,}$/.test(v)) token = v;
              if (token) {
                const base = (import.meta.env.VITE_API_BASE || API_BASE);
                // first try invite lookup
                try {
                  const r = await fetch(base + '/api/invites/' + encodeURIComponent(token));
                  if (r.ok) {
                    const j = await r.json();
                    if (j && j.invite && j.invite.campaign_id) {
                      setCampaignId(String(j.invite.campaign_id));
                      setPendingInviteToken(token);
                      return;
                    }
                  }
                } catch (e) { /* ignore invite lookup failure and try campaign code */ }
                // try campaign code lookup
                try {
                  const r2 = await fetch(base + '/api/campaigns/code/' + encodeURIComponent(token));
                  if (r2.ok) {
                    const j2 = await r2.json();
                    if (j2 && j2.campaign && j2.campaign.id) {
                      setCampaignId(String(j2.campaign.id));
                      // store token as campaign code (not an invite token)
                      setPendingInviteToken(null);
                    }
                  }
                } catch (e) { /* ignore */ }
              }
            } catch (e) { /* ignore resolution errors */ }
          }} style={{ width: '100%', padding: 8 }} />
        </div>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={() => onClose && onClose()}>Cancel</button>
          {mode === 'login' ? (
            <button onClick={doLogin} disabled={loading} style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>{loading ? 'Logging in...' : 'Login'}</button>
          ) : (
            <button onClick={doSignup} disabled={loading} style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>{loading ? 'Signing up...' : 'Sign up'}</button>
          )}
        </div>
      </div>
    </div>
  );
}
