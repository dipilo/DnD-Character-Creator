import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import DiceBox from '@3d-dice/dice-box';
import { DiceAudioController } from '@/lib/diceAudio';
import { expandDiceNotation as parseNotationDice, type DiceRollResult } from '@/lib/diceNotation';
import { AVAILABLE_DICE_THEMES, DEFAULT_DICE_COLOR, type DiceColorMode } from '@/components/dice/diceOptions';

// Distinguishes each DiceBox instance's canvas so that a torn-down instance only
// removes its own canvas, never a live sibling created during a remount race.
let diceInstanceCounter = 0;

function getResolvedTheme(theme: string) {
  return AVAILABLE_DICE_THEMES.includes(theme as (typeof AVAILABLE_DICE_THEMES)[number]) ? theme : 'default';
}

export type DiceSceneResult = DiceRollResult;

export interface DiceSceneHandle {
  clear: () => void;
  isReady: () => boolean;
  roll: (notation: string) => Promise<DiceSceneResult[]>;
  /**
   * Throw one die that is already on the surface again. dice-box identifies a die by the `rollId`
   * it hands back, so only a result object it produced can be rerolled — a die picked out of the
   * log after a reload cannot.
   */
  reroll: (die: DiceSceneResult) => Promise<DiceSceneResult[]>;
}

// Vibrant, visually distinct pool used when each die is colored independently.
export const DEFAULT_DICE_PALETTE = [
  '#2e8555',
  '#f59e0b',
  '#dc2626',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#eab308'
] as const;

// Sides we can safely expand into per-die groups. Anything else (fate dice,
// exotic notation) falls back to a single-color roll so we never mis-parse.
const EXPANDABLE_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);

// Expand "4d6" / "1d20+3" into a flat list of die sides. Returns null when the
// notation can't be expanded confidently, so the caller keeps the plain roll.
function expandDiceNotation(notation: string): number[] | null {
  const dice = parseNotationDice(notation);
  return dice?.every((sides) => EXPANDABLE_SIDES.has(sides)) ? dice : null;
}

// Fisher-Yates shuffle. A deterministic comparator keeps Sonar happy while still
// spreading colors so adjacent dice differ up to the palette length.
function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function pickPerDieColors(count: number, palette: readonly string[]): string[] {
  const pool = palette.length > 0 ? palette : DEFAULT_DICE_PALETTE;
  const shuffled = shuffle(pool);
  return Array.from({ length: count }, (_, index) => shuffled[index % shuffled.length]);
}

