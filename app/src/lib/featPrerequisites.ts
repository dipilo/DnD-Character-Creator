/** The source's own `text` is read alongside the structured fields, never instead. */
import type { AbilityScores, Feat, Species, SpeciesVariant } from '@/types/dnd';

export interface FeatPrerequisiteContext {
  /** Scores as the character will have them, bonuses already applied. */
  abilityScores: AbilityScores;
  totalLevel: number;
  classNames: string[];
  /** Features the character already has, by name — what "Fighting Style feature" is checked against. */
  featureNames: string[];
  /** Feats already taken, by name, including the one the background granted. */
  featNames: string[];
  species?: Species;
  variant?: SpeciesVariant;
  hasSpellcasting: boolean;
  hasPactMagic: boolean;
}

export interface FeatPrerequisiteResult {
  met: boolean;
  /** One line per requirement the character does not meet. Empty when they meet all of them. */
  unmet: string[];
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const SMALL_WORDS = new Set(['a', 'an', 'and', 'from', 'in', 'of', 'or', 'the', 'to', 'with']);

/** A pointer is stored as the book's name folded to lower case; this is how it is printed back. */
export const formatContentName = (value: string) => value
  .split(' ')
  .map((word, index) => (index > 0 && SMALL_WORDS.has(word)
    ? word
    : word.replace(/[a-z]/, (letter) => letter.toUpperCase())))
  .join(' ');
const normalize = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();

/** Either side may contain the other: the book says "Elf", the species may be "High Elf". */
const lineageMatches = (required: string, candidate: string | undefined) => {
  if (!candidate) return false;
  const left = normalize(required);
  const right = normalize(candidate);
  return left === right || right.includes(left) || left.includes(right);
};

const meetsRaceRequirement = (
  required: string[],
  text: string | undefined,
  context: FeatPrerequisiteContext,
) => {
  const names = [context.species?.name, context.variant?.name];
  if (required.some((entry) => names.some((name) => lineageMatches(entry, name)))) {
    return true;
  }

  // Squat Nimbleness prints "Dwarf or a Small race" and only the dwarf half survives extraction,
  // so the size half is read back off the line the source actually stated.
  const size = context.variant?.sizeOptions?.[0] ?? context.species?.size;
  return /small race/i.test(text ?? '') && size === 'Small';
};

const describeRaceRequirement = (required: string[], text: string | undefined) =>
  text?.trim() ? `Requires ${text.trim()}` : `Requires ${required.map((entry) => capitalize(entry)).join(' or ')}`;

/** Which magic feature the line asks for, reading the flags and the printed text together. */
function checkMagicRequirement(feat: Feat, context: FeatPrerequisiteContext): string | null {
  const prerequisites = feat.prerequisites;
  const text = prerequisites?.text ?? '';
  const needsSpellcasting = Boolean(prerequisites?.spellcasting) || /spellcasting/i.test(text);
  const needsPactMagic = Boolean(prerequisites?.pactMagic) || /pact magic/i.test(text);
  if (!needsSpellcasting && !needsPactMagic) {
    return null;
  }

  const eitherWillDo = needsSpellcasting && needsPactMagic && /\bor\b/i.test(text);
  if (eitherWillDo) {
    return context.hasSpellcasting || context.hasPactMagic
      ? null
      : 'Requires a Spellcasting or Pact Magic feature';
  }

  if (needsSpellcasting && !context.hasSpellcasting) {
    return 'Requires a Spellcasting feature';
  }

  if (needsPactMagic && !context.hasPactMagic) {
    return 'Requires a Pact Magic feature';
  }

  return null;
}

const describeAbilityMinimums = (block: Partial<Record<keyof AbilityScores, number>>) =>
  Object.entries(block).map(([ability, minimum]) => `${capitalize(ability)} ${minimum}`).join(' and ');

/** Any one block satisfies the line, so the report names them all rather than the nearest miss. */
function checkAbilityAlternatives(
  alternatives: Partial<Record<keyof AbilityScores, number>>[],
  context: FeatPrerequisiteContext,
): string | null {
  const holds = alternatives.some((block) => Object.entries(block).every(([ability, minimum]) =>
    context.abilityScores[ability as keyof AbilityScores] >= (minimum ?? 0)));
  return holds ? null : `Requires ${alternatives.map(describeAbilityMinimums).join(' or ')}`;
}

export function evaluateFeatPrerequisites(feat: Feat, context: FeatPrerequisiteContext): FeatPrerequisiteResult {
  const prerequisites = feat.prerequisites;
  if (!prerequisites) {
    return { met: true, unmet: [] };
  }

  const unmet: string[] = [];

  Object.entries(prerequisites.ability ?? {}).forEach(([ability, minimum]) => {
    const score = context.abilityScores[ability as keyof AbilityScores];
    if (typeof minimum === 'number' && score < minimum) {
      unmet.push(`Requires ${capitalize(ability)} ${minimum} (you have ${score})`);
    }
  });

  if (prerequisites.abilityAlternatives?.length) {
    const alternatives = checkAbilityAlternatives(prerequisites.abilityAlternatives, context);
    if (alternatives) {
      unmet.push(alternatives);
    }
  }

  if (prerequisites.level && context.totalLevel < prerequisites.level) {
    unmet.push(`Requires level ${prerequisites.level} (you are level ${context.totalLevel})`);
  }

  if (prerequisites.race?.length && !meetsRaceRequirement(prerequisites.race, prerequisites.text, context)) {
    unmet.push(describeRaceRequirement(prerequisites.race, prerequisites.text));
  }

  if (prerequisites.class?.length) {
    const holds = prerequisites.class.some((required) =>
      context.classNames.some((name) => lineageMatches(required, name)));
    if (!holds) {
      unmet.push(`Requires ${prerequisites.class.map((entry) => capitalize(entry)).join(' or ')}`);
    }
  }

  // "Fighting Style feature" gates the 2024 Fighting Style feats, which every class without the
  // feature would otherwise be offered.
  prerequisites.features?.forEach((required) => {
    if (!context.featureNames.some((name) => lineageMatches(required, name))) {
      unmet.push(`Requires a ${required} feature`);
    }
  });

  // A feat that builds on another: the pointer is a name, because a stored id goes stale.
  prerequisites.feats?.forEach((required) => {
    if (!context.featNames.some((name) => lineageMatches(required, name))) {
      unmet.push(`Requires the ${formatContentName(required)} feat`);
    }
  });

  const magic = checkMagicRequirement(feat, context);
  if (magic) {
    unmet.push(magic);
  }

  return { met: unmet.length === 0, unmet };
}
