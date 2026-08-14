import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getTrope, kob } from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobBikeOption } from '@/data/gameSystems/kidsOnBikes/types';
import type { KobBike, KobCharacter } from '@/types/kob';
import { cn } from '@/lib/utils';

interface BikeBuilderProps {
  character: KobCharacter;
  onChange: (patch: Partial<KobCharacter>) => void;
}

function OptionGrid({
  options,
  selectedId,
  suggestedName,
  onSelect,
}: Readonly<{
  options: KobBikeOption[];
  selectedId: string;
  suggestedName: string | null;
  onSelect: (id: string) => void;
}>) {
  const suggestedStem = suggestedName?.toLowerCase() ?? null;
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {options.map((option) => {
        const selected = option.id === selectedId;
        const suggested = suggestedStem === option.name.toLowerCase();
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            aria-pressed={selected}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              selected ? 'border-primary bg-accent' : 'hover:border-primary/40 hover:bg-accent/50',
            )}
          >
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{option.name}</span>
              {option.adjective ? (
                <span className="text-xs italic text-muted-foreground">{option.adjective}</span>
              ) : null}
              {suggested ? <Badge variant="secondary">Suggested</Badge> : null}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{option.benefit}</span>
          </button>
        );
      })}
    </div>
  );
}

export function BikeBuilder({ character, onChange }: Readonly<BikeBuilderProps>) {
  const trope = getTrope(character.tropeId);
  const suggestion = trope?.suggestedBikes.find((bike) => bike.age === character.age) ?? null;

  const setBike = (patch: Partial<KobBike>) => onChange({ bike: { ...character.bike, ...patch } });

  // The trope tables name a colour the Bikes appendix does not define in two places, so a
  // suggestion is only applied when both halves resolve to real options.
  const suggestedColor = suggestion
    ? kob.bikes.colors.find((color) => color.name.toLowerCase() === suggestion.color.toLowerCase())
    : undefined;
  const suggestedUpgrade = suggestion
    ? kob.bikes.upgrades.find((upgrade) => upgrade.name.toLowerCase() === suggestion.upgrade.toLowerCase())
    : undefined;
  const canTakeGift = Boolean(suggestedColor && suggestedUpgrade);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Your bike</h3>
          <p className="text-sm text-muted-foreground">
            A colour and an upgrade. Build your own, or take the gift bike for your Trope and age.
          </p>
        </div>
        {suggestion ? (
          <Button
            type="button"
            variant="secondary"
            disabled={!canTakeGift}
            onClick={() =>
              setBike({ colorId: suggestedColor?.id ?? '', upgradeId: suggestedUpgrade?.id ?? '' })
            }
          >
            Take the gift bike ({suggestion.color}, {suggestion.upgrade})
          </Button>
        ) : null}
      </div>

      {suggestion && !canTakeGift ? (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          This Trope suggests a {suggestion.color} bike with {suggestion.upgrade}, but the imported
          Bikes appendix has no entry for it — pick a colour below instead.
        </p>
      ) : null}

      <section className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Colour</h4>
        <OptionGrid
          options={kob.bikes.colors}
          selectedId={character.bike.colorId}
          suggestedName={suggestion?.color ?? null}
          onSelect={(colorId) => setBike({ colorId })}
        />
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Upgrade</h4>
        <OptionGrid
          options={kob.bikes.upgrades}
          selectedId={character.bike.upgradeId}
          suggestedName={suggestion?.upgrade ?? null}
          onSelect={(upgradeId) => setBike({ upgradeId })}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="bike-name">Its name</Label>
          <Input
            id="bike-name"
            value={character.bike.name}
            onChange={(event) => setBike({ name: event.target.value })}
            placeholder="Silver Streak"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="bike-origin">How you got it</Label>
          <Input
            id="bike-origin"
            value={character.bike.origin}
            onChange={(event) => setBike({ origin: event.target.value })}
            placeholder="A hand-me-down from your cousin"
          />
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <Label htmlFor="bike-memory">Your favourite memory on it</Label>
          <Textarea
            id="bike-memory"
            value={character.bike.favoriteMemory}
            onChange={(event) => setBike({ favoriteMemory: event.target.value })}
            placeholder="Share this one with the group."
          />
        </div>
      </section>
    </div>
  );
}
