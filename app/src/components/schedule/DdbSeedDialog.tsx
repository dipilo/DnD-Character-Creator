// Seed a builder character from a seat's legacy D&D Beyond blob (MERGE_PLAN.md Phase 5).
//
// `players.ddb_json` was the scheduler's character storage. Phase 5 replaces it with a real link to
// a builder character, so this is the way out for the blobs that already exist: read what can be
// matched, say plainly what cannot, and hand the rest to the builder. It never writes a character —
// it starts one, which is the difference between seeding and converting.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Player } from '@/lib/api';
import { seedCharacterFromDdbJson } from '@/lib/ddbImport';
import { useCharacterStore } from '@/store/characterStore';

interface DdbSeedDialogProps {
  campaignId: number;
  campaignName?: string;
  player: Player | null;
  allowedSourceIds: string[];
  onOpenChange: (open: boolean) => void;
}

export function DdbSeedDialog({
  campaignId,
  campaignName,
  player,
  allowedSourceIds,
  onOpenChange,
}: Readonly<DdbSeedDialogProps>) {
  const navigate = useNavigate();
  const resetBuilder = useCharacterStore((state) => state.resetBuilder);
  const updateBuilderState = useCharacterStore((state) => state.updateBuilderState);
  const updateBuilderCharacter = useCharacterStore((state) => state.updateBuilderCharacter);

  const result = useMemo(() => seedCharacterFromDdbJson(player?.ddb_json), [player?.ddb_json]);

  const handleStart = () => {
    if (!result || !player) return;
    resetBuilder();
    updateBuilderState({
      selectedSourceIds: allowedSourceIds,
      forCampaignId: campaignId,
      forPlayerId: player.id,
      forCampaignName: campaignName,
    });
    updateBuilderCharacter(result.seed);
    onOpenChange(false);
    navigate('/builder/species');
  };

  return (
    <Dialog open={player !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Start from the D&D Beyond import</DialogTitle>
          <DialogDescription>
            This seat carries a D&D Beyond export from the old scheduler. It seeds the builder
            rather than becoming a sheet, so you finish the character from there.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 text-sm">
            <SeedList
              title="Carried over"
              items={result.matched}
              empty="Nothing in the export could be matched."
              icon={<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
            />
            <SeedList
              title="You will need to choose"
              items={result.unmatched}
              empty="Everything matched."
              icon={<X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            That import could not be read. It is not valid D&D Beyond character JSON.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleStart} disabled={!result}>Open in the builder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SeedListProps {
  title: string;
  items: string[];
  empty: string;
  icon: React.ReactNode;
}

function SeedList({ title, items, empty, icon }: Readonly<SeedListProps>) {
  return (
    <div className="space-y-1.5">
      <p className="font-medium">{title}</p>
      {items.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item} className="flex gap-2 text-muted-foreground">
              {icon}
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
