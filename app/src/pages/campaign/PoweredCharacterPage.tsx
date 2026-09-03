import { useCallback, useMemo, useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { PoweredCharacterCard } from '@/components/kob/PoweredCharacterCard';
import type { SeatOption } from '@/components/kob/PoweredCharacterCard';
import { PoweredCharacterEditor } from '@/components/kob/PoweredCharacterEditor';
import { kob } from '@/data/gameSystems/kidsOnBikes/rules';
import {
  createPoweredCharacter,
  deletePoweredCharacter,
  listPoweredCharacters,
  playPoweredCharacter,
  updatePoweredCharacter,
} from '@/lib/api';
import type { PoweredCharacter, PoweredCharacterData, PoweredCharacterPlayPatch } from '@/lib/api';
import { isCampaignOwner, useCampaignStore } from '@/store/campaignStore';
import { playerLabel, useCampaignId, useRoster } from './useCampaignData';
import { useTaggedLoad } from './useTaggedLoad';

/** A new card starts with the pool the chapter states, so the number is the book's and not ours. */
function emptyDocument(): PoweredCharacterData {
  return {
    name: '',
    concept: '',
    stats: {},
    powerTokens: { pool: kob.poweredCharacter.powerTokens ?? 0, spent: 0 },
    aspects: [],
    fears: [],
    hiddenAspects: 0,
    hiddenFears: 0,
  };
}

/**
 * The Powered Character at one table (Kids on Bikes, chapter 5).
 *
 * The chapter's own rules are quoted underneath rather than paraphrased: they are imported from
 * the rulebook, so this page states no rule of its own.
 */
export function PoweredCharacterPage() {
  const campaignId = useCampaignId();
  const { membership } = useCampaignStore();
  const owner = isCampaignOwner(membership);
  const { players } = useRoster(campaignId);

  const load = useTaggedLoad<PoweredCharacter[]>(
    campaignId,
    true,
    useCallback((id: number) => listPoweredCharacters(id), []),
    'Could not load the Powered Character.',
  );

  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [busy, setBusy] = useState(false);

  const seats: SeatOption[] = useMemo(
    () => players.map((player) => ({ id: player.id, name: playerLabel(player) })),
    [players],
  );

  const characters = load.data ?? [];

  const applyResult = (updated: PoweredCharacter) => {
    load.set(characters.map((entry) => (entry.id === updated.id ? updated : entry)));
  };

  const run = (work: Promise<unknown>, onDone?: () => void) => {
    setBusy(true);
    work
      .then(() => onDone?.())
      .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'That did not go through.'))
      .finally(() => setBusy(false));
  };

  const play = (character: PoweredCharacter, patch: PoweredCharacterPlayPatch) => {
    run(playPoweredCharacter(character.id, patch).then(applyResult));
  };

  const save = (character: PoweredCharacter | null, data: PoweredCharacterData) => {
    const work = character
      ? updatePoweredCharacter(character.id, character.version, data)
      : createPoweredCharacter(campaignId, data);
    run(
      work.then(() => {
        setEditing(null);
        load.reload();
      }),
    );
  };

  if (load.loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading the Powered Character...
      </div>
    );
  }

  if (load.error) {
    return (
      <Card>
        <CardHeader>
          <CardDescription>{load.error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="min-h-11 coarse:min-h-11" onClick={load.reload}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold short:text-base">
          <Sparkles className="h-5 w-5" />
          {kob.poweredCharacter.title || 'Powered Characters'}
        </h2>
        {owner && editing === null ? (
          <Button className="min-h-11 coarse:min-h-11" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        ) : null}
      </div>

      {editing === 'new' ? (
        <PoweredCharacterEditor
          initial={emptyDocument()}
          saving={busy}
          onSave={(data) => save(null, data)}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      {characters.length === 0 && editing !== 'new' ? (
        <Card>
          <CardHeader>
            <CardDescription>
              {owner
                ? 'The GM introduces the Powered Character early in the first session.'
                : 'Your GM has not introduced one yet.'}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {characters.map((character) =>
        editing === character.id ? (
          <PoweredCharacterEditor
            key={character.id}
            initial={character.data}
            saving={busy}
            onSave={(data) => save(character, data)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <div key={character.id} className="space-y-2">
            <PoweredCharacterCard
              character={character}
              seats={seats}
              busy={busy}
              onSpend={(spent) => play(character, { spent })}
              onMoveAspect={(id, change) => play(character, { aspects: [{ id, ...change }] })}
            />
            {character.is_owner ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  className="min-h-11 coarse:min-h-11"
                  onClick={() => setEditing(character.id)}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  className="min-h-11 coarse:min-h-11"
                  onClick={() => run(deletePoweredCharacter(character.id), load.reload)}
                >
                  Remove
                </Button>
              </div>
            ) : null}
          </div>
        ),
      )}

      <PoweredCharacterRules />
    </div>
  );
}

/** The chapter itself, imported from the rulebook. Collapsed, because it is reference, not a step. */
function PoweredCharacterRules() {
  const sections = kob.poweredCharacter.sections.filter((section) => section.name && section.paragraphs.length > 0);
  if (sections.length === 0) return null;

  return (
    <Accordion type="single" collapsible className="rounded-md border px-3">
      {sections.map((section) => (
        <AccordionItem key={section.id} value={section.id}>
          <AccordionTrigger className="text-left text-sm">{section.name}</AccordionTrigger>
          <AccordionContent className="space-y-3 text-sm text-muted-foreground">
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
