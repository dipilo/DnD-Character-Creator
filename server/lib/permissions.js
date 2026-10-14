/** What the server will *store*: anything outside this set is dropped, not persisted. */
const GRANTABLE_PERMISSIONS = [
  'can_create_players',
  'can_delete_players',
  'can_manage_groups',
  'can_manage_sessions',
  'can_create_invites',
  'can_edit_self',
  // Legacy name for the same right as `players_self_delete`; both are still honoured on read.
  'can_unclaim',
  'players_self_delete',
];

const GRANTABLE_PERMISSION_SET = new Set(GRANTABLE_PERMISSIONS);

/** A member who can change nothing on their own row cannot fix their own timezone. */
const SELF_SERVICE_PERMISSIONS = Object.freeze({ can_edit_self: true, players_self_delete: true });

/** Without `can_create_players` an invited player had no seat to make or claim. */
const DEFAULT_MEMBER_PERMISSIONS = Object.freeze({ ...SELF_SERVICE_PERMISSIONS, can_create_players: true });

/** `{ value }` with a JSON string, null when nothing is granted, or `{ error }`. */
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

/** NULL and `{}` differ: "no opinion" is not "grant nothing". */
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

/** Kept, so "grant nothing" can be said out loud rather than collapsing to NULL. */
function normaliseDefaultPermissions(value) {
  if (value === null || value === undefined || value === '') return { value: null };
  const normalised = normalisePermissions(value);
  if (normalised.error) return normalised;
  return { value: normalised.value ?? '{}' };
}

module.exports = {
  DEFAULT_MEMBER_PERMISSIONS,
  SELF_SERVICE_PERMISSIONS,
  GRANTABLE_PERMISSIONS,
  joinPermissionsBlob,
  normaliseDefaultPermissions,
  normalisePermissions,
  parsePermissions,
  resolveJoinPermissions,
};
