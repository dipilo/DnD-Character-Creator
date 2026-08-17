/**
 * The registry of tabletop systems the app can build characters for.
 *
 * One record per system: its identity, where its builder lives, and the palette the UI wears while
 * you are working in it. Adding a system is adding an entry here plus its content module — no
 * component branches on a system id, and nothing about a system is spelled out in a page.
 */

import { Bike, Download, FlaskConical, Sword, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

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

/**
 * A destination in the main nav that belongs to one system.
 *
 * These live here rather than in `Layout` because a system's routes are the registry's to state:
 * switching the active game swaps the whole set, and a nav list written out in a component would
 * be the second place a system is described.
 */
export interface GameSystemNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Prefix the route must start with to read as active; exact match when `exact` is set. */
  match: string;
  exact?: boolean;
  /** One line for the home page's cards. The nav shows the label alone. */
  description?: string;
}

export interface GameSystemDefinition {
  id: GameSystemId;
  /** Full title, used in headings and the system picker. */
  name: string;
  /** Fits in a header next to the logo on a phone. */
  shortName: string;
  tagline: string;
  /** Icon for the system picker. */
  icon: LucideIcon;
  /** Route the builder for this system lives under. */
  builderPath: string;
  /** Route the character list for this system lives at. */
  charactersPath: string;
  /**
   * Where one saved character's sheet lives. A function because the two systems nest it
   * differently, and because the party view has to link to either without knowing which.
   */
  sheetPath: (characterId: string) => string;
  /** Where the picker lands when this system is chosen. */
  homePath: string;
  /**
   * Every route prefix that belongs to this system. The theme follows these, so a sheet and a
   * character list count, not just the builder.
   */
  routePrefixes: string[];
  /** This system's own nav destinations, shown while it is the active game. */
  navItems: GameSystemNavItem[];
  /** False while a system is still being built out — it stays visible but is not selectable. */
  available: boolean;
  theme: GameSystemTheme;
}

export const GAME_SYSTEMS: Record<GameSystemId, GameSystemDefinition> = {
  'dnd-5e': {
    id: 'dnd-5e',
    name: 'Dungeons & Dragons 5th Edition',
    shortName: 'D&D 5e',
    tagline: 'The World\'s Greatest Roleplaying Game',
    icon: Sword,
    builderPath: '/builder',
    charactersPath: '/characters',
    sheetPath: (characterId) => `/character/${characterId}`,
    homePath: '/builder',
    routePrefixes: ['/builder', '/characters', '/character/', '/content', '/homebrew'],
    navItems: [
      {
        to: '/builder',
        label: 'Builder',
        icon: Sword,
        match: '/builder',
        description: 'Select species, class, background, ability scores, spells, and equipment.',
      },
      {
        to: '/characters',
        label: 'My Characters',
        icon: Users,
        match: '/characters',
        description: 'Open, edit, or export the characters you have already saved.',
      },
      {
        to: '/content/import',
        label: 'Import',
        icon: Download,
        match: '/content',
        description: 'Load source books from local JSON into your library.',
      },
      {
        to: '/homebrew',
        label: 'Homebrew',
        icon: FlaskConical,
        match: '/homebrew',
        description: 'Make your own species, classes, spells, feats, and monsters.',
      },
    ],
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
    tagline: 'A Collaborative Storytelling RPG set in small towns with big adventure!',
    icon: Bike,
    builderPath: '/kob/builder',
    charactersPath: '/kob',
    sheetPath: (characterId) => `/kob/character/${characterId}`,
    homePath: '/kob',
    routePrefixes: ['/kob'],
    // One destination, because that is all this system has: `/kob` lists the characters and is
    // where a new one is started. Nothing here pretends to a screen that does not exist.
    navItems: [
      {
        to: '/kob',
        label: 'Characters',
        icon: Users,
        match: '/kob',
        description: 'Trope, age, Strengths and a Flaw — then the bike. Open one or start another.',
      },
    ],
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
