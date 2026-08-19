// One character's sheet, read from the server rather than the local cache (MERGE_PLAN.md Phase 5).
//
// This is the page that makes the party view worth having: a DM opens any character seated at their
// campaign and gets the real sheet, rendered by the same views the owner sees. The server allows
// the read because the character is attached to a campaign both accounts belong to.
//
// It is also where a *granted* editor works. A GM whose players consented, or anyone the owner
// named with edit access, holds no local copy of the sheet — so edits go straight back through
// `useRemoteCharacter` rather than through `characterStore`, which is only ever the owner's own
// cache. Without a grant the page is exactly what it was: read-only.
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { StoredCharacterSheet } from '@/components/character/StoredCharacterSheet';
import { isKobDocument } from '@/lib/storedCharacter';
import { DEFAULT_GAME_SYSTEM_ID, getGameSystem } from '@/data/gameSystems';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { exportCharacterToFillablePdf } from '@/lib/characterPdf';
import { useRemoteCharacter } from '@/hooks/useRemoteCharacter';
import { useCampaignId } from '@/pages/campaign/useCampaignData';

export function CampaignCharacterPage() {
  const campaignId = useCampaignId();
  const { characterId } = useParams<{ characterId: string }>();
  const { record, document, error, loading, saving, applyPatch } = useRemoteCharacter({
    kind: 'id',
    id: characterId ?? '',
  });

  const backToParty = (
    <Button asChild variant="outline" size="sm">
      <Link to={`/campaign/${campaignId}/party`}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Party
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <output className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading the sheet...
      </output>
    );
  }

  if (!document) {
    return (
      <div className="space-y-4 py-20 text-center">
        <p className="text-muted-foreground">{error ?? 'That character has no readable sheet.'}</p>
        {backToParty}
      </div>
    );
  }

  const isOwn = Boolean(record?.is_owner);
  // The owner's own sheet is edited in their cache, where sync already handles it — offering a
  // second, server-only write path for the same document would be two writers on one row.
  const mayEdit = Boolean(record?.can_edit) && !isOwn;
  const systemId = isKobDocument(document) ? 'kids-on-bikes' : DEFAULT_GAME_SYSTEM_ID;

  const handleExportPDF = async () => {
    if (isKobDocument(document)) return;
    try {
      await exportCharacterToFillablePdf(document);
      toast.success('PDF exported');
    } catch (e) {
      console.error(e);
      toast.error('PDF export failed');
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <StoredCharacterSheet
        document={document}
        leading={backToParty}
        note={<SheetNote isOwn={isOwn} mayEdit={mayEdit} saving={saving} />}
        onChange={mayEdit ? applyPatch : undefined}
        actions={(
          <>
            {isOwn ? (
              <Button asChild variant="outline">
                <Link to={getGameSystem(systemId).sheetPath(document.id)}>Open in my characters</Link>
              </Button>
            ) : null}
            {isKobDocument(document) ? null : (
              <Button variant="outline" onClick={() => void handleExportPDF()}>
                <FileDown className="mr-2 h-4 w-4" />
                Export PDF
              </Button>
            )}
          </>
        )}
      />
    </div>
  );
}

/** Whose sheet this is, and what the reader may do with it. */
function SheetNote({ isOwn, mayEdit, saving }: Readonly<{ isOwn: boolean; mayEdit: boolean; saving: boolean }>) {
  if (isOwn) return null;
  if (!mayEdit) {
    return <Badge variant="outline" className="mt-2">Read-only — this sheet belongs to another player</Badge>;
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Badge variant="secondary">Editing another player&apos;s sheet — they gave you access</Badge>
      {saving ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
    </div>
  );
}
