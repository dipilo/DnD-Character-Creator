/**
 * Who may read or edit one character.
 *
 * Before sharing there was one rule — a row belongs to one user — and one widening: attaching a
 * character to a campaign let that campaign's members read it. Three things widen it now, and all
 * three are the owner's own act:
 *
 *   - `characters.visibility`, the D&D Beyond-shaped choice between private, campaign and public;
 *   - `character_grants`, one row per account or campaign owner the sheet was handed to;
 *   - `campaign_members.character_edit_consent`, a table-wide "the GM may edit my sheets here".
 *
 * Invisible still means **404 rather than 403** (a 403 confirms the id exists), and an edit grant
 * is over the *document* only: the seat, the visibility, the grant list and deletion stay with the
 * owner. That is why `resolveCharacterAccess` reports `isOwner` separately from `canEdit`.
 */
const db = require('../db');
const { readMembership } = require('./membership');

const VISIBILITIES = ['private', 'campaign', 'public'];

/**
 * A row written before the column read as campaign-visible the moment it was attached, so NULL is
 * 'campaign'. Defaulting it to 'private' would silently un-share every existing party view.
 */
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

/** True when this user runs that campaign. `campaign_owner` grants name the seat, not the person. */
async function ownsCampaign(userId, campaignId) {
  if (!userId || !campaignId) return false;
  const row = await db.get(
    "SELECT 1 AS ok FROM campaign_members WHERE campaign_id = ? AND user_id = ? AND role = 'owner'",
    campaignId, userId,
  );
  return Boolean(row);
}

/**
 * The strongest access a grant row gives this user, or null. `campaign_owner` resolves through the
 * campaign rather than naming a user id, so a table that changes hands hands the grant over too.
 */
async function accessFromGrants(user, characterId) {
  if (!user) return null;
  let best = null;
  for (const grant of await listGrants(characterId)) {
    const applies = grant.subject_type === 'user'
      ? Number(grant.subject_id) === Number(user.id)
      : grant.subject_type === 'campaign_owner' && await ownsCampaign(user.id, grant.subject_id);
    if (!applies) continue;
    if (grant.access === 'edit') return 'edit';
    best = best ?? 'view';
  }
  return best;
}

/**
 * The consent a member gave the campaign they play at: the GM may edit anything they seat there,
 * including characters built after the consent was given. It lives on the membership row and not
 * in `character_grants` for that reason — and on its own column rather than in the permissions
 * blob, because that blob is the *owner's* to write and this is the one grant they must not be
 * able to give themselves.
 */
async function hasCampaignEditConsent(user, row) {
  if (!user || row.campaign_id == null) return false;
  if (!await ownsCampaign(user.id, row.campaign_id)) return false;
  const ownerMembership = await readMembership(db, row.campaign_id, row.user_id);
  return Boolean(ownerMembership?.character_edit_consent);
}

/**
 * Resolve what `user` (null for an anonymous caller) may do with `row`.
 *
 * Returns null when the character should read as absent. `canEdit` never implies the owner's
 * rights — check `isOwner` for anything that is not the document itself.
 */
async function resolveCharacterAccess(user, row) {
  if (!row || row.deleted_at) return null;
  if (user && Number(row.user_id) === Number(user.id)) {
    return { row, isOwner: true, canEdit: true, visibility: characterVisibility(row) };
  }

  const visibility = characterVisibility(row);
  const granted = await accessFromGrants(user, row.id);
  const canEdit = granted === 'edit' || await hasCampaignEditConsent(user, row);
  if (canEdit) return { row, isOwner: false, canEdit: true, visibility };
  if (granted === 'view') return { row, isOwner: false, canEdit: false, visibility };

  if (visibility === 'public') return { row, isOwner: false, canEdit: false, visibility };
  if (visibility === 'campaign' && user && row.campaign_id != null) {
    const membership = await readMembership(db, row.campaign_id, user.id);
    if (membership) return { row, isOwner: false, canEdit: false, visibility };
  }
  return null;
}

module.exports = {
  VISIBILITIES,
  characterVisibility,
  listGrants,
  normaliseVisibility,
  ownsCampaign,
  resolveCharacterAccess,
};
