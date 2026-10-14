// A granted editor has no local copy, so edits go through `useRemoteCharacter`.
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { StoredCharacterSheet } from '@/components/character/StoredCharacterSheet';
import { isKobDocument } from '@/lib/storedCharacter';
import { DEFAULT_GAME_SYSTEM_ID, getGameSystem } from '@/data/gameSystems';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { exportCharacterToFillablePdf } from '@/lib/characterPdf';
import { exportKobCharacterToPdf } from '@/lib/kob/characterSheetPdf';
import { useRemoteCharacter } from '@/hooks/useRemoteCharacter';
import { SaveConflictAlert } from '@/components/character/SaveConflictAlert';
import { useCharacterStore } from '@/store/characterStore';
import type { Character } from '@/types/dnd';
import { useCampaignId } from '@/pages/campaign/useCampaignData';
import { useRollAttribution } from '@/hooks/useRollAttribution';

export function CampaignCharacterPage() {
  const campaignId = useCampaignId();
  const navigate = useNavigate();
  const { characterId } = useParams<{ characterId: string }>();
  const loadDocumentIntoBuilder = useCharacterStore((state) => state.loadDocumentIntoBuilder);
  const { record, document, error, loading, saving, applyPatch, conflict, resolveConflict } = useRemoteCharacter({
    kind: 'id',
    id: characterId ?? '',
  });

  // While this sheet is open, rolls made from it are attributed to the character in the table's
  // session feed.
  useRollAttribution(document && !isKobDocument(document) ? document.name : null);

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
  const mayOpenBuilder = mayEdit && record !== null;

  // `document`, not `record.data`: an inline edit here may not have been pushed yet.
  const openBuilderAt = (path: string) => {
    if (!record) return;
    if (systemId === 'kids-on-bikes') {
      navigate(`/campaign/${campaignId}/party/${record.id}/edit`);
      return;
    }
    loadDocumentIntoBuilder(document as Character, { id: record.id, version: record.version, campaignId });
    navigate(path);
  };

  const handleEditInBuilder = () => openBuilderAt('/builder/review');

  const handleExportPDF = async () => {
    try {
      if (isKobDocument(document)) await exportKobCharacterToPdf(document);
      else await exportCharacterToFillablePdf(document);
      toast.success('PDF exported');
    } catch (e) {
      console.error(e);
      toast.error('PDF export failed');
    }
  };

  return (
    <div className="space-y-4">
      {conflict ? <SaveConflictAlert conflict={conflict} onResolve={resolveConflict} /> : null}
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
        onOpenBuilder={mayOpenBuilder ? openBuilderAt : undefined}
        actions={(
          <>
            {isOwn ? (
              <Button asChild variant="outline">
                <Link to={getGameSystem(systemId).sheetPath(document.id)}>Open in my characters</Link>
              </Button>
            ) : null}
            {mayOpenBuilder ? (
              <Button onClick={handleEditInBuilder}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => void handleExportPDF()}>
              <FileDown className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
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
    return <Badge variant="outline" className="mt-2">Read-only. This sheet belongs to another player.</Badge>;
  }
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Badge variant="secondary">Editing another player&apos;s sheet, with their permission</Badge>
      {saving ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
    </div>
  );
}
