// The half of the Kids on Bikes sheet that never goes away: the tokens you spend, the dice you
// roll, and the Knacks you spend once a session. Everything else is an alternate view of the
// character and lives in the tabbed subsection beside this.
//
// It writes nothing of its own — `onChange` is the whole write surface, exactly as in
// `KobSheetView`, and a roll is not a write.
import { useState } from 'react';
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatSpread } from '@/components/kob/StatSpread';
import { getPlayRuleSection } from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobCharacter } from '@/types/kob';

/** The book's own paragraph, kept out of the way until it is asked for. */
function RuleNote({ label, text }: Readonly<{ label: string; text: string }>) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex min-h-9 w-full items-center justify-between gap-2 text-xs font-medium text-muted-foreground coarse:min-h-11">
        {label}
        <ChevronDown className={open ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <p className="pt-1 text-xs text-muted-foreground">{text}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function AdversityTokensCard({
  character,
  onChange,
}: Readonly<{ character: KobCharacter; onChange?: (patch: Partial<KobCharacter>) => void }>) {
  // Both of these are the book's own sentences, imported from the vault rather than paraphrased.
  const rule = [
    getPlayRuleSection('adversity-tokens')?.paragraphs[0],
    getPlayRuleSection('failing-a-roll')?.paragraphs[0],
  ]
    .filter(Boolean)
    .join(' ');
  const setTokens = (value: number) => onChange?.({ adversityTokens: Math.max(0, value) });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Adversity Tokens</CardTitle>
          <div className="flex items-center gap-2">
            {onChange ? (
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
            ) : null}
            <span className="w-10 text-center text-2xl font-bold tabular-nums text-brand">
              {character.adversityTokens}
            </span>
            {onChange ? (
              <Button
                variant="outline"
                size="icon"
                className="min-h-11"
                aria-label="Gain an Adversity Token"
                onClick={() => setTokens(character.adversityTokens + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <RuleNote label="What these are" text={rule} />
      </CardContent>
    </Card>
  );
}

interface KobSheetRailProps {
  character: KobCharacter;
  /** The Knacks the player wrote, already trimmed of blanks by the sheet. */
  knacks: readonly string[];
  onChange?: (patch: Partial<KobCharacter>) => void;
}

export function KobSheetRail({ character, knacks, onChange }: Readonly<KobSheetRailProps>) {
  // The Lucky Break is the reason a stat is a button; the rule is quoted from the vault, never
  // paraphrased here.
  const statCheckRule = getPlayRuleSection('stat-checks')?.paragraphs[1] ?? '';

  return (
    <div className="space-y-4">
      <AdversityTokensCard character={character} onChange={onChange} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Two across in a 19rem column, three where the rail is a full-width strip. */}
          <StatSpread
            statDice={character.statDice}
            age={character.age}
            rollable
            className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-2"
          />
          <RuleNote label="How a check works" text={statCheckRule} />
        </CardContent>
      </Card>

      {knacks.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Knacks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <ul className="list-inside list-disc text-sm">
              {knacks.map((knack) => (
                <li key={knack}>{knack}</li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Once per session each: take a 10 instead of rolling.
            </p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
