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
 * What a campaign grants arrivals when it has no opinion of its own. A member who can change
 * nothing on their own row cannot correct their own timezone, so "no default" used to mean a seat
 * its holder could not touch.
 */
const DEFAULT_MEMBER_PERMISSIONS = Object.freeze({ can_edit_self: true, players_self_delete: true });

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
 * default applies, and a campaign with no opinion falls back to the self-service floor. NULL and
 * `{}` differ on both columns for that reason — "no opinion" and "grant nothing" are not the same
 * answer.
 */
function resolveJoinPermissions(campaign, invite = null) {
  if (invite && invite.permissions !== null && invite.permissions !== undefined) {
    return parsePermissions(invite.permissions);
  }
  const stored = campaign?.default_member_permissions;
  if (stored === null || stored === undefined || stored === '') return { ...DEFAULT_MEMBER_PERMISSIONS };
  return parsePermissions(stored);
}

/** The same answer as a JSON string, ready for the `campaign_members.permissions` column. */
function joinPermissionsBlob(campaign, invite = null, extra = null) {
  const granted = { ...resolveJoinPermissions(campaign, invite), ...(extra ?? {}) };
  return Object.keys(granted).length > 0 ? JSON.stringify(granted) : null;
}

/**
 * A campaign default keeps the empty object an owner explicitly saved, so "grant nothing" can be
 * said out loud. `normalisePermissions` collapses it to NULL, which here would read as no opinion.
 */
function normaliseDefaultPermissions(value) {
  if (value === null || value === undefined || value === '') return { value: null };
  const normalised = normalisePermissions(value);
  if (normalised.error) return normalised;
  return { value: normalised.value ?? '{}' };
}

module.exports = {
  DEFAULT_MEMBER_PERMISSIONS,
  GRANTABLE_PERMISSIONS,
  joinPermissionsBlob,
  normaliseDefaultPermissions,
  normalisePermissions,
  parsePermissions,
  resolveJoinPermissions,
};
