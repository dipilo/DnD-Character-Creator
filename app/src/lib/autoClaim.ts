import type { AutoClaimMode, Campaign, CampaignMember } from '@/lib/api';

/**
 * Whether a seat someone creates becomes theirs. The resolution order mirrors
 * `server/lib/seatClaim.js` exactly: the owner's per-member override, then the member's own
 * preference, then the campaign's default, then the built-in answer. Null at any level is "no
 * opinion" and falls through, the same way it does on the permission defaults.
 */
export const AUTO_CLAIM_MODES = [
  { value: 'never', label: 'Never', hint: 'Seats they make stay unclaimed for someone else to take' },
  { value: 'first', label: 'First seat', hint: 'Takes a new seat only while they hold none' },
  { value: 'always', label: 'Every seat', hint: 'The newest seat they make becomes theirs' },
] as const satisfies readonly { value: AutoClaimMode; label: string; hint: string }[];

const KNOWN = new Set(AUTO_CLAIM_MODES.map((mode) => mode.value));

function storedMode(value: string | null | undefined): AutoClaimMode | null {
  return typeof value === 'string' && KNOWN.has(value as AutoClaimMode) ? (value as AutoClaimMode) : null;
}

/** A table that has never said. Owners make seats for other people; players make their own. */
export function builtInAutoClaim(isOwner: boolean): AutoClaimMode {
  return isOwner ? 'never' : 'first';
}

export function resolveAutoClaimMode(
  campaign: Pick<Campaign, 'default_auto_claim_seats'> | null | undefined,
  member: Pick<CampaignMember, 'role' | 'auto_claim_override' | 'auto_claim_preference'> | null | undefined,
): AutoClaimMode {
  return storedMode(member?.auto_claim_override)
    ?? storedMode(member?.auto_claim_preference)
    ?? storedMode(campaign?.default_auto_claim_seats)
    ?? builtInAutoClaim(member?.role === 'owner');
}

/** Where the answer above came from, for a line that says why a control is not the member's. */
export function autoClaimSource(
  campaign: Pick<Campaign, 'default_auto_claim_seats'> | null | undefined,
  member: Pick<CampaignMember, 'role' | 'auto_claim_override' | 'auto_claim_preference'> | null | undefined,
): 'override' | 'preference' | 'campaign' | 'built-in' {
  if (storedMode(member?.auto_claim_override)) return 'override';
  if (storedMode(member?.auto_claim_preference)) return 'preference';
  if (storedMode(campaign?.default_auto_claim_seats)) return 'campaign';
  return 'built-in';
}

export function autoClaimLabel(mode: AutoClaimMode): string {
  return AUTO_CLAIM_MODES.find((entry) => entry.value === mode)?.label ?? mode;
}
