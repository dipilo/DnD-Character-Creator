// Editing a Kids on Bikes character you do not hold a copy of.
//
// The D&D builder is a wizard whose Review step performs the write, so a granted editor opens it
// through `loadDocumentIntoBuilder` and it pushes on save. The Kids on Bikes builder has no save
// step — every control writes a patch as it is touched — so the remote case is the same screens
// with `useRemoteCharacter.applyPatch` in place of the store's `updateCharacter`.
//
// Without this the Edit button simply did not appear for a Kids on Bikes sheet, whatever the GM
// had been granted.
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { KobBuilder } from '@/components/kob/KobBuilder';
import { useRemoteCharacter } from '@/hooks/useRemoteCharacter';
import { isKobDocument } from '@/lib/storedCharacter';
import { withKobDefaults } from '@/store/kobCharacterStore';
import type { KobCharacter } from '@/types/kob';
import { useCampaignId } from '@/pages/campaign/useCampaignData';

export function CampaignCharacterEditPage() {
  const campaignId = useCampaignId();
  const { characterId } = useParams<{ characterId: string }>();
  const { record, document, error, loading, saving, applyPatch } = useRemoteCharacter({
    kind: 'id',
    id: characterId ?? '',
  });

  const sheetPath = `/campaign/${campaignId}/party/${characterId}`;
  const backToSheet = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 min-h-11">
      <Link to={sheetPath}>
        <ArrowLeft className="h-4 w-4" />
        Sheet
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <output className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading the character...
      </output>
    );
  }

  // `can_edit` is the server's answer and it is checked again on every write; this only decides
  // whether to put an editing surface on screen at all.
  const mayEdit = Boolean(record?.can_edit) && !record?.is_owner;
  if (!document || !isKobDocument(document) || !mayEdit) {
    return (
      <div className="space-y-4 py-20 text-center">
        <p className="text-muted-foreground">
          {error ?? 'That character cannot be edited here.'}
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to={sheetPath}>Back to the sheet</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <KobBuilder
        character={withKobDefaults(document)}
        onChange={(patch: Partial<KobCharacter>) => applyPatch(patch)}
        leading={backToSheet}
        note={(
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Editing another player&apos;s character, with their permission</Badge>
            {saving ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
          </div>
        )}
        actions={(
          <Button asChild variant="secondary" className="min-h-11">
            <Link to={sheetPath}>
              <FileText className="h-4 w-4" />
              View sheet
            </Link>
          </Button>
        )}
      />
    </div>
  );
}
