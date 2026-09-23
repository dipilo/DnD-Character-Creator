/**
 * What a feature throws, read from the feature's own sentences.
 *
 * The sheet used to take the first `NdN` in the text, which is wrong in both directions: Supreme
 * Healing's "for example, instead of restoring 2d6 Hit Points" is not a throw, and Land's Aid
 * states two. Nothing here is a per-feature table — a feature an imported pack adds is read exactly
 * as `deriveSpellAttackOrSave` reads a spell, and one that states no throw gets none.
 */
import { DAMAGE_TYPES, trailingLevel, type SpellDamageType } from '@/lib/spellFacets';
import type { AbilityScores, Feature } from '@/types/dnd';

/** What the throw is for, in the words the feature uses to say so. */
export type FeatureThrowKind =
  | 'damage'
  | 'healing'
  | 'temporary-hit-points'
  | 'reduction'
  | 'bonus'
  | 'other';

export interface FeatureThrow {
  /** Stable within the feature, so a list of buttons can key on it. */
  id: string;
  /** What a click throws, with whatever modifier the text states and the context resolves. */
  notation: string;
  /** What the button prints: the notation, plus what it is for when the feature says. */
  label: string;
  kind: FeatureThrowKind;
  damageType?: SpellDamageType;
  /** The book's own phrase, for the tray's detail line. */
  detail: string;
}

/**
 * What the character brings to a throw the feature states in words: "plus your Fighter level",
 * "+ your Dexterity modifier", "+ PB". A value this does not carry leaves the modifier unresolved
 * and the throw bare, which is what the sheet already did.
 */
export interface FeatureContext {
  /** The level a "when you reach 14th level" clause is measured against. */
  level?: number;
  /** Levels by lower-case class name, for a feature that names one ("Cleric levels 7 (2d8)"). */
  classLevels?: Readonly<Record<string, number>>;
  abilityModifiers?: Readonly<Partial<Record<keyof AbilityScores, number>>>;
  proficiencyBonus?: number;
  /** What a feature means by "your spell save DC", which only the character knows. */
  spellSaveDc?: number;
  /** The class table's dice columns, by lower-case feature name. */
  tableDice?: Readonly<Record<string, FeatureTableDice>>;
}

/**
 * A die a class table states per level, for a feature whose own text prints only its first value
 * and then points at the column: the Monk's Martial Arts die, the Rogue's Sneak Attack, the 2024
 * Bard's Bardic die. Without it a level-20 Monk still read 1d4.
 */
export interface FeatureTableDice {
  /** One entry per class level, index 0 being level 1; `null` where the table prints none. */
  perLevel: readonly (string | null)[];
  /** The level the character holds in the class whose table states it. */
  level: number;
}

const DICE_PATTERN = /\b\d*d(?:100|20|12|10|8|6|4)\b/g;
const DICE_FACE = /d(\d+)/;

/** "d10" and "1d10" are the same throw; the sheet prints the second. */
const normalizeDice = (dice: string) => (dice.startsWith('d') ? `1${dice}` : dice);

/* -------------------------------------------------------------------------- *
 * What is not a throw
 * -------------------------------------------------------------------------- */

/**
 * Every shape the books use for dice that are not rolled here: a Cunning Strike's die cost, a cap,
 * the dice a Sneak Attack gives up, another feature's die, a count of rests, and a per-slot step.
 * Each is read forwards, so nothing has to match against the end of arbitrary prose (Sonar S8786).
 */
const NOT_A_THROW = [
  /\bCost:\s*(\d*d\d+)/gi,
  /\bmaximum of\s+(\d*d\d+)/gi,
  /\bremove\s+(\d*d\d+)/gi,
  /\badditional\s+(?:an?\s+)?(\d*d\d+)/gi,
  /\b(?:instead of|rather than)\s+(?:an?\s+)?(\d*d\d+)/gi,
  /\bdie of your\s[^.]{0,40}?\bis\s+(?:an?\s+)?(\d*d\d+)/gi,
  /(\d*d\d+)\s+(?:long|short)\s+rests?\b/gi,
  /(\d*d\d+)\s+of\s+(?:the|your)\b/gi,
  /(\d*d\d+)\s+for\s+each\b/gi
];

/** A d20 is the test the character is already rolling, never a throw a feature hands them. */
const isTestDie = (dice: string) => dice.endsWith('d20');

