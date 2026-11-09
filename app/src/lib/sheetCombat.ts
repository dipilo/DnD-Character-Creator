// Timings and defences from the features held; nothing here names a class or feat.
import { featureTableDie, type FeatureContext } from '@/lib/featureFacets';
import type { AbilityScores, Feature } from '@/types/dnd';
import {
  abilityModifier,
  baseUnarmedStrike,
  damageLine,
  formatModifier,
  type AlternateDamage,
  type DerivedAttack
} from '@/lib/sheetMath';

export type ActionTiming = 'action' | 'bonus-action' | 'reaction';

// Ordered: a feature that names a Reaction and an Action in one paragraph is offered under the
// narrower one, because that is the sentence the player is looking for.
const TIMING_PATTERNS: Array<{ timing: ActionTiming; pattern: RegExp }> = [
  { timing: 'reaction', pattern: /\b(?:as|using|take) (?:a|your) reaction\b/i },
  { timing: 'bonus-action', pattern: /\bas a bonus action\b/i },
  { timing: 'action', pattern: /\bas (?:an|a) (?:action|magic action|attack action)\b/i }
];

/** When a feature's own text says it is used, or null when it never says. */
export function detectActionTiming(text: string): ActionTiming | null {
  return TIMING_PATTERNS.find((entry) => entry.pattern.test(text))?.timing ?? null;
}

const ATTACK_COUNT_WORDS: Record<string, number> = {
  twice: 2,
  'three times': 3,
  'four times': 4,
  'five times': 5
};

const EXTRA_ATTACK_PATTERN = /\battack (twice|three times|four times|five times)\b/gi;
/** Ungreedy sibling: `test` on the global one moves its `lastIndex` under the `matchAll` above. */
const EXTRA_ATTACK_SENTENCE = /\battack (?:twice|three times|four times|five times)\b/i;
const ATTACK_ACTION_PATTERN = /\bAttack action\b/i;

export interface AttacksPerAction {
  count: number;
  /** The feature whose sentence stated it. Absent at one attack, which no feature grants. */
  source?: string;
  /** That sentence, so the number can say where it came from rather than just being a number. */
  detail?: string;
}

/** The highest a feature states wins, since later grants restate the sentence. */
export function deriveAttacksPerAction(features: readonly Feature[]): AttacksPerAction {
  let best: AttacksPerAction = { count: 1 };
  for (const feature of features) {
    if (!ATTACK_ACTION_PATTERN.test(feature.description)) continue;
    for (const match of feature.description.matchAll(EXTRA_ATTACK_PATTERN)) {
      const count = ATTACK_COUNT_WORDS[match[1].toLowerCase()] ?? 1;
      if (count <= best.count) continue;
      best = {
        count,
        source: feature.name,
        detail: toSentences(feature.description).find((sentence) => EXTRA_ATTACK_SENTENCE.test(sentence))
      };
    }
  }
  return best;
}

const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning', 'necrotic',
  'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder'
];

const CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled', 'incapacitated',
  'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'
];

export type DefenceKind = 'resistance' | 'immunity' | 'vulnerability' | 'condition-immunity';

export const DEFENCE_KIND_LABELS: Record<DefenceKind, string> = {
  resistance: 'Resistances',
  immunity: 'Immunities',
  vulnerability: 'Vulnerabilities',
  'condition-immunity': 'Condition Immunities'
};

