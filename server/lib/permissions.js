/**
 * Campaign member permissions: the one place the server states which flags exist.
 *
 * The client has its own ordered list for the editor UI (`CAMPAIGN_PERMISSION_FLAGS` in
 * `store/campaignStore.ts`) because it also carries labels and hints. What the server owns is what
 * it will *store* — anything outside this set is dropped rather than persisted, so a typo in a
 * client payload cannot become a permission nobody can see or revoke.
 */
const GRANTABLE_PERMISSIONS = [
  'can_create_players',
  'can_delete_players',
  'can_manage_groups',
  'can_create_invites',
  'can_edit_self',
  // Legacy name for the same right as `players_self_delete`; both are still honoured on read.
  'can_unclaim',
  'players_self_delete',
];

const GRANTABLE_PERMISSION_SET = new Set(GRANTABLE_PERMISSIONS);

/**
 * Normalise a permissions object from a request body.
 *
 * Returns `{ value }` with a JSON string (or null when nothing is granted, which is how "no
 * permissions" has always been stored), or `{ error }` for a shape that is not an object.
 */
function normalisePermissions(value) {
  if (value === null || value === undefined || value === '') return { value: null };
  if (typeof value !== 'object' || Array.isArray(value)) return { error: 'permissions_must_be_an_object' };

  const granted = {};
  for (const flag of GRANTABLE_PERMISSIONS) {
    if (value[flag]) granted[flag] = true;
  }
  return { value: Object.keys(granted).length > 0 ? JSON.stringify(granted) : null };
}

/** Parse a stored blob back to an object, tolerating the junk the column has always tolerated. */
function parsePermissions(stored) {
  if (!stored) return {};
  try {
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const granted = {};
    for (const [flag, on] of Object.entries(parsed)) {
      if (on && GRANTABLE_PERMISSION_SET.has(flag)) granted[flag] = true;
    }
    return granted;
  } catch (e) {
    console.warn('permissions blob is not valid JSON', e?.message);
    return {};
  }
}

/**
 * What a new member gets. An invite's own blob wins when it has one; otherwise the campaign's
 * default applies. NULL on the invite means "no opinion", which is why it cannot simply be
 * defaulted to `{}` at the column level — an invite has to be able to say "grant nothing" too.
 */
function resolveJoinPermissions(campaign, invite = null) {
  if (invite && invite.permissions !== null && invite.permissions !== undefined) {
    return parsePermissions(invite.permissions);
  }
  return parsePermissions(campaign?.default_member_permissions);
}

module.exports = {
  GRANTABLE_PERMISSIONS,
  normalisePermissions,
  parsePermissions,
  resolveJoinPermissions,
};
