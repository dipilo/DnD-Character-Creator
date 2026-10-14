// One record per system; no component branches on a system id.

import { Bike, ClipboardList, Download, FlaskConical, Sword, Users, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type GameSystemId = 'dnd-5e' | 'kids-on-bikes';

/** Bare HSL triplets, as shadcn's tokens are read; an omitted token keeps the base value. */
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

/** Here, not in `Layout`: a nav list in a component would describe a system twice. */
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

/** One tab a game system adds inside a campaign. */
export interface GameSystemCampaignTab {
  /** Relative to `/campaign/:campaignId`. */
  to: string;
  label: string;
  icon: LucideIcon;
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
  /** A function: the two systems nest it differently and the party view links to either. */
  sheetPath: (characterId: string) => string;
  /** Where the picker lands when this system is chosen. */
  homePath: string;
  /** The theme follows these, so a sheet and a character list count too. */
  routePrefixes: string[];
  /** This system's own nav destinations, shown while it is the active game. */
  navItems: GameSystemNavItem[];
  /** `to` is relative to `/campaign/:campaignId`, and the campaign's `system_id` picks them. */
  campaignTabs: GameSystemCampaignTab[];
  /** False while a system is still being built out — it stays visible but is not selectable. */
  available: boolean;
  /** A capability, not an id check: a third system declares its own answer. */
  hasSelectableSources: boolean;
  /** The capability only; a rule's wording belongs in the system's imported content. */
  dice: {
    /** Quick-roll buttons, in the order they are shown. */
    presets: string[];
    /** A die that lands on its maximum is thrown again and added, or null when there is no such rule. */
    explodingRule: { name: string } | null;
  };
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
    campaignTabs: [],
    available: true,
    hasSelectableSources: true,
    dice: {
      presets: ['1d4', '1d6', '1d8', '1d10', '1d12', '1d20', '2d20', '4d6'],
      explodingRule: null,
    },
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
    campaignTabs: [
      { to: 'pre-game', label: 'Pre-Game Form', icon: ClipboardList },
      { to: 'powered', label: 'Powered Character', icon: Zap },
    ],
    available: true,
    hasSelectableSources: false,
    dice: {
      // The stat dice, biggest first, because that is the order a spread is read in.
      presets: ['1d20', '1d12', '1d10', '1d8', '1d6', '1d4'],
      explodingRule: { name: 'Lucky Break' },
    },
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
