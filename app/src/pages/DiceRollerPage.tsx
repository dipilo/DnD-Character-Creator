import { startTransition, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { AVAILABLE_DICE_THEMES, DiceScene, type DiceSceneHandle, type DiceSceneResult } from '@/components/dice/DiceScene';
import { useDicePreferencesStore } from '@/store/dicePreferencesStore';

const presetRolls = ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '2d20', '4d6'];

const colorSwatches = [
  { label: 'Emerald', value: '#2e8555' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Crimson', value: '#dc2626' },
  { label: 'Royal', value: '#3b82f6' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Rose', value: '#ec4899' },
  { label: 'Slate', value: '#475569' },
  { label: 'Bone', value: '#e7e5e4' }
];

const paletteColors = colorSwatches.map((swatch) => swatch.value);

const MIN_DICE_SCALE = 4;
const MAX_DICE_SCALE = 14;

export function DiceRollerPage() {
  const [notation, setNotation] = useState('1d20');
  const soundEnabled = useDicePreferencesStore((state) => state.soundEnabled);
  const setSoundEnabled = useDicePreferencesStore((state) => state.setSoundEnabled);
  const theme = useDicePreferencesStore((state) => state.theme) as (typeof AVAILABLE_DICE_THEMES)[number];
  const setTheme = useDicePreferencesStore((state) => state.setTheme);
  const diceColor = useDicePreferencesStore((state) => state.diceColor);
  const setDiceColor = useDicePreferencesStore((state) => state.setDiceColor);
  const randomColors = useDicePreferencesStore((state) => state.randomColors);
  const setRandomColors = useDicePreferencesStore((state) => state.setRandomColors);
  const fullyRandomColors = useDicePreferencesStore((state) => state.fullyRandomColors);
  const setFullyRandomColors = useDicePreferencesStore((state) => state.setFullyRandomColors);
  const diceScale = useDicePreferencesStore((state) => state.diceScale);
  const setDiceScale = useDicePreferencesStore((state) => state.setDiceScale);
  const [ready, setReady] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<DiceSceneResult[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const diceSceneRef = useRef<DiceSceneHandle | null>(null);

  const handleRoll = async (nextNotation = notation) => {
    if (!diceSceneRef.current || !ready || rolling) {
      return;
    }

    try {
      setRolling(true);
      setNotation(nextNotation);
      const nextResults = await diceSceneRef.current.roll(nextNotation);
      startTransition(() => {
        setResults(nextResults);
        setTotal(nextResults.reduce((sum, result) => sum + (result.value ?? 0) + (result.modifier ?? 0), 0));
      });
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
    <div className="relative min-h-[calc(100vh-7rem)] overflow-hidden bg-[#09070a] text-slate-50">
      <DiceScene
        ref={diceSceneRef}
        soundEnabled={soundEnabled}
        theme={theme}
        themeColor={diceColor}
        colorMode={randomColors ? (fullyRandomColors ? 'random-any' : 'random') : 'single'}
        colorPalette={paletteColors}
        scale={diceScale}
        throwForce={7}
        spinForce={7}
        onError={setError}
        onReadyChange={setReady}
        className="absolute inset-0 h-full w-full bg-[radial-gradient(circle_at_20%_14%,_rgba(245,158,11,0.2),_transparent_26%),radial-gradient(circle_at_78%_0%,_rgba(14,165,233,0.18),_transparent_28%),linear-gradient(180deg,_rgba(31,18,12,0.96),_rgba(8,6,7,1))]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(8,6,7,0.08)_0%,_rgba(8,6,7,0.28)_32%,_rgba(8,6,7,0.56)_100%)]" />

      <div className="relative z-10 flex min-h-[calc(100vh-7rem)] flex-col justify-between p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge className="border-white/15 bg-white/10 text-white hover:bg-white/10">{ready ? 'Ready' : 'Loading dice…'}</Badge>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dice Roller</h1>
              <p className="mt-2 text-sm text-slate-300 sm:text-base">
                Enter dice notation and roll across the screen.
              </p>
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
                {AVAILABLE_DICE_THEMES.length > 1 ? (
                  <div className="flex flex-wrap gap-2">
                    {AVAILABLE_DICE_THEMES.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={theme === option ? 'default' : 'outline'}
                        onClick={() => setTheme(option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-300">Installed dice theme: {AVAILABLE_DICE_THEMES[0]}</div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-[0.18em] text-slate-400">Dice Color</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant={randomColors ? 'default' : 'outline'}
                      className={randomColors ? '' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'}
                      onClick={() => setRandomColors(!randomColors)}
                      aria-pressed={randomColors}
                    >
                      {randomColors ? 'Random: On' : 'Random: Off'}
                    </Button>
                  </div>
                  {randomColors ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={fullyRandomColors ? 'outline' : 'default'}
                          className={fullyRandomColors ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : ''}
                          onClick={() => setFullyRandomColors(false)}
                          aria-pressed={!fullyRandomColors}
                        >
                          Palette
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={fullyRandomColors ? 'default' : 'outline'}
                          className={fullyRandomColors ? '' : 'border-white/20 bg-white/10 text-white hover:bg-white/20'}
                          onClick={() => setFullyRandomColors(true)}
                          aria-pressed={fullyRandomColors}
                        >
                          Any Color
                        </Button>
                      </div>
                      {fullyRandomColors ? (
                        <p className="text-xs text-slate-300">Every die gets a completely random color on each roll.</p>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {colorSwatches.map((swatch) => (
                              <span
                                key={swatch.value}
                                title={swatch.label}
                                className="size-5 rounded-full border border-white/25 shadow-sm"
                                style={{ backgroundColor: swatch.value }}
                              />
                            ))}
                          </div>
                          <p className="text-xs text-slate-300">Every die gets its own random color from this palette on each roll.</p>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {colorSwatches.map((swatch) => {
                        const selected = diceColor.toLowerCase() === swatch.value.toLowerCase();
                        return (
                          <button
                            key={swatch.value}
                            type="button"
                            title={swatch.label}
                            aria-label={swatch.label}
                            aria-pressed={selected}
                            onClick={() => setDiceColor(swatch.value)}
                            className={`size-7 rounded-full border shadow-sm transition ${selected ? 'border-white ring-2 ring-white/70' : 'border-white/25 hover:border-white/60'}`}
                            style={{ backgroundColor: swatch.value }}
                          />
                        );
                      })}
                      <label className="relative size-7 cursor-pointer overflow-hidden rounded-full border border-dashed border-white/40 hover:border-white/70" title="Custom color">
                        <span
                          className="absolute inset-0 rounded-full"
                          style={{ background: 'conic-gradient(from 0deg, #f87171, #fbbf24, #34d399, #38bdf8, #a78bfa, #f472b6, #f87171)' }}
                        />
                        <input
                          type="color"
                          value={diceColor}
                          onChange={(event) => setDiceColor(event.target.value)}
                          className="absolute inset-0 cursor-pointer opacity-0"
                          aria-label="Custom dice color"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-[0.18em] text-slate-400">Dice Size</Label>
                    <span className="text-xs tabular-nums text-slate-300">{diceScale.toFixed(1)}</span>
                  </div>
                  <Slider
                    value={[diceScale]}
                    min={MIN_DICE_SCALE}
                    max={MAX_DICE_SCALE}
                    step={0.2}
                    onValueChange={(next) => setDiceScale(next[0] ?? diceScale)}
                    aria-label="Dice size"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={() => setSoundEnabled(!soundEnabled)}>
                    {soundEnabled ? 'Sound On' : 'Sound Off'}
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="border-white/20 bg-white/10 text-white hover:bg-white/20" onClick={handleClear} disabled={!ready}>
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
