import type { KobAge, KobDie, KobStatId } from '@/data/gameSystems/kidsOnBikes/types';

/**
 * A Kids on Bikes character, as one document.
 *
 * Same posture as the 5e `Character`: this is an editable document, not a receipt. Every choice
 * the player made is stored — including the ones a sheet could derive, like which strengths came
 * from the trope's suggestions — so reopening the builder shows what they picked rather than a
 * reconstruction of it.
 */
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
  /**
   * True when the player assigned dice themselves ("Creating a Character from Scratch") rather
   * than taking the trope's spread. Kept because it changes what the builder shows on reopening.
   */
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
  backpack: string;
  /** Answers to the trope's two questions, in the order the trope lists them. */
  tropeAnswers: string[];

  bike: KobBike;
  relationships: KobRelationship[];
  bondedActions: KobBondedActionEntry[];
  /**
   * The Consent Sheet (rulebook p. 16–18): what the player is comfortable their character doing
   * on-page, not a creation-time answer — it is meant to be revisited as comfort shifts over play.
   */
  consent: KobConsentSheet;

  /** Each player starts the game with 3. */
  adversityTokens: number;
  notes: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * "To accommodate this, each player has a section on their Consent Sheet that allows them to
 * select the levels of romance they are interested in." Crush/Date/Partner are cumulative levels
 * of romantic involvement; the two intimacy flags are independent of them, per the printed sheet.
 */
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
  /**
   * The party-mate this relationship points at, when it is one. A pointer, not the name: the other
   * player may rename their character, and `who` keeps working for someone who is not in the app.
   * Null on a relationship typed by hand, and on every one written before this field existed.
   */
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
