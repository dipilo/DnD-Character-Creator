/**
 * The registry of tabletop systems the app can build characters for.
 *
 * One record per system: its identity, where its builder lives, and the palette the UI wears while
 * you are working in it. Adding a system is adding an entry here plus its content module — no
 * component branches on a system id, and nothing about a system is spelled out in a page.
 */

export type GameSystemId = 'dnd-5e' | 'kids-on-bikes';

/**
 * Accent tokens layered over the shared neutral palette in `index.css`.
 *
 * Values are bare HSL triplets (`H S% L%`) because that is the format shadcn's tokens use —
 * `hsl(var(--primary))` is how every component reads them, so a hex value here renders nothing.
 * Only the tokens a system actually recolours are listed; anything omitted keeps the base value.
 */
export type ThemeTokens = Partial<
  Record<
    | 'primary'
    | 'primary-foreground'
    | 'secondary'
    | 'secondary-foreground'
    | 'accent'
    | 'accent-foreground'
    | 'ring'
    | 'brand'
    | 'brand-foreground'
    | 'brand-muted',
    string
  >
>;

export interface GameSystemTheme {
  /** Shown in the theme picker. */
  label: string;
  dark: ThemeTokens;
  light: ThemeTokens;
}

export interface GameSystemDefinition {
  id: GameSystemId;
  /** Full title, used in headings and the system picker. */
  name: string;
  /** Fits in a header next to the logo on a phone. */
  shortName: string;
  tagline: string;
  /** Route the builder for this system lives under. */
  builderPath: string;
  /** Route the character list for this system lives at. */
  charactersPath: string;
  /**
   * Every route prefix that belongs to this system. The theme follows these, so a sheet and a
   * character list count, not just the builder.
   */
  routePrefixes: string[];
  /** False while a system is still being built out — it stays visible but is not selectable. */
  available: boolean;
  theme: GameSystemTheme;
}

export const GAME_SYSTEMS: Record<GameSystemId, GameSystemDefinition> = {
  'dnd-5e': {
    id: 'dnd-5e',
    name: 'Dungeons & Dragons 5th Edition',
    shortName: 'D&D 5e',
    tagline: 'Species, class, background — the full 2014 and 2024 rule sets.',
    builderPath: '/builder',
    charactersPath: '/characters',
    routePrefixes: ['/builder', '/characters', '/character/'],
    available: true,
    theme: {
      label: 'Dungeons & Dragons',
      // The book red, dropped in luminance for a dark surface so large fills stay readable.
      dark: {
        primary: '0 72% 48%',
        'primary-foreground': '0 0% 100%',
        accent: '0 30% 18%',
        'accent-foreground': '0 0% 98%',
        ring: '0 72% 52%',
        brand: '0 72% 48%',
        'brand-foreground': '0 0% 100%',
        'brand-muted': '14 45% 22%',
      },
      light: {
        primary: '0 74% 42%',
        'primary-foreground': '0 0% 100%',
        accent: '12 40% 94%',
        'accent-foreground': '0 60% 22%',
        ring: '0 74% 42%',
        brand: '0 74% 42%',
        'brand-foreground': '0 0% 100%',
        'brand-muted': '18 50% 90%',
      },
    },
  },
  'kids-on-bikes': {
    id: 'kids-on-bikes',
    name: 'Kids on Bikes',
    shortName: 'Kids on Bikes',
    tagline: 'Small towns, strange happenings, and a bike to get away on.',
    builderPath: '/kob/builder',
    charactersPath: '/kob',
    routePrefixes: ['/kob'],
    available: true,
    theme: {
      // Eighties VHS: magenta against cyan over a violet-tinted night.
      label: 'Kids on Bikes',
      dark: {
        primary: '315 85% 58%',
        'primary-foreground': '300 100% 8%',
        secondary: '265 40% 22%',
        'secondary-foreground': '280 40% 96%',
        accent: '265 45% 24%',
        'accent-foreground': '280 40% 96%',
        ring: '315 85% 62%',
        brand: '315 85% 58%',
        'brand-foreground': '300 100% 8%',
        'brand-muted': '188 80% 42%',
      },
      light: {
        primary: '315 72% 44%',
        'primary-foreground': '0 0% 100%',
        secondary: '265 40% 94%',
        'secondary-foreground': '265 45% 24%',
        accent: '188 60% 92%',
        'accent-foreground': '198 70% 22%',
        ring: '315 72% 44%',
        brand: '315 72% 44%',
        'brand-foreground': '0 0% 100%',
        'brand-muted': '188 70% 38%',
      },
    },
  },
};

export const GAME_SYSTEM_LIST: GameSystemDefinition[] = Object.values(GAME_SYSTEMS);

export const DEFAULT_GAME_SYSTEM_ID: GameSystemId = 'dnd-5e';

export function getGameSystem(id: string | null | undefined): GameSystemDefinition {
  if (id && Object.hasOwn(GAME_SYSTEMS, id)) return GAME_SYSTEMS[id as GameSystemId];
  return GAME_SYSTEMS[DEFAULT_GAME_SYSTEM_ID];
}

/** The system that owns a route, so the theme can follow where you actually are. */
export function getGameSystemForPath(pathname: string): GameSystemDefinition | null {
  let best: { system: GameSystemDefinition; length: number } | null = null;
  for (const system of GAME_SYSTEM_LIST) {
    for (const prefix of system.routePrefixes) {
      // Longest prefix wins, so a system nested under another's route still claims its own pages.
      if (pathname.startsWith(prefix) && prefix.length > (best?.length ?? 0)) {
        best = { system, length: prefix.length };
      }
    }
  }
  return best?.system ?? null;
}
