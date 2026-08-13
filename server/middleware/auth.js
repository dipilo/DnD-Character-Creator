const db = require('../db');

// Simple auth helper: in absence of full OAuth, allow a request to include X-User-Id header
// which maps to users.id in DB. This is primarily for API testing. Real OAuth will set this.
async function getRequestUser(req) {
  const uid = req.get('X-User-Id') || req.query.user_id || null;
  if (!uid) return null;
  const u = await db.get('SELECT * FROM users WHERE id = ?', uid);
  return u || null;
}

// middleware: require membership in campaign (owner allowed), sets req.campaign
function requireCampaignAccess(role = null) {
  return async (req, res, next) => {
    const campaignId = req.params.campaignId || req.body.campaign_id || req.query.campaign_id || req.get('X-Campaign-Id');
    if (!campaignId) return res.status(400).json({ error: 'campaign_id required' });
    const camp = await db.get('SELECT * FROM campaigns WHERE id = ?', campaignId);
    if (!camp) return res.status(404).json({ error: 'campaign_not_found' });
    const user = await getRequestUser(req);
    if (!user) return res.status(401).json({ error: 'not_authenticated' });

    // check membership
    const mem = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', campaignId, user.id);
    if (!mem) return res.status(403).json({ error: 'not_a_member' });
    if (role === 'owner' && mem.role !== 'owner') return res.status(403).json({ error: 'owner_required' });

    req.user = user;
    req.campaign = camp;
    req.membership = mem;
    next();
  };
}

async function getCampaignMembership(userId, campaignId) {
  if (!userId || !campaignId) return null;
  return await db.get('SELECT * FROM campaign_members WHERE user_id = ? AND campaign_id = ?', userId, campaignId);
}

async function canUserModifyPlayer(user, campaignId, playerId) {
  if (!user) return false;
  // owner of campaign?
  // Use single quotes for SQL string literals to avoid SQLite parsing errors
  const ownerCheck = await db.get("SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'", campaignId, user.id);
  if (ownerCheck) return true;
  // is there a campaign_members linking this user to this player?
  const link = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND player_id = ?', campaignId, user.id, playerId);
  if (link) return true;
  // if the user is a member (not necessarily linked to this player) but has can_edit_self on their linked member and the playerId equals their player_id, allow
  const memberRow = await db.get('SELECT * FROM campaign_members WHERE campaign_id = ? AND user_id = ?', campaignId, user.id);
  if (memberRow && memberRow.player_id && Number(memberRow.player_id) === Number(playerId)) {
    try {
      const perms = memberRow.permissions ? JSON.parse(memberRow.permissions) : {};
      if (perms && perms.can_edit_self) return true;
    } catch (e) { /* ignore parse error */ }
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
      if (cm && cm.cnt === 0) {
        console.log('Deleting orphaned campaign-scoped user', userId);
        await db.run('DELETE FROM users WHERE id = ?', userId);
      }
    } catch (e) { console.warn('cleanupOrphanedUser failed', e && e.message); }
  }

module.exports = { getRequestUser, requireCampaignAccess, getCampaignMembership, canUserModifyPlayer, cleanupOrphanedUser };
