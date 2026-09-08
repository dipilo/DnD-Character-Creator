// The rendered Kids on Bikes sheet.
//
// Extracted from `KobSheetPage` for the same reason `CharacterSheetView` was extracted from the
// D&D one: a campaign-mate opening a seated character has to see the real sheet, not a summary,
// and that means the owner's page and the party view render through the same component.
//
// It is the same frame the D&D sheet is: a persistent header and rail — the tokens, the stat dice
// and the Knacks, everything read while doing something else — with one tabbed subsection beside
// it holding the genuine alternates.
//
// It reads no store and performs no writes. `onChange` is the whole write surface, and its absence
// is what makes the party view read-only.
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getGameSystem } from '@/data/gameSystems';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { BackpackButton } from '@/components/kob/BackpackButton';
import { BackpackCanvasDialog } from '@/components/kob/BackpackCanvasDialog';
import { ConsentSheetPanel } from '@/components/kob/ConsentSheetPanel';
import { KobSheetRail } from '@/components/kob/KobSheetRail';
import { useFitsViewport, useSheetLayout } from '@/components/character/useSheetLayout';
import {
  bondedActionName,
  freeStrengthForAge,
  fullName,
  getAgeRules,
  getBikeColor,
  getBikeUpgrade,
  getBondedAction,
  getStrength,
  getTrope,
  kob,
  needsSkilledAt,
  tropeQuestions,
} from '@/data/gameSystems/kidsOnBikes/rules';
import { hasAnyConsentContent } from '@/lib/kob/consent';
import { readCanvas } from '@/lib/kob/backpackCanvas';
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

/**
 * The backpack, opened as the board it is. Read-only without `onChange`, which is the same thing
 * that makes the rest of the party view read-only.
 */
function BackpackCard({
  character,
  onChange,
}: Readonly<{ character: KobCharacter; onChange?: (patch: Partial<KobCharacter>) => void }>) {
  const [open, setOpen] = useState(false);
  const canvas = readCanvas(character.backpackCanvas);
  if (canvas.nodes.length === 0 && !onChange) {
    return <Field label="Backpack" value={character.backpack} />;
  }
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Backpack</p>
      <BackpackButton canvas={canvas} onOpen={() => setOpen(true)} className="mt-1" />
      <BackpackCanvasDialog
        open={open}
        onOpenChange={setOpen}
        canvas={character.backpackCanvas}
        readOnly={!onChange}
        onChange={(backpackCanvas) => onChange?.({ backpackCanvas })}
      />
    </div>
  );
}

/**
 * A Bonded Action is agreed between two players, so it prints the pair and the shared history
 * they wrote — the mechanical line comes from the appendix, never from what was typed.
 */
