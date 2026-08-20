import { useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DiceScene, type DiceSceneHandle, type DiceSceneResult } from '@/components/dice/DiceScene';
import { AVAILABLE_DICE_THEMES } from '@/components/dice/diceOptions';
import { DiceAppearanceControls } from '@/components/dice/DiceAppearanceControls';
import { DICE_PALETTE_COLORS } from '@/components/dice/dicePalette';
import { DiceRollLog } from '@/components/dice/DiceRollLog';
import { useDicePreferencesStore } from '@/store/dicePreferencesStore';
import { MAX_LUCKY_BREAKS, isMaximum, recordRoll, rollInstantly, summarizeRoll, useDiceTrayStore } from '@/store/diceTrayStore';
import { resolveActiveGameSystem, useGameSystemStore } from '@/store/gameSystemStore';
import { parseDiceNotation } from '@/lib/diceNotation';

const ghostButtonClass = 'border-white/20 bg-white/10 text-white hover:bg-white/20';

export function DiceRollerPage() {
  // The roller is shared, so the presets and the exploding-die rule are the active system's to
  // state — the page used to hard-code a D&D preset row on a Kids on Bikes table.
  const location = useLocation();
  const preferredSystemId = useGameSystemStore((state) => state.preferredSystemId);
  const system = resolveActiveGameSystem(location.pathname, preferredSystemId);
  const explodingRule = system.dice.explodingRule;
  const [exploding, setExploding] = useState(false);
  const [notation, setNotation] = useState('1d20');
  const soundEnabled = useDicePreferencesStore((state) => state.soundEnabled);
  const theme = useDicePreferencesStore((state) => state.theme) as (typeof AVAILABLE_DICE_THEMES)[number];
  const diceColor = useDicePreferencesStore((state) => state.diceColor);
  const randomColors = useDicePreferencesStore((state) => state.randomColors);
  const fullyRandomColors = useDicePreferencesStore((state) => state.fullyRandomColors);
  const diceScale = useDicePreferencesStore((state) => state.diceScale);
  const show3dDice = useDicePreferencesStore((state) => state.show3dDice);
  const setShow3dDice = useDicePreferencesStore((state) => state.setShow3dDice);
  const [sceneReady, setSceneReady] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The log entry whose dice are still on this page's surface. dice-box can only throw a die again
  // while it is rendering it, so nothing older than the last roll is rerollable.
  const [liveEntryId, setLiveEntryId] = useState<string | null>(null);
  const reviseLogEntry = useDiceTrayStore((state) => state.reviseLogEntry);
  const latestEntryId = useDiceTrayStore((state) => state.log[0]?.id ?? null);
  const diceSceneRef = useRef<DiceSceneHandle | null>(null);
  // Nothing has to load when the dice are not being thrown, so the roll button is live immediately.
  const ready = show3dDice ? sceneReady : true;
  let readyLabel = 'Instant rolls';
  if (show3dDice) {
    readyLabel = sceneReady ? 'Ready' : 'Loading dice…';
  }
  const rollerDescription = show3dDice
    ? 'Enter dice notation and roll across the screen.'
    : 'Enter dice notation and get the result straight away.';

  // The 3D surface resolves each settled die without the notation's modifier, so `+3` has to be
  // added back from the notation itself. Both roll paths total the same way for that reason.
  //
  // This page throws on its own surface rather than through `rollOnScreen`, so it logs the outcome
  // itself — one history covers the roller and every sheet.
  const finish = (nextResults: DiceSceneResult[], nextNotation: string, live: boolean, luckyBreaks = 0) => {
    const modifier = parseDiceNotation(nextNotation)?.modifier ?? 0;
    const id = recordRoll(
      { notation: nextNotation, label: system.shortName },
      summarizeRoll(nextResults, modifier, luckyBreaks),
    );
    setLiveEntryId(live ? id : null);
  };

  /**
   * A die on its maximum is thrown again and added, as many times as it keeps landing there. It is
   * a loop rather than something the notation can say, exactly as in the tray.
   */
  const explodeOnSurface = async (scene: DiceSceneHandle, settled: DiceSceneResult[]) => {
    const results = [...settled];
    let luckyBreaks = 0;
    while (isMaximum(results.at(-1)) && luckyBreaks < MAX_LUCKY_BREAKS) {
      results.push(...(await scene.roll(`1d${results.at(-1)?.sides ?? 0}`)));
      luckyBreaks += 1;
    }
    return { results, luckyBreaks };
  };

  const handleRoll = async (nextNotation = notation) => {
    if (!ready || rolling) {
      return;
    }

    setNotation(nextNotation);
    // The rule is written for one die; on a handful there is no "the die" to throw again.
    const explodesNow = Boolean(explodingRule) && exploding && (parseDiceNotation(nextNotation)?.groups.length === 1);

    if (!show3dDice) {
      const outcome = rollInstantly({
        notation: nextNotation,
        label: system.shortName,
        explodeOnMax: explodesNow,
      });
      if (!outcome) {
        setError(`"${nextNotation}" is not dice notation this roller understands.`);
        return;
      }
      setError(null);
      finish(outcome.results, nextNotation, false, outcome.luckyBreaks);
      return;
    }

    if (!diceSceneRef.current) {
      return;
    }

    try {
      setRolling(true);
      const settled = await diceSceneRef.current.roll(nextNotation);
      const thrown = explodesNow
        ? await explodeOnSurface(diceSceneRef.current, settled)
        : { results: settled, luckyBreaks: 0 };
      finish(thrown.results, nextNotation, true, thrown.luckyBreaks);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The dice roll could not be completed.');
    } finally {
      setRolling(false);
    }
  };

  const handleClear = () => {
    diceSceneRef.current?.clear();
    setLiveEntryId(null);
  };

  /**
   * Throw one settled die again, in place. dice-box has no picking or dragging of its own, so this
   * is as close as its API gets to handling a die: `reroll` names one by the `rollId` it handed
   * back, removes that mesh and drops a replacement onto the same surface.
   */
  const handleRerollDie = async (index: number) => {
    const scene = diceSceneRef.current;
    const entry = useDiceTrayStore.getState().log.find((item) => item.id === liveEntryId);
    const die = entry?.results[index];
    if (!scene || !entry || !die?.rollId) return;

    try {
      setRolling(true);
      const replacement = (await scene.reroll(die))[0];
      if (!replacement) return;
      const results = entry.results.map((result, i) => (i === index ? replacement : result));
      reviseLogEntry(entry.id, summarizeRoll(results, entry.modifier, entry.luckyBreaks));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'That die could not be thrown again.');
    } finally {
      setRolling(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100dvh-7rem)] overflow-hidden bg-[#09070a] text-slate-50">
      {show3dDice ? (
        <DiceScene
          ref={diceSceneRef}
          soundEnabled={soundEnabled}
          theme={theme}
          themeColor={diceColor}
          colorMode={randomColors ? (fullyRandomColors ? 'random-any' : 'random') : 'single'}
          colorPalette={DICE_PALETTE_COLORS}
          scale={diceScale}
          throwForce={7}
          spinForce={7}
          onError={setError}
          onReadyChange={setSceneReady}
          className="absolute inset-0 h-full w-full bg-[radial-gradient(circle_at_20%_14%,_rgba(245,158,11,0.2),_transparent_26%),radial-gradient(circle_at_78%_0%,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_rgba(31,18,12,0.96),_rgba(8,6,7,1))]"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_14%,_rgba(245,158,11,0.2),_transparent_26%),radial-gradient(circle_at_78%_0%,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_rgba(31,18,12,0.96),_rgba(8,6,7,1))]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(8,6,7,0.08)_0%,_rgba(8,6,7,0.28)_32%,_rgba(8,6,7,0.56)_100%)]" />

      <div className="relative z-10 flex min-h-[calc(100dvh-7rem)] flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">{readyLabel}</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dice Roller</h1>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">{rollerDescription}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {system.dice.presets.map((preset) => (
              <Button
                key={preset}
                type="button"
                variant="outline"
                size="sm"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => void handleRoll(preset)}
                disabled={!ready || rolling}
              >
                {preset}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {error ? (
            <Alert className="border-red-400/30 bg-red-950/75 text-red-50" variant="destructive">
              <AlertTitle>Dice Roller Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,20rem)] xl:justify-end">
            <Card className="border-white/12 bg-slate-950/50 text-slate-50 shadow-lg backdrop-blur-[2px]">
              <CardHeader>
                <CardTitle>Roll</CardTitle>
                <CardDescription className="text-slate-300">Enter notation such as 1d20, 2d6+3, or 4d6.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input value={notation} onChange={(event) => setNotation(event.target.value)} placeholder="1d20" className="border-white/10 bg-slate-950/80 text-slate-50 placeholder:text-slate-500" />
                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">3D Dice</p>
                    <p className="text-xs text-slate-300">Off resolves the roll instantly.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={show3dDice ? 'default' : 'outline'}
                    className={show3dDice ? '' : ghostButtonClass}
                    onClick={() => setShow3dDice(!show3dDice)}
                    aria-pressed={show3dDice}
                  >
                    {show3dDice ? 'On' : 'Off'}
                  </Button>
                </div>

                {explodingRule ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{explodingRule.name}</p>
                      <p className="text-xs text-slate-300">A single die on its maximum is thrown again and added.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={exploding ? 'default' : 'outline'}
                      className={exploding ? '' : ghostButtonClass}
                      onClick={() => setExploding(!exploding)}
                      aria-pressed={exploding}
                    >
                      {exploding ? 'On' : 'Off'}
                    </Button>
                  </div>
                ) : null}

                {show3dDice ? <DiceAppearanceControls /> : null}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className={ghostButtonClass} onClick={handleClear} disabled={!ready}>
                    Clear
                  </Button>
                </div>
                <Button type="button" className="w-full bg-amber-300 text-slate-950 hover:bg-amber-200" onClick={() => void handleRoll()} disabled={!ready || rolling || !notation.trim()}>
                  {rolling ? 'Rolling...' : 'Roll Dice'}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/12 bg-slate-950/46 text-slate-50 shadow-lg backdrop-blur-[2px]">
              <CardHeader>
                <CardTitle>Results</CardTitle>
                <CardDescription className="text-slate-300">Every roll this session, here and on your sheets.</CardDescription>
              </CardHeader>
              <CardContent>
                <DiceRollLog
                  dark
                  onRerollDie={liveEntryId && liveEntryId === latestEntryId ? (index) => void handleRerollDie(index) : undefined}
                  rerollDisabled={rolling}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
