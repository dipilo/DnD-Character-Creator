const express = require('express');
const bcrypt = require('bcrypt');
const { config } = require('../config');
const db = require('../db');
const fetch = require('../lib/httpFetch');
const { genToken } = require('../lib/tokens');
const { getServerOrigin, isAllowedReturnTo } = require('../lib/urls');
const { getRequestUser } = require('../middleware/auth');

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
    const existing = await db.get('SELECT * FROM users WHERE discord_id = ?', uJson.id);
    if (existing) {
      await db.run('UPDATE users SET username = ? WHERE id = ?', uJson.username, existing.id);
      
      // Find potential players to link but don't auto-link them
      let potentialMatches = [];
      try {
      potentialMatches = await db.all(`
        SELECT p.id, p.campaign_id, p.name, p.discord, c.name as campaign_name
        FROM players p 
        JOIN campaigns c ON c.id = p.campaign_id
        WHERE (p.name = ? OR p.discord = ? OR p.discord = ?) 
          AND p.discord_id IS NULL
          AND p.password_hash IS NULL
      `, uJson.username, uJson.username, uJson.global_name || uJson.username);
        potentialMatches = await (async () => {
          const out = [];
          for (const match of potentialMatches) {
            const existingLink = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', match.campaign_id, existing.id);
            if (!existingLink) out.push(match);
          }
          return out;
        })();
      } catch (linkErr) {
        console.warn('Find potential matches failed:', linkErr);
      }
      
      // respond with a small HTML page that posts the user id and potential matches to the opener window
      return res.send(`<!doctype html><html><body>
        <script>
          (function(){
            var userId = ${existing.id};
            var potentialMatches = ${JSON.stringify(potentialMatches)};
            try {
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: 'discord-auth', userId: userId, potentialMatches: potentialMatches }, '*');
                document.write('Login successful. You can close this window.');
                setTimeout(function(){ try{ window.close(); }catch(e){} }, 800);
              } else {
                // No opener (likely opened with 'noopener'): set storage so original tab picks it up
                try { localStorage.setItem('userId', String(userId)); } catch(e){}
                try { localStorage.setItem('pendingMatches', JSON.stringify(potentialMatches)); } catch(e){}
                try { sessionStorage.setItem('dnd-auth', '1'); } catch(e){}
                if (window.name === 'discord_oauth' || window.name === '_blank') {
                  document.write('Login successful. You can close this window.');
                  setTimeout(function(){ try{ window.close(); }catch(e){} }, 800);
                } else {
                  // Same-tab or new-tab fallback — return to the app
                  window.location.replace(${JSON.stringify(returnTo)});
                }
              }
            } catch (e) {
              try { localStorage.setItem('userId', String(userId)); } catch(_){ }
              try { localStorage.setItem('pendingMatches', JSON.stringify(potentialMatches)); } catch(_){ }
              try { sessionStorage.setItem('dnd-auth', '1'); } catch(_){ }
              window.location.replace(${JSON.stringify(returnTo)});
            }
          })();
        </script>
      </body></html>`);
    }
  const info = await db.run('INSERT INTO users(discord_id, username) VALUES (?, ?)', uJson.id, uJson.username);
  const newUser = await db.get('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
    
    // Find potential players to link but don't auto-link them
    let potentialMatches = [];
    try {
      potentialMatches = await db.all(`
        SELECT p.id, p.campaign_id, p.name, p.discord, c.name as campaign_name
        FROM players p 
        JOIN campaigns c ON c.id = p.campaign_id
        WHERE (p.name = ? OR p.discord = ? OR p.discord = ?) 
          AND p.discord_id IS NULL
          AND p.password_hash IS NULL
      `, uJson.username, uJson.username, uJson.global_name || uJson.username);
      
      // No need to filter for new users since they can't have existing campaign memberships
    } catch (linkErr) {
      console.warn('Find potential matches failed:', linkErr);
    }
    
    return res.send(`<!doctype html><html><body>
      <script>
        (function(){
          var userId = ${newUser.id};
          var potentialMatches = ${JSON.stringify(potentialMatches)};
          try {
            if (window.opener && !window.opener.closed) {
              window.opener.postMessage({ type: 'discord-auth', userId: userId, potentialMatches: potentialMatches }, '*');
              document.write('Account created. You can close this window.');
              setTimeout(function(){ try{ window.close(); }catch(e){} }, 800);
            } else {
              try { localStorage.setItem('userId', String(userId)); } catch(e){}
              try { localStorage.setItem('pendingMatches', JSON.stringify(potentialMatches)); } catch(e){}
              try { sessionStorage.setItem('dnd-auth', '1'); } catch(e){}
              if (window.name === 'discord_oauth' || window.name === '_blank') {
                document.write('Account created. You can close this window.');
                setTimeout(function(){ try{ window.close(); }catch(e){} }, 800);
              } else {
                window.location.replace(${JSON.stringify(returnTo)});
              }
            }
          } catch (e) {
            try { localStorage.setItem('userId', String(userId)); } catch(_){ }
            try { localStorage.setItem('pendingMatches', JSON.stringify(potentialMatches)); } catch(_){ }
            try { sessionStorage.setItem('dnd-auth', '1'); } catch(_){ }
            window.location.replace(${JSON.stringify(returnTo)});
          }
        })();
      </script>
    </body></html>`);
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


// Confirm linking Discord user to a specific player
router.post('/api/discord/confirm-link', async (req, res) => {
  try {
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'not_authenticated' });
    
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


// Local signup/login endpoints for non-discord auth
router.post('/auth/signup', async (req, res) => {
  try {
    // allow passing invite_token which resolves to a campaign_id
    const inviteToken = req.body && req.body.invite_token;
    if (inviteToken) {
      const inv = await db.get('SELECT * FROM invites WHERE token = ?', inviteToken);
      if (!inv) return res.status(400).json({ error: 'invalid_invite' });
      // if invite expired or max_uses reached, reject
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(400).json({ error: 'invite_expired' });
      if (inv.max_uses && inv.used_count >= inv.max_uses) return res.status(400).json({ error: 'invite_full' });
      // attach campaignId for downstream logic
      req.body.campaign_id = inv.campaign_id;
    }
    const username = req.body && req.body.username;
    const password = req.body && req.body.password;
    const campaignId = req.body && req.body.campaign_id;
    if (!username) return res.status(400).json({ error: 'username required' });
    // If password provided: create a persistent account. Disallow if any other persistent account
    // (passworded) already uses this username.
    if (password) {
      const conflict = await db.get('SELECT * FROM users WHERE username = ? AND password_hash IS NOT NULL', username);
      if (conflict) return res.status(400).json({ error: 'username_taken' });
      const hash = bcrypt.hashSync(password, 10);
      const info = await db.run('INSERT INTO users(username, password_hash) VALUES (?, ?)', username, hash);
      const u = await db.get('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
      return res.json({ ok: true, user: u });
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
    const u2 = await db.get('SELECT * FROM users WHERE id = ?', info2.lastInsertRowid);
    await db.run('INSERT OR IGNORE INTO campaign_members(campaign_id,user_id,role,permissions) VALUES (?, ?, ?, ?)', campaignId, u2.id, 'player', JSON.stringify({ can_unclaim: true, can_edit_self: true }));
    return res.json({ ok: true, user: u2 });
  } catch (e) {
    console.error('POST /auth/signup', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/auth/login', async (req, res) => {
  try {
    const inviteToken = req.body && req.body.invite_token;
    if (inviteToken) {
      const inv = await db.get('SELECT * FROM invites WHERE token = ?', inviteToken);
      if (!inv) return res.status(400).json({ error: 'invalid_invite' });
      if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(400).json({ error: 'invite_expired' });
      if (inv.max_uses && inv.used_count >= inv.max_uses) return res.status(400).json({ error: 'invite_full' });
      req.body.campaign_id = inv.campaign_id;
    }
    const username = req.body && req.body.username;
    const password = req.body && req.body.password;
    const campaignId = req.body && req.body.campaign_id;
    if (!username) return res.status(400).json({ error: 'username required' });
    // If password provided: search among passworded accounts with this username and verify the password
    if (password) {
      const candidates = await db.all('SELECT * FROM users WHERE username = ? AND password_hash IS NOT NULL', username);
      for (const c of candidates) {
        try {
          if (bcrypt.compareSync(password, c.password_hash)) return res.json({ ok: true, user_id: c.id });
        } catch (e) { /* ignore */ }
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
    return res.json({ ok: true, user_id: u.id });
  } catch (e) {
    console.error('POST /auth/login', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