function BondedActionsCard({ character }: Readonly<{ character: KobCharacter }>) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Bonded Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {character.bondedActions.map((entry, index) => {
          const action = getBondedAction(entry.actionId);
          const name = bondedActionName(entry) || 'Unnamed Bonded Action';
          const withWhom = entry.withCharacter || 'someone';
          return (
            <div key={entry.id} className="space-y-1">
              {index > 0 ? <Separator className="mb-3" /> : null}
              <p className="font-medium">
                {name}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  with{' '}
                  {entry.withCharacterId ? (
                    <Link
                      className="underline underline-offset-4 hover:text-brand"
                      to={getGameSystem(character.systemId).sheetPath(entry.withCharacterId)}
                    >
                      {withWhom}
                    </Link>
                  ) : (
                    withWhom
                  )}
                </span>
              </p>
              {action ? <p className="text-sm text-muted-foreground">{action.description}</p> : null}
              {entry.backstory.trim() ? (
                <p className="whitespace-pre-wrap text-sm">{entry.backstory}</p>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RelationshipsCard({ character }: Readonly<{ character: KobCharacter }>) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Relationships</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {character.relationships.map((relationship, index) => (
          <div key={relationship.id} className="space-y-1">
            {index > 0 ? <Separator className="mb-3" /> : null}
            <p className="font-medium">
              {/* A relationship pointed at a party-mate opens their sheet; the route is the
                  registry's, because this system does not spell another's out. */}
              {relationship.withCharacterId ? (
                <Link
                  className="underline underline-offset-4 hover:text-brand"
                  to={getGameSystem(character.systemId).sheetPath(relationship.withCharacterId)}
                >
                  {relationship.who || 'Someone'}
                </Link>
              ) : (
                relationship.who || 'Someone'
              )}
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

interface KobSheetViewProps {
  character: KobCharacter;
  /** Buttons for the header row. The view itself never writes, so every action comes from here. */
  actions?: ReactNode;
  /** Rendered ahead of the title — a back link, usually. */
  leading?: ReactNode;
  /** Shown under the title. Used to say whose sheet this is when it is not the reader's. */
  note?: ReactNode;
  /** Omit to render read-only; see the module comment. */
  onChange?: (patch: Partial<KobCharacter>) => void;
}

export function KobSheetView({ character, actions, leading, note, onChange }: Readonly<KobSheetViewProps>) {
  const { railIsSticky } = useSheetLayout();
  const { ref: railRef, fits: railFits } = useFitsViewport(80);
  const trope = getTrope(character.tropeId);
  const ageRules = getAgeRules(character.age);
  const flaw = character.customFlaw || kob.flaws.find((entry) => entry.id === character.flawId)?.name || '';
  const questions = tropeQuestions(character.tropeId);
  const knacks = character.knacks.filter((knack) => knack.trim());
  const answeredQuestions = questions.length > 0 && character.tropeAnswers.some((answer) => answer?.trim());
  const hasConnections =
    character.relationships.length > 0 || character.bondedActions.length > 0 || answeredQuestions;
  const showConsent = Boolean(onChange) || hasAnyConsentContent(character.consent);
  const showNotes = Boolean(onChange) || Boolean(character.notes.trim());

  return (
    // `sheet-dense` tightens every Card inside the sheet (index.css), the same as the D&D one.
    <div className="sheet-dense space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {leading}
          <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl short:text-lg">
            {fullName(character) || 'Unnamed'}
          </h1>
          <p className="text-muted-foreground short:hidden">
            {[ageRules?.name, trope?.name, character.pronouns].filter(Boolean).join(' · ')}
          </p>
          {note}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-6">
        {/* Pinned only while the whole rail fits under the header. A taller one scrolls with the
            page, because giving it a scrollbar of its own makes reaching its bottom two gestures
            on two surfaces. */}
        <div ref={railRef} className={railIsSticky && railFits ? 'lg:sticky lg:top-16' : undefined}>
          <KobSheetRail character={character} knacks={knacks} onChange={onChange} />
        </div>

        <Tabs defaultValue="character" className="min-w-0">
          <TabsList className="w-full justify-start overscroll-x-contain [&>*]:flex-none coarse:h-auto coarse:[&>*]:min-h-11">
            <TabsTrigger value="character">Character</TabsTrigger>
            {hasConnections ? <TabsTrigger value="connections">Connections</TabsTrigger> : null}
            {showNotes ? <TabsTrigger value="notes">Notes</TabsTrigger> : null}
            {showConsent ? <TabsTrigger value="consent">Consent</TabsTrigger> : null}
          </TabsList>

          {/* Columns, not a grid: a grid row is as tall as its tallest card and a short Strengths
              card left a hole the height of the Flaw card beside it. */}
          <TabsContent
            value="character"
            className="[&>*]:mb-4 [&>*]:break-inside-avoid xl:columns-2 xl:gap-4"
          >
            <StrengthsCard character={character} />

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Flaw, Fear &amp; Motivation</CardTitle>
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
                <CardTitle className="text-base">Backpack &amp; Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <BackpackCard character={character} onChange={onChange} />
                <Field label="Description" value={character.description} />
              </CardContent>
            </Card>

            <BikeCard character={character} />
          </TabsContent>

          {hasConnections ? (
            <TabsContent value="connections" className="space-y-4">
              {character.relationships.length > 0 ? <RelationshipsCard character={character} /> : null}
              {character.bondedActions.length > 0 ? <BondedActionsCard character={character} /> : null}
              {answeredQuestions ? (
                <Card>
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
            </TabsContent>
          ) : null}

          {showNotes ? (
            <TabsContent value="notes">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  {onChange ? (
                    <Textarea
                      value={character.notes}
                      onChange={(event) => onChange({ notes: event.target.value })}
                      placeholder="Session notes, clues, who owes whom a favour…"
                      className="min-h-32"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{character.notes}</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ) : null}

          {showConsent ? (
            <TabsContent value="consent">
              <ConsentSheetPanel character={character} onChange={onChange} />
            </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </div>
  );
}
