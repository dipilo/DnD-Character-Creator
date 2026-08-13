// Calendar appearance and view preferences (MERGE_PLAN.md Phase 4).
//
// This replaces the old ColorManager, which wrote `singleColor_v1` / `aggPalette_v1` into
// localStorage by hand and told the calendars about it by dispatching CustomEvents on `window`.
// A zustand store is the same persistence with a subscription the components already understand,
// so nothing has to listen on the global object.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PaletteEntry {
  /** `#rrggbb`. Stored as hex because that is what an `<input type="color">` round-trips. */
  color: string;
  opacity: number;
}

/**
 * Colour by how many players overlap: one free player is the palest band, four or more the
 * strongest. Anything above the last entry keeps the last colour.
 */
const DEFAULT_AGGREGATE_PALETTE: PaletteEntry[] = [
  { color: '#4682b4', opacity: 0.45 },
  { color: '#228b22', opacity: 0.45 },
  { color: '#ffa500', opacity: 0.45 },
  { color: '#dc143c', opacity: 0.45 },
];

const DEFAULT_OWN_COLOR: PaletteEntry = { color: '#4682b4', opacity: 1 };

interface SchedulePreferencesState {
  /** The colour of your own availability blocks on the editable calendar. */
  ownColor: PaletteEntry;
  aggregatePalette: PaletteEntry[];
  /** IANA zone the calendars render in, or 'local' for the browser's own. */
  viewTimeZone: string;

  setOwnColor: (entry: PaletteEntry) => void;
  setAggregateEntry: (index: number, entry: PaletteEntry) => void;
  setViewTimeZone: (zone: string) => void;
  resetColors: () => void;
}

export const useSchedulePreferences = create<SchedulePreferencesState>()(
  persist(
    (set) => ({
      ownColor: DEFAULT_OWN_COLOR,
      aggregatePalette: DEFAULT_AGGREGATE_PALETTE,
      viewTimeZone: 'local',

      setOwnColor: (entry) => set({ ownColor: entry }),

      setAggregateEntry: (index, entry) =>
        set((state) => {
          const next = state.aggregatePalette.slice();
          next[index] = entry;
          return { aggregatePalette: next };
        }),

      setViewTimeZone: (viewTimeZone) => set({ viewTimeZone }),

      resetColors: () =>
        set({ ownColor: DEFAULT_OWN_COLOR, aggregatePalette: DEFAULT_AGGREGATE_PALETTE }),
    }),
    { name: 'dnd-schedule-preferences' },
  ),
);

/** `#rrggbb` + opacity to a CSS colour FullCalendar can put straight on an event. */
export function toRgba({ color, opacity }: PaletteEntry): string {
  const hex = color.replace('#', '');
  const value = Number.parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex, 16);
  if (Number.isNaN(value)) return `rgba(70,130,180,${opacity})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${opacity})`;
}

/** The band for `count` overlapping players; counts beyond the palette keep its last colour. */
export function paletteEntryForCount(palette: PaletteEntry[], count: number): PaletteEntry {
  if (palette.length === 0) return DEFAULT_OWN_COLOR;
  const index = Math.min(Math.max(0, count - 1), palette.length - 1);
  return palette[index];
}
