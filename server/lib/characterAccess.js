/** Invisible means 404, not 403, and an edit grant covers the document alone. */
const db = require('../db');

const VISIBILITIES = ['private', 'campaign', 'public'];

/** NULL is 'campaign': defaulting to 'private' would un-share every existing party view. */
function characterVisibility(row) {
  const stored = typeof row?.visibility === 'string' ? row.visibility : '';
  return VISIBILITIES.includes(stored) ? stored : 'campaign';
}

function normaliseVisibility(value) {
  if (typeof value !== 'string' || !VISIBILITIES.includes(value)) return { error: 'invalid_visibility' };
  return { value };
}

/** Every grant on a character, oldest first. */
async function listGrants(characterId) {
  return await db.all('SELECT * FROM character_grants WHERE character_id = ? ORDER BY id', characterId);
}

/** Three round trips whatever the party size; a row at a time cost four each. */
async function loadAccessContext(user, rows) {
  const context = { ownedCampaigns: new Set(), grants: new Map(), memberships: new Map() };
  const live = rows.filter((row) => row && !row.deleted_at);
  if (!user || live.length === 0) return context;

  const foreign = live.filter((row) => Number(row.user_id) !== Number(user.id));
  if (foreign.length === 0) return context;

  const owned = await db.all(
    "SELECT campaign_id FROM campaign_members WHERE user_id = ? AND role = 'owner'",
    user.id,
  );
  for (const row of owned) context.ownedCampaigns.add(Number(row.campaign_id));

  const ids = foreign.map((row) => row.id);
  const grants = await db.all(
    `SELECT * FROM character_grants WHERE character_id IN (${ids.map(() => '?').join(', ')}) ORDER BY id`,
    ids,
  );
  for (const grant of grants) {
    const list = context.grants.get(grant.character_id) ?? [];
    list.push(grant);
    context.grants.set(grant.character_id, list);
  }

  await loadMemberships(user, foreign, context);
  return context;
}

/** Both remaining questions are about one campaign's membership rows. */
async function loadMemberships(user, rows, context) {
  const wanted = new Map();
  for (const row of rows) {
    if (row.campaign_id == null) continue;
    const campaignId = Number(row.campaign_id);
    const users = wanted.get(campaignId) ?? new Set();
    users.add(Number(user.id));
    users.add(Number(row.user_id));
    wanted.set(campaignId, users);
  }

  for (const [campaignId, users] of wanted) {
    const ids = [...users];
    const members = await db.all(
      `SELECT * FROM campaign_members
        WHERE campaign_id = ? AND user_id IN (${ids.map(() => '?').join(', ')})
        ORDER BY (player_id IS NULL), id`,
      [campaignId, ...ids],
    );
    // The seated row wins, then the oldest — `readMembership`'s rule, applied to a batched read.
    for (const member of members) {
      const key = `${campaignId}:${Number(member.user_id)}`;
      if (!context.memberships.has(key)) context.memberships.set(key, member);
    }
  }
}

function membershipIn(context, campaignId, userId) {
  return context.memberships.get(`${Number(campaignId)}:${Number(userId)}`) ?? null;
}

/** The strongest access this character's grants give the caller, or null. */
function grantedAccess(user, row, context) {
  if (!user) return null;
  let best = null;
  for (const grant of context.grants.get(row.id) ?? []) {
    const applies = grant.subject_type === 'user'
      ? Number(grant.subject_id) === Number(user.id)
      : grant.subject_type === 'campaign_owner' && context.ownedCampaigns.has(Number(grant.subject_id));
    if (!applies) continue;
    if (grant.access === 'edit') return 'edit';
    best = best ?? 'view';
  }
  return best;
}

/** Covers characters built after it was given, which is why it is on the membership row. */
function hasCampaignEditConsent(user, row, context) {
  if (!user || row.campaign_id == null) return false;
  if (!context.ownedCampaigns.has(Number(row.campaign_id))) return false;
  return Boolean(membershipIn(context, row.campaign_id, row.user_id)?.character_edit_consent);
}

/** Null means the character reads as absent; `canEdit` never implies the owner's rights. */
function decideAccess(user, row, context) {
  if (!row || row.deleted_at) return null;
  const visibility = characterVisibility(row);
  if (user && Number(row.user_id) === Number(user.id)) {
    return { row, isOwner: true, canEdit: true, visibility };
  }

  const granted = grantedAccess(user, row, context);
  if (granted === 'edit' || hasCampaignEditConsent(user, row, context)) {
    return { row, isOwner: false, canEdit: true, visibility };
  }
  if (granted === 'view') return { row, isOwner: false, canEdit: false, visibility };

  if (visibility === 'public') return { row, isOwner: false, canEdit: false, visibility };
  if (visibility === 'campaign' && user && row.campaign_id != null) {
    if (membershipIn(context, row.campaign_id, user.id)) {
      return { row, isOwner: false, canEdit: false, visibility };
    }
  }
  return null;
}

async function resolveCharacterAccess(user, row) {
  return decideAccess(user, row, await loadAccessContext(user, [row]));
}

/** The same answer for a whole list, in order, at a fixed cost. */
async function resolveCharacterAccessAll(user, rows) {
  const context = await loadAccessContext(user, rows);
  return rows.map((row) => decideAccess(user, row, context));
}

module.exports = {
  VISIBILITIES,
  characterVisibility,
  listGrants,
  normaliseVisibility,
  resolveCharacterAccess,
  resolveCharacterAccessAll,
};
