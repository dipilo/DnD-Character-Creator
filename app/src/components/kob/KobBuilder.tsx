// The Kids on Bikes creation screens, with no idea where the character is stored.
//
// Extracted from `KobBuilderPage` for the reason `KobSheetView` was extracted from `KobSheetPage`:
// a GM editing a player's character holds no local copy, so the same screens have to write through
// `useRemoteCharacter` instead of the store. Every edit is one `onChange` patch, as on the sheet.
import type { ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { BikeBuilder } from '@/components/kob/BikeBuilder';
import { BondedActionsEditor } from '@/components/kob/BondedActionsEditor';
import { FinishingTouches } from '@/components/kob/FinishingTouches';
import { RelationshipsEditor } from '@/components/kob/RelationshipsEditor';
import { StatSpread } from '@/components/kob/StatSpread';
import { StrengthsAndFlaw } from '@/components/kob/StrengthsAndFlaw';
import { TropePicker } from '@/components/kob/TropePicker';
import {
  finishingTouch,
  getAgeRules,
  getTrope,
  kob,
  outstandingChoices,
  statDiceForTrope,
} from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobAge, KobDie, KobStatId } from '@/data/gameSystems/kidsOnBikes/types';
import type { KobCharacter } from '@/types/kob';
import { cn } from '@/lib/utils';

const TABS = [
  { value: 'trope', label: 'Trope & age' },
  { value: 'strengths', label: 'Strengths & Flaw' },
  { value: 'details', label: 'Finishing touches' },
  { value: 'bike', label: 'Bike' },
  { value: 'relationships', label: 'Relationships' },
] as const;

function AgePicker({
  character,
  onChange,
}: Readonly<{ character: KobCharacter; onChange: (patch: Partial<KobCharacter>) => void }>) {
  const trope = getTrope(character.tropeId);
  const allowed = trope?.ages ?? kob.ages.map((age) => age.id);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {kob.ages.map((age) => {
        const permitted = allowed.includes(age.id);
        const selected = character.age === age.id;
        return (
          <button
            key={age.id}
            type="button"
            disabled={!permitted}
            aria-pressed={selected}
            onClick={() => onChange({ age: age.id as KobAge })}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              selected && 'border-primary bg-accent',
              !selected && permitted && 'hover:border-primary/40 hover:bg-accent/50',
              !permitted && 'cursor-not-allowed opacity-50',
            )}
          >
            <span className="flex flex-wrap items-center gap-2 font-semibold">
              {age.name}
              {!permitted ? <Badge variant="outline">Not for this Trope</Badge> : null}
            </span>
            <span className="mt-1 block text-sm text-muted-foreground">{age.text}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The section's own line about names, rather than a paraphrase of it. */
const fullNameRule = finishingTouch('full-name')?.paragraphs[0] ?? '';

interface KobBuilderProps {
  character: KobCharacter;
  /** Buttons for the header row. The builder never navigates on its own. */
  actions?: ReactNode;
  /** Rendered ahead of the title — a back link, usually. */
  leading?: ReactNode;
  /** Shown under the title. Used to say whose character this is when it is not the reader's. */
  note?: ReactNode;
  onChange: (patch: Partial<KobCharacter>) => void;
}

export function KobBuilder({ character, actions, leading, note, onChange }: Readonly<KobBuilderProps>) {
  const missing = outstandingChoices(character);
  const ageRules = getAgeRules(character.age);

  /** Taking a Trope writes its spread; from-scratch mode keeps whatever is already assigned. */
  const selectTrope = (tropeId: string) => {
    const trope = getTrope(tropeId);
    const allowedAges = trope?.ages ?? [];
    const changes: Partial<KobCharacter> = { tropeId, tropeAnswers: [] };
    if (!character.fromScratch) changes.statDice = statDiceForTrope(trope);
    // An age the new Trope cannot be played at is no longer a valid choice.
    if (character.age && !allowedAges.includes(character.age)) changes.age = null;
    onChange(changes);
  };

  const setDie = (statId: KobStatId, die: KobDie) => {
    onChange({ statDice: { ...character.statDice, [statId]: die } });
  };

  const statsHint = character.fromScratch
    ? 'Assign your d20 and your d4 first, then fill in the rest around them.'
    : 'Taken from your Trope. Turn on “Assign dice myself” to change them.';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {leading}
          <h1 className="truncate text-2xl font-bold tracking-tight short:text-lg">
            {character.firstName || 'New character'}
          </h1>
          {note}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      {missing.length > 0 ? (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Still to choose</AlertTitle>
          <AlertDescription>{missing.join(', ')}.</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Who they are</CardTitle>
          <CardDescription>{fullNameRule}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="first-name">First name</Label>
            <Input
              id="first-name"
              value={character.firstName}
              onChange={(event) => onChange({ firstName: event.target.value })}
              placeholder="Billy"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last-name">Last name</Label>
            <Input
              id="last-name"
              value={character.lastName}
              onChange={(event) => onChange({ lastName: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pronouns">Pronouns</Label>
            <Input
              id="pronouns"
              value={character.pronouns}
              onChange={(event) => onChange({ pronouns: event.target.value })}
              placeholder="they/them"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={character.description}
              onChange={(event) => onChange({ description: event.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="trope">
        {/* `TabsTrigger` is `flex-1 min-w-0` with a centred label, so a label wider than its share
            is clipped at *both* ends. Let each trigger keep its natural width and let the list
            scroll, as the sheet and the class detail tabs already do. */}
        <TabsList className="w-full justify-start overscroll-x-contain [&>*]:flex-none">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="min-h-11">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="trope" className="space-y-6 pt-4">
          <section className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Trope</h3>
                <p className="text-sm text-muted-foreground">
                  Your Trope sets your six dice. It is a starting point, not a stereotype.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="from-scratch"
                  checked={character.fromScratch}
                  onCheckedChange={(checked) => onChange({ fromScratch: checked })}
                />
                <Label htmlFor="from-scratch" className="font-normal">
                  Assign dice myself
                </Label>
              </div>
            </div>
            <TropePicker selectedId={character.tropeId} onSelect={(trope) => selectTrope(trope.id)} />
          </section>

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Age</h3>
            <AgePicker character={character} onChange={onChange} />
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">Stats</h3>
              <p className="text-sm text-muted-foreground">
                {statsHint}
                {ageRules ? ` ${ageRules.name}s add +1 to two of these.` : ''}
              </p>
            </div>
            <StatSpread
              statDice={character.statDice}
              age={character.age}
              onChange={character.fromScratch ? setDie : undefined}
            />
          </section>
        </TabsContent>

        <TabsContent value="strengths" className="pt-4">
          <StrengthsAndFlaw character={character} onChange={onChange} />
        </TabsContent>

        <TabsContent value="details" className="pt-4">
          <FinishingTouches character={character} onChange={onChange} />
        </TabsContent>

        <TabsContent value="bike" className="pt-4">
          <BikeBuilder character={character} onChange={onChange} />
        </TabsContent>

        <TabsContent value="relationships" className="space-y-8 pt-4">
          <RelationshipsEditor character={character} onChange={onChange} />
          <Separator />
          <BondedActionsEditor character={character} onChange={onChange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
