/** Apart from `DiceScene`, or reading a preference drags the physics engine into the chunk. */

export const AVAILABLE_DICE_THEMES = ['default'] as const;

export type DiceTheme = (typeof AVAILABLE_DICE_THEMES)[number];

// dice-box's built-in default color; the "color" material of the default theme is tinted with it.
export const DEFAULT_DICE_COLOR = '#2e8555';

export type DiceColorMode = 'single' | 'random' | 'random-any';
