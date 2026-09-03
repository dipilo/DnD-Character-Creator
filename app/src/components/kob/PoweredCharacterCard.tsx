import { useMemo, useState } from 'react';
import { Dices, EyeOff, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DIE_FACES, getStatName, kob } from '@/data/gameSystems/kidsOnBikes/rules';
import { PowerCheckPanel } from './PowerCheckPanel';
import { cn } from '@/lib/utils';
import { rollOnScreen } from '@/store/diceTrayStore';
import type { PoweredCharacter, PoweredCharacterAspect } from '@/lib/api';

/** The roster seats an Aspect can sit in front of. */
export interface SeatOption {
  id: number;
  name: string;
}

interface PoweredCharacterCardProps {
  character: PoweredCharacter;
  seats: SeatOption[];
  busy: boolean;
  onSpend: (spent: number) => void;
  onMoveAspect: (id: string, change: { active?: boolean; holder?: number | null }) => void;
}

/** Radix rejects an empty string as a value, so "in the middle of the table" needs one of its own. */
const NO_SEAT = 'table';

/**
 * The Powered Character as the table sees it: the stat card, the Power Token pool, and the Aspects
 * face up in front of whoever holds them.
 *
 * Every control here is one the book gives to *any* player — "any player may activate any Aspect at
 * the table, even one in front of another player" — so nothing on this card is gated on running the
 * campaign. What the GM held back is not here at all; only the count of face-down cards is.
 */
export function PoweredCharacterCard({ character, seats, busy, onSpend, onMoveAspect }: Readonly<PoweredCharacterCardProps>) {
  const { data } = character;
  const remaining = data.powerTokens.pool - data.powerTokens.spent;
  const stats = useMemo(() => Object.entries(data.stats).filter(([, die]) => die), [data.stats]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          {data.name || 'Unnamed Powered Character'}
          {data.hiddenAspects > 0 || data.hiddenFears > 0 ? (
            <Badge variant="outline" className="gap-1 font-normal">
              <EyeOff className="h-3 w-3" />
              {faceDownLabel(data.hiddenAspects, data.hiddenFears)}
            </Badge>
          ) : null}
        </CardTitle>
        {data.concept ? <CardDescription>{data.concept}</CardDescription> : null}
      </CardHeader>

      <CardContent className="space-y-5">
        {stats.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {stats.map(([statId, die]) => (
              <Button
                key={statId}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 flex-col gap-0 coarse:min-h-11"
                onClick={() => rollStat(statId, die, data.name)}
              >
                <span className="text-xs text-muted-foreground">{getStatName(statId)}</span>
                <span className="font-semibold">{die}</span>
              </Button>
            ))}
          </div>
        ) : null}

        <PowerTokens
          pool={data.powerTokens.pool}
          spent={data.powerTokens.spent}
          remaining={remaining}
          busy={busy}
          onSpend={onSpend}
        />

        <Separator />

        <PowerCheckPanel name={data.name} spent={data.powerTokens.spent} busy={busy} onSpend={onSpend} />

        <Separator />

        <div className="space-y-2">
          <p className="text-sm font-medium">Aspects</p>
          {data.aspects.length === 0 ? (
            <p className="text-sm text-muted-foreground">None on the table yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.aspects.map((aspect) => (
                <AspectCard
                  key={aspect.id}
                  aspect={aspect}
                  seats={seats}
                  busy={busy}
                  onMove={(change) => onMoveAspect(aspect.id, change)}
                />
              ))}
            </div>
          )}
        </div>

        {data.fears.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Fears</p>
            <div className="flex flex-wrap gap-2">
              {data.fears.map((fear) => (
                <Badge
                  key={fear.id}
                  variant={fear.revealed ? 'destructive' : 'outline'}
                  className="gap-1 font-normal"
                >
                  {fear.revealed ? null : <EyeOff className="h-3 w-3" />}
                  {fear.text}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function faceDownLabel(aspects: number, fears: number): string {
  const parts = [];
  if (aspects > 0) parts.push(`${aspects} Aspect${aspects === 1 ? '' : 's'}`);
  if (fears > 0) parts.push(`${fears} Fear${fears === 1 ? '' : 's'}`);
  return `${parts.join(' and ')} face down`;
}

/** A stat check for the Powered Character, thrown on the shared surface like every other roll. */
function rollStat(statId: string, die: string, name: string) {
  const faces = DIE_FACES[die];
  if (!faces) return;
  void rollOnScreen({
    notation: `1d${faces}`,
    label: `${getStatName(statId)} check`,
    detail: name || 'Powered Character',
    explodeOnMax: true,
  });
}

interface PowerTokensProps {
  pool: number;
  spent: number;
  remaining: number;
  busy: boolean;
  onSpend: (spent: number) => void;
}

/**
 * The shared pool. Spending past it is deliberately allowed: the chapter has a section on exerting
 * "past bounds of Power Tokens", and a counter that refuses would be a rule the book does not have.
 */
function PowerTokens({ pool, spent, remaining, busy, onSpend }: Readonly<PowerTokensProps>) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Power Tokens</p>
        <p className="text-sm text-muted-foreground">
          {remaining} of {pool} left
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          className="min-h-11 coarse:min-h-11"
          onClick={() => onSpend(spent + 1)}
        >
          Spend 1
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || spent === 0}
          className="min-h-11 coarse:min-h-11"
          onClick={() => onSpend(Math.max(0, spent - 1))}
        >
          Give back 1
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || spent === 0}
          className="min-h-11 coarse:min-h-11"
          onClick={() => onSpend(0)}
        >
          <RotateCcw className="h-4 w-4" />
          Replenish
        </Button>
      </div>
    </div>
  );
}

