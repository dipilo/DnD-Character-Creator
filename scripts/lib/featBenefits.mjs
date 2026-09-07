/**
 * What a feat's benefit lines actually grant, read out of the sentences the books print.
 *
 * A feat states its benefits in prose — "Increase your Intelligence, Wisdom, or Charisma score by
 * 1", "You learn the misty step spell and one 1st-level spell of your choice", "you learn one
 * Eldritch Invocation option of your choice from the warlock class". Without structure the builder
 * can only print those sentences, so the ability score is never applied and the two spells are
 * never chosen. Every shape below is one the sources state; nothing is invented for a feat whose
 * text does not say it.
 *
 * Shared by `generate-free-core-sources.mjs` (the SRD packs) and `canonical-content.mjs` (the
 * document imports) so the two cannot drift.
 */

const ABILITY_NAMES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const ABILITY_PATTERN = /strength|dexterity|constitution|intelligence|wisdom|charisma/gi;

const CLASS_NAMES = [
  'artificer', 'barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk',
  'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard'
];

const SCHOOL_NAMES = [
  'abjuration', 'conjuration', 'divination', 'enchantment',
  'evocation', 'illusion', 'necromancy', 'transmutation'
];

const COUNT_WORDS = new Map([
  ['a', 1], ['an', 1], ['one', 1], ['two', 2], ['three', 3], ['four', 4]
]);

