import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Minus, Pencil, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { StatSpread } from '@/components/kob/StatSpread';
import {
  freeStrengthForAge,
  fullName,
  getAgeRules,
  getBikeColor,
  getBikeUpgrade,
  getStrength,
  getTrope,
  kob,
  needsSkilledAt,
  tropeQuestions,
} from '@/data/gameSystems/kidsOnBikes/rules';
import { useKobCharacterStore } from '@/store/kobCharacterStore';
import type { KobCharacter } from '@/types/kob';

/** A labelled block that renders nothing when the player has not written anything in it. */
function Field({ label, value }: Readonly<{ label: string; value: string }>) {
  if (!value.trim()) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

function StrengthsCard({ character }: Readonly<{ character: KobCharacter }>) {
  const free = freeStrengthForAge(character.age);
  const chosen = character.strengthIds.map((id) => getStrength(id)).filter((s) => s !== null);
  const all = free ? [free, ...chosen] : chosen;
  const skilledAtLabel = needsSkilledAt(character) && character.skilledAt ? character.skilledAt : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Strengths</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {all.length === 0 ? (
          <p className="text-sm text-muted-foreground">None chosen yet.</p>
        ) : null}
        {all.map((strength) => (
          <div key={strength.id}>
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {strength.id === 'skilled-at' && skilledAtLabel
                ? `Skilled at ${skilledAtLabel}`
                : strength.name}
              {strength.id === free?.id ? <Badge variant="secondary">Free for your age</Badge> : null}
            </p>
            <p className="text-sm text-muted-foreground">{strength.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BikeCard({ character }: Readonly<{ character: KobCharacter }>) {
  const color = getBikeColor(character.bike.colorId);
  const upgrade = getBikeUpgrade(character.bike.upgradeId);
  if (!color && !upgrade && !character.bike.name) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {character.bike.name || 'Bike'}
          {color || upgrade ? (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {[color?.name, upgrade?.name].filter(Boolean).join(' · ')}
            </span>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {color ? (
          <div>
            <p className="font-medium">
              {color.name}
              {color.adjective ? <span className="ml-2 text-sm italic text-muted-foreground">{color.adjective}</span> : null}
            </p>
            <p className="text-sm text-muted-foreground">{color.benefit}</p>
          </div>
        ) : null}
        {upgrade ? (
          <div>
            <p className="font-medium">
              {upgrade.name}
              {upgrade.adjective ? <span className="ml-2 text-sm italic text-muted-foreground">{upgrade.adjective}</span> : null}
            </p>
            <p className="text-sm text-muted-foreground">{upgrade.benefit}</p>
          </div>
        ) : null}
        <Field label="How you got it" value={character.bike.origin} />
        <Field label="Favourite memory" value={character.bike.favoriteMemory} />
      </CardContent>
    </Card>
  );
}

export function KobSheetPage() {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const character = useKobCharacterStore((state) =>
    state.characters.find((entry) => entry.id === characterId),
  );
  const { updateCharacter } = useKobCharacterStore.getState();

  if (!character) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Character not found</h1>
        <Button onClick={() => navigate('/kob')}>Back to Kids on Bikes</Button>
      </div>
    );
  }

  const trope = getTrope(character.tropeId);
  const ageRules = getAgeRules(character.age);
  const flaw = character.customFlaw || kob.flaws.find((entry) => entry.id === character.flawId)?.name || '';
  const questions = tropeQuestions(character.tropeId);
  const knacks = character.knacks.filter((knack) => knack.trim());
  const setTokens = (value: number) => updateCharacter(character.id, { adversityTokens: Math.max(0, value) });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 min-h-11">
            <Link to="/kob">
              <ArrowLeft className="h-4 w-4" />
              Kids on Bikes
            </Link>
          </Button>
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl short:text-lg">
            {fullName(character) || 'Unnamed'}
          </h1>
          <p className="text-muted-foreground">
            {[ageRules?.name, trope?.name, character.pronouns].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Button asChild variant="secondary" className="min-h-11">
          <Link to={`/kob/builder/${character.id}`}>
            <Pencil className="h-4 w-4" />
            Edit
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Adversity Tokens</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="min-h-11"
                aria-label="Spend an Adversity Token"
                onClick={() => setTokens(character.adversityTokens - 1)}
                disabled={character.adversityTokens === 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center text-2xl font-bold tabular-nums text-brand">
                {character.adversityTokens}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="min-h-11"
                aria-label="Gain an Adversity Token"
                onClick={() => setTokens(character.adversityTokens + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Spend them to raise a roll, to power a Strength, or — with the GM's permission — to
            ignore your Fear. You gain one every time you fail a roll.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Stats</CardTitle>
        </CardHeader>
        <CardContent>
          <StatSpread statDice={character.statDice} age={character.age} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <StrengthsCard character={character} />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Flaw, Fear & Motivation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Flaw" value={flaw} />
            <Field label="Fear" value={character.fear} />
            <Field label="Motivation" value={character.motivation} />
            <Field label="Obligations" value={character.obligations} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Knacks & Backpack</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {knacks.length > 0 ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Knacks
                </p>
                <ul className="mt-1 list-inside list-disc text-sm">
                  {knacks.map((knack) => (
                    <li key={knack}>{knack}</li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">
                  Once per session each: take a 10 instead of rolling.
                </p>
              </div>
            ) : null}
            <Field label="Backpack" value={character.backpack} />
            <Field label="Description" value={character.description} />
          </CardContent>
        </Card>

        <BikeCard character={character} />

        {character.relationships.length > 0 ? (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Relationships</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {character.relationships.map((relationship, index) => (
                <div key={relationship.id} className="space-y-1">
                  {index > 0 ? <Separator className="mb-3" /> : null}
                  <p className="font-medium">
                    {relationship.who || 'Someone'}
                    {relationship.connection ? (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        {relationship.connection}
                      </span>
                    ) : null}
                  </p>
                  {relationship.question ? (
                    <p className="text-sm italic text-muted-foreground">{relationship.question}</p>
                  ) : null}
                  {relationship.answer ? (
                    <p className="whitespace-pre-wrap text-sm">{relationship.answer}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {questions.length > 0 && character.tropeAnswers.some((answer) => answer?.trim()) ? (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{trope?.name} questions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.map((question, index) => (
                <Field key={question} label={question} value={character.tropeAnswers[index] ?? ''} />
              ))}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={character.notes}
            onChange={(event) => updateCharacter(character.id, { notes: event.target.value })}
            placeholder="Session notes, clues, who owes whom a favour…"
            className="min-h-32"
          />
        </CardContent>
      </Card>
    </div>
  );
}
