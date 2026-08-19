/**
 * Dice options that are not the physics surface.
 *
 * These live apart from `DiceScene` because `DiceScene` statically imports `@3d-dice/dice-box`
 * (2,667 KB): anything reading a preference would otherwise drag the engine into its chunk, and the
 * dice tray is mounted by `Layout` on every route. See CLAUDE.md, "Boot Cost and the Bundle Graph".
 */

export const AVAILABLE_DICE_THEMES = ['default'] as const;

export type DiceTheme = (typeof AVAILABLE_DICE_THEMES)[number];

// dice-box's built-in default color; the "color" material of the default theme is tinted with it.
export const DEFAULT_DICE_COLOR = '#2e8555';

export type DiceColorMode = 'single' | 'random' | 'random-any';
