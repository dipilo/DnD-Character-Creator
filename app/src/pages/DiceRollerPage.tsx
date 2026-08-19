import { startTransition, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DiceScene, type DiceSceneHandle, type DiceSceneResult } from '@/components/dice/DiceScene';
import { AVAILABLE_DICE_THEMES } from '@/components/dice/diceOptions';
import { DiceAppearanceControls } from '@/components/dice/DiceAppearanceControls';
import { DICE_PALETTE_COLORS } from '@/components/dice/dicePalette';
import { useDicePreferencesStore } from '@/store/dicePreferencesStore';
import { parseDiceNotation, rollDiceNotation, totalDiceResults } from '@/lib/diceNotation';

const presetRolls = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '2d20', '4d6'];

const ghostButtonClass = 'border-white/20 bg-white/10 text-white hover:bg-white/20';

export function DiceRollerPage() {
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
  const [results, setResults] = useState<DiceSceneResult[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const diceSceneRef = useRef<DiceSceneHandle | null>(null);
  // Nothing has to load when the dice are not being thrown, so the roll button is live immediately.
  const ready = show3dDice ? sceneReady : true;
  let readyLabel = 'Instant rolls';
  if (show3dDice) {
    readyLabel = sceneReady ? 'Ready' : 'Loading dice…';
  }
  const rollerDescription = show3dDice
    ? 'Enter dice notation and roll across the screen.'
    : 'Enter dice notation and get the result straight away — no dice to wait for.';

  // The 3D surface resolves each settled die without the notation's modifier, so `+3` has to be
  // added back from the notation itself. Both roll paths total the same way for that reason.
  const finish = (nextResults: DiceSceneResult[], nextNotation: string) => {
    const modifier = parseDiceNotation(nextNotation)?.modifier ?? 0;
    startTransition(() => {
      setResults(nextResults);
      setTotal(totalDiceResults(nextResults, modifier));
    });
  };

  const handleRoll = async (nextNotation = notation) => {
    if (!ready || rolling) {
      return;
    }

    setNotation(nextNotation);

    if (!show3dDice) {
      const instantResults = rollDiceNotation(nextNotation);
      if (!instantResults) {
        setError(`"${nextNotation}" is not dice notation this roller understands.`);
        return;
      }
      setError(null);
      finish(instantResults, nextNotation);
      return;
    }

    if (!diceSceneRef.current) {
      return;
    }

    try {
      setRolling(true);
      const nextResults = await diceSceneRef.current.roll(nextNotation);
      finish(nextResults, nextNotation);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'The dice roll could not be completed.');
    } finally {
      setRolling(false);
    }
  };

  const handleClear = () => {
    diceSceneRef.current?.clear();
    setResults([]);
    setTotal(null);
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
            {presetRolls.map((preset) => (
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
                <CardDescription className="text-slate-300">Latest settled dice values from the live surface.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {results.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2">
                      {results.map((result, index) => (
                        <Badge key={`${result.sides}-${result.value}-${index}`} className="bg-white text-slate-950 hover:bg-white">
                          d{result.sides ?? '?'}: {result.value ?? '?'}
                        </Badge>
                      ))}
                    </div>
                    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Total</p>
                      <p className="text-2xl font-semibold text-white">{total ?? 0}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-300">Roll the dice to capture results here.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
