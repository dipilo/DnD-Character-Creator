// What a feature throws, from its own sentences; one that states none gets none.
import { CONDITION_NAMES } from '@/lib/sheetPlayState';
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

/** What the character adds, in words; an unrecognised term leaves the throw bare. */
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
  /** Other features, for a save whose DC a sibling states (Stunning Strike). */
  siblingFeatures?: readonly SiblingFeature[];
}

/** A feature read only for what it says about its siblings' saves. */
export type SiblingFeature = Pick<Feature, 'name' | 'description'>;

/** A per-level column die; without it a level-20 Monk reads 1d4. */
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

/** Dice that are not thrown: a cost, a cap, a count. Read forwards (Sonar S8786). */
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

/** Where the sentence holding `index` ends, so a clause can be read without its neighbours. */
function sentenceEnd(text: string, index: number): number {
  let end = text.length;
  for (const marker of SENTENCE_BREAKS) {
    const at = text.indexOf(marker, index);
    if (at >= 0) end = Math.min(end, at + marker.length);
  }
  return end;
}

const EXAMPLE_PATTERN = /\bfor example\b/i;

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

/** Only a subject naming more than one thing grows more than one throw. */
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

/** Where the text restates a throw; a null level is neither a tier nor a throw. */
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

const TYPED_DAMAGE = new RegExp(`\\b(${DAMAGE_TYPES.join('|')})\\s+damage\\b`, 'i');
const TEMPORARY_HIT_POINTS = /\btemporary hit points\b/i;
const REDUCTION = /\b(?:reduce[sd]?|reduction)\b/i;
const HEALING = /\b(?:regain(?:s|ing)?|restor(?:e|es|ing)|heals?)\b/i;
const HIT_POINTS = /\bhit points\b/i;
const DAMAGE = /\bdamage\b/i;
const BONUS = /\badd (?:the number rolled|it)\b|\bto (?:your|the|an|one) (?:roll|total)\b/i;

/** What the dice are for, read from a short tail so a distant clause cannot vote. */
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

/** Stops at the first unrecognised term: a wrong number is worse than none. */
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

interface ThrowDraft {
  /** Where the dice were read, so a save in the same sentence can say it halves this. */
  at: number;
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
    at: index,
    dice: normalizeDice(dice),
    face: DICE_FACE.exec(dice)?.[1] ?? '',
    kind,
    damageType: typed ? readDamageType(before, after) : undefined,
    modifier: readModifier(after, context),
    tiers: []
  };
}

/** The nearest throw in the same die, unless the clause names more than one thing. */
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

/** Matched on the printed 1st-level value, not position, so a stated die keeps its own. */
function applyColumnDice(drafts: readonly ThrowDraft[], column: ColumnDice): void {
  const target = drafts.find((draft) => draft.dice === column.base);
  if (target) target.tableDice = column.reached;
}

/** Every throw, scaled, deduped on what it prints: a book says one thing twice. */
export function deriveFeatureThrows(
  feature: Pick<Feature, 'description'> & { name?: string },
  context: FeatureContext = {}
): FeatureThrow[] {
  return readThrows(feature, context).map((read) => read.entry);
}

/** A throw and where its dice were read, which is what links it to a save in the same sentence. */
interface ReadThrow {
  entry: FeatureThrow;
  at: number;
}

function readThrows(
  feature: Pick<Feature, 'description'> & { name?: string },
  context: FeatureContext
): ReadThrow[] {
  const text = (feature.description ?? '').replaceAll('’', "'");
  if (!text) return [];

  const drafts = readDrafts(text, context);
  const column = readColumn(context.tableDice?.[(feature.name ?? '').trim().toLowerCase()]);
  if (column) applyColumnDice(drafts, column);

  const reads: ReadThrow[] = [];
  const seen = new Set<string>();
  const notations = new Set<string>();
  for (const draft of drafts) {
    const entry = present(draft, reads.length, context);
    const key = `${entry.notation}|${entry.kind}|${entry.damageType ?? ''}`;
    // A later mention with nothing said about it is the same throw again: Emboldening Bond's
    // "each creature can add the d4 no more than once per turn" is not a second d4.
    if (seen.has(key) || (entry.kind === 'other' && notations.has(entry.notation))) continue;
    seen.add(key);
    notations.add(entry.notation);
    reads.push({ entry, at: draft.at });
  }
  return reads;
}

