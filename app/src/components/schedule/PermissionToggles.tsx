import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { CampaignPermissions } from '@/lib/api';
import { CAMPAIGN_PERMISSION_FLAGS } from '@/store/campaignStore';

interface PermissionTogglesProps {
  readonly value: CampaignPermissions;
  readonly onChange: (next: CampaignPermissions) => void;
  readonly disabled?: boolean;
  /** Distinguishes the switches when two of these grids are on the same screen. */
  readonly idPrefix: string;
}

/**
 * The grantable-permission grid, in one component because it now appears three times: the
 * campaign's default for anyone joining, its default for invite links, and a link's own override.
 * `CAMPAIGN_PERMISSION_FLAGS` stays the single list — this only decides how it is rendered.
 */
export function PermissionToggles({ value, onChange, disabled = false, idPrefix }: PermissionTogglesProps) {
  return (
    <div className="space-y-2">
      {CAMPAIGN_PERMISSION_FLAGS.map((flag) => {
        const id = `${idPrefix}-${flag.key}`;
        return (
          <div key={flag.key} className="flex items-start justify-between gap-3">
            <Label htmlFor={id} className="font-normal leading-snug">
              {flag.label}
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{flag.hint}</span>
            </Label>
            <Switch
              id={id}
              disabled={disabled}
              checked={Boolean(value[flag.key])}
              onCheckedChange={(checked) => onChange({ ...value, [flag.key]: checked })}
            />
          </div>
        );
      })}
    </div>
  );
}
