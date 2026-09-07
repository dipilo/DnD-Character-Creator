/**
 * What a character can actually do in a round, and what they shrug off.
 *
 * Both halves are read out of the features the character already has: a feature says when it is
 * used ("as a Bonus Action", "as a Reaction") and what it protects against ("you have Resistance to
 * Bludgeoning, Piercing, and Slashing damage"), so nothing here names a class, a species or a feat.
 * A feature whose text states neither simply appears in neither list.
 */
import type { AbilityScores, Feature } from '@/types/dnd';
import { abilityModifier, formatModifier, type DerivedAttack } from '@/lib/sheetDerivations';

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

/* -------------------------------------------------------------------------- *
 * Attacks per Action
 * -------------------------------------------------------------------------- */

const ATTACK_COUNT_WORDS: Record<string, number> = {
  twice: 2,
  'three times': 3,
  'four times': 4,
  'five times': 5
};

const EXTRA_ATTACK_PATTERN = /\battack (twice|three times|four times|five times)\b/gi;
const ATTACK_ACTION_PATTERN = /\bAttack action\b/i;

/**
 * How many attacks the Attack action buys this character, read from the features they have.
 *
 * Both printings state it the same way — "you can attack twice, instead of once, whenever you take
 * the Attack action" — and the Fighter's later grants restate the sentence with a bigger number, so
 * the highest a feature states is the answer and a character with no such feature attacks once.
 */
export function deriveAttacksPerAction(features: readonly Feature[]): number {
  let most = 1;
  for (const feature of features) {
    if (!ATTACK_ACTION_PATTERN.test(feature.description)) continue;
    for (const match of feature.description.matchAll(EXTRA_ATTACK_PATTERN)) {
      most = Math.max(most, ATTACK_COUNT_WORDS[match[1].toLowerCase()] ?? 1);
    }
  }
  return most;
}

/* -------------------------------------------------------------------------- *
 * Unarmed Strike
 * -------------------------------------------------------------------------- */

/**
 * The Unarmed Strike every character has. Both printings state the same damage — 1 plus the
 * Strength modifier, bludgeoning — and every character is proficient with it, so it is derived
 * rather than being an item somebody has to remember to add to their equipment.
 */
export function deriveUnarmedStrike(
  abilityScores: AbilityScores,
  proficiencyBonus: number
): DerivedAttack {
  const strength = abilityModifier(abilityScores.strength);
  return {
    name: 'Unarmed Strike',
    kind: 'Melee Weapon Attack',
    attackBonus: strength + proficiencyBonus,
    damage: `${1 + strength} bludgeoning`,
    ability: 'strength',
    proficient: true,
    properties: []
  };
}

/* -------------------------------------------------------------------------- *
 * Defences
 * -------------------------------------------------------------------------- */

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

/**
 * The defences a character's features state. One sentence can state two things — "you have
 * Resistance to Poison damage, and you have Advantage on saving throws against being Poisoned" —
 * so every pattern is tried against every sentence.
 */
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