/** A saving throw a feature imposes, at this character's own DC where the feature states one. */
export interface FeatureSave {
  /** Stable within the feature, so a list can key on it. */
  id: string;
  ability: keyof AbilityScores;
  /** What the sheet prints: "DC 16 CON", or "CON Save" where nothing states the DC. */
  label: string;
  /** Absent where the feature states no DC, or where the context cannot resolve the one it states. */
  dc?: number;
  /** Whether a success halves the damage, which both printings word "half as much damage". */
  halvesDamage?: boolean;
  /** The throw this save is rolled against, where the feature states both. */
  throwId?: string;
  /** What a failure does, in the feature's own words, where the damage is not the whole of it. */
  effect?: string;
  /** The conditions that clause names, from the list the sheet's own toggles use. */
  conditions?: readonly string[];
}

const ABILITY_WORDS = 'strength|dexterity|constitution|intelligence|wisdom|charisma';

/** A save the feature *imposes*, matched forwards on the clause calling for it (S8786). */
const IMPOSED_SAVE = new RegExp(
  String.raw`\b(?:must (?:succeed on|make)|unless it succeeds on|succeeds on)\s+an?\s+(${ABILITY_WORDS})\s+saving\s+throw`,
  'gi'
);
/** "forcing the target to make a Strength saving throw". */
const FORCED_SAVE = new RegExp(
  String.raw`\bforc(?:e|es|ing)\b[^.]{0,40}?\bto\s+make\s+an?\s+(${ABILITY_WORDS})\s+saving\s+throw`,
  'gi'
);