function collectRejected(text: string): Set<number> {
  const rejected = new Set<number>();
  for (const pattern of NOT_A_THROW) {
    for (const match of text.matchAll(pattern)) {
      rejected.add((match.index ?? 0) + match[0].lastIndexOf(match[1]));
    }
  }
  return rejected;
}

const SENTENCE_BREAKS = ['. ', '• ', '? ', '! '];

/** Where the sentence holding `index` starts, so a worked example can be read as one clause. */
function sentenceStart(text: string, index: number): number {
  let start = 0;
  for (const marker of SENTENCE_BREAKS) {
    const at = text.lastIndexOf(marker, index);
    if (at >= 0) start = Math.max(start, at + marker.length);
  }
  return start;
}

const EXAMPLE_PATTERN = /\bfor example\b/i;

/* -------------------------------------------------------------------------- *
 * What is a restatement of a throw already made
 * -------------------------------------------------------------------------- */

interface FeatureTier {
  level: number;
  dice: string;
}

/** Both printings bracket a tier's dice after the level that grants them. */
const TIER_BRACKET = /\((\d*d\d+)(?:\s[^)]*)?\)/g;
/** "to 1d8 at 9th level", "a d8 at level 5", "1d10 at 14th level". */
const TIER_AT_LEVEL = /(\d*d\d+)\s+at\s+(?:level\s+(\d+)|(\d+)(?:st|nd|rd|th)\s+level)/gi;
/** "the extra damage increases to 2d8", "the die becomes a d8". */
const TIER_INCREASE = /\b(?:increases?|increased|increasing|becomes?)\s+(?:to|by)\s+(?:an?\s+)?(\d*d\d+)/gi;
/** The level an increase clause states on either side of itself. */
const NEARBY_LEVEL = /(?:when you reach\s+)?(?:[A-Za-z]+\s+)?levels?\s+(\d+)|(\d+)(?:st|nd|rd|th)\s+level/i;
/** A feature names one class, so one reading of it serves every tier it states. */
const TIER_CLASS = /\b([A-Za-z]+)\s+levels?\s+\d/;

const inRange = (level: number | null) => (level !== null && level >= 1 && level <= 20 ? level : null);

function nearbyLevel(text: string, start: number, end: number): number | null {
  const window = `${text.slice(Math.max(0, start - 70), start)} ${text.slice(end, end + 70)}`;
  const match = NEARBY_LEVEL.exec(window);
  if (!match) return null;
  const stated = match[1] ?? match[2];
  return inRange(stated === undefined ? null : Number.parseInt(stated, 10));
}

interface TierMention {
  level: number | null;
  /** What the clause says is growing, where it names more than one thing. */
  kinds: FeatureThrowKind[];
}

/**
 * What a restatement says is growing, read from the clause it stands in. Only a subject naming
 * more than one thing is used — Land's Aid's "The damage and healing increase by 1d6" restates one
 * die for two throws, and the nearest-throw rule alone gave the second die to the healing only.
 */
const TIER_SUBJECTS: ReadonlyArray<{ pattern: RegExp; kind: FeatureThrowKind }> = [
  { pattern: /\btemporary hit points\b/i, kind: 'temporary-hit-points' },
  { pattern: /\bheal(?:ing|s)?\b|\bhit points\b/i, kind: 'healing' },
  { pattern: /\bdamage\b/i, kind: 'damage' }
];

function readTierSubjects(clause: string): FeatureThrowKind[] {
  const kinds = TIER_SUBJECTS.filter(({ pattern }) => pattern.test(clause)).map((entry) => entry.kind);
  // "Temporary hit points" holds the words "hit points", so one subject must not read as two.
  return kinds.includes('temporary-hit-points') ? kinds.filter((kind) => kind !== 'healing') : kinds;
}

/**
 * Where the text restates a throw it has already made, and at which level.
 *
 * A `level` of `null` is a restatement with no level in it — Divine Smite's "the damage increases
 * by 1d8 if the target is an undead" — which is neither a tier nor a throw of its own.
 */
