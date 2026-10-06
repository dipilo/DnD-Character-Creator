/**
 * Expertise, read from the feature's own sentences.
 *
 * Both printings say the same thing four ways — 2014 doubles the proficiency bonus, 2024 names a
 * glossary term — and three features double the bonus without granting Expertise at all: the 2014
 * Ranger's favoured terrain, Draconic Ancestry's dragons and the Dwarf's stonework. A feature that
 * states a condition grants nothing here, exactly as a feature stating no timing lands in no
 * action group.
 */
import type { Feature } from '@/types/dnd';

/** A single grant, which a character resolves into picks. */
export interface ExpertiseGrant {
  /** Stable within the feature, so a stored pick survives a re-read: `<featureId>::<index>`. */
  id: string;
  /** How many proficiencies this grant covers. */
  count: number;
  /** The class level at which it lands, from the clause that states it. */
  level: number;
  /** Whether the feature lets one pick be a tool ("or your proficiency with thieves' tools"). */
  allowsTools: boolean;
  /**
   * The skills the feature names, where it names any. A grant with a list is chosen from that
   * list; one without is chosen from the character's own skill proficiencies.
   */
  optionSkills?: readonly string[];
  /** Named outright rather than chosen — the Scout's Nature and Survival. */
  fixed?: readonly string[];
  /** The feature's own words, for the selector's helper line. */
  detail: string;
}

/** A grant placed against the character who holds it. */
export interface ResolvedExpertiseGrant {
  grant: ExpertiseGrant;
  /** The feature that states it, for the selector's heading. */
  featureName: string;
  /** The class, subclass or species the feature came from. */
  sourceName: string;
  /** The id of the class whose page resolves this grant. */
  sourceClassId: string;
  /** What the player picked, filtered to what they are still proficient in. */
  selected: readonly string[];
  /** Picks still to make. A fixed grant has none. */
  outstanding: number;
  /** What may still be picked: proficiencies held, less those already doubled. */
  options: readonly string[];
}

/** A feature the character holds, with the level they hold in whatever granted it. */
export interface ExpertiseSource {
  feature: Pick<Feature, 'id' | 'name' | 'description' | 'level'>;
  /** The level in the class the feature came from; a species trait is held at 1. */
  heldLevel: number;
  sourceName: string;
  /** The id of the class the feature came from, which is what a builder link needs. */
  sourceClassId: string;
}

/** What the character may spend a pick on. Tools are offered only where the feature says so. */
export interface ExpertiseProficiencies {
  skills: readonly string[];
  tools: readonly string[];
}

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  one: 1,
  a: 1,
  an: 1,
  another: 2,
  two: 2,
  three: 3,
  four: 4,
};

/**
 * A clause that limits the doubling to some checks is not Expertise. The books write the limit as
 * a "when/while/whenever … related to" clause next to the doubling, never as a bare sentence.
 */
const CONDITIONAL_PATTERNS: readonly RegExp[] = [
  /\b(?:when|whenever|while)\b[^.]*\b(?:proficiency bonus is doubled|double your proficiency bonus|add double)/i,
  /\bproficiency bonus is doubled\b[^.]*\b(?:if you are using|if it applies|related to)\b/i,
  /\bfavou?red terrain\b/i,
];

/** The 2024 wording, which names the glossary term, and the 2014 one, which states the maths. */
const GRANTS_EXPERTISE = /\bgain(?:s)? expertise\b|\byou have expertise\b|\bproficiency bonus is (?:now )?doubled\b/i;

/**
 * "choose two of your skill proficiencies", "gain Expertise (see the rules glossary) in two of
 * your skill proficiencies". The 2014 Rogue's second grant writes "two more of your proficiencies
 * (in skills or with thieves' tools)", so the word "skill" is not always on the noun — the
 * sentence has to name skills somewhere, which is what keeps a tool-only grant out.
 */
const OPEN_CHOICE = /(?:choose|gain(?:s)? expertise(?:\s*\([^)]*\))?\s+in)\s+(one|two|three|four|another)\b[^.]*?\b(?:skill )?proficiencies?\b/gi;

const MENTIONS_SKILL = /\bskills?\b/i;

