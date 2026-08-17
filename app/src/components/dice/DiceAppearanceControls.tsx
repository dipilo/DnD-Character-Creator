// Everything that only means something while the physics surface is on screen: theme, colour,
// size and impact sound. Split out of `DiceRollerPage` so instant-roll mode can simply not render
// it, rather than leaving a panel of controls that change nothing.
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { AVAILABLE_DICE_THEMES } from '@/components/dice/DiceScene';
import { DICE_COLOR_SWATCHES } from '@/components/dice/dicePalette';
import { useDicePreferencesStore } from '@/store/dicePreferencesStore';

const MIN_DICE_SCALE = 4;
const MAX_DICE_SCALE = 14;

const ghostButtonClass = 'border-white/20 bg-white/10 text-white hover:bg-white/20';

function ThemePicker() {
  const theme = useDicePreferencesStore((state) => state.theme);
  const setTheme = useDicePreferencesStore((state) => state.setTheme);

  if (AVAILABLE_DICE_THEMES.length <= 1) {
    return <div className="text-xs text-slate-300">Installed dice theme: {AVAILABLE_DICE_THEMES[0]}</div>;
  }

  return (
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
  );
}

function SingleColorPicker() {
  const diceColor = useDicePreferencesStore((state) => state.diceColor);
  const setDiceColor = useDicePreferencesStore((state) => state.setDiceColor);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {DICE_COLOR_SWATCHES.map((swatch) => {
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
  );
}

function RandomColorPicker() {
  const fullyRandomColors = useDicePreferencesStore((state) => state.fullyRandomColors);
  const setFullyRandomColors = useDicePreferencesStore((state) => state.setFullyRandomColors);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={fullyRandomColors ? 'outline' : 'default'}
          className={fullyRandomColors ? ghostButtonClass : ''}
          onClick={() => setFullyRandomColors(false)}
          aria-pressed={!fullyRandomColors}
        >
          Palette
        </Button>
        <Button
          type="button"
          size="sm"
          variant={fullyRandomColors ? 'default' : 'outline'}
          className={fullyRandomColors ? '' : ghostButtonClass}
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
            {DICE_COLOR_SWATCHES.map((swatch) => (
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
  );
}

export function DiceAppearanceControls() {
  const randomColors = useDicePreferencesStore((state) => state.randomColors);
  const setRandomColors = useDicePreferencesStore((state) => state.setRandomColors);
  const diceScale = useDicePreferencesStore((state) => state.diceScale);
  const setDiceScale = useDicePreferencesStore((state) => state.setDiceScale);
  const soundEnabled = useDicePreferencesStore((state) => state.soundEnabled);
  const setSoundEnabled = useDicePreferencesStore((state) => state.setSoundEnabled);

  return (
    <>
      <ThemePicker />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-[0.18em] text-slate-400">Dice Color</Label>
          <Button
            type="button"
            size="sm"
            variant={randomColors ? 'default' : 'outline'}
            className={randomColors ? '' : ghostButtonClass}
            onClick={() => setRandomColors(!randomColors)}
            aria-pressed={randomColors}
          >
            {randomColors ? 'Random: On' : 'Random: Off'}
          </Button>
        </div>
        {randomColors ? <RandomColorPicker /> : <SingleColorPicker />}
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

      <Button type="button" variant="outline" size="sm" className={ghostButtonClass} onClick={() => setSoundEnabled(!soundEnabled)}>
        {soundEnabled ? 'Sound On' : 'Sound Off'}
      </Button>
    </>
  );
}
