import { useState } from 'react';
import { Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { kob } from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobPowerCheckFactor } from '@/data/gameSystems/kidsOnBikes/types';
import { rollOnScreen } from '@/store/diceTrayStore';

interface PowerCheckPanelProps {
  name: string;
  spent: number;
  busy: boolean;
  onSpend: (spent: number) => void;
}

interface Attempt {
  rolls: number[];
  total: number;
  tokens: number;
}

/** Radix rejects an empty string as a value, so "not chosen yet" needs one of its own. */
const UNSET = 'unset';

const EMPTY: Attempt = { rolls: [], total: 0, tokens: 0 };

function difficultyOf(choices: Record<string, string>, factors: KobPowerCheckFactor[]): number {
  return factors.reduce((sum, factor) => {
    const option = factor.options.find((candidate) => candidate.id === choices[factor.id]);
    return sum + (option?.modifier ?? 0);
  }, 0);
}

/** The row the table gives for the Power Tokens spent so far, or the last one it prints. */
function consequenceFor(tokens: number): string {
  const rows = kob.poweredCharacter.powerCheck.consequences;
  const matched = rows.filter((row) => row.tokens <= tokens).at(-1);
  return matched?.text ?? '';
}

/**
 * A power check: the difficulty the four factors add up to, then a d6 per Power Token until the
 * table meets it or gives up.
 *
 * The pool is the campaign's, so every spend goes back through `onSpend` and the whole table sees
 * it; the attempt itself is this reader's, the way a roll is. Lucky Breaks come from the tray's own
 * `explodeOnMax`, which is the same switch a stat check uses.
 */
export function PowerCheckPanel({ name, spent, busy, onSpend }: Readonly<PowerCheckPanelProps>) {
  const { equation, factors } = kob.poweredCharacter.powerCheck;
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [target, setTarget] = useState(0);
  const [attempt, setAttempt] = useState<Attempt>(EMPTY);
  const [rolling, setRolling] = useState(false);

  const met = attempt.tokens > 0 && attempt.total >= target;
  const canRoll = target > 0 && !met && !busy && !rolling;

  const choose = (factorId: string, optionId: string) => {
    const next = { ...choices, [factorId]: optionId === UNSET ? '' : optionId };
    setChoices(next);
    setTarget(difficultyOf(next, factors));
  };

  const clear = () => {
    setAttempt(EMPTY);
    setChoices({});
    setTarget(0);
  };

  const spendAndRoll = () => {
    const carried = attempt.total;
    setRolling(true);
    rollOnScreen({
      notation: '1d6',
      label: 'Power check',
      detail: name || 'Powered Character',
      explodeOnMax: true,
      describeOutcome: (outcome) => `${carried + outcome.total} of ${target}`,
    })
      .then((outcome) => {
        setAttempt((current) => ({
          rolls: [...current.rolls, outcome.total],
          total: current.total + outcome.total,
          tokens: current.tokens + 1,
        }));
        onSpend(spent + 1);
      })
      .finally(() => setRolling(false));
  };

  if (factors.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Power check</p>
        <p className="text-xs text-muted-foreground">{equation} = difficulty</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {factors.map((factor) => (
          <FactorField
            key={factor.id}
            factor={factor}
            value={choices[factor.id] || UNSET}
            onChange={(value) => choose(factor.id, value)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="pc-difficulty">Difficulty</Label>
          <Input
            id="pc-difficulty"
            type="number"
            min={0}
            value={target}
            className="w-24 coarse:min-h-11"
            onChange={(event) => setTarget(Math.max(0, Number(event.target.value) || 0))}
          />
        </div>
        <Button type="button" disabled={!canRoll} className="min-h-11 coarse:min-h-11" onClick={spendAndRoll}>
          <Dices className="h-4 w-4" />
          Spend 1 PT and roll
        </Button>
        {attempt.tokens > 0 || target > 0 ? (
          <Button type="button" variant="ghost" className="min-h-11 coarse:min-h-11" onClick={clear}>
            {attempt.tokens > 0 && !met ? 'Stop' : 'Clear'}
          </Button>
        ) : null}
      </div>

      <AttemptReadout attempt={attempt} target={target} met={met} />
    </div>
  );
}

interface FactorFieldProps {
  factor: KobPowerCheckFactor;
  value: string;
  onChange: (value: string) => void;
}

/**
 * One factor. The option list carries only the label and its modifier: the book's examples run to
 * three lines apiece, and a phone-width dropdown of five of them is the wall of text this screen
 * exists to replace. They are printed under the field once a choice is made, which is when they
 * are what the narration needs.
 */
function FactorField({ factor, value, onChange }: Readonly<FactorFieldProps>) {
  const id = `factor-${factor.id}`;
  const chosen = factor.options.find((option) => option.id === value);
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{factor.name}</Label>
      {factor.question ? <p className="text-xs text-muted-foreground">{factor.question}</p> : null}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full min-h-11 coarse:min-h-11">
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={UNSET}>Not set</SelectItem>
          {factor.options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label} +{option.modifier}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {chosen?.examples ? <p className="text-xs text-muted-foreground">{chosen.examples}</p> : null}
      {factor.note ? <p className="text-xs text-muted-foreground">{factor.note}</p> : null}
    </div>
  );
}

interface AttemptReadoutProps {
  attempt: Attempt;
  target: number;
  met: boolean;
}

/** The running total, what it has cost so far, and the row the book gives for that many tokens. */
function AttemptReadout({ attempt, target, met }: Readonly<AttemptReadoutProps>) {
  if (attempt.tokens === 0) return null;
  const consequence = consequenceFor(attempt.tokens);
  return (
    <div className="space-y-1 rounded-md border p-3 text-sm">
      <p className="font-medium">
        {attempt.total} of {target}
        {met ? '. The attempt succeeds.' : ''}
      </p>
      <p className="text-xs text-muted-foreground">
        Rolled {attempt.rolls.join(' + ')} for {attempt.tokens} PT.
      </p>
      {consequence ? <p className="text-xs text-muted-foreground">{consequence}</p> : null}
    </div>
  );
}
