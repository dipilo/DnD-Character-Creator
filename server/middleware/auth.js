const db = require('../db');
const { getSessionUser } = require('../lib/sessions');

// Identity comes from the session cookie and nowhere else. The `X-User-Id` header and
// `?user_id=` query fallback this module used to accept were client-asserted: any caller could
// name themselves any user on the system (MERGE_PLAN.md §3). Both are gone as of Phase 1b, so a
// forged header now resolves to no user at all.

/** Attach req.user when the caller has a valid session; leave it null and continue when not. */
async function optionalAuth(req, res, next) {
  try {
    req.user = await getSessionUser(req);
    next();
  } catch (e) {
    next(e);
  }
}

/** Reject anyone without a valid session before the handler runs. */
async function requireAuth(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'not_authenticated' });
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
}

// middleware: require membership in campaign (owner allowed), sets req.campaign
function requireCampaignAccess(role = null) {
  return async (req, res, next) => {
    try {
      const campaignId = req.params.campaignId || req.body?.campaign_id || req.query.campaign_id || req.get('X-Campaign-Id');
      if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
      const camp = await db.get('SELECT * FROM campaigns WHERE id = ?', campaignId);
      if (!camp) return res.status(404).json({ error: 'campaign_not_found' });
      const user = req.user || await getSessionUser(req);
      if (!user) return res.status(401).json({ error: 'not_authenticated' });

      // check membership
      const mem = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', campaignId, user.id);
      if (!mem) return res.status(403).json({ error: 'not_a_member' });
      if (role === 'owner' && mem.role !== 'owner') return res.status(403).json({ error: 'owner_required' });

      req.user = user;
      req.campaign = camp;
      req.membership = mem;
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** True when the user owns the campaign. The single most repeated permission check in the API. */
async function isCampaignOwner(userId, campaignId) {
  if (!userId || !campaignId) return false;
  const row = await db.get("SELECT 1 AS ok FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", campaignId, userId);
  return Boolean(row);
}

async function getCampaignMembership(userId, campaignId) {
  if (!userId || !campaignId) return null;
  return await db.get('SELECT * FROM campaign_members WHERE user_id = ? AND campaign_id = ?', userId, campaignId);
}

/** Read one flag out of a campaign_members.permissions JSON blob without throwing on bad JSON. */
function memberHasPermission(memberRow, ...flags) {
  if (!memberRow?.permissions) return false;
  try {
    const perms = JSON.parse(memberRow.permissions);
    return Boolean(perms) && flags.some((f) => perms[f]);
  } catch (e) {
    console.warn('campaign_members.permissions is not valid JSON for member', memberRow.id, e?.message);
    return false;
  }
}

async function canUserModifyPlayer(user, campaignId, playerId) {
  if (!user) return false;
  // owner of campaign?
  if (await isCampaignOwner(user.id, campaignId)) return true;
  // is there a campaign_members linking this user to this player?
  const link = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND player_id = ?', campaignId, user.id, playerId);
  if (link) return true;
  // if the user is a member (not necessarily linked to this player) but has can_edit_self on their linked member and the playerId equals their player_id, allow
  const memberRow = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', campaignId, user.id);
  if (memberRow?.player_id && Number(memberRow.player_id) === Number(playerId)) {
    return memberHasPermission(memberRow, 'can_edit_self');
  }
  return false;
}

// Remove users that are campaign-scoped (no password) and have no remaining campaign_members
async function cleanupOrphanedUser(userId) {
  try {
    if (!userId) return;
    const u = await db.get('SELECT * FROM users WHERE id = ?', userId);
    if (!u) return;
    if (u.password_hash) return; // has password -> persistent account
    const cm = await db.get('SELECT COUNT(*) as cnt FROM campaign_members WHERE user_id = ?', userId);
    if (cm?.cnt === 0) {
      console.log('Deleting orphaned campaign-scoped user', userId);
      await db.run('DELETE FROM sessions WHERE user_id = ?', userId);
      await db.run('DELETE FROM users WHERE id = ?', userId);
    }
  } catch (e) { console.warn('cleanupOrphanedUser failed', e?.message); }
}

module.exports = {
  canUserModifyPlayer,
  cleanupOrphanedUser,
  getCampaignMembership,
  isCampaignOwner,
  memberHasPermission,
  optionalAuth,
  requireAuth,
  requireCampaignAccess,
};
