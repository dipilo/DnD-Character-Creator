/**
 * Whether creating a seat also claims it.
 *
 * Three modes: 'never', 'first' (claim only while the creator holds no seat, so it covers both the
 * literal first seat and the one made after deleting a previous), and 'always' (the newest seat
 * becomes theirs). A membership row holds one `player_id`, so 'always' moves the seat rather than
 * adding a second.
 *
 * The owner writes `auto_claim_override` and the member writes `auto_claim_preference`; NULL on
 * either is "no opinion" and falls through, exactly as NULL does on the permission defaults.
 */
const AUTO_CLAIM_MODES = ['never', 'first', 'always'];
const AUTO_CLAIM_MODE_SET = new Set(AUTO_CLAIM_MODES);

/** A campaign's own default, for a table that has never said. Owners make seats for other people. */
const BUILT_IN_AUTO_CLAIM = Object.freeze({ owner: 'never', player: 'first' });

/** `{ value }` with a mode or null ("no opinion"), or `{ error }`. */
function normaliseAutoClaimMode(value) {
  if (value === null || value === undefined || value === '') return { value: null };
  if (typeof value !== 'string' || !AUTO_CLAIM_MODE_SET.has(value)) return { error: 'invalid_auto_claim_mode' };
  return { value };
}

function storedMode(value) {
  return typeof value === 'string' && AUTO_CLAIM_MODE_SET.has(value) ? value : null;
}

/** The answer for one person at one table: owner's word, then theirs, then the table's, then ours. */
function resolveAutoClaimMode(campaign, membership) {
  const isOwner = membership?.role === 'owner';
  return storedMode(membership?.auto_claim_override)
    ?? storedMode(membership?.auto_claim_preference)
    ?? storedMode(campaign?.default_auto_claim_seats)
    ?? (isOwner ? BUILT_IN_AUTO_CLAIM.owner : BUILT_IN_AUTO_CLAIM.player);
}

/** Given the resolved mode and the seat they hold now, does this new seat become theirs? */
function shouldAutoClaim(mode, heldPlayerId) {
  if (mode === 'always') return true;
  if (mode === 'first') return heldPlayerId === null || heldPlayerId === undefined;
  return false;
}

module.exports = {
  AUTO_CLAIM_MODES,
  BUILT_IN_AUTO_CLAIM,
  normaliseAutoClaimMode,
  resolveAutoClaimMode,
  shouldAutoClaim,
};
