/**
 * The shape of the Kids on Bikes content pack.
 *
 * `generated.ts` is written by `scripts/import-kids-on-bikes.mjs` and typed against this file, so
 * a parser that stops finding a field fails the build rather than shipping an empty screen.
 */

export type KobAge = 'child' | 'teen' | 'adult';

/** The six stats, by their lowercase ids. */
export type KobStatId = 'brains' | 'brawn' | 'fight' | 'flight' | 'charm' | 'grit';

export type KobDie = 'd20' | 'd12' | 'd10' | 'd8' | 'd6' | 'd4';

export interface KobStat {
  id: string;
  name: string;
}

export interface KobStrength {
  id: string;
  name: string;
  description: string;
  /** Ages that receive this Strength for free, read from the Strength's own parenthetical. */
  freeFor: string[];
  /** Ages that may take it at all, or null when anyone may. */
  restrictedTo: string[] | null;
  /** The parenthetical itself, so the builder can show the rule rather than paraphrase it. */
  note: string | null;
}

export interface KobFlaw {
  id: string;
  name: string;
  description: string;
}

export interface KobBikeOption {
  id: string;
  name: string;
  /** The colour's adjective, or the upgrade's two-word phrase. */
  adjective: string;
  benefit: string;
}

export interface KobBikes {
  colors: KobBikeOption[];
  upgrades: KobBikeOption[];
}

export interface KobBondedAction {
  id: string;
  name: string;
  description: string;
}

/** An Obsidian callout, with the `+`/`-` the note wrote after its marker. */
export interface KobCallout {
  kind: string;
  defaultOpen: boolean;
  paragraphs: string[];
}

export interface KobBondedActions {
  /** What a Bonded Action is, from Character Creation's own section. */
  intro: string[];
  callouts: KobCallout[];
  actions: KobBondedAction[];
}

/** One field the Finishing Touches section asks for, in the book's own words. */
export interface KobFinishingTouch {
  id: string;
  name: string;
  paragraphs: string[];
  callouts: KobCallout[];
}

export interface KobRelationshipQuestion {
  /** The d20 result that selects this question. */
  roll: number;
  question: string;
}

export interface KobRelationshipQuestions {
  positive: KobRelationshipQuestion[];
  negative: KobRelationshipQuestion[];
  stranger: KobRelationshipQuestion[];
}

export interface KobSuggestedBike {
  age: string;
  color: string;
  upgrade: string;
}

export interface KobTrope {
  id: string;
  name: string;
  /** Ages this trope can be played at. */
  ages: string[];
  /** Stat id → die. The trope's whole mechanical contribution. */
  statDice: Record<string, string>;
  suggestedStrengths: string[];
  suggestedFlaws: string[];
  /** The two trope-specific questions printed in the table's bottom-right corner. */
  questions: string[];
  suggestedBikes: KobSuggestedBike[];
}

export interface KobStatBonus {
  stat: string;
  amount: number;
}

export interface KobAgeRules {
  id: string;
  name: string;
  /** +1 to two named stats, read from the age's own paragraph. */
  statBonuses: KobStatBonus[];
  /** Strength id granted for free, or null. */
  freeStrength: string | null;
  /** Strength id this age may not take, or null. */
  forbiddenStrength: string | null;
  /** The paragraph itself, so the builder can show the rule rather than paraphrase it. */
  text: string;
}

/** One `#` heading of `Playing The Game.md`, with the blockquoted rule text under it. */
export interface KobRuleSection {
  id: string;
  name: string;
  paragraphs: string[];
}

/** One row of the difficulty table, with the bounds its wording states. */
export interface KobDifficultyBand {
  /** As printed: "20 or greater", "13 to 16", "1 or 2". */
  range: string;
  minimum: number;
  /** Null for the open-ended top band. */
  maximum: number | null;
  explanation: string;
}

export interface KobPlayRules {
  sections: KobRuleSection[];
  difficulties: KobDifficultyBand[];
}

/** One of the Pre-Game Form's four lists (Appendix A), with the question the book prints under it. */
export interface KobPreGameList {
  id: string;
  name: string;
  prompt: string;
}

/**
 * Appendix A and Appendix B, which the form asks for together: the four lists, and the picklist
 * of themes the first of them says to reference.
 */
export interface KobPreGameForm {
  title: string;
  intro: string;
  lists: KobPreGameList[];
  contentWarnings: string[];
  /** The book's own heading over the blank rules a table adds its own warnings on. */
  additionalPrompt: string;
}

export interface KobAspectEntry {
  roll: number;
  text: string;
}

/**
 * One numbered table under a prompt. Most have a single unlabelled list; the Powers table has two,
 * headed "Heads" and "Tails", because it is rolled with a coin as well as a die.
 */
export interface KobAspectVariant {
  label: string;
  entries: KobAspectEntry[];
}

export interface KobAspectGroup {
  id: string;
  prompt: string;
  variants: KobAspectVariant[];
}

/** A "Fill in the Blanks" heading and the tables printed under it. */
export interface KobAspectSection {
  id: string;
  name: string;
  /** The die the heading names, e.g. "d12". */
  die: string;
  groups: KobAspectGroup[];
}

/** Appendix K: what the players fill in about a Powered Character. */
export interface KobPoweredCharacterAspects {
  title: string;
  sections: KobAspectSection[];
}

/**
 * Chapter 5, the Powered Character: the co-controlled character the GM introduces.
 *
 * `powerTokens` and `aspectsPerPlayer` are the two counts the chapter states in a sentence, read
 * from its own text rather than written into the app. Null means the sentence was not found, and
 * `meta.warnings` says so.
 */
export interface KobPoweredCharacterRules {
  title: string;
  sections: KobRuleSection[];
  powerTokens: number | null;
  aspectsPerPlayer: number | null;
}

export interface KobContentMeta {
  systemId: string;
  label: string;
  source: string;
  importedAt: string;
  /** What the import could not resolve. Surfaced in the UI rather than silently dropped. */
  warnings: string[];
}

export interface KidsOnBikesContent {
  meta: KobContentMeta;
  stats: KobStat[];
  diceOrder: string[];
  ages: KobAgeRules[];
  finishingTouches: KobFinishingTouch[];
  tropes: KobTrope[];
  strengths: KobStrength[];
  flaws: KobFlaw[];
  bikes: KobBikes;
  bondedActions: KobBondedActions;
  relationshipQuestions: KobRelationshipQuestions;
  playRules: KobPlayRules;
  preGameForm: KobPreGameForm;
  poweredCharacterAspects: KobPoweredCharacterAspects;
  poweredCharacter: KobPoweredCharacterRules;
}