function collectTiers(text: string): Map<number, TierMention> {
  const tiers = new Map<number, TierMention>();
  const record = (index: number, level: number | null, clauseStart = sentenceStart(text, index)) => {
    if (!tiers.has(index)) tiers.set(index, { level, kinds: readTierSubjects(text.slice(clauseStart, index)) });
  };

  for (const match of text.matchAll(TIER_AT_LEVEL)) {
    const stated = match[2] ?? match[3];
    record(match.index ?? 0, inRange(Number.parseInt(stated, 10)));
  }
  for (const match of text.matchAll(TIER_BRACKET)) {
    const index = (match.index ?? 0) + 1;
    record(index, inRange(trailingLevel(text.slice(Math.max(0, index - 26), index))));
  }
  for (const match of text.matchAll(TIER_INCREASE)) {
    const index = (match.index ?? 0) + match[0].lastIndexOf(match[1]);
    record(index, nearbyLevel(text, match.index ?? 0, index + match[1].length), sentenceStart(text, match.index ?? 0));
  }
  return tiers;
}

/* -------------------------------------------------------------------------- *
 * What the throw is for
 * -------------------------------------------------------------------------- */

const TYPED_DAMAGE = new RegExp(`\\b(${DAMAGE_TYPES.join('|')})\\s+damage\\b`, 'i');
const TEMPORARY_HIT_POINTS = /\btemporary hit points\b/i;
const REDUCTION = /\b(?:reduce[sd]?|reduction)\b/i;
const HEALING = /\b(?:regain(?:s|ing)?|restor(?:e|es|ing)|heals?)\b/i;
const HIT_POINTS = /\bhit points\b/i;
const DAMAGE = /\bdamage\b/i;
const BONUS = /\badd (?:the number rolled|it)\b|\bto (?:your|the|an|one) (?:roll|total)\b/i;

/**
 * What the feature has the dice rolled for. The clause that says so sits against the dice, so each
 * is read from a short tail — Quivering Palm's "it is reduced to 0 hit points" two sentences
 * earlier otherwise makes its 10d12 a damage reduction. Bonus is read before healing because
 * Tactical Mind states both: "Rather than regaining Hit Points, you roll 1d10 and add the number
 * rolled to the ability check".
 */
function readKind(before: string, after: string): FeatureThrowKind {
  const lead = before.slice(-40);
  const window = `${before} ${after}`;
  if (TEMPORARY_HIT_POINTS.test(lead) || TEMPORARY_HIT_POINTS.test(after.slice(0, 30))) {
    return 'temporary-hit-points';
  }
  if (REDUCTION.test(lead) && DAMAGE.test(window)) return 'reduction';
  if (BONUS.test(after)) return 'bonus';
  if (HEALING.test(before.slice(-60)) && HIT_POINTS.test(window)) return 'healing';
  if (DAMAGE.test(window)) return 'damage';
  return 'other';
}

/** The type named beside the dice, which the books state after them far more often than before. */
function readDamageType(before: string, after: string): SpellDamageType | undefined {
  const match = TYPED_DAMAGE.exec(after) ?? TYPED_DAMAGE.exec(before);
  return match ? (match[1].toLowerCase() as SpellDamageType) : undefined;
}

const KIND_WORDS: Record<FeatureThrowKind, string> = {
  damage: '',
  healing: 'healing',
  'temporary-hit-points': 'temp HP',
  reduction: 'reduction',
  bonus: '',
  other: ''
};

/* -------------------------------------------------------------------------- *
 * What the character adds to it
 * -------------------------------------------------------------------------- */

