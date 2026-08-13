const express = require('express');
const db = require('../db');
const { getCachedQueryAsync, setCache } = require('../lib/cache');
const { CHALLENGE_FEATURES_ENABLED, INVITE_CHALLENGE_TTL_MS, INVITE_PASS_TTL_MS, RIDDLE_BANK, inviteChallengePassTokens, inviteChallengeSessions, makeFakeCaptchaText, pruneInviteChallengeState } = require('../lib/inviteChallenge');
const { genToken } = require('../lib/tokens');
const { getRequestUser, requireCampaignAccess } = require('../middleware/auth');

const router = express.Router();

// Create an invite token for a campaign (owner or member with permission)
router.post('/api/campaigns/:campaignId/invites', requireCampaignAccess(), async (req, res) => {
  try {
    const { expires_at, max_uses, challenge_enabled, challenge_min_score } = req.body || {};
    const user = await getRequestUser(req);
    // owner or member with can_create_invites
    const ownerCheck = user ? await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", req.campaign.id, user.id) : null;
    let allowed = false;
    if (ownerCheck) allowed = true;
    if (!allowed && user) {
      const cm = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', req.campaign.id, user.id);
      if (cm && cm.permissions) {
        try { const perms = JSON.parse(cm.permissions); if (perms && perms.can_create_invites) allowed = true; } catch (e) { }
      }
    }
    if (!allowed) return res.status(403).json({ error: 'forbidden' });

    const token = genToken(32);
    const parsedMaxUses = max_uses === '' || max_uses === null || max_uses === undefined
      ? null
      : Number.parseInt(String(max_uses), 10);
    const normalizedMaxUses = Number.isNaN(parsedMaxUses) || parsedMaxUses <= 0 ? null : parsedMaxUses;
    const parsedMinScore = Number.parseInt(String(challenge_min_score ?? ''), 10);
    const normalizedMinScore = Number.isNaN(parsedMinScore) || parsedMinScore < 1 ? 200 : parsedMinScore;
    const challengeEnabledInt = challenge_enabled ? 1 : 0;
    const info = await db.run('INSERT INTO invites(token,campaign_id,created_by_user_id,expires_at,max_uses,challenge_enabled,challenge_min_score) VALUES (?, ?, ?, ?, ?, ?, ?)',
      token,
      req.campaign.id,
      user && user.id ? user.id : null,
      expires_at || null,
      normalizedMaxUses,
      challengeEnabledInt,
      normalizedMinScore
    );
    const row = await db.get('SELECT * FROM invites WHERE id = ?', info.lastInsertRowid);
    res.json({ ok: true, invite: row });
  } catch (e) {
    console.error('POST /api/campaigns/:campaignId/invites', e);
    res.status(500).json({ error: e.message });
  }
});

// Join a campaign using invite token (authenticated or anonymous)
router.post('/api/invites/join', async (req, res) => {
  try {
    pruneInviteChallengeState();
    const token = req.body && req.body.token;
    if (!token) return res.status(400).json({ error: 'token required' });
    const inv = await db.get('SELECT * FROM invites WHERE token = ?', token);
    if (!inv) return res.status(404).json({ error: 'invite_not_found' });
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(400).json({ error: 'invite_expired' });
    if (inv.max_uses && inv.used_count >= inv.max_uses) return res.status(400).json({ error: 'invite_maxed_out' });
    if (CHALLENGE_FEATURES_ENABLED && inv.challenge_enabled) {
      const passToken = req.body && req.body.challenge_pass_token;
      const pass = passToken ? inviteChallengePassTokens.get(String(passToken)) : null;
      if (!pass || pass.inviteToken !== token || pass.expiresAt <= Date.now()) {
        return res.status(403).json({ error: 'challenge_required' });
      }
      inviteChallengePassTokens.delete(String(passToken));
    }

    const user = await getRequestUser(req);
    // If user provided discord_id in body, try to link
    const discord_id = req.body && req.body.discord_id;

    await db.transaction(async (trx) => {
      // If a user exists (authenticated), add membership linking user
      let joinUserId = null;
      if (user) {
        joinUserId = user.id;
        const exists = await trx.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', inv.campaign_id, user.id);
        if (!exists) await trx.run('INSERT INTO campaign_members(campaign_id,user_id,role) VALUES (?, ?, ?)', inv.campaign_id, user.id, 'player');
      } else if (discord_id) {
        // create or find a user by discord_id
        let u = await trx.get('SELECT * FROM users WHERE discord_id = ?', discord_id);
        if (!u) {
          const info = await trx.run('INSERT INTO users(discord_id, username) VALUES (?, ?)', discord_id, (req.body && req.body.username) || ('discord:'+discord_id));
          u = await trx.get('SELECT * FROM users WHERE id = ?', info.lastInsertRowid);
        }
        joinUserId = u.id;
        const exists = await trx.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', inv.campaign_id, joinUserId);
        if (!exists) await trx.run('INSERT INTO campaign_members(campaign_id,user_id,role) VALUES (?, ?, ?)', inv.campaign_id, joinUserId, 'player');
      }

      // increment used_count
      await trx.run('UPDATE invites SET used_count = used_count + 1 WHERE id = ?', inv.id);
    });

    // include campaign name for client convenience
    const camp = await db.get('SELECT id, name FROM campaigns WHERE id = ?', inv.campaign_id);
    res.json({ ok: true, campaign_id: inv.campaign_id, campaign_name: camp ? camp.name : null });
  } catch (e) {
    console.error('POST /api/invites/join error', e);
    res.status(500).json({ error: e.message });
  }
});

