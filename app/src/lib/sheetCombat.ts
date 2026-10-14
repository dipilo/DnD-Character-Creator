// Timings and defences from the features held; nothing here names a class or feat.
import type { Feature } from '@/types/dnd';
import { deriveUnarmedStrike, formatModifier } from '@/lib/sheetMath';

export { deriveUnarmedStrike };

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
const ATTACK_ACTION_PATTERN = /\bAttack action\b/i;

/** The highest a feature states wins, since later grants restate the sentence. */
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
