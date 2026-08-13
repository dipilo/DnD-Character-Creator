const express = require('express');
const db = require('../db');
const { getCachedQueryAsync, setCache } = require('../lib/cache');
const { CHALLENGE_FEATURES_ENABLED, INVITE_CHALLENGE_TTL_MS, INVITE_PASS_TTL_MS, inviteChallengePassTokens, inviteChallengeSessions, makeFakeCaptchaText, pickRiddle, pruneInviteChallengeState } = require('../lib/inviteChallenge');
const { genToken } = require('../lib/tokens');
const { getCampaignMembership, isCampaignOwner, memberHasPermission, optionalAuth, requireAuth, requireCampaignAccess } = require('../middleware/auth');

const router = express.Router();

/** An empty/absent/non-positive max_uses means "unlimited", stored as NULL. */
function normalizeMaxUses(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
}

function normalizeMinScore(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isNaN(parsed) || parsed < 1 ? 200 : parsed;
}

// The columns PATCH /api/invites/:id may write, and how each request value is normalised. A
// table rather than one hasOwnProperty branch per column.
const PATCHABLE_INVITE_FIELDS = [
  ['max_uses', normalizeMaxUses],
  ['expires_at', (v) => (v === '' ? null : v)],
  ['token', (v) => (v === '' ? null : v)],
  ['challenge_enabled', (v) => (v ? 1 : 0)],
  ['challenge_min_score', normalizeMinScore],
];

/** Owner, the invite's creator, or a member holding can_create_invites. */
async function canManageInvites(user, campaignId, invite = null) {
  if (!user) return false;
  if (await isCampaignOwner(user.id, campaignId)) return true;
  if (invite && invite.created_by_user_id === user.id) return true;
  const cm = await getCampaignMembership(user.id, campaignId);
  return memberHasPermission(cm, 'can_create_invites');
}

// Create an invite token for a campaign (owner or member with permission)
router.post('/api/campaigns/:campaignId/invites', requireCampaignAccess(), async (req, res) => {
  try {
    const { expires_at, max_uses, challenge_enabled, challenge_min_score } = req.body || {};
    const user = req.user;
    if (!await canManageInvites(user, req.campaign.id)) return res.status(403).json({ error: 'forbidden' });

    const token = genToken(32);
    const info = await db.run('INSERT INTO invites(token,campaign_id,created_by_user_id,expires_at,max_uses,challenge_enabled,challenge_min_score) VALUES (?, ?, ?, ?, ?, ?, ?)',
      token,
      req.campaign.id,
      user?.id ?? null,
      expires_at || null,
      normalizeMaxUses(max_uses),
      challenge_enabled ? 1 : 0,
      normalizeMinScore(challenge_min_score)
    );
    const row = await db.get('SELECT * FROM invites WHERE id = ?', info.lastInsertRowid);
    res.json({ ok: true, invite: row });
  } catch (e) {
    console.error('POST /api/campaigns/:campaignId/invites', e);
    res.status(500).json({ error: e.message });
  }
});

// Join a campaign using invite token (authenticated or anonymous)
router.post('/api/invites/join', optionalAuth, async (req, res) => {
  try {
    pruneInviteChallengeState();
    const token = req.body?.token;
    if (!token) return res.status(400).json({ error: 'token required' });
    const inv = await db.get('SELECT * FROM invites WHERE token = ?', token);
    if (!inv) return res.status(404).json({ error: 'invite_not_found' });
    if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(400).json({ error: 'invite_expired' });
    if (inv.max_uses && inv.used_count >= inv.max_uses) return res.status(400).json({ error: 'invite_maxed_out' });
    if (CHALLENGE_FEATURES_ENABLED && inv.challenge_enabled) {
      const passToken = req.body?.challenge_pass_token;
      const pass = passToken ? inviteChallengePassTokens.get(String(passToken)) : null;
      if (!pass || pass.inviteToken !== token || pass.expiresAt <= Date.now()) {
        return res.status(403).json({ error: 'challenge_required' });
      }
      inviteChallengePassTokens.delete(String(passToken));
    }

    // A `discord_id` in the body used to create-or-find a user with that Discord identity and
    // join it to the campaign — an anonymous caller could add any Discord user to any campaign
    // they held an invite for. Identity now comes from the session or not at all.
    const user = req.user;

    await db.transaction(async (trx) => {
      if (user) {
        const exists = await trx.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', inv.campaign_id, user.id);
        if (!exists) await trx.run('INSERT INTO campaign_members(campaign_id,user_id,role) VALUES (?, ?, ?)', inv.campaign_id, user.id, 'player');
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

    const riddle = pickRiddle();
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
router.patch('/api/invites/:id', requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const inv = await db.get('SELECT * FROM invites WHERE id = ?', id);
    if (!inv) return res.status(404).json({ error: 'invite_not_found' });
    if (!await canManageInvites(req.user, inv.campaign_id, inv)) return res.status(403).json({ error: 'forbidden' });

    const body = req.body || {};
    const updates = [];
    const values = [];
    for (const [column, normalize] of PATCHABLE_INVITE_FIELDS) {
      if (!Object.hasOwn(body, column)) continue;
      updates.push(`${column} = ?`);
      values.push(normalize(body[column]));
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
router.delete('/api/invites/:id', requireAuth, async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'invalid_id' });
    const inv = await db.get('SELECT * FROM invites WHERE id = ?', id);
    if (!inv) return res.status(404).json({ error: 'invite_not_found' });
    if (!await canManageInvites(req.user, inv.campaign_id, inv)) return res.status(403).json({ error: 'forbidden' });
    await db.run('DELETE FROM invites WHERE id = ?', id);
    res.json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/invites/:id', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
