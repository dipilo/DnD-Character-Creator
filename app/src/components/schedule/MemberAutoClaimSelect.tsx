import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AUTO_CLAIM_MODES, autoClaimLabel, resolveAutoClaimMode } from '@/lib/autoClaim';
import type { AutoClaimMode, Campaign, CampaignMember } from '@/lib/api';

/** Radix rejects an empty item value, so "the owner has no opinion" needs a value of its own. */
const UNSET = 'unset';

interface MemberAutoClaimSelectProps {
  readonly campaign: Campaign | null;
  readonly member: CampaignMember;
  readonly memberName: string;
  readonly onChange: (mode: AutoClaimMode | null) => void;
}

/**
 * The owner's override for one member. Leaving it unset is what hands the decision back to that
 * member, so the placeholder names the answer they would get rather than reading as "off".
 */
export function MemberAutoClaimSelect({ campaign, member, memberName, onChange }: MemberAutoClaimSelectProps) {
  const theirs = resolveAutoClaimMode(campaign, { ...member, auto_claim_override: null });

  return (
    <Select
      value={member.auto_claim_override ?? UNSET}
      onValueChange={(value) => onChange(value === UNSET ? null : (value as AutoClaimMode))}
    >
      <SelectTrigger className="h-11 w-44" aria-label={`Seat claiming for ${memberName}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNSET}>Their choice ({autoClaimLabel(theirs).toLowerCase()})</SelectItem>
        {AUTO_CLAIM_MODES.map((mode) => (
          <SelectItem key={mode.value} value={mode.value}>{mode.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
