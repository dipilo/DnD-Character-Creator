/**
 * What a feature does to a d20 test, read from the feature's own sentences.
 *
 * Silver Tongue's floor, Reliable Talent's, Brave's advantage against being frightened: the books
 * state each as a scope and an effect in one clause, so nothing here is a per-feature table. A
 * clause whose scope cannot be read grants nothing, exactly as a feature stating no timing lands in
 * no action group.
 */
import { SKILL_ABILITIES } from '@/lib/sheetDerivations';
import type { AbilityScores, Feature } from '@/types/dnd';

/** The four d20 tests the sheet rolls. Initiative is kept apart: it is not an ability check here. */
export type RollKind = 'check' | 'save' | 'attack' | 'initiative';

export type RollEffectKind = 'advantage' | 'disadvantage' | 'floor' | 'bonus';

export interface RollScope {
  /** Which tests the clause covers. Empty means it named none and the effect is dropped. */
  rolls: readonly RollKind[];
  abilities?: readonly (keyof AbilityScores)[];
  skills?: readonly string[];
  /** "that lets you add your proficiency bonus", "that uses one of your skill proficiencies". */
  requiresProficiency?: boolean;
  /** Jack of All Trades' own narrowing: "that doesn't already include your proficiency bonus". */
  excludesProficiency?: boolean;
}

/**
 * How big a bonus is, as the book states it rather than as a number: the size is one of the
 * character's own figures and is resolved against them in `resolveCharacterRollEffects`.
 */
export interface RollBonus {
  source: 'ability' | 'proficiency';
  ability?: keyof AbilityScores;
  /** "half your proficiency bonus". Both books round a halved value down unless they say up. */
  half?: boolean;
  rounding?: 'up' | 'down';
  /** "(with a minimum bonus of +1)". */
  minimum?: number;
}

export interface RollEffect {
  /** Stable within the feature, so a stored or rendered list can key on it: `<featureId>::<n>`. */
  id: string;
  kind: RollEffectKind;
  /** `floor` only: a d20 that lands below this counts as this. */
  value?: number;
  /** `bonus` only: the figure the clause names, before it is placed against a character. */
  bonus?: RollBonus;
  scope: RollScope;
  /**
   * The words that narrow the clause, verbatim — "against being frightened", "to avoid or end the
   * charmed condition". The sheet cannot tell whether they hold, so it prints them beside the roll.
   */
  condition?: string;
  /** The clause as the book writes it, for the tray's detail line. */
  detail: string;
}

/** An effect placed against the character who holds it. */
export interface ResolvedRollEffect extends RollEffect {
  /** `bonus` only: what the clause's figure comes to for this character. */
  amount?: number;
  featureName: string;
  /** The book the feature came from, for the selector's helper line. */
  source: string;
}

/** One d20 test, as the thing being rolled describes itself. */
export interface RollTarget {
  kind: RollKind;
  ability?: keyof AbilityScores;
  /** The skill's canonical name, for a skill check. */
  skill?: string;
  /** Whether the character adds their proficiency bonus to this particular roll. */
  proficient?: boolean;
}

const SKILL_NAMES = Object.keys(SKILL_ABILITIES);

const ABILITY_NAMES: readonly (keyof AbilityScores)[] = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];

/* -------------------------------------------------------------------------- *
 * Reading one clause
 * -------------------------------------------------------------------------- */

/** "you can treat a d20 roll of 9 or lower as a 10" — the only shape either printing prints. */
const FLOOR_PATTERN = /treat a d20 roll of (\d+) or lower as (?:an?\s+)?(\d+)/i;

/** "You have advantage on …", "you gain disadvantage on …". The scope runs to the clause's end. */
const SWING_PATTERN = /\byou (?:have|gain)\s+(advantage|disadvantage)\s+on\s+/gi;

/**
 * Where the clause holding `index` ends. A comma is not a break: "Strength checks and Strength
 * saving throws" and "saving throws against poison, and you have resistance" both need the comma.
 */
const CLAUSE_END = /[.;?!•]/;

function clauseFrom(text: string, start: number): string {
  const rest = text.slice(start);
  const end = CLAUSE_END.exec(rest);
  return (end ? rest.slice(0, end.index) : rest).trim();
}

