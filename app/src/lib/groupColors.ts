/**
 * The palette a group can be tagged with. The server stores the key and interprets nothing, the
 * same posture it takes for `system_id` — so adding a colour is a client change alone.
 *
 * `swatch` is a Tailwind background for the dot beside a name; `soft` tints a card's edge without
 * competing with the theme, which is why neither is a raw hex value.
 */
export const GROUP_COLORS = [
  { key: 'slate', label: 'Slate', swatch: 'bg-slate-500', soft: 'border-l-slate-500' },
  { key: 'rose', label: 'Rose', swatch: 'bg-rose-500', soft: 'border-l-rose-500' },
  { key: 'amber', label: 'Amber', swatch: 'bg-amber-500', soft: 'border-l-amber-500' },
  { key: 'emerald', label: 'Emerald', swatch: 'bg-emerald-500', soft: 'border-l-emerald-500' },
  { key: 'sky', label: 'Sky', swatch: 'bg-sky-500', soft: 'border-l-sky-500' },
  { key: 'violet', label: 'Violet', swatch: 'bg-violet-500', soft: 'border-l-violet-500' },
] as const;

export type GroupColorKey = (typeof GROUP_COLORS)[number]['key'];

/** A group with no colour, and one carrying a key this build does not know, both read as neutral. */
export function groupColor(key: string | null | undefined) {
  return GROUP_COLORS.find((color) => color.key === key) ?? null;
}
