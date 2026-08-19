// The shared dice surface, mounted once by `Layout`.
//
// Every roll the app makes outside the roller page — a skill on the sheet, a Kids on Bikes stat
// check, "roll a question" — goes through `rollOnScreen` and lands here, so one preference decides
// whether it is thrown across the screen or resolved instantly.
//
// `DiceScene` is loaded lazily and only once a roll has actually been asked for: it statically
// imports 2,667 KB of physics engine, and this component is in the boot graph of every route.
import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DICE_PALETTE_COLORS } from '@/components/dice/dicePalette';
import type { DiceSceneHandle } from '@/components/dice/DiceScene';
import { parseDiceNotation } from '@/lib/diceNotation';
import { resolveDiceColorMode, useDicePreferencesStore } from '@/store/dicePreferencesStore';
import {
  MAX_LUCKY_BREAKS,
  isMaximum,
  rollInstantly,
  summarizeRoll,
  useDiceTrayStore,
  type PendingRoll,
} from '@/store/diceTrayStore';
import type { AVAILABLE_DICE_THEMES } from '@/components/dice/diceOptions';

const DiceScene = lazy(async () => ({ default: (await import('@/components/dice/DiceScene')).DiceScene }));

/** How long a settled result stays on screen before it clears itself. */
const RESULT_LINGER_MS = 8000;

function formatSigned(value: number) {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function DiceTray() {
  const queued = useDiceTrayStore((state) => state.queue.length);
  const active = useDiceTrayStore((state) => state.active);
  const outcome = useDiceTrayStore((state) => state.outcome);
  const warm = useDiceTrayStore((state) => state.warm);
  const dismiss = useDiceTrayStore((state) => state.dismiss);

  const show3dDice = useDicePreferencesStore((state) => state.show3dDice);
  const soundEnabled = useDicePreferencesStore((state) => state.soundEnabled);
  const theme = useDicePreferencesStore((state) => state.theme) as (typeof AVAILABLE_DICE_THEMES)[number];
  const diceColor = useDicePreferencesStore((state) => state.diceColor);
  const diceScale = useDicePreferencesStore((state) => state.diceScale);
  const colorMode = useDicePreferencesStore(resolveDiceColorMode);

  const sceneRef = useRef<DiceSceneHandle | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  // The surface is mounted from the first roll onwards, not from page load: keeping it after that
  // is what makes the second click throw immediately instead of waiting out another init.
  const showScene = show3dDice && warm;
  const canThrow = showScene ? sceneReady : true;

  useEffect(() => {
    if (active || queued === 0 || !canThrow) {
      return;
    }

    const pending = useDiceTrayStore.getState().takeNext();
    if (!pending) {
      return;
    }

    const scene = showScene ? sceneRef.current : null;
    void resolveRoll(pending, scene).then((settled) => {
      useDiceTrayStore.getState().settle(pending, settled);
    });
  }, [active, canThrow, queued, showScene]);

  useEffect(() => {
    if (!outcome) {
      return;
    }

    const timer = window.setTimeout(() => dismiss(), RESULT_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [dismiss, outcome]);

  const rolling = Boolean(active);
  if (!showScene && !rolling && !outcome) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50" aria-live="polite">
      {showScene ? (
        <Suspense fallback={null}>
          <DiceScene
            ref={sceneRef}
            soundEnabled={soundEnabled}
            theme={theme}
            themeColor={diceColor}
            colorMode={colorMode}
            colorPalette={DICE_PALETTE_COLORS}
            scale={diceScale}
            throwForce={7}
            spinForce={7}
            onReadyChange={setSceneReady}
            className="absolute inset-0 h-full w-full"
          />
        </Suspense>
      ) : null}

      {rolling || outcome ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 sm:p-4">
          {rolling && active ? (
            <div className="pointer-events-auto rounded-xl border bg-card/95 px-4 py-3 text-sm shadow-lg backdrop-blur">
              <span className="font-medium">{active.request.label}</span>
              <span className="ml-2 text-muted-foreground">rolling {active.request.notation}…</span>
            </div>
          ) : null}
          {!rolling && outcome ? <DiceOutcomeCard onDismiss={dismiss} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function DiceOutcomeCard({ onDismiss }: Readonly<{ onDismiss: () => void }>) {
  const outcome = useDiceTrayStore((state) => state.outcome);
  if (!outcome) return null;

  const { request } = outcome;
  const detail = [request.detail, request.notation].filter(Boolean).join(' · ');
  const note = request.describeOutcome?.(outcome) ?? null;

  return (
    <div className="pointer-events-auto w-full max-w-md rounded-xl border bg-card/95 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3 p-3 sm:p-4">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{request.label}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {outcome.results.map((result, index) => (
              <Badge
                key={`${result.sides}-${result.value}-${index}`}
                variant={isMaximum(result) ? 'default' : 'secondary'}
                className="tabular-nums"
              >
                d{result.sides ?? '?'}: {result.value ?? '?'}
              </Badge>
            ))}
            {outcome.modifier !== 0 ? (
              <Badge variant="outline" className="tabular-nums">{formatSigned(outcome.modifier)}</Badge>
            ) : null}
            {outcome.luckyBreaks > 0 ? (
              <Badge className="bg-amber-500 text-amber-950 hover:bg-amber-500">
                {outcome.luckyBreaks === 1 ? 'Lucky Break' : `${outcome.luckyBreaks} Lucky Breaks`}
              </Badge>
            ) : null}
          </div>
          {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold tabular-nums leading-none">{outcome.total}</p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-1 h-11 w-11"
            aria-label="Dismiss the roll"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Throw the request, on the surface when there is one. A Lucky Break is a fresh throw of the same
 * die added to the running total, so it is a loop here rather than something the notation can say.
 */
async function resolveRoll(pending: PendingRoll, scene: DiceSceneHandle | null) {
  const { request } = pending;
  const modifier = parseDiceNotation(request.notation)?.modifier ?? 0;

  if (!scene) {
    return rollInstantly(request) ?? summarizeRoll([], modifier);
  }

  try {
    const results = [...(await scene.roll(request.notation))];
    let luckyBreaks = 0;

    while (request.explodeOnMax && isMaximum(results.at(-1)) && luckyBreaks < MAX_LUCKY_BREAKS) {
      const again = await scene.roll(`1d${results.at(-1)?.sides ?? 0}`);
      results.push(...again);
      luckyBreaks += 1;
    }

    return summarizeRoll(results, modifier, luckyBreaks);
  } catch (error) {
    console.warn('the dice surface could not throw', error instanceof Error ? error.message : error);
    return rollInstantly(request) ?? summarizeRoll([], modifier);
  }
}