const slugify = (value) => String(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
const titleCase = (value) => value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
const readCount = (word) => COUNT_WORDS.get(String(word).toLowerCase()) ?? (Number.parseInt(word, 10) || 1);

/** Sentences, with the abbreviations the rules text actually uses left intact. */
const toSentences = (text) => String(text ?? '')
  .split(/(?<=[.!?])\s+(?=[A-Z“"])/)
  .map((entry) => entry.trim())
  .filter(Boolean);

/* -------------------------------------------------------------------------- *
 * Ability score increases
 * -------------------------------------------------------------------------- */

const readAbilities = (fragment) => {
  const matches = String(fragment).match(ABILITY_PATTERN) ?? [];
  return Array.from(new Set(matches.map((entry) => entry.toLowerCase())));
};

const toIncrease = (abilities, amount, chooseCount) => {
  if (abilities.length === 1 && chooseCount === 1) {
    return { ability: abilities[0], amount };
  }
  return {
    ability: 'choose',
    amount,
    chooseFrom: abilities.length > 0 ? abilities : [...ABILITY_NAMES],
    chooseCount
  };
};

// The abilities named before "by N" are words joined by spaces, commas and "or", so the list
// class is closed rather than open (Sonar S8786).
const NAMED_INCREASE_PATTERN = /increase\s+your\s+((?:[a-z]+[ ,]+){1,8}?)(?:scores?\s+)?by\s+(\d+)/i;

/**
 * One "increase ..." clause. Both printings occur: the named form ("Increase your Strength or
 * Dexterity score by 1") and the open one ("Increase one ability score of your choice by 2").
 */
const parseIncreaseClause = (clause) => {
  const openMatch = /increase\s+(a|an|one|two|three|\d+)\s+ability\s+scores?\s+of\s+your\s+choice\s+by\s+(\d+)/i.exec(clause);
  if (openMatch) {
    return toIncrease([], Number(openMatch[2]), readCount(openMatch[1]));
  }

  // Tasha's Crusher, Piercer and Slasher print "Increase your Strength or Dexterity by 1" with
  // no "score", so the noun is optional or those three lose their increase entirely.
  const namedMatch = NAMED_INCREASE_PATTERN.exec(clause);
  if (namedMatch) {
    const abilities = readAbilities(namedMatch[1]);
    return abilities.length > 0 ? toIncrease(abilities, Number(namedMatch[2]), 1) : null;
  }

  return null;
};

/**
 * The increases a benefit line states.
 *
 * The 2024 Ability Score Improvement feat states two alternatives in one sentence ("Increase one
 * ability score of your choice by 2, or increase two ability scores of your choice by 1"), which
 * is a choice the player makes rather than two grants — so it comes back as `alternatives`.
 */
export const parseFeatAbilityScoreIncreases = (texts) => {
  for (const text of texts) {
    for (const sentence of toSentences(text)) {
      if (!/\bincrease\b/i.test(sentence)) continue;

      const clauses = sentence.split(/,?\s+or\s+(?=increase\b)/i);
      const parsed = clauses.map((clause) => parseIncreaseClause(clause)).filter(Boolean);
      if (parsed.length === 0) continue;

      if (clauses.length > 1 && parsed.length === clauses.length) {
        return { increases: undefined, alternatives: parsed.map((entry) => [entry]) };
      }

      return { increases: [parsed[0]], alternatives: undefined };
    }
  }

  return { increases: undefined, alternatives: undefined };
};

/* -------------------------------------------------------------------------- *
 * Spells
 * -------------------------------------------------------------------------- */

// A spell's name is at most five lowercase words, each followed by a space, so the name class and
// whatever follows it cannot overlap (Sonar S8786).
const SPELL_NAME = String.raw`[a-z][a-z'’/-]*(?:\s[a-z][a-z'’/-]*){0,4}`;

// Ordered: the first one that matches a sentence wins, so "learn the longstrider and pass without
// trace spells" is read as two spells rather than also matching the single-spell shape.
const namedSpellPatterns = [
  // "You also learn the longstrider and pass without trace spells"
  new RegExp(String.raw`\blearns?\sthe\s(${SPELL_NAME})\sand\s(${SPELL_NAME})\s(?:spells|cantrips)\b`, 'i'),
  // "You also learn levitate and dispel magic, each of which you can cast once"
  new RegExp(String.raw`\blearns?\s(${SPELL_NAME})\sand\s(${SPELL_NAME}),\seach of which`, 'i'),
  // "You learn the misty step spell", "You learn the mage hand cantrip"
  new RegExp(String.raw`\blearns?\sthe\s(${SPELL_NAME})\s(?:spell|cantrip)\b`, 'i')
];

/** Spells the line names outright. These are grants, not choices. */
export const parseFeatGrantedSpells = (texts) => {
  const names = new Set();

  for (const text of texts) {
    for (const sentence of toSentences(text)) {
      const pattern = namedSpellPatterns.find((candidate) => candidate.test(sentence));
      if (!pattern) continue;
      const match = pattern.exec(sentence);
      match.slice(1).filter(Boolean).forEach((name) => names.add(titleCase(name.trim())));
    }
  }

  return Array.from(names);
};

const readSpellLevel = (fragment, kind) => {
  if (/cantrip/i.test(kind)) return 0;
  const ordinal = /(\d+)(?:st|nd|rd|th)[- ]level/i.exec(fragment);
  if (ordinal) return Number(ordinal[1]);
  const plain = /level\s+(\d+)/i.exec(fragment);
  return plain ? Number(plain[1]) : 1;
};

const readSpellListClasses = (fragment) => {
  const lowered = String(fragment).toLowerCase();
  const words = new Set(lowered.split(/[^a-z]+/));
  return CLASS_NAMES.filter((name) => words.has(name)).map((name) => titleCase(name));
};

const readSchools = (fragment) => {
  const lowered = String(fragment).toLowerCase();
  if (!/school of magic/.test(lowered)) return [];
  return SCHOOL_NAMES.filter((name) => lowered.includes(name)).map((name) => titleCase(name));
};

// Up to three qualifying words ("1st-level", "druid") before the noun, each one closed by a
// space so the qualifier cannot run into the noun that follows it (Sonar S8786).
const SPELL_QUALIFIER = String.raw`(?:[a-z0-9'’-]+\s){0,3}`;

const spellChoicePatterns = [
  // "two cantrips of your choice from the Cleric, Druid, or Wizard spell list", and the bare
  // "one 1st-level spell of your choice" that follows a named grant in the same sentence.
  new RegExp(String.raw`\b(a|an|one|two|three|\d+)\s(${SPELL_QUALIFIER})(cantrips?|spells?)\sof\syour\schoice\b([^.]*)`, 'gi'),
  // "Choose a level 1 spell from the same list you selected for this feat's cantrips"
  new RegExp(String.raw`\bchoose\s(a|an|one|two|three|\d+)\s(${SPELL_QUALIFIER})(cantrips?|spells?)\sfrom\s([^.]*)`, 'gi')
];

/** A sentence naming two picks joins them with "and you learn", which is two clauses. */
const toSpellClauses = (text) => toSentences(text)
  .flatMap((sentence) => sentence.split(/,?\s+and\s+(?=you\s+learn\b)/i));

/** One match, read into the shape the builder offers a picker for. */
const toSpellChoice = (featId, index, match, schools) => {
  const [whole, countWord, qualifier, kind, trailing] = match;
  const context = `${qualifier} ${trailing ?? ''}`;
  const classes = readSpellListClasses(context);
  return {
    id: `${featId}-spell-choice-${index}`,
    count: readCount(countWord),
    level: readSpellLevel(context, kind),
    classes: classes.length > 0 ? classes : undefined,
    schools: schools.length > 0 ? schools : undefined,
    // "the same list"/"that list" carries the restriction rather than restating it.
    inheritsListFromPreviousChoice: /\b(?:same|that)\slist\b/i.test(context) || undefined,
    label: whole.trim().replace(/\s+/g, ' ')
  };
};

/** Every match of one pattern against one clause. */
const matchAllIn = (pattern, clause) => {
  pattern.lastIndex = 0;
  const matches = [];
  let match = pattern.exec(clause);
  while (match) {
    matches.push(match);
    match = pattern.exec(clause);
  }
  return matches;
};

/**
 * The spells a feat leaves the player to pick, with what the line narrows them to: a level, a
 * class list, or a school. "From the same list" and "from that list" point at the pick before
 * them, which is how Magic Initiate's level 1 spell stays on the list its cantrips came from.
 */
export const parseFeatSpellChoices = (featId, texts) => {
  const choices = [];
  const seen = new Set();

  for (const text of texts) {
    const schools = readSchools(text);
    const matches = toSpellClauses(text)
      .flatMap((clause) => spellChoicePatterns.flatMap((pattern) => matchAllIn(pattern, clause)));

    for (const match of matches) {
      const key = match[0].trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      choices.push(toSpellChoice(featId, choices.length + 1, match, schools));
    }
  }

  // A choice that points at the list before it takes that list, so the picker has candidates.
  choices.forEach((choice, index) => {
    if (!choice.inheritsListFromPreviousChoice || choice.classes) return;
    for (let earlier = index - 1; earlier >= 0; earlier -= 1) {
      if (choices[earlier].classes) {
        choice.classes = choices[earlier].classes;
        return;
      }
    }
  });

  return choices;
};

/* -------------------------------------------------------------------------- *
 * Options borrowed from another class
 * -------------------------------------------------------------------------- */

const classOptionPattern = new RegExp(
  String.raw`\b(\w+)\s((?:[A-Z][A-Za-z]*\s){1,3})options?\sof\syour\schoice\sfrom\sthe\s([a-z]+)\sclass`,
  'g'
);

/**
 * "one Eldritch Invocation option of your choice from the warlock class" — the pool is that
 * class's own feature, so the feat names where to look rather than carrying a copy of the list.
 */
export const parseFeatOptionChoices = (featId, texts) => {
  const choices = [];
  const seen = new Set();

  for (const text of texts) {
    classOptionPattern.lastIndex = 0;
    let match = classOptionPattern.exec(text);
    while (match) {
      const [whole, countWord, featureName, className] = match;
      if (!COUNT_WORDS.has(countWord.toLowerCase()) && !/^\d+$/.test(countWord)) {
        match = classOptionPattern.exec(text);
        continue;
      }
      const key = `${slugify(featureName)}:${className.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        choices.push({
          id: `${featId}-option-choice-${choices.length + 1}`,
          count: readCount(countWord),
          featureName: featureName.trim(),
          className: titleCase(className),
          label: whole.trim().replace(/\s+/g, ' ')
        });
      }
      match = classOptionPattern.exec(text);
    }
  }

  return choices;
};

/* -------------------------------------------------------------------------- *
 * One feat
 * -------------------------------------------------------------------------- */

/**
 * Every structured grant a feat's own text states. `texts` is the feat's description plus each
 * benefit line, because the sources split the same sentence across the two shapes.
 */
export const extractFeatBenefitStructures = (featId, texts) => {
  const lines = texts.map((entry) => String(entry ?? '')).filter(Boolean);
  const { increases, alternatives } = parseFeatAbilityScoreIncreases(lines);
  const grantedSpells = parseFeatGrantedSpells(lines);
  const spellChoices = parseFeatSpellChoices(featId, lines);
  const optionChoices = parseFeatOptionChoices(featId, lines);

  return {
    abilityScoreIncreases: increases,
    abilityScoreIncreaseAlternatives: alternatives,
    grantedSpells: grantedSpells.length > 0 ? grantedSpells : undefined,
    spellChoices: spellChoices.length > 0 ? spellChoices : undefined,
    optionChoices: optionChoices.length > 0 ? optionChoices : undefined
  };
};