const ABILITY_TERM =
  /^\s*(?:\+|plus|and)\s+(?:add\s+)?(?:your\s+)?(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+modifier/i;
const LEVEL_TERM = /^\s*(?:\+|plus|and)\s+(?:(half)\s+)?(?:your\s+)?(?:([A-Za-z]+)\s+)?level(?:\s+in\s+this\s+class)?/i;
const PROFICIENCY_TERM = /^\s*(?:\+|plus|and)\s+(?:your\s+)?(?:PB|proficiency bonus)\b/i;

interface ModifierTerm {
  matched: string;
  value: number | undefined;
}

function readAbilityTerm(rest: string, context: FeatureContext): ModifierTerm | null {
  const match = ABILITY_TERM.exec(rest);
  if (!match) return null;
  const ability = match[1].toLowerCase() as keyof AbilityScores;
  return { matched: match[0], value: context.abilityModifiers?.[ability] };
}

function readLevelTerm(rest: string, context: FeatureContext): ModifierTerm | null {
  const match = LEVEL_TERM.exec(rest);
  if (!match) return null;
  const named = match[2]?.toLowerCase();
  const level = named ? context.classLevels?.[named] : context.level;
  const halved = match[1] ? Math.floor((level ?? 0) / 2) : level;
  return { matched: match[0], value: level === undefined ? undefined : halved };
}

function readProficiencyTerm(rest: string, context: FeatureContext): ModifierTerm | null {
  const match = PROFICIENCY_TERM.exec(rest);
  if (!match) return null;
  return { matched: match[0], value: context.proficiencyBonus };
}

const TERM_READERS = [readAbilityTerm, readLevelTerm, readProficiencyTerm];

interface FeatureModifier {
  /** Absent where the text names something this context cannot resolve. */
  bonus?: number;
  /** The book's own words, which the tray prints whether or not they resolved. */
  phrase: string;
}

/**
 * The chain of terms the text adds to the dice — "+ your Dexterity modifier + your monk level" —
 * stopping at the first thing it does not recognise. One unresolved term leaves the whole modifier
 * unresolved and the throw bare: a wrong number is worse than no number.
 */
function readModifier(after: string, context: FeatureContext): FeatureModifier {
  let rest = after;
  let total = 0;
  let resolved = true;
  const phrases: string[] = [];

  for (let guard = 0; guard < 4; guard += 1) {
    let term: ModifierTerm | null = null;
    for (const read of TERM_READERS) {
      term = read(rest, context);
      if (term) break;
    }
    if (!term) break;
    phrases.push(term.matched.trim());
    if (term.value === undefined) resolved = false;
    else total += term.value;
    rest = rest.slice(term.matched.length);
  }

  const phrase = phrases.join(' ');
  if (!resolved || phrases.length === 0) return { phrase };
  return { bonus: total, phrase };
}

/* -------------------------------------------------------------------------- *
 * The reading
 * -------------------------------------------------------------------------- */

interface ThrowDraft {
  dice: string;
  face: string;
  kind: FeatureThrowKind;
  damageType?: SpellDamageType;
  modifier: FeatureModifier;
  tiers: FeatureTier[];
  className?: string;
  /** What the class table states at this character's level, where a column states this die. */
  tableDice?: string;
}

const WINDOW = 100;

function draftAt(text: string, index: number, dice: string, context: FeatureContext): ThrowDraft {
  const after = text.slice(index + dice.length, index + dice.length + WINDOW);
  const before = text.slice(Math.max(0, index - WINDOW), index);
  // Only a throw that deals damage takes a type from the sentences around it, or the Steel
  // Defender's Repair reads as force healing off the attack line above it.
  const kind = readKind(before, after);
  const typed = kind === 'damage' || kind === 'reduction';
  return {
    dice: normalizeDice(dice),
    face: DICE_FACE.exec(dice)?.[1] ?? '',
    kind,
    damageType: typed ? readDamageType(before, after) : undefined,
    modifier: readModifier(after, context),
    tiers: []
  };
}

/**
 * Which throws a tier belongs to: the nearest one already made in the same die, else the nearest
 * of any die — unless the clause names more than one thing, in which case it says so outright and
 * every throw it names in that die grows ("The damage and healing increase by 1d6").
 */
function tierTargets(drafts: readonly ThrowDraft[], face: string, kinds: readonly FeatureThrowKind[]): ThrowDraft[] {
  const inFace = drafts.filter((draft) => draft.face === face);
  const named = inFace.filter((draft) => kinds.includes(draft.kind));
  if (named.length > 0) {
    // One thing named is one throw — the nearest of them, as before. More than one is the clause
    // saying outright that several grow together.
    return kinds.length > 1 ? named : named.slice(-1);
  }
  const nearest = inFace.at(-1) ?? drafts.at(-1);
  return nearest ? [nearest] : [];
}

function readDrafts(text: string, context: FeatureContext): ThrowDraft[] {
  const rejected = collectRejected(text);
  const tiers = collectTiers(text);
  const className = TIER_CLASS.exec(text)?.[1]?.toLowerCase();
  const drafts: ThrowDraft[] = [];

  for (const match of text.matchAll(DICE_PATTERN)) {
    const index = match.index ?? 0;
    const dice = match[0];
    if (isTestDie(dice) || rejected.has(index)) continue;
    if (EXAMPLE_PATTERN.test(text.slice(sentenceStart(text, index), index))) continue;

    const face = DICE_FACE.exec(dice)?.[1] ?? '';
    const mention = tiers.get(index);
    if (mention) {
      const targets = tierTargets(drafts, face, mention.kinds);
      // A restatement before the feature has stated anything is the throw: Improved Blessed
      // Strikes says only that your Divine Strike now rolls 2d8.
      if (targets.length > 0) {
        const { level } = mention;
        if (level !== null) {
          for (const target of targets) target.tiers.push({ level, dice: normalizeDice(dice) });
        }
        continue;
      }
    }

    drafts.push({ ...draftAt(text, index, dice, context), className });
  }

  return drafts;
}

function diceForLevel(draft: ThrowDraft, context: FeatureContext): string {
  // The column is the book stating the die outright, so it beats whatever the prose restates.
  if (draft.tableDice) return draft.tableDice;
  if (draft.tiers.length === 0) return draft.dice;
  const named = draft.className ? context.classLevels?.[draft.className] : undefined;
  const level = named ?? context.level ?? 1;
  const reached = draft.tiers.filter((tier) => tier.level <= level).sort((a, b) => a.level - b.level);
  return reached.at(-1)?.dice ?? draft.dice;
}

const signed = (bonus: number) => (bonus < 0 ? `${bonus}` : `+${bonus}`);

function present(draft: ThrowDraft, index: number, context: FeatureContext): FeatureThrow {
  const dice = diceForLevel(draft, context);
  const bonus = draft.modifier.bonus;
  const notation = bonus ? `${dice}${signed(bonus)}` : dice;
  const word = draft.damageType ?? KIND_WORDS[draft.kind];
  return {
    id: `throw-${index}`,
    notation,
    label: word ? `${notation} ${word}` : notation,
    kind: draft.kind,
    damageType: draft.damageType,
    detail: [dice, draft.modifier.phrase].filter(Boolean).join(' ')
  };
}

/** The value a column states at level 1 and the one it states now, both as the sheet prints them. */
interface ColumnDice {
  base: string;
  reached: string;
}

function readColumn(table: FeatureTableDice | undefined): ColumnDice | null {
  if (!table) return null;
  const stated = table.perLevel.slice(0, Math.max(1, table.level)).filter((value) => value !== null);
  const base = table.perLevel.find((value) => value !== null);
  const reached = stated.at(-1);
  if (!base || !reached) return null;
  return { base: normalizeDice(base.toLowerCase()), reached: normalizeDice(reached.toLowerCase()) };
}

/**
 * The die a class table states for this feature, laid onto the throw the text prints at 1st level.
 * Matching on that printed value rather than on position is what keeps a feature stating dice of
 * its own — the Monk's Martial Arts states three — from taking the column by accident.
 */
function applyColumnDice(drafts: readonly ThrowDraft[], column: ColumnDice): void {
  const target = drafts.find((draft) => draft.dice === column.base);
  if (target) target.tableDice = column.reached;
}

/**
 * Every throw a feature states, already scaled to the level the context gives.
 *
 * Two throws with the same notation and the same purpose are the book saying one thing twice —
 * Divine Strike restates its die under each option — so the list is deduped on what it prints.
 */
export function deriveFeatureThrows(
  feature: Pick<Feature, 'description'> & { name?: string },
  context: FeatureContext = {}
): FeatureThrow[] {
  const text = (feature.description ?? '').replaceAll('’', "'");
  if (!text) return [];

  const drafts = readDrafts(text, context);
  const column = readColumn(context.tableDice?.[(feature.name ?? '').trim().toLowerCase()]);
  if (column) applyColumnDice(drafts, column);

  const throws: FeatureThrow[] = [];
  const seen = new Set<string>();
  const notations = new Set<string>();
  for (const draft of drafts) {
    const entry = present(draft, throws.length, context);
    const key = `${entry.notation}|${entry.kind}|${entry.damageType ?? ''}`;
    // A later mention with nothing said about it is the same throw again: Emboldening Bond's
    // "each creature can add the d4 no more than once per turn" is not a second d4.
    if (seen.has(key) || (entry.kind === 'other' && notations.has(entry.notation))) continue;
    seen.add(key);
    notations.add(entry.notation);
    throws.push(entry);
  }
  return throws;
}

/* -------------------------------------------------------------------------- *
 * What the feature makes somebody else roll
 * -------------------------------------------------------------------------- */

/** A saving throw a feature imposes, at this character's own DC where the feature states one. */
export interface FeatureSave {
  /** Stable within the feature, so a list can key on it. */
  id: string;
  ability: keyof AbilityScores;
  /** What the sheet prints: "DC 16 CON", or "CON Save" where nothing states the DC. */
  label: string;
  /** Absent where the feature states no DC, or where the context cannot resolve the one it states. */
  dc?: number;
}

const ABILITY_WORDS = 'strength|dexterity|constitution|intelligence|wisdom|charisma';

/**
 * A save the feature *imposes*. "You have advantage on Dexterity saving throws" and "you gain
 * proficiency in Wisdom saving throws" name the same words about the opposite thing, so the clause
 * that calls for one is what is matched — forwards, never against the tail before it (S8786).
 */
const IMPOSED_SAVE = new RegExp(
  String.raw`\b(?:must (?:succeed on|make)|unless it succeeds on|succeeds on)\s+an?\s+(${ABILITY_WORDS})\s+saving\s+throw`,
  'gi'
);
/** "forcing the target to make a Strength saving throw". */
const FORCED_SAVE = new RegExp(
  String.raw`\bforc(?:e|es|ing)\b[^.]{0,40}?\bto\s+make\s+an?\s+(${ABILITY_WORDS})\s+saving\s+throw`,
  'gi'
);

/** 2014 states the formula one way and 2024 the other; neither number is written in the app. */
const DC_FORMULA_2014 = new RegExp(
  String.raw`\b8\s*\+\s*your proficiency bonus\s*\+\s*your (${ABILITY_WORDS}) modifier`,
  'i'
);
const DC_FORMULA_2024 = new RegExp(
  String.raw`\b8 plus your (${ABILITY_WORDS}) modifier and (?:your )?proficiency bonus`,
  'i'
);
/** "against your spell save DC" — a number only the character knows. */
const DC_SPELL_SAVE = /\bspell save DC\b/i;
/** A DC the feature simply prints. */
const DC_STATED = /\bDC\s+(\d+)\b/i;

/**
 * The DC the feature states, resolved against this character. A feature that states none — Stunning
 * Strike names the save and leaves the DC to the class's own feature — gets no number rather than a
 * guessed one, exactly as an unstated spell facet stays unstated.
 */
function readSaveDc(text: string, context: FeatureContext): number | undefined {
  const formula = DC_FORMULA_2014.exec(text) ?? DC_FORMULA_2024.exec(text);
  if (formula) {
    const modifier = context.abilityModifiers?.[formula[1].toLowerCase() as keyof AbilityScores];
    const proficiency = context.proficiencyBonus;
    if (modifier === undefined || proficiency === undefined) return undefined;
    return 8 + proficiency + modifier;
  }

  const stated = DC_STATED.exec(text);
  if (stated) return Number.parseInt(stated[1], 10);
  return DC_SPELL_SAVE.test(text) ? context.spellSaveDc : undefined;
}

const abbreviate = (ability: keyof AbilityScores) => ability.slice(0, 3).toUpperCase();

/**
 * Every saving throw a feature calls for, in the order it names them.
 *
 * The other half of `deriveSpellAttackOrSave` for features. There is no attack half: no feature in
 * either printing rolls an attack of its own — the ones that mention one are talking about the
 * attack the character was already making.
 */
export function deriveFeatureSaves(
  feature: Pick<Feature, 'description'>,
  context: FeatureContext = {}
): FeatureSave[] {
  const text = (feature.description ?? '').replaceAll('’', "'");
  if (!text) return [];

  const dc = readSaveDc(text, context);
  const saves: FeatureSave[] = [];
  const seen = new Set<string>();

  for (const pattern of [IMPOSED_SAVE, FORCED_SAVE]) {
    for (const match of text.matchAll(pattern)) {
      const ability = match[1].toLowerCase() as keyof AbilityScores;
      if (seen.has(ability)) continue;
      seen.add(ability);
      saves.push({
        id: `save-${saves.length}`,
        ability,
        label: dc === undefined ? `${abbreviate(ability)} Save` : `DC ${dc} ${abbreviate(ability)}`,
        dc
      });
    }
  }

  return saves;
}
