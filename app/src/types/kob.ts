import type { KobAge, KobDie, KobStatId } from '@/data/gameSystems/kidsOnBikes/types';

/** An editable document, not a receipt: every choice is stored, derivable or not. */
export interface KobCharacter {
  id: string;
  /** Discriminates the document once several systems share one store or one server row. */
  systemId: 'kids-on-bikes';
  schemaVersion: 1;

  firstName: string;
  lastName: string;
  pronouns: string;
  description: string;

  tropeId: string | null;
  age: KobAge | null;
  /** Kept because it changes what the builder shows on reopening. */
  fromScratch: boolean;
  /** Stat id → die. Written from the trope, or by hand in from-scratch mode. */
  statDice: Record<KobStatId, KobDie>;

  /** The two chosen Strengths. The age's free Strength is derived, never stored here. */
  strengthIds: string[];
  /** Fills the blank in "Skilled at ___". */
  skilledAt: string;
  flawId: string | null;
  /** A Flaw agreed with the GM that is not on the list. Wins over `flawId` when set. */
  customFlaw: string;

  motivation: string;
  fear: string;
  obligations: string;
  /** One at creation, three at most, per the rules. */
  knacks: string[];
  /** Migrated into `backpackCanvas` once, and still read for a character with no canvas. */
  backpack: string;
  /** "What items are you never without?", as a board of notes, links and pictures. */
  backpackCanvas?: KobBackpackCanvas;
  /** Answers to the trope's two questions, in the order the trope lists them. */
  tropeAnswers: string[];

  bike: KobBike;
  relationships: KobRelationship[];
  bondedActions: KobBondedActionEntry[];
  /** Meant to be revisited as comfort shifts, so it is not a creation-time answer. */
  consent: KobConsentSheet;

  /** Each player starts the game with 3. */
  adversityTokens: number;
  notes: string;

  createdAt: string;
  updatedAt: string;
}

/** A collage, not a paragraph; the size caps keep a dropped photo savable. */
export interface KobBackpackCanvas {
  nodes: KobBackpackNode[];
  /** Written since the board gained edges; a canvas saved before that has none. */
  edges?: KobBackpackEdge[];
}

export type KobBackpackNodeKind = 'note' | 'link' | 'media' | 'group';

/** Which border an edge leaves or enters by. */
export type KobBackpackSide = 'top' | 'right' | 'bottom' | 'left';

/** An arrow from one card to another, with the caption the player wrote on it. */
export interface KobBackpackEdge {
  id: string;
  from: string;
  to: string;
  fromSide: KobBackpackSide;
  toSide: KobBackpackSide;
  label: string;
  color: string | null;
}

export interface KobBackpackNode {
  id: string;
  kind: KobBackpackNodeKind;
  /** Board coordinates, in CSS pixels at 100% zoom. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** A note's body, a link's caption, a picture's caption, or a group's title. */
  text: string;
  /** An http(s) URL, or a `data:` URL for a small dropped file. Empty on a note. */
  src: string;
  /** A palette key from `lib/groupColors.ts`, or null for the default card. */
  color: string | null;
}

export interface KobConsentSheet {
  crush: boolean;
  date: boolean;
  partner: boolean;
  onScreenIntimacy: boolean;
  offScreenIntimacy: boolean;
  relationshipNotes: string;
  characterNotes: string;
}

export interface KobBike {
  /** Bike colour option id, or '' for none chosen. */
  colorId: string;
  upgradeId: string;
  name: string;
  origin: string;
  favoriteMemory: string;
}

export interface KobRelationship {
  id: string;
  /** The other character, by name — they may not exist in this app at all. */
  who: string;
  /** A pointer, not the name, so `who` keeps working if the other character is renamed. */
  withCharacterId?: string | null;
  /** How the two know each other, in the player's words. */
  connection: string;
  /** Which question list the answer came from. */
  kind: 'positive' | 'negative' | 'stranger';
  question: string;
  answer: string;
}

export interface KobBondedActionEntry {
  id: string;
  /** Bonded action id from the appendix, or '' when the pair invented one. */
  actionId: string;
  /** The invented action's name, when `actionId` is empty. */
  customName: string;
  /** The other character's display name — what survives when they leave the table. */
  withCharacter: string;
  /** The party-mate this is bonded with, when it is one. A pointer, never the name. */
  withCharacterId: string | null;
  /** The three shared experiences the rules ask the pair to describe. */
  backstory: string;
}
