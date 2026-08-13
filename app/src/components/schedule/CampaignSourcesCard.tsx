// A campaign's content agreement (MERGE_PLAN.md Phase 5).
//
// "Which books are we playing with" used to be something a table settled in chat and every player
// had to remember while building. It is a campaign property now, and "New character for this
// campaign" seeds the builder's own source filter from it — which is the only reason this is worth
// storing rather than writing in the campaign description.
//
// The server keeps the list opaque: these ids belong to the client's source manifest, and nothing
// server-side interprets them.
import { useState } from 'react';
import { toast } from 'sonner';
import { parseAllowedSourceIds, setCampaignSources } from '@/lib/api';
import type { Campaign } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SourceFilterBar } from '@/components/SourceFilterBar';
import { getContentSourceLabel } from '@/data/librarySources';
import { useCampaignStore } from '@/store/campaignStore';

interface CampaignSourcesCardProps {
  campaign: Campaign | null;
  /** Non-owners see the agreement but cannot change it; the server refuses them anyway. */
  canEdit: boolean;
}

export function CampaignSourcesCard({ campaign, canEdit }: Readonly<CampaignSourcesCardProps>) {
  const upsertCampaign = useCampaignStore((state) => state.upsertCampaign);
  // null means "not edited", so the card follows the campaign until someone touches it — the same
  // shape the rename field uses, and for the same reason: mirroring a prop into state from an
  // effect would fight every change that lands from elsewhere.
  const [draft, setDraft] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);

  if (!campaign) return null;

  const stored = parseAllowedSourceIds(campaign);
  const selected = draft ?? stored;
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(stored);

  const handleSave = async () => {
    setSaving(true);
    try {
      upsertCampaign(await setCampaignSources(campaign.id, selected));
      setDraft(null);
      toast.success('Campaign sources updated');
    } catch (e) {
      toast.error('Could not save the sources', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const plural = stored.length === 1 ? '' : 's';
  const summary = stored.length === 0
    ? 'Every source is in play. New characters start with no filter applied.'
    : `New characters for this campaign start filtered to these ${stored.length} source${plural}.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sources in play</CardTitle>
        <CardDescription>{summary}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canEdit ? (
          <>
            <SourceFilterBar
              label="Allowed sources"
              selectedSourceIds={selected}
              onChange={(next) => setDraft(next)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleSave} disabled={!dirty || saving}>
                {saving ? 'Saving...' : 'Save sources'}
              </Button>
              {dirty ? (
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                  Discard
                </Button>
              ) : null}
              <p className="text-xs text-muted-foreground">
                This is a default, not a lock — a player can still widen the filter in the builder.
              </p>
            </div>
          </>
        ) : (
          <SourceList sourceIds={stored} />
        )}
      </CardContent>
    </Card>
  );
}

function SourceList({ sourceIds }: Readonly<{ sourceIds: string[] }>) {
  if (sourceIds.length === 0) {
    return <p className="text-sm text-muted-foreground">The campaign owner has not restricted sources.</p>;
  }
  return (
    <ul className="list-inside list-disc text-sm text-muted-foreground">
      {sourceIds.map((id) => (
        <li key={id}>{getContentSourceLabel(id)}</li>
      ))}
    </ul>
  );
}