// Get invite information without consuming it (useful for previewing invite/campaign name)
router.get('/api/invites/:token', setCache, async (req, res) => {
  try {
    const token = req.params.token;
    if (!token) return res.status(400).json({ error: 'token required' });
    const cacheKey = `invite_preview_${token}`;
    const result = await getCachedQueryAsync(cacheKey, async () => {
      const inv = await db.get('SELECT * FROM invites WHERE token = ?', token);
      if (!inv) return null;
      const camp = await db.get('SELECT id, name FROM campaigns WHERE id = ?', inv.campaign_id);
      return { invite: inv, campaign: camp };
    });
    if (!result || !result.invite) {
      return res.status(404).json({ error: 'invite_not_found' });
    }
    res.json({ ok: true, invite: result.invite, campaign: result.campaign || null });
  } catch (e) {
    console.error('GET /api/invites/:token error', e);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/invites/:token/challenge', async (req, res) => {
  try {
    pruneInviteChallengeState();
    const token = req.params.token;
    if (!token) return res.status(400).json({ error: 'token required' });
    const inv = await db.get('SELECT * FROM invites WHERE token = ?', token);
    if (!inv) return res.status(404).json({ error: 'invite_not_found' });
    if (!CHALLENGE_FEATURES_ENABLED || !inv.challenge_enabled) return res.json({ ok: true, required: false });

    const riddle = RIDDLE_BANK[Math.floor(Math.random() * RIDDLE_BANK.length)];
    const sessionId = genToken(28);
    const captcha = makeFakeCaptchaText();
    inviteChallengeSessions.set(sessionId, {
      inviteToken: token,
      captcha: captcha.toLowerCase(),
      riddleAnswer: riddle.correct,
      minScore: Number(inv.challenge_min_score) || 200,
      expiresAt: Date.now() + INVITE_CHALLENGE_TTL_MS
    });

    res.json({
      ok: true,
      required: true,
      challenge: {
        session_id: sessionId,
        fake_captcha_text: captcha,
        riddle_question: riddle.question,
        riddle_options: riddle.options,
        min_zoople_score: Number(inv.challenge_min_score) || 200,
        expires_in_ms: INVITE_CHALLENGE_TTL_MS,
      }
    });
  } catch (e) {
    console.error('GET /api/invites/:token/challenge', e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/invites/:token/challenge/complete', async (req, res) => {
  try {
    pruneInviteChallengeState();
    const token = req.params.token;
    const { session_id, zoople_score } = req.body || {};
    if (!token || !session_id) return res.status(400).json({ error: 'token and session_id required' });
    const inv = await db.get('SELECT * FROM invites WHERE token = ?', token);
    if (!inv) return res.status(404).json({ error: 'invite_not_found' });
    if (!CHALLENGE_FEATURES_ENABLED || !inv.challenge_enabled) return res.json({ ok: true, pass_token: null, required: false });

    const sess = inviteChallengeSessions.get(String(session_id));
    if (!sess || sess.inviteToken !== token || sess.expiresAt <= Date.now()) {
      return res.status(400).json({ error: 'challenge_session_invalid' });
    }

    const scoreNum = Number(zoople_score || 0);
    const scoreOk = Number.isFinite(scoreNum) && scoreNum >= (sess.minScore || 200);

    if (!scoreOk) {
      return res.status(400).json({
        error: 'challenge_failed',
        details: { scoreOk, requiredScore: sess.minScore || 200 }
      });
    }

    inviteChallengeSessions.delete(String(session_id));
    const passToken = genToken(36);
    inviteChallengePassTokens.set(passToken, {
      inviteToken: token,
      expiresAt: Date.now() + INVITE_PASS_TTL_MS
    });
    res.json({ ok: true, required: true, pass_token: passToken, expires_in_ms: INVITE_PASS_TTL_MS });
  } catch (e) {
    console.error('POST /api/invites/:token/challenge/complete', e);
    res.status(500).json({ error: e.message });
  }
});

// List invites for a campaign (owner or member can view)
router.get('/api/campaigns/:campaignId/invites', requireCampaignAccess(), async (req, res) => {
  try {
    const rows = await db.all('SELECT * FROM invites WHERE campaign_id = ?', req.campaign.id);
    res.json({ ok: true, invites: rows });
  } catch (e) {
    console.error('GET /api/campaigns/:campaignId/invites', e);
    res.status(500).json({ error: e.message });
  }
});

// Patch invite to edit constraints (owner, creator, or member with permission)
router.patch('/api/invites/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'not_authenticated' });
    const inv = await db.get('SELECT * FROM invites WHERE id = ?', id);
    if (!inv) return res.status(404).json({ error: 'invite_not_found' });
    // check permissions: owner, creator, or member with can_create_invites
    const ownerCheck = await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", inv.campaign_id, user.id);
    let allowed = false;
    if (ownerCheck) allowed = true;
    if (!allowed && inv.created_by_user_id === user.id) allowed = true;
    if (!allowed) {
      const cm = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', inv.campaign_id, user.id);
      if (cm && cm.permissions) {
        try { const perms = JSON.parse(cm.permissions); if (perms && perms.can_create_invites) allowed = true; } catch (e) { }
      }
    }
    if (!allowed) return res.status(403).json({ error: 'forbidden' });

    const { max_uses, expires_at, token, challenge_enabled, challenge_min_score } = req.body || {};
    const updates = [];
    const values = [];

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'max_uses')) {
      const parsedMaxUses = max_uses === '' || max_uses === null || max_uses === undefined
        ? null
        : Number.parseInt(String(max_uses), 10);
      const normalizedMaxUses = Number.isNaN(parsedMaxUses) || parsedMaxUses <= 0 ? null : parsedMaxUses;
      updates.push('max_uses = ?');
      values.push(normalizedMaxUses);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'expires_at')) {
      updates.push('expires_at = ?');
      values.push(expires_at === '' ? null : expires_at);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'token')) {
      updates.push('token = ?');
      values.push(token === '' ? null : token);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'challenge_enabled')) {
      updates.push('challenge_enabled = ?');
      values.push(challenge_enabled ? 1 : 0);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'challenge_min_score')) {
      const parsed = Number.parseInt(String(challenge_min_score ?? ''), 10);
      values.push(Number.isNaN(parsed) || parsed < 1 ? 200 : parsed);
      updates.push('challenge_min_score = ?');
    }

    if (updates.length > 0) {
      values.push(id);
      await db.run(`UPDATE invites SET ${updates.join(', ')} WHERE id = ?`, ...values);
    }
    const updated = await db.get('SELECT * FROM invites WHERE id = ?', id);
    res.json({ ok: true, invite: updated });
  } catch (e) {
    console.error('PATCH /api/invites/:id', e);
    res.status(500).json({ error: e.message });
  }
});

// Delete an invite (owner, creator, or member with can_create_invites)
router.delete('/api/invites/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'not_authenticated' });
    const inv = await db.get('SELECT * FROM invites WHERE id = ?', id);
    if (!inv) return res.status(404).json({ error: 'invite_not_found' });
    // permission check: owner, creator, or member with can_create_invites
    const ownerCheck = await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", inv.campaign_id, user.id);
    let allowed = false;
    if (ownerCheck) allowed = true;
    if (!allowed && inv.created_by_user_id === user.id) allowed = true;
    if (!allowed) {
      const cm = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', inv.campaign_id, user.id);
      if (cm && cm.permissions) {
        try { const perms = JSON.parse(cm.permissions); if (perms && perms.can_create_invites) allowed = true; } catch (e) { }
      }
    }
    if (!allowed) return res.status(403).json({ error: 'forbidden' });
    await db.run('DELETE FROM invites WHERE id = ?', id);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/invites/:id', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