/** "At 10th level", "At Bard level 9", "At Rogue level 6" — the level a later grant lands on. */
const LEVEL_CLAUSE = /\bat\s+(?:[a-z]+\s+)?level\s+(\d{1,2})\b|\bat\s+(\d{1,2})(?:st|nd|rd|th)\s+level\b/i;

/** "Choose one of the following skills in which you have proficiency: Arcana, History, …" */
const LISTED_OPTIONS = /\bfollowing skills?\b[^:]*:\s*([^.]+)\./i;

/** "you gain proficiency in the Nature and Survival skills" — a grant that names its skills. */
const NAMED_SKILLS = /\bproficiency in the\s+([A-Z][A-Za-z]+(?:\s+and\s+[A-Z][A-Za-z]+)*)\s+skills?\b/;

const TOOL_MENTION = /\btools?\b/i;

/** Sentences, kept whole: a level clause belongs to the grant stated in its own sentence. */
function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function parseCount(word: string): number {
  return NUMBER_WORDS[word.toLowerCase()] ?? 1;
}

/**
 * "another two" and "two more" are the same grant restated at a later level, so the count comes
 * from the number beside the word rather than from the word itself.
 */
function countFrom(sentence: string, word: string): number {
  const pair = /\b(?:another|more)\s+(one|two|three|four)\b|\b(one|two|three|four)\s+more\b/i.exec(sentence);
  if (pair) {
    return parseCount(pair[1] ?? pair[2]);
  }

  return parseCount(word);
}

function levelFrom(sentence: string, fallback: number): number {
  const match = LEVEL_CLAUSE.exec(sentence);
  if (!match) {
    return fallback;
  }

  return Number.parseInt(match[1] ?? match[2], 10);
}

function splitSkillList(raw: string): string[] {
  return raw
    .split(/,|\bor\b|\band\b/i)
    .map((entry) => entry.replace(/\.$/, '').trim())
    .filter((entry) => entry.length > 1);
}