export interface DerivedDefence {
  kind: DefenceKind;
  /** Damage types, or condition names for a condition immunity. */
  names: string[];
  /** The feature that grants it, so a conditional one can be read against its own text. */
  source: string;
  /** True when the sentence ties it to a state — "while raging", "while active". */
  conditional: boolean;
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const toSentences = (text: string) =>
  text.split(/(?<=[.!?])\s+/).map((entry) => entry.trim()).filter(Boolean);

/** Which of the listed words a sentence names, in the order the list states them. */
const namesIn = (sentence: string, vocabulary: string[]) => {
  const lowered = sentence.toLowerCase();
  return vocabulary.filter((name) => new RegExp(`\\b${name}\\b`).test(lowered)).map(titleCase);
};

const DEFENCE_PATTERNS: Array<{ kind: DefenceKind; pattern: RegExp; vocabulary: string[] }> = [
  { kind: 'resistance', pattern: /\bresistance to\b/i, vocabulary: DAMAGE_TYPES },
  { kind: 'vulnerability', pattern: /\bvulnerability to\b/i, vocabulary: DAMAGE_TYPES },
  { kind: 'immunity', pattern: /\bimmunity to\b|\bimmune to\b/i, vocabulary: DAMAGE_TYPES },
  { kind: 'condition-immunity', pattern: /\bimmune to\b|\bcan(?:'|’)?t be\b|\bcannot be\b/i, vocabulary: CONDITIONS }
];

/** One sentence can state two things, so every pattern tries every sentence. */
export function deriveDefences(features: readonly Feature[]): DerivedDefence[] {
  const defences: DerivedDefence[] = [];

  for (const feature of features) {
    for (const sentence of toSentences(feature.description)) {
      for (const { kind, pattern, vocabulary } of DEFENCE_PATTERNS) {
        if (!pattern.test(sentence)) continue;
        const names = namesIn(sentence, vocabulary);
        if (names.length === 0) continue;
        defences.push({
          kind,
          names,
          source: feature.name,
          conditional: /\bwhile\b|\bwhen you\b|\bduring\b/i.test(sentence)
        });
      }
    }
  }

  return defences;
}

/** Group defences by kind, merging the names each feature contributes. */
export function groupDefences(defences: readonly DerivedDefence[]) {
  const groups = new Map<DefenceKind, DerivedDefence[]>();
  for (const defence of defences) {
    groups.set(defence.kind, [...(groups.get(defence.kind) ?? []), defence]);
  }
  return groups;
}

export { formatModifier };

const SENSE_NAMES = ['darkvision', 'blindsight', 'tremorsense', 'truesight'] as const;

export type SenseName = (typeof SENSE_NAMES)[number];

export interface DerivedSense {
  sense: SenseName;
  /** Feet, from the sentence that names the sense. */
  range: number;
  /** The feature that granted it. */
  source: string;
}

const FEET_PATTERN = /(\d+)[\s-]*f(?:ee|oo)t\b/i;

/** The first distance stated in the sentence, which is the range the sense reaches. */
const feetIn = (text: string): number | null => {
  const match = FEET_PATTERN.exec(text);
  return match ? Number.parseInt(match[1], 10) : null;
};

/** Looked for in the name as well as the text; no distance grants nothing. */
export function deriveSenses(features: readonly Feature[]): DerivedSense[] {
  const best = new Map<SenseName, DerivedSense>();

  for (const feature of features) {
    const sentences = toSentences(feature.description);
    for (const sense of SENSE_NAMES) {
      const pattern = new RegExp(`\\b${sense}\\b`, 'i');
      const namedByTitle = pattern.test(feature.name);
      const stated = sentences.find((sentence) => pattern.test(sentence));
      if (!namedByTitle && !stated) continue;

      // A titled trait states its range in its body; a sentence states it in itself.
      const range = feetIn(stated ?? '') ?? (namedByTitle ? feetIn(feature.description) : null);
      if (range === null) continue;

      const current = best.get(sense);
      if (!current || range > current.range) {
        best.set(sense, { sense, range, source: feature.name });
      }
    }
  }

  return SENSE_NAMES.map((sense) => best.get(sense)).filter((entry): entry is DerivedSense => Boolean(entry));
}

const titleCaseSense = (sense: SenseName) => sense.charAt(0).toUpperCase() + sense.slice(1);

export const senseLabel = (entry: DerivedSense) => titleCaseSense(entry.sense);

const UNARMED_STRIKE_PATTERN = /\bunarmed strikes?\b/i;
const DIE_PATTERN = /\b(\d*d(?:4|6|8|10|12))\b/i;

// Both wordings for "use this line rather than the bare one": a species trait swaps the damage
// type, the Monk's Martial Arts swaps only the die.
const REPLACES_UNARMED_DAMAGE =
  /\binstead of (?:the )?bludgeoning\b|\bin place of the normal damage\b/i;

// The Monk's option, in both printings' wordings. Conditional on being unarmoured, which the row's
// notes carry: the sheet cannot see what the character is wearing.
const DEXTERITY_FOR_STRENGTH =
  /\buse (?:your )?dexterity (?:modifier )?instead of (?:your )?strength\b/i;

const ABILITY_NAMED = /\byour (strength|dexterity) modifier\b/i;

// Where the clause turns to the damage it is there to rule out: everything after it names the
// bludgeoning an unarmed strike would otherwise deal, so reading the whole sentence for a type
// gave a Tortle bludgeoning claws.
const REPLACED_DAMAGE_CLAUSE = /\binstead of\b|\bin place of\b/i;

/** "1d10" where the class table states one for the level held, the sentence's own die otherwise. */
const scaledDie = (die: string, featureName: string, context: FeatureContext) =>
  featureTableDie(featureName, context) ?? (die.startsWith('d') ? `1${die}` : die);

/** What the character's own features say about punching, gated on each naming an unarmed strike. */
function readUnarmedFeatures(
  features: readonly Feature[],
  abilityScores: AbilityScores,
  ability: keyof AbilityScores,
  context: FeatureContext
) {
  const alternates: AlternateDamage[] = [];
  const dexteritySources: string[] = [];

  for (const feature of features) {
    if (!UNARMED_STRIKE_PATTERN.test(feature.description)) continue;

    for (const sentence of toSentences(feature.description)) {
      if (DEXTERITY_FOR_STRENGTH.test(sentence)) dexteritySources.push(feature.name);
      if (!REPLACES_UNARMED_DAMAGE.test(sentence)) continue;

      const die = DIE_PATTERN.exec(sentence);
      if (!die) continue;

      const granted = sentence.split(REPLACED_DAMAGE_CLAUSE)[0];
      // A clause naming no type replaces the die alone, so the strike stays bludgeoning.
      const [damageType = 'bludgeoning'] = namesIn(granted, DAMAGE_TYPES).map((name) => name.toLowerCase());
      const named = ABILITY_NAMED.exec(sentence)?.[1]?.toLowerCase() as keyof AbilityScores | undefined;
      const modifier = abilityModifier(abilityScores[named ?? ability]);
      const notation = scaledDie(die[1].toLowerCase(), feature.name, context);
      alternates.push({
        notation: damageLine(notation, modifier, undefined),
        damage: damageLine(notation, modifier, damageType),
        source: feature.name
      });
    }
  }

  return { alternates, dexteritySources };
}

export interface UnarmedStrikeOptions {
  /** The level-gated feature list, exactly as the rest of the sheet reads it. */
  features?: readonly Feature[];
  featureContext?: FeatureContext;
}

/**
 * Nobody equips their fists, so the sheet derives the row — and a trait that says it replaces an
 * unarmed strike's damage is offered beside the bare line rather than overwriting it, because the
 * terms it states ("while unarmed and not wearing armor") are not something the sheet can check.
 */
export function deriveUnarmedStrike(
  abilityScores: AbilityScores,
  proficiencyBonus: number,
  { features = [], featureContext = {} }: UnarmedStrikeOptions = {}
): DerivedAttack {
  const base = baseUnarmedStrike(abilityScores, proficiencyBonus);
  const { alternates, dexteritySources } = readUnarmedFeatures(
    features,
    abilityScores,
    base.ability,
    featureContext
  );

  // The option is always the player's and always "whichever is better", the way finesse is.
  const dexterity = abilityModifier(abilityScores.dexterity);
  const strength = abilityModifier(abilityScores.strength);
  const usesDexterity = dexteritySources.length > 0 && dexterity > strength;
  const ability = usesDexterity ? 'dexterity' : base.ability;
  const modifier = abilityModifier(abilityScores[ability]);

  // Re-read with the chosen ability: a Monk's Martial Arts die rides the same modifier the to-hit
  // does, and reading it before the ability was settled would print the Strength line.
  const scaled = usesDexterity
    ? readUnarmedFeatures(features, abilityScores, ability, featureContext).alternates
    : alternates;

  return {
    ...base,
    attackBonus: modifier + proficiencyBonus,
    damage: damageLine(`${1 + modifier}`, 0, 'bludgeoning'),
    ability,
    alternateDamages: scaled,
    properties: usesDexterity ? [`Dexterity (${dexteritySources.join(', ')})`] : base.properties
  };
}
