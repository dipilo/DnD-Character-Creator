const express = require('express');
const bcrypt = require('bcrypt');
const { config } = require('../config');
const db = require('../db');
const fetch = require('../lib/httpFetch');
const { genToken } = require('../lib/tokens');
const {
  clearSessionCookie,
  createSession,
  publicUser,
  revokeAllSessionsForUser,
  revokeSession,
} = require('../lib/sessions');
const { getServerOrigin, isAllowedReturnTo } = require('../lib/urls');
const { optionalAuth, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ---------- Discord OAuth skeleton ----------
// Configure in server/config.json: { discordClientId, discordClientSecret, discordRedirectUri }
router.get('/auth/discord', (req, res) => {
  const state = genToken(12);
  const clientId = config.discordClientId;
  // prefer configured redirect unless it points to localhost; then derive from current host
  const cfgUri = config.discordRedirectUri;
  const isLocal = cfgUri && /localhost|127\.0\.0\.1/i.test(cfgUri);
  const redirectUri = (!cfgUri || isLocal) ? (getServerOrigin(req) + '/auth/discord/callback') : cfgUri;
  if (!clientId) return res.status(500).send('discord client id not configured');
  const scope = 'identify email';
  // allow the client to pass a returnTo URL so we can navigate back after login
  const returnTo = req.query.returnTo ? String(req.query.returnTo) : '';
  const statePayload = Buffer.from(JSON.stringify({ s: state, returnTo })).toString('base64url');
  const url = `https://discord.com/api/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(statePayload)}`;
  // For simplicity store state in-memory (stateless in this simple server)
  res.redirect(url);
});

/**
 * Campaign seats that look like they belong to this Discord user but are not yet linked.
 * The old callback shipped these to the client through postMessage/localStorage alongside a raw
 * user id; now the browser is redirected with a session cookie and asks for them separately.
 */
async function findPotentialPlayerLinks(user, discordProfile) {
  const username = discordProfile?.username ?? user.username;
  const globalName = discordProfile?.global_name || username;
  try {
    const matches = await db.all(`
      SELECT p.id, p.campaign_id, p.name, p.discord, c.name as campaign_name
      FROM players p
      JOIN campaigns c ON c.id = p.campaign_id
      WHERE (p.name = ? OR p.discord = ? OR p.discord = ?)
        AND p.discord_id IS NULL
        AND p.password_hash IS NULL
    `, username, username, globalName);
    const out = [];
    for (const match of matches) {
      const existingLink = await db.get('SELECT 1 AS ok FROM campaign_members WHERE campaign_id = ? AND user_id = ?', match.campaign_id, user.id);
      if (!existingLink) out.push(match);
    }
    return out;
  } catch (linkErr) {
    console.warn('Find potential matches failed:', linkErr);
    return [];
  }
}

router.get('/auth/discord/callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('code required');
    // decode state to extract returnTo if provided
    let returnTo = '/';
    const serverOrigin = getServerOrigin(req);
    try {
      const rawState = req.query.state || '';
      if (rawState) {
        const parsed = JSON.parse(Buffer.from(String(rawState), 'base64url').toString('utf8'));
        if (parsed && typeof parsed.returnTo === 'string' && isAllowedReturnTo(parsed.returnTo, serverOrigin)) {
          returnTo = parsed.returnTo;
        }
      }
    } catch (_) { returnTo = '/'; }
    const redirectUriComputed = (() => {
      const cfgUri = config.discordRedirectUri;
      const isLocal = cfgUri && /localhost|127\.0\.0\.1/i.test(cfgUri);
      return (!cfgUri || isLocal) ? (serverOrigin + '/auth/discord/callback') : cfgUri;
    })();

    const UA = process.env.FORCED_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    const basicAuth = Buffer.from(`${config.discordClientId}:${config.discordClientSecret}`).toString('base64');
    async function exchangeToken(url) {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': UA,
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUriComputed
        })
      });
      const text = await res.text();
      return { res, text };
    }
    let { res: tokenRes, text: tokenText } = await exchangeToken('https://discord.com/api/oauth2/token');
    // Fallback: if Cloudflare blocks on discord.com, try legacy host discordapp.com
    if (tokenRes.status === 429 && /Cloudflare/i.test(tokenText)) {
      const fallback = await exchangeToken('https://discordapp.com/api/oauth2/token');
      tokenRes = fallback.res; tokenText = fallback.text;
    }
    let tokenJson;
    try { tokenJson = JSON.parse(tokenText); } catch(_) { tokenJson = null; }
    if (!tokenRes.ok || !tokenJson || !tokenJson.access_token) {
      console.error('Discord token exchange failed', {
        status: tokenRes.status,
        body: tokenText && tokenText.slice(0,400),
        redirect_uri: redirectUriComputed
      });
      return res.status(400).send('oauth failed');
    }
    const uRes = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenJson.access_token}`, 'User-Agent': UA, 'Accept': 'application/json', 'Accept-Language': 'en-US,en;q=0.9', 'Connection': 'keep-alive' } });
    const uJson = await uRes.json();

    // create or update users table
    let user = await db.get('SELECT * FROM users WHERE discord_id = ?', uJson.id);
    if (user) {
      await db.run('UPDATE users SET username = ? WHERE id = ?', uJson.username, user.id);
    } else {
      const info = await db.run('INSERT INTO users(discord_id, username) VALUES (?, ?)', uJson.id, uJson.username);
      user = await db.get('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
    }

    // The whole point of Phase 1b: the browser leaves this route holding an httpOnly session
    // cookie, not a user id it was trusted to send back. Unlinked seats are fetched afterwards
    // from /api/discord/potential-links, which requires that session.
    await createSession(req, res, user);
    return res.redirect(returnTo);
  } catch (e) {
    console.error('Discord callback error', e);
    res.status(500).send('oauth error');
  }
});

// OAuth diagnostics: confirm configuration and external reachability
router.get('/diag/oauth', async (req, res) => {
  try {
    const serverOrigin = getServerOrigin(req);
    const cfgUri = config.discordRedirectUri;
    const isLocal = cfgUri && /localhost|127\.0\.0\.1/i.test(cfgUri);
    const redirectUriComputed = (!cfgUri || isLocal) ? (serverOrigin + '/auth/discord/callback') : cfgUri;
    const UA = process.env.FORCED_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    // Reachability probe: expect 401 Unauthorized but should not be blocked by Cloudflare
    let reachability = { ok: false, status: null, note: null };
    try {
      const probe = await fetch('https://discord.com/api/users/@me', { headers: { 'User-Agent': UA, 'Accept': 'application/json' } });
      reachability.ok = probe.status === 401 || probe.status === 200; // 401 expected without token
      reachability.status = probe.status;
      if (!reachability.ok) {
        const body = await probe.text();
        reachability.note = (body && body.slice(0, 200)) || null;
      }
    } catch (err) {
      reachability.ok = false;
      reachability.status = null;
      reachability.note = String(err && err.message ? err.message : err);
    }
    res.json({
      ok: true,
      server_origin: serverOrigin,
      redirect_uri_computed: redirectUriComputed,
      env: {
        discord_client_id_present: Boolean(config.discordClientId),
        discord_client_secret_present: Boolean(config.discordClientSecret),
        discord_redirect_uri_set: Boolean(config.discordRedirectUri),
      },
      reachability,
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Campaign seats this Discord user could claim. Replaces the potentialMatches blob the OAuth
// callback used to postMessage into the opener window.
router.get('/api/discord/potential-links', requireAuth, async (req, res) => {
  try {
    if (!req.user.discord_id) return res.json({ ok: true, potential_matches: [] });
    const matches = await findPotentialPlayerLinks(req.user, null);
    res.json({ ok: true, potential_matches: matches });
  } catch (e) {
    console.error('GET /api/discord/potential-links', e);
    res.status(500).json({ error: e.message });
  }
});

// Confirm linking Discord user to a specific player
router.post('/api/discord/confirm-link', requireAuth, async (req, res) => {
  try {
    const user = req.user;
    const { player_id, campaign_id } = req.body;
    if (!player_id || !campaign_id) {
      return res.status(400).json({ error: 'player_id and campaign_id required' });
    }

    // Verify the player exists and isn't already claimed
    const player = await db.get('SELECT * FROM players WHERE id = ? AND campaign_id = ? AND discord_id IS NULL', player_id, campaign_id);
    if (!player) {
      return res.status(404).json({ error: 'Player not found or already claimed' });
    }

    // Check if user is already linked to this campaign
    const existingLink = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', campaign_id, user.id);
    if (existingLink) {
      return res.status(400).json({ error: 'Already linked to this campaign' });
    }
    // Create the link
    await db.run('INSERT INTO campaign_members (campaign_id, user_id, player_id, role) VALUES (?, ?, ?, ?)', campaign_id, user.id, player_id, 'player');
    await db.run('UPDATE players SET discord_id = ? WHERE id = ?', user.discord_id, player_id);
    const campRow = await db.get('SELECT name FROM campaigns WHERE id = ?', campaign_id);
    res.json({ ok: true, campaign_id, player_id, campaign_name: campRow && campRow.name });
  } catch (e) {
    console.error('POST /api/discord/confirm-link', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * Resolve an invite_token in the request body to its campaign_id, or return an error code.
 * Shared by signup and login, which both accept an invite as a way to name the campaign a
 * passwordless account is scoped to.
 */
async function applyInviteToken(req) {
  const inviteToken = req.body?.invite_token;
  if (!inviteToken) return null;
  const inv = await db.get('SELECT * FROM invites WHERE token = ?', inviteToken);
  if (!inv) return 'invalid_invite';
  if (inv.expires_at && new Date(inv.expires_at) < new Date()) return 'invite_expired';
  if (inv.max_uses && inv.used_count >= inv.max_uses) return 'invite_full';
  req.body.campaign_id = inv.campaign_id;
  return null;
}

// Local signup/login endpoints for non-discord auth
router.post('/auth/signup', async (req, res) => {
  try {
    // allow passing invite_token which resolves to a campaign_id
    const inviteError = await applyInviteToken(req);
    if (inviteError) return res.status(400).json({ error: inviteError });

    const username = req.body?.username;
    const password = req.body?.password;
    const campaignId = req.body?.campaign_id;
    if (!username) return res.status(400).json({ error: 'username required' });
    // If password provided: create a persistent account. Disallow if any other persistent account
    // (passworded) already uses this username.
    if (password) {
      const conflict = await db.get('SELECT * FROM users WHERE username = ? AND password_hash IS NOT NULL', username);
      if (conflict) return res.status(400).json({ error: 'username_taken' });
      const hash = bcrypt.hashSync(password, 10);
      const info = await db.run('INSERT INTO users(username, password_hash) VALUES (?, ?)', username, hash);
      const u = await db.get('SELECT id, username, discord_id, created_at FROM users WHERE id = ?', info.lastInsertRowid);
      await createSession(req, res, u);
      return res.json({ ok: true, user: publicUser(u) });
    }

    // Password not provided -> create a campaign-scoped account. Require campaignId.
    if (!campaignId) return res.status(400).json({ error: 'campaign_required_for_passwordless' });

    // If a passwordless user with the same username already exists in this campaign, reject.
    const existingInCampaign = await db.get(`
      SELECT u.* FROM users u JOIN campaign_members cm ON cm.user_id = u.id
      WHERE u.username = ? AND u.password_hash IS NULL AND cm.campaign_id = ?
    `, username, campaignId);
    if (existingInCampaign) return res.status(400).json({ error: 'username_taken_in_campaign' });

    // Create a new passwordless user scoped to this campaign
    const info2 = await db.run('INSERT INTO users(username, password_hash) VALUES (?, ?)', username, null);
    const u2 = await db.get('SELECT id, username, discord_id, created_at FROM users WHERE id = ?', info2.lastInsertRowid);
    await db.run('INSERT OR IGNORE INTO campaign_members(campaign_id,user_id,role,permissions) VALUES (?, ?, ?, ?)', campaignId, u2.id, 'player', JSON.stringify({ can_unclaim: true, can_edit_self: true }));
    await createSession(req, res, u2);
    return res.json({ ok: true, user: publicUser(u2) });
  } catch (e) {
    console.error('POST /auth/signup', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const inviteError = await applyInviteToken(req);
    if (inviteError) return res.status(400).json({ error: inviteError });

    const username = req.body?.username;
    const password = req.body?.password;
    const campaignId = req.body?.campaign_id;
    if (!username) return res.status(400).json({ error: 'username required' });
    // If password provided: search among passworded accounts with this username and verify the password
    if (password) {
      const candidates = await db.all('SELECT * FROM users WHERE username = ? AND password_hash IS NOT NULL', username);
      for (const c of candidates) {
        let matched = false;
        try {
          matched = bcrypt.compareSync(password, c.password_hash);
        } catch (e) {
          console.warn('bcrypt compare failed for user', c.id, e?.message);
        }
        if (matched) {
          await createSession(req, res, c);
          return res.json({ ok: true, user: publicUser(c) });
        }
      }
      return res.status(401).json({ error: 'invalid_credentials' });
    }

    // Password not provided: require campaign_id and find a passwordless user with this username linked to that campaign
    if (!campaignId) return res.status(400).json({ error: 'password_or_campaign_required' });
    const u = await db.get(`
      SELECT u.* FROM users u JOIN campaign_members cm ON cm.user_id = u.id
      WHERE u.username = ? AND u.password_hash IS NULL AND cm.campaign_id = ?
    `, username, campaignId);
    if (!u) return res.status(401).json({ error: 'invalid_credentials' });
    await createSession(req, res, u);
    return res.json({ ok: true, user: publicUser(u) });
  } catch (e) {
    console.error('POST /auth/login', e);
    res.status(500).json({ error: e.message });
  }
});

// Who am I? The client's only way to learn its own identity — the cookie is the source of truth
// and script cannot read it.
router.get('/api/me', optionalAuth, (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'not_authenticated' });
  res.json({ ok: true, user: publicUser(req.user) });
});

// Sign out this device. Revokes server-side, so a copied cookie dies with it.
router.post('/auth/logout', optionalAuth, async (req, res) => {
  try {
    if (req.user?.session_id) await revokeSession(req.user.session_id);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /auth/logout', e);
    res.status(500).json({ error: e.message });
  }
});

// Sign out everywhere.
router.post('/auth/logout-all', requireAuth, async (req, res) => {
  try {
    await revokeAllSessionsForUser(req.user.id);
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (e) {
    console.error('POST /auth/logout-all', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