/** Whether the doubling the text states is limited to some checks rather than held outright. */
export function isConditionalDoubling(text: string): boolean {
  return CONDITIONAL_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Every Expertise grant a feature states. A feature that only doubles the bonus under a condition
 * returns none, and so does one that never mentions Expertise.
 */
export function deriveExpertiseGrants(feature: Pick<Feature, 'id' | 'name' | 'description' | 'level'>): ExpertiseGrant[] {
  const text = feature.description ?? '';
  if (!text.trim()) {
    return [];
  }

  const namesExpertise = /\bexpertise\b/i.test(`${feature.name} ${text}`);
  if (!namesExpertise && !GRANTS_EXPERTISE.test(text)) {
    return [];
  }
  if (isConditionalDoubling(text)) {
    return [];
  }

  const baseLevel = feature.level ?? 1;
  const grants: ExpertiseGrant[] = [];
  const sentences = sentencesOf(text);

  for (const sentence of sentences) {
    if (!MENTIONS_SKILL.test(sentence)) {
      continue;
    }
    OPEN_CHOICE.lastIndex = 0;
    let match = OPEN_CHOICE.exec(sentence);
    while (match) {
      grants.push({
        id: `${feature.id}::${grants.length}`,
        count: countFrom(sentence, match[1]),
        level: levelFrom(sentence, baseLevel),
        allowsTools: TOOL_MENTION.test(sentence),
        detail: sentence,
      });
      match = OPEN_CHOICE.exec(sentence);
    }
  }

  if (grants.length > 0) {
    return grants;
  }

  // A choice from a list the feature prints: the 2024 Wizard's Scholar.
  const listed = LISTED_OPTIONS.exec(text);
  if (listed && GRANTS_EXPERTISE.test(text)) {
    const options = splitSkillList(listed[1]);
    if (options.length > 0) {
      return [{
        id: `${feature.id}::0`,
        count: 1,
        level: baseLevel,
        allowsTools: false,
        optionSkills: options,
        detail: listed[0].trim(),
      }];
    }
  }

  // Skills the feature names outright: the Scout's Nature and Survival.
  const named = NAMED_SKILLS.exec(text);
  if (named && GRANTS_EXPERTISE.test(text)) {
    const fixed = splitSkillList(named[1]);
    if (fixed.length > 0) {
      return [{
        id: `${feature.id}::0`,
        count: fixed.length,
        level: baseLevel,
        allowsTools: false,
        fixed,
        detail: named[0].trim(),
      }];
    }
  }

  return [];
}

const fold = (value: string) => value.trim().toLowerCase();

/**
 * Every grant the character has reached, with what they picked and what they may still pick.
 *
 * A grant below the level held is left out rather than offered early, and a pick is dropped when
 * the character stops being proficient in it — Expertise doubles a proficiency, so a pick that
 * names one they no longer hold doubles nothing.
 */
export function resolveCharacterExpertise(
  sources: readonly ExpertiseSource[],
  proficiencies: ExpertiseProficiencies,
  selections: Readonly<Record<string, readonly string[]>> | undefined
): ResolvedExpertiseGrant[] {
  const resolved: ResolvedExpertiseGrant[] = [];
  const doubled = new Set<string>();

  for (const source of sources) {
    for (const grant of deriveExpertiseGrants(source.feature)) {
      if (source.heldLevel < grant.level) {
        continue;
      }

      const eligible = grant.allowsTools
        ? [...proficiencies.skills, ...proficiencies.tools]
        : [...proficiencies.skills];
      const held = new Set(eligible.map(fold));

      if (grant.fixed) {
        for (const skill of grant.fixed) doubled.add(fold(skill));
        resolved.push({
          grant,
          featureName: source.feature.name,
          sourceName: source.sourceName,
          sourceClassId: source.sourceClassId,
          selected: grant.fixed,
          outstanding: 0,
          options: []
        });
        continue;
      }

      const stored = selections?.[grant.id] ?? [];
      const selected = stored.filter((pick) => held.has(fold(pick))).slice(0, grant.count);
      for (const pick of selected) doubled.add(fold(pick));

      // "with which you lack Expertise" is the books' own wording, and it is what keeps two
      // grants from spending both picks on the same skill.
      const offered = grant.optionSkills
        ? grant.optionSkills.filter((skill) => held.has(fold(skill)))
        : eligible;
      const options = offered.filter((entry) => !doubled.has(fold(entry)) || selected.some((pick) => fold(pick) === fold(entry)));

      resolved.push({
        grant,
        featureName: source.feature.name,
        sourceName: source.sourceName,
        sourceClassId: source.sourceClassId,
        selected,
        outstanding: Math.max(0, grant.count - selected.length),
        options
      });
    }
  }

  return resolved;
}

/** The proficiencies whose bonus is doubled, folded for comparison against a skill's name. */
export function expertiseProficiencyKeys(resolved: readonly ResolvedExpertiseGrant[]): Set<string> {
  const keys = new Set<string>();
  for (const entry of resolved) {
    for (const pick of entry.selected) keys.add(fold(pick));
  }
  return keys;
}

/** How many picks the character still owes, across every grant they have reached. */
export function countOutstandingExpertise(resolved: readonly ResolvedExpertiseGrant[]): number {
  return resolved.reduce((total, entry) => total + entry.outstanding, 0);
}

/** The shape `resolveCharacterClasses` already hands every sheet and builder screen. */
export interface ExpertiseClassLike {
  cls: { id: string; name: string; features: readonly Feature[] };
  subclass?: { name: string; features: readonly Feature[] } | null;
  /** The level held in this class, which is what a "At Rogue level 6" clause is measured against. */
  level: number;
}

/**
 * Every feature that could state Expertise, with the level it is measured against. A subclass
 * feature is held at its class's level, because that is the level its own clauses count.
 */
export function collectExpertiseSources(classes: readonly ExpertiseClassLike[]): ExpertiseSource[] {
  const sources: ExpertiseSource[] = [];
  for (const entry of classes) {
    for (const feature of entry.cls.features) {
      sources.push({ feature, heldLevel: entry.level, sourceName: entry.cls.name, sourceClassId: entry.cls.id });
    }
    for (const feature of entry.subclass?.features ?? []) {
      sources.push({
        feature,
        heldLevel: entry.level,
        sourceName: entry.subclass?.name ?? entry.cls.name,
        sourceClassId: entry.cls.id
      });
    }
  }
  return sources;
}
