// One character's sheet, read from the server rather than the local cache (MERGE_PLAN.md Phase 5).
//
// This is the page that makes the party view worth having: a DM opens any character seated at their
// campaign and gets the real sheet, rendered by the same `CharacterSheetView` the owner sees. The
// server allows the read because the character is attached to a campaign both accounts belong to;
// nothing here can write, and the owner's actions (edit, delete) are simply not offered.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { getCharacter } from '@/lib/api';
import type { CharacterRecord } from '@/lib/api';
import { CharacterSheetView } from '@/components/character/CharacterSheetView';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { exportCharacterToFillablePdf } from '@/lib/characterPdf';
import { useAuthStore } from '@/store/authStore';
import { useCampaignId } from '@/pages/campaign/useCampaignData';

interface FetchResult {
  key: string;
  record: CharacterRecord | null;
  error: string | null;
}

export function CampaignCharacterPage() {
  const campaignId = useCampaignId();
  const { characterId } = useParams<{ characterId: string }>();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [result, setResult] = useState<FetchResult | null>(null);
  const key = `${campaignId}:${characterId}`;

  useEffect(() => {
    if (!characterId) return;
    let cancelled = false;
    getCharacter(characterId)
      .then((record) => {
        if (!cancelled) setResult({ key, record, error: null });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setResult({ key, record: null, error: e instanceof Error ? e.message : 'Could not load that character.' });
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, key]);

  const fresh = result?.key === key ? result : null;

  const backToParty = (
    <Button asChild variant="outline" size="sm">
      <Link to={`/campaign/${campaignId}/party`}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Party
      </Link>
    </Button>
  );

  if (fresh === null) {
    return (
      <output className="flex items-center gap-2 py-20 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading the sheet...
      </output>
    );
  }

  if (fresh.error || !fresh.record?.data) {
    return (
      <div className="space-y-4 py-20 text-center">
        <p className="text-muted-foreground">
          {fresh.error ?? 'That character has no readable sheet.'}
        </p>
        {backToParty}
      </div>
    );
  }

  const character = fresh.record.data;
  const isOwn = fresh.record.user_id === userId;

  const handleExportPDF = async () => {
    try {
      await exportCharacterToFillablePdf(character);
      toast.success('PDF exported');
    } catch (error) {
      console.error(error);
      toast.error('PDF export failed');
    }
  };

  return (
    <CharacterSheetView
      character={character}
      leading={backToParty}
      note={isOwn ? null : <Badge variant="outline" className="mt-2">Read-only — this sheet belongs to another player</Badge>}
      actions={(
        <>
          {isOwn ? (
            <Button asChild variant="outline">
              <Link to={`/character/${character.id}`}>Open in my characters</Link>
            </Button>
          ) : null}
          <Button variant="outline" onClick={handleExportPDF}>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
        </>
      )}
    />
  );
}