interface AspectCardProps {
  aspect: PoweredCharacterAspect;
  seats: SeatOption[];
  busy: boolean;
  onMove: (change: { active?: boolean; holder?: number | null }) => void;
}

/**
 * One Aspect. Turning it sideways is the book's own gesture, so the card rotates rather than
 * lighting up; the seat picker is what "place it in front of you" means here.
 */
function AspectCard({ aspect, seats, busy, onMove }: Readonly<AspectCardProps>) {
  const holderValue = aspect.holder === null ? NO_SEAT : String(aspect.holder);
  return (
    <div className={cn('space-y-2 rounded-md border p-3 transition-colors', aspect.active && 'border-primary bg-accent')}>
      <button
        type="button"
        disabled={busy || aspect.hidden}
        aria-pressed={aspect.active}
        className="flex min-h-11 w-full items-start gap-2 text-left text-sm coarse:min-h-11"
        onClick={() => onMove({ active: !aspect.active })}
      >
        {aspect.hidden ? <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
        <span className={cn(aspect.hidden && 'text-muted-foreground')}>{aspect.text}</span>
      </button>
      <div className="flex items-center gap-2">
        <Select
          value={holderValue}
          disabled={busy || aspect.hidden}
          onValueChange={(value) => onMove({ holder: value === NO_SEAT ? null : Number(value) })}
        >
          <SelectTrigger className="h-9 min-h-11 text-xs coarse:min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_SEAT}>In the middle of the table</SelectItem>
            {seats.map((seat) => (
              <SelectItem key={seat.id} value={String(seat.id)}>
                {seat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {aspect.active ? <Badge variant="secondary" className="shrink-0">Turned</Badge> : null}
      </div>
    </div>
  );
}

interface AspectRollerProps {
  onRolled: (text: string) => void;
}

/**
 * Roll one of Appendix K's tables for an Aspect.
 *
 * It goes through the shared tray rather than `Math.random()`, so the number that produced the
 * answer is on screen and in the roll log like every other roll at the table.
 */
export function AspectRoller({ onRolled }: Readonly<AspectRollerProps>) {
  const [busy, setBusy] = useState(false);
  const groups = useAspectGroups();
  const [groupId, setGroupId] = useState(groups[0]?.key ?? '');
  const chosen = groups.find((group) => group.key === groupId) ?? groups[0];

  if (!chosen) return null;

  const roll = () => {
    setBusy(true);
    void rollOnScreen({
      notation: `1d${chosen.entries.length}`,
      label: 'Aspect',
      detail: chosen.label,
    })
      .then((outcome) => {
        const entry = chosen.entries.find((candidate) => candidate.roll === outcome.total) ?? chosen.entries[0];
        onRolled(`${chosen.prompt} ${entry.text}`);
      })
      .finally(() => setBusy(false));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={chosen.key} onValueChange={setGroupId}>
        <SelectTrigger className="h-9 min-h-11 w-full text-xs coarse:min-h-11 sm:w-auto sm:min-w-64">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectItem key={group.key} value={group.key}>
              {group.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="button" variant="outline" disabled={busy} className="min-h-11 coarse:min-h-11" onClick={roll}>
        <Dices className="h-4 w-4" />
        Roll one
      </Button>
    </div>
  );
}

interface AspectGroupOption {
  key: string;
  label: string;
  prompt: string;
  entries: { roll: number; text: string }[];
}

/**
 * Appendix K flattened for a picker. A table with more than one list — the Powers table is rolled
 * with a coin as well as a die — becomes one option per list, which is what the coin decides.
 */
function useAspectGroups(): AspectGroupOption[] {
  return useMemo(
    () =>
      kob.poweredCharacterAspects.sections.flatMap((section) =>
        section.groups.flatMap((group) =>
          group.variants.map((variant) => ({
            key: `${section.id}:${group.id}:${variant.label}`,
            label: variant.label ? `${group.prompt} (${variant.label})` : group.prompt,
            prompt: group.prompt,
            entries: variant.entries,
          })),
        ),
      ),
    [],
  );
}
