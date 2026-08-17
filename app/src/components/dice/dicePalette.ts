/** The swatches the roller offers, and the pool it draws from when every die gets its own colour. */
export const DICE_COLOR_SWATCHES = [
  { label: 'Emerald', value: '#2e8555' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Crimson', value: '#dc2626' },
  { label: 'Royal', value: '#3b82f6' },
  { label: 'Violet', value: '#8b5cf6' },
  { label: 'Rose', value: '#ec4899' },
  { label: 'Slate', value: '#475569' },
  { label: 'Bone', value: '#e7e5e4' }
];

export const DICE_PALETTE_COLORS = DICE_COLOR_SWATCHES.map((swatch) => swatch.value);