/** Where the sentence holding `index` begins, so a floor's scope can be read back off it. */
function sentenceStart(text: string, index: number): number {
  let start = 0;
  for (const marker of ['. ', '• ', '? ', '! ']) {
    const at = text.lastIndexOf(marker, index);
    if (at >= 0) start = Math.max(start, at + marker.length);
  }
  return start;
}

/**
 * "add half your proficiency bonus, rounded down, to ...", "add your Charisma modifier to ...".
 * The size is closed to the character's own figures: a clause adding a die is a throw, which
 * `featureFacets` reads, and a number nobody can place is not a d20 effect.
 */
const BONUS_PATTERN =
  /\badd (half )?your (strength|dexterity|constitution|intelligence|wisdom|charisma|proficiency) (?:modifier|bonus)\b([^.;]{0,40}?) to /gi;

/** The test has to be one the character makes: Flash of Genius adds its modifier to someone else's. */
const SELF_TEST = /\byou (?:make|roll)\b|\byour (?:initiative|ability check|attack roll|saving throw)/i;

/** "any ability check you make that doesn't already include your proficiency bonus". */
const EXCLUDES_PROFICIENCY =
  /\bdoesn[’']t (?:already|otherwise) (?:include|use)\b[^.;]{0,24}proficiency bonus/i;

const ROUNDING_UP = /round(?:ed)? up/i;
const MINIMUM_BONUS = /minimum (?:bonus )?of \+?(\d+)/i;

const PROFICIENCY_SCOPE =
  /\b(?:lets you add your proficiency bonus|uses one of your (?:skill|tool)|you(?:'re| are) proficient)/i;

/**
 * The words that narrow a clause to a situation the sheet has no way of knowing about. "When you
 * make" is not among them: it is how both printings open a clause that states the scope.
 */
const CONDITION_PATTERN =
  /\b(?:against|while|unless|if you|to avoid|to end|to escape|to maintain|to track|to navigate|to influence|to produce|that rely on|that you can see|with that|made with)\b/i;

function readRolls(clause: string): RollKind[] {
  const rolls: RollKind[] = [];
  if (/\battack rolls?\b/i.test(clause)) rolls.push('attack');
  if (/\bsaving throws?\b|\bsaves?\b/i.test(clause)) rolls.push('save');
  if (/\binitiative\b/i.test(clause)) rolls.push('initiative');
  if (/\bchecks?\b/i.test(clause)) rolls.push('check');
  return rolls;
}

const wordPattern = (word: string) => new RegExp(String.raw`\b${word}\b`, 'i');

const ABILITY_PATTERNS = ABILITY_NAMES.map((ability) => [ability, wordPattern(ability)] as const);
const SKILL_PATTERNS = SKILL_NAMES.map((skill) => [skill, wordPattern(skill)] as const);

function readAbilities(clause: string): (keyof AbilityScores)[] {
  return ABILITY_PATTERNS.filter(([, pattern]) => pattern.test(clause)).map(([ability]) => ability);
}

function readSkills(clause: string): string[] {
  return SKILL_PATTERNS.filter(([, pattern]) => pattern.test(clause)).map(([skill]) => skill);
}

/** What follows ", and" is a further effect, not more qualification — Sacred Weapon states both. */
const CONDITION_END = /,\s+and\s/i;

function readCondition(clause: string): string | undefined {
  const match = CONDITION_PATTERN.exec(clause);
  if (!match) return undefined;
  const rest = clause.slice(match.index);
  const end = CONDITION_END.exec(rest);
  const condition = (end ? rest.slice(0, end.index) : rest).trim();
  return condition.length > 0 ? condition : undefined;
}

/**
 * The scope a clause states. `rolls` empty means the clause named no test at all, which is what
 * the caller drops on: a bonus the sheet cannot place is worse than no bonus.
 */
function readScope(clause: string): RollScope {
  const abilities = readAbilities(clause);
  const skills = readSkills(clause);
  // A skill is already an ability check, so naming one does not also constrain the ability: the
  // books write "Charisma (Persuasion)" and a Persuasion check is the same roll either way.
  const narrowsByAbility = skills.length === 0 && abilities.length > 0;

  return {
    rolls: readRolls(clause),
    abilities: narrowsByAbility ? abilities : undefined,
    skills: skills.length > 0 ? skills : undefined,
    requiresProficiency: PROFICIENCY_SCOPE.test(clause) || undefined,
    excludesProficiency: EXCLUDES_PROFICIENCY.test(clause) || undefined,
  };
}

/** The size a bonus clause names, with the rounding and the floor the same clause states. */
function readBonus(match: RegExpMatchArray, clause: string): RollBonus {
  const named = match[2].toLowerCase();
  const trailing = match[3] ?? '';
  const minimum = MINIMUM_BONUS.exec(clause);
  const half = Boolean(match[1]);
  const isProficiency = named === 'proficiency';
  // Both books round a halved value down unless the clause says otherwise.
  const roundsUp = ROUNDING_UP.test(trailing);
  let rounding: 'up' | 'down' | undefined;
  if (half) rounding = roundsUp ? 'up' : 'down';

  return {
    source: isProficiency ? 'proficiency' : 'ability',
    ability: isProficiency ? undefined : (named as keyof AbilityScores),
    half: half || undefined,
    rounding,
    minimum: minimum ? Number.parseInt(minimum[1], 10) : undefined,
  };
}

/** Every effect a feature's own sentences state. A feature stating none gets none. */
export function deriveRollEffects(
  feature: Pick<Feature, 'id' | 'name' | 'description'>,
): RollEffect[] {
  const text = feature.description ?? '';
  const effects: RollEffect[] = [];

  const floor = FLOOR_PATTERN.exec(text);
  if (floor) {
    const sentence = text.slice(sentenceStart(text, floor.index), floor.index).trim();
    const scope = readScope(sentence);
    if (scope.rolls.length > 0) {
      effects.push({
        id: `${feature.id}::floor`,
        kind: 'floor',
        value: Number.parseInt(floor[2], 10),
        scope,
        // No condition: a floor's whole sentence is its scope, which `scope` already carries.
        detail: text.slice(sentenceStart(text, floor.index), floor.index + floor[0].length).trim(),
      });
    }
  }

  for (const match of text.matchAll(SWING_PATTERN)) {
    const start = (match.index ?? 0) + match[0].length;
    const clause = clauseFrom(text, start);
    const scope = readScope(clause);
    if (scope.rolls.length === 0) continue;
    effects.push({
      id: `${feature.id}::${match.index ?? 0}`,
      kind: match[1].toLowerCase() === 'advantage' ? 'advantage' : 'disadvantage',
      scope,
      condition: readCondition(clause),
      detail: `${match[0].trim()} ${clause}`,
    });
  }

  for (const match of text.matchAll(BONUS_PATTERN)) {
    const start = (match.index ?? 0) + match[0].length;
    const clause = clauseFrom(text, start);
    // A bonus states its scope on either side of the figure: Jack of All Trades after it, the
    // Alert feat before it ("When you roll Initiative, you can add your Proficiency Bonus…").
    const lead = text.slice(sentenceStart(text, match.index ?? 0), match.index ?? 0);
    const scope = readScope(`${lead} ${clause}`);
    if (scope.rolls.length === 0) continue;
    if (!SELF_TEST.test(`${lead} ${clause}`)) continue;
    effects.push({
      id: `${feature.id}::bonus::${match.index ?? 0}`,
      kind: 'bonus',
      bonus: readBonus(match, clause),
      scope,
      condition: readCondition(clause),
      detail: `${match[0].trim()} ${clause}`,
    });
  }

  return effects;
}

/** The character's own figures, which is what a bonus clause names rather than a number. */
export interface RollBonusContext {
  proficiencyBonus?: number;
  abilityModifiers?: Partial<Record<keyof AbilityScores, number>>;
}

/**
 * What a bonus clause comes to for this character. A figure that cannot be resolved leaves the
 * effect off rather than reporting a wrong number, exactly as an unreadable term does to a
 * feature's throw.
 */
function resolveBonusAmount(bonus: RollBonus, context: RollBonusContext): number | undefined {
  const base = bonus.source === 'proficiency'
    ? context.proficiencyBonus
    : bonus.ability && context.abilityModifiers?.[bonus.ability];
  if (typeof base !== 'number') return undefined;

  const halved = bonus.rounding === 'up' ? Math.ceil(base / 2) : Math.floor(base / 2);
  const amount = bonus.half ? halved : base;
  return bonus.minimum === undefined ? amount : Math.max(amount, bonus.minimum);
}

/* -------------------------------------------------------------------------- *
 * Placing them on a character
 * -------------------------------------------------------------------------- */

export interface RollEffectOptions {
  /**
   * Features whose pool the character is *not* currently in, lower-cased. Rage states its advantage
   * flatly because the whole feature is conditional on raging, and `activeEffects` already holds
   * whether they are — so the one condition the document knows about is honoured rather than
   * printed.
   */
  dormantFeatureNames?: ReadonlySet<string>;
  /** What a bonus clause's figure comes to. Without it, bonus effects resolve to nothing. */
  bonusContext?: RollBonusContext;
}

/**
 * Every effect the character's features state. The list is the level-gated one `getActiveFeatures`
 * already builds, exactly as `deriveSenses` and `deriveDefences` take it.
 */
export function resolveCharacterRollEffects(
  features: readonly Feature[],
  options: RollEffectOptions = {},
): ResolvedRollEffect[] {
  const dormant = options.dormantFeatureNames ?? new Set<string>();
  const resolved: ResolvedRollEffect[] = [];

  for (const feature of features) {
    if (dormant.has(feature.name.toLowerCase())) continue;
    for (const effect of deriveRollEffects(feature)) {
      if (effect.kind !== 'bonus') {
        resolved.push({ ...effect, featureName: feature.name, source: feature.source });
        continue;
      }

      const amount = effect.bonus && resolveBonusAmount(effect.bonus, options.bonusContext ?? {});
      if (typeof amount !== 'number') continue;
      resolved.push({ ...effect, amount, featureName: feature.name, source: feature.source });
    }
  }

  return resolved;
}

/* -------------------------------------------------------------------------- *
 * Reading them against one roll
 * -------------------------------------------------------------------------- */

function matchesScope(scope: RollScope, target: RollTarget): boolean {
  if (!scope.rolls.includes(target.kind)) return false;
  if (scope.requiresProficiency && !target.proficient) return false;
  if (scope.excludesProficiency && target.proficient) return false;
  if (scope.skills?.length) {
    return target.skill ? scope.skills.includes(target.skill) : false;
  }
  if (scope.abilities?.length) {
    return target.ability ? scope.abilities.includes(target.ability) : false;
  }
  return true;
}

/** Which of the character's effects cover one roll. */
export function effectsForRoll(
  effects: readonly ResolvedRollEffect[],
  target: RollTarget,
): ResolvedRollEffect[] {
  return effects.filter((effect) => matchesScope(effect.scope, target));
}

export interface AppliedRollEffects {
  advantage: boolean;
  disadvantage: boolean;
  /** The highest floor that covers the roll; a d20 below it counts as it. */
  floor?: number;
  /** What the covering features add to the roll, on top of the row's own modifier. */
  bonus?: number;
  /** Every effect that applied, for the roll's own detail line. */
  applied: readonly ResolvedRollEffect[];
}

/**
 * What a roll carries once its features are read. Advantage and disadvantage are reported as the
 * books state them, both at once where both apply — 5e cancels them, which `rollD20` does, because
 * that is the dice rule rather than a fact about the features.
 */
export function applyRollEffects(
  effects: readonly ResolvedRollEffect[],
  target: RollTarget,
): AppliedRollEffects {
  const applied = effectsForRoll(effects, target);
  const floors = applied.flatMap((effect) =>
    effect.kind === 'floor' && typeof effect.value === 'number' ? [effect.value] : []);
  const bonus = applied.reduce(
    (total, effect) => (effect.kind === 'bonus' ? total + (effect.amount ?? 0) : total),
    0,
  );

  return {
    advantage: applied.some((effect) => effect.kind === 'advantage'),
    disadvantage: applied.some((effect) => effect.kind === 'disadvantage'),
    floor: floors.length > 0 ? Math.max(...floors) : undefined,
    bonus: bonus !== 0 ? bonus : undefined,
    applied,
  };
}

/** The line the tray prints under a roll that a feature changed: what applied, and on what terms. */
export function describeRollEffects(applied: readonly ResolvedRollEffect[]): string | undefined {
  if (applied.length === 0) return undefined;
  return applied
    .map((effect) => (effect.condition ? `${effect.featureName} (${effect.condition})` : effect.featureName))
    .join(', ');
}