/** Three wordings, one rule; neither number is written in the app. */
const DC_FORMULA_SUMMED = new RegExp(
  String.raw`\b8\s*\+\s*(?:your proficiency bonus\s*\+\s*your (${ABILITY_WORDS}) modifier`
    + String.raw`|your (${ABILITY_WORDS}) modifier\s*\+\s*your proficiency bonus)`,
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

/** A feature that states no DC gets no number, not a guessed one. */
function readSaveDc(text: string, context: FeatureContext): number | undefined {
  const formula = DC_FORMULA_SUMMED.exec(text) ?? DC_FORMULA_2024.exec(text);
  if (formula) {
    const ability = (formula[1] ?? formula[2]).toLowerCase() as keyof AbilityScores;
    const modifier = context.abilityModifiers?.[ability];
    const proficiency = context.proficiencyBonus;
    if (modifier === undefined || proficiency === undefined) return undefined;
    return 8 + proficiency + modifier;
  }

  const stated = DC_STATED.exec(text);
  if (stated) return Number.parseInt(stated[1], 10);
  return DC_SPELL_SAVE.test(text) ? context.spellSaveDc : undefined;
}

/** A feature that merely imposes a save says "must succeed on" instead. */
const DECLARES_SIBLING_SAVE = /\brequires?\b[^.]{0,60}?\bsaving\s+throws?\b/i;

/** Both printings list what a pool fuels the same way, and Open Hand Technique names one of them. */
const FUELLED_FEATURES = /\bsuch features:\s*([^.]+)/i;

/** "Monk's Focus" is what Stunning Strike calls simply Focus; "Ki" is already what Ki is called. */
const POSSESSIVE_PREFIX = /^[A-Za-z]+'s\s+/;

const escapeForPattern = (value: string) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/** Two or more capitalised words in the declaring clause are what it covers. */
const NAMED_TERM = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g;

/** Every name a sibling's dependants use for it: its own, what it covers, and what it fuels. */
function referenceNames(sibling: SiblingFeature, clause: string): string[] {
  const name = (sibling.name ?? '').replaceAll('’', "'").trim();
  const names = name ? [name, name.replace(POSSESSIVE_PREFIX, '')] : [];
  names.push(...clause.replace(/^\S+\s+/, '').match(NAMED_TERM) ?? []);
  const fuelled = FUELLED_FEATURES.exec(sibling.description ?? '')?.[1] ?? '';
  for (const part of fuelled.split(/,|\band\b/)) {
    const trimmed = part.trim();
    if (trimmed) names.push(trimmed);
  }
  return names.filter((value) => value.length > 1);
}

/** Lookarounds, not `\b`: a name ending in punctuation asserts nothing after it. */
const namedIn = (text: string, names: readonly string[]) =>
  names.some((name) =>
    new RegExp(String.raw`(?<![A-Za-z0-9])${escapeForPattern(name)}(?![A-Za-z0-9])`, 'i').test(text)
  );

/** Both books put the DC on the pool's owner and cross-reference it by name. */
function siblingSaveDc(text: string, context: FeatureContext): number | undefined {
  for (const sibling of context.siblingFeatures ?? []) {
    const description = (sibling.description ?? '').replaceAll('’', "'");
    // The same feature read back out of the character's own list is not its own source.
    if (!description || description === text) continue;
    const declares = DECLARES_SIBLING_SAVE.exec(description);
    if (!declares) continue;
    const start = sentenceStart(description, declares.index);
    if (!namedIn(text, referenceNames(sibling, description.slice(start, declares.index)))) continue;
    // 2014's Ki states the formula in the sentence after the declaration, so the window runs one
    // sentence past it: "Ki save DC = 8 + your proficiency bonus + your Wisdom modifier".
    const dc = readSaveDc(description.slice(start, sentenceEnd(description, sentenceEnd(description, declares.index))), context);
    if (dc !== undefined) return dc;
  }
  return undefined;
}

/** Matched whole: Evasion's "only half damage" is about somebody else's effect. */
const HALVED_ON_SAVE = /\bhalf as much damage\b/i;

const abbreviate = (ability: keyof AbilityScores) => ability.slice(0, 3).toUpperCase();

/** The tray's line: the book's phrase plus what a save against it does. */
export function describeFeatureThrow(entry: FeatureThrow, saves: readonly FeatureSave[]): string {
  const save = saves.find((candidate) => candidate.throwId === entry.id);
  return save ? `${entry.detail} · half on a successful ${abbreviate(save.ability)} save` : entry.detail;
}

/** What the sheet prints beside a save: its DC, and the conditions a failure imposes. */
export function describeFeatureSave(save: FeatureSave): string {
  return save.conditions?.length ? `${save.label} → ${save.conditions.join(', ')}` : save.label;
}

/** The `or` clause is anchored to its save and skips the mitigation phrase. */
const FAILURE_CLAUSES = [
  /^[^.•]*?\bsaving\s+throw\b[^.•]*?,?\s+\bor\s+(?!half as much)/i,
  /\bon a (?:failed (?:save|saving throw)|failure),\s+(?!or\b)/i,
  /\bif (?:it|the save|the creature|the target) fails(?: its (?:save|saving throw))?,\s+/i,
  /\bunless the save succeeds,\s+/i
];

/** The subject has to lead it, or an effect mentioning damage reads as one. */
const DAMAGE_PART = /^(?:(?:it|a creature|the (?:target|creature|attacker))\s+)?(?:takes?|taking)\b.*\bdamage\b/i;

/** The damage is already a throw, so what is left of the clause is what the save does. */
function withoutDamage(clause: string): string | undefined {
  const kept = clause.split(/\s+and\s+/).filter((part) => !DAMAGE_PART.test(part.trim()));
  const effect = kept.join(' and ').trim();
  // A clause that announces a list ("suffer one of the following effects:") is not the effect: the
  // bullets it points at are a sentence break away and nothing carries them here.
  return effect && !effect.endsWith(':') ? effect : undefined;
}

/** The caller's window ends at the next save, so two never read each other's clause. */
function readFailureEffect(window: string): string | undefined {
  for (const pattern of FAILURE_CLAUSES) {
    const match = pattern.exec(window);
    if (!match) continue;
    const start = (match.index ?? 0) + match[0].length;
    const clause = window.slice(start, sentenceEnd(window, start)).trim().replace(/[.•]$/, '');
    const effect = withoutDamage(clause);
    if (effect) return effect;
  }
  return undefined;
}

/** The conditions the clause names, in the order it names them. */
function readConditions(effect: string): string[] {
  const found: Array<{ name: string; at: number }> = [];
  for (const name of CONDITION_NAMES) {
    const at = new RegExp(String.raw`\b${name}\b`, 'i').exec(effect)?.index;
    if (at !== undefined) found.push({ name, at });
  }
  found.sort((a, b) => a.at - b.at);
  return found.map((entry) => entry.name);
}

/** Land's Aid states a damage throw and a healing one; only the first is what its save mitigates. */
function nearestThrow(damages: readonly ReadThrow[], at: number): ReadThrow | undefined {
  return damages.reduce<ReadThrow | undefined>((closest, read) => {
    if (!closest) return read;
    return Math.abs(read.at - at) < Math.abs(closest.at - at) ? read : closest;
  }, undefined);
}

/** Every save the text calls for, with where it was read, in the order the feature names them. */
function readSaves(text: string): Array<{ ability: keyof AbilityScores; at: number }> {
  const found: Array<{ ability: keyof AbilityScores; at: number }> = [];
  for (const pattern of [IMPOSED_SAVE, FORCED_SAVE]) {
    for (const match of text.matchAll(pattern)) {
      found.push({ ability: match[1].toLowerCase() as keyof AbilityScores, at: match.index ?? 0 });
    }
  }
  found.sort((a, b) => a.at - b.at);
  return dropRestatedSaves(text, found);
}

/** Deduped on the clause, not the ability: Wild Surge imposes two Constitution saves. */
function dropRestatedSaves(
  text: string,
  found: Array<{ ability: keyof AbilityScores; at: number }>
): Array<{ ability: keyof AbilityScores; at: number }> {
  const clausesByAbility = new Map<keyof AbilityScores, Set<string>>();
  return found.filter((entry, index) => {
    const effect = readFailureEffect(text.slice(entry.at, found[index + 1]?.at ?? text.length)) ?? '';
    const seen = clausesByAbility.get(entry.ability);
    if (!seen) {
      clausesByAbility.set(entry.ability, new Set([effect]));
      return true;
    }
    // A repeat with no clause of its own is a restatement: there is nothing it could add.
    if (!effect || seen.has(effect)) return false;
    seen.add(effect);
    return true;
  });
}

/** No attack half: no feature in either printing rolls an attack of its own. */
export function deriveFeatureSaves(
  feature: Pick<Feature, 'description'> & { name?: string },
  context: FeatureContext = {}
): FeatureSave[] {
  const text = (feature.description ?? '').replaceAll('’', "'");
  if (!text) return [];

  const featureDc = readSaveDc(text, context) ?? siblingSaveDc(text, context);
  const damages = readThrows(feature, context).filter((read) => read.entry.kind === 'damage');

  const found = readSaves(text);
  return found.map((entry, index) => {
    const { ability, at } = entry;
    // The failure clause can be further off than the halving one — Shadow Lore states what a
    // success does first — so it is read up to wherever the next save begins.
    const effectWindow = text.slice(at, found[index + 1]?.at ?? text.length);
    // A feature's two saves usually share one DC, but each one's own clause states it where they
    // differ, so the nearest reading wins over the feature-wide one.
    const clause = text.slice(at, sentenceEnd(text, sentenceEnd(text, at)));
    const dc = readSaveDc(clause, context) ?? featureDc;
    // "On a successful save, it takes half as much damage" can sit any number of sentences past the
    // save — Rebuke the Violent states the failure first — so it is read to the same bound.
    const halvesDamage = HALVED_ON_SAVE.test(effectWindow);
    const mitigated = halvesDamage ? nearestThrow(damages, at) : undefined;
    const label = dc === undefined ? `${abbreviate(ability)} Save` : `DC ${dc} ${abbreviate(ability)}`;
    const effect = readFailureEffect(effectWindow);
    const conditions = effect ? readConditions(effect) : [];
    return {
      id: `save-${index}`,
      ability,
      label: halvesDamage ? `${label} (half)` : label,
      dc,
      ...(halvesDamage ? { halvesDamage } : {}),
      ...(mitigated ? { throwId: mitigated.entry.id } : {}),
      ...(effect ? { effect } : {}),
      ...(conditions.length > 0 ? { conditions } : {})
    };
  });
}