// HSL keeps the random hue at a fixed, vivid saturation/lightness so dice never
// land on a muddy or unreadable color, unlike sampling raw RGB.
function randomVividColor(): string {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 65 + Math.random() * 25;
  const lightness = 45 + Math.random() * 15;
  return hslToHex(hue, saturation, lightness);
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const huePrime = hue / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const lightnessMatch = l - chroma / 2;

  let [red, green, blue] = [0, 0, 0];
  if (huePrime < 1) [red, green, blue] = [chroma, secondary, 0];
  else if (huePrime < 2) [red, green, blue] = [secondary, chroma, 0];
  else if (huePrime < 3) [red, green, blue] = [0, chroma, secondary];
  else if (huePrime < 4) [red, green, blue] = [0, secondary, chroma];
  else if (huePrime < 5) [red, green, blue] = [secondary, 0, chroma];
  else [red, green, blue] = [chroma, 0, secondary];

  const toChannel = (value: number) =>
    Math.round((value + lightnessMatch) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toChannel(red)}${toChannel(green)}${toChannel(blue)}`;
}

function pickAnyRandomColors(count: number): string[] {
  return Array.from({ length: count }, randomVividColor);
}

interface DiceSceneProps {
  className?: string;
  colorMode?: DiceColorMode;
  colorPalette?: readonly string[];
  scale?: number;
  soundEnabled?: boolean;
  spinForce?: number;
  theme?: string;
  themeColor?: string;
  throwForce?: number;
  onError?: (message: string | null) => void;
  onReadyChange?: (ready: boolean) => void;
}

// BASE_URL is absolute in both dev and prod now that the Vite base is '/', so these runtime-fetched
// dice-box files resolve the same on /builder as on /. It must stay absolute: a relative base makes
// this follow the client route and 404.
const getAssetPath = () => `${import.meta.env.BASE_URL}assets/`;

export const DiceScene = forwardRef<DiceSceneHandle, DiceSceneProps>(function DiceScene({
  className,
  colorMode = 'random',
  colorPalette = DEFAULT_DICE_PALETTE,
  scale = 6,
  soundEnabled = true,
  spinForce = 6,
  theme = 'default',
  themeColor = DEFAULT_DICE_COLOR,
  throwForce = 6,
  onError,
  onReadyChange
}, ref) {
  const containerId = useId().replaceAll(':', '-');
  const diceBoxRef = useRef<DiceBox | null>(null);
  const audioControllerRef = useRef(new DiceAudioController());
  const [ready, setReady] = useState(false);
  const resolvedTheme = getResolvedTheme(theme);

  // Latest tuning values, read at init time so that changing size/color/force
  // updates the live scene via updateConfig instead of tearing it down. Kept in
  // sync via an effect that runs before the init effect below.
  const tuningRef = useRef({ scale, spinForce, themeColor, throwForce });
  useEffect(() => {
    tuningRef.current = { scale, spinForce, themeColor, throwForce };
  }, [scale, spinForce, themeColor, throwForce]);

  // Color-mode config is read at roll time (an event), so a ref keeps the
  // imperative handle stable while always seeing the latest values.
  const colorRef = useRef({ colorMode, colorPalette });
  useEffect(() => {
    colorRef.current = { colorMode, colorPalette };
  }, [colorMode, colorPalette]);

  useEffect(() => {
    audioControllerRef.current.setEnabled(soundEnabled);
  }, [soundEnabled]);

  const clearScene = () => {
    try {
      diceBoxRef.current?.clear();
    } catch {
      // DiceBox can be mid-disposal during React cleanup in development.
    }
  };

  useImperativeHandle(ref, () => ({
    clear: clearScene,
    isReady: () => ready,
    reroll: async (die: DiceSceneResult) => {
      if (!ready || !diceBoxRef.current) {
        throw new Error('Dice scene is still initializing.');
      }
      await audioControllerRef.current.playRollStart(`1d${die.sides ?? 20}`);
      return diceBoxRef.current.reroll(die, { remove: true }) as Promise<DiceSceneResult[]>;
    },
    roll: async (notation: string) => {
      if (!ready || !diceBoxRef.current) {
        throw new Error('Dice scene is still initializing.');
      }

      await audioControllerRef.current.playRollStart(notation);

      const { colorMode: mode, colorPalette: palette } = colorRef.current;
      const dice = mode === 'random' || mode === 'random-any' ? expandDiceNotation(notation) : null;
      if (dice) {
        // One qty:1 group per die, each with its own color, so dice-box tints
        // them independently within a single roll.
        const colors = mode === 'random-any' ? pickAnyRandomColors(dice.length) : pickPerDieColors(dice.length, palette);
        const groups = dice.map((sides, index) => ({ sides, qty: 1, themeColor: colors[index] }));
        return diceBoxRef.current.roll(groups) as Promise<DiceSceneResult[]>;
      }

      return diceBoxRef.current.roll(notation) as Promise<DiceSceneResult[]>;
    }
  }), [ready]);

  useEffect(() => {
    let cancelled = false;
    let localDiceBox: DiceBox | null = null;
    const canvasId = `${containerId}-canvas-${(diceInstanceCounter += 1)}`;

    // dice-box has no dispose API, so we manually remove the canvas it appends
    // to the container. Without this, React's mount/cleanup/mount cycle (Strict
    // Mode, or navigating away and back) stacks multiple canvases and physics
    // worlds in the same container, and no dice ever render. Each instance owns a
    // uniquely-identified canvas so teardown never removes a live sibling created
    // by a concurrent remount.
    const teardown = () => {
      try {
        localDiceBox?.clear();
      } catch {
        // DiceBox can be mid-disposal during React cleanup in development.
      }
      document.getElementById(canvasId)?.remove();
    };

    const initialize = async () => {
      try {
        setReady(false);

        const diceBox = new DiceBox({
          container: `#${containerId}`,
          id: canvasId,
          assetPath: getAssetPath(),
          theme: resolvedTheme,
          themeColor: tuningRef.current.themeColor,
          gravityScale: 1,
          scale: tuningRef.current.scale,
          throwForce: tuningRef.current.throwForce,
          spinForce: tuningRef.current.spinForce
        }) as DiceBox & {
          onDieComplete?: (result: DiceSceneResult) => void;
          onRollComplete?: (results: DiceSceneResult[]) => void;
        };

        diceBox.onDieComplete = (result) => {
          audioControllerRef.current.playImpact(result.sides);
        };
        diceBox.onRollComplete = (results) => {
          audioControllerRef.current.playRollComplete(results.length);
        };

        localDiceBox = diceBox;
        await diceBox.init();

        if (cancelled) {
          // Effect was torn down while init was in flight; discard this instance.
          teardown();
          return;
        }

        diceBoxRef.current = diceBox;
        setReady(true);
        onReadyChange?.(true);
        onError?.(null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : 'The dice roller failed to initialize.';
        onError?.(message);
      }
    };

    void initialize();

    return () => {
      cancelled = true;
      onReadyChange?.(false);
      diceBoxRef.current = null;
      teardown();
    };
  }, [containerId, onError, onReadyChange, resolvedTheme]);

  // Apply size/color/force changes to the live scene without a full reinit.
  // dice-box picks these up on the next roll.
  useEffect(() => {
    if (!ready || !diceBoxRef.current) {
      return;
    }

    try {
      diceBoxRef.current.updateConfig({ scale, spinForce, themeColor, throwForce });
    } catch {
      // updateConfig can race with disposal during React cleanup in development.
    }
  }, [ready, scale, spinForce, themeColor, throwForce]);

  return <div id={containerId} className={className} />;
});