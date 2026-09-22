/**
 * A limited-use feature stated in prose, read into the same `ClassResource` shape a class table's
 * column produces.
 *
 * The 2014 tables state only three pools (Rages, Ki Points, Sorcery Points); everything else —
 * Second Wind, Action Surge, Channel Divinity, Wild Shape, Bardic Inspiration — is a sentence:
 * "Once you use this feature, you must finish a short or long rest before you can use it again",
 * "You can use this feature twice", "a number of times equal to your Charisma modifier (a minimum
 * of once)", "Beginning at 6th level, you can use your Channel Divinity twice between rests". Each
 * shape below is one a source prints; a feature whose text states no count, or no rest that
 * returns the uses, is not a pool and gets no tracker.
 *
 * Shared with the table reader in `canonical-content.mjs`, so a column and a sentence cannot
 * disagree about what "you regain all expended uses when you finish a Long Rest" means.
 */

const ABILITY_NAMES = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const MAX_LEVEL = 20;

const COUNT_WORDS = new Map([
  ['once', 1], ['one', 1], ['twice', 2], ['two', 2], ['thrice', 3], ['three', 3], ['four', 4], ['five', 5],
]);

const readCount = (word) => {
  const key = word.toLowerCase().replace(/\s+times?$/, '');
  return COUNT_WORDS.get(key) ?? (/^\d+$/.test(key) ? Number(key) : undefined);
};

// "6th level", "6th-level", "level 6".
const LEVEL = String.raw`(?:(\d+)(?:st|nd|rd|th)[- ]level|level (\d+))`;
const REST = String.raw`(?:a |an )?(short or (?:a )?long|short|long) rest`;
const FEATURE = String.raw`(?:this feature|this ability|this trait|this action|this bonus action|this reaction|the feature|it)`;
const COUNT = String.raw`(once|twice|thrice|three times|four times|five times|\d+ times)`;

// When *all* the uses come back. `resetsOn` is that rest and never a partial: 2024's "one back on
// a Short Rest, all back on a Long Rest" is a long-rest pool with `shortRestRegain: 1`.
const RESET_PATTERNS = [
  /regain(?:s)? (?:all |any )?(?:of (?:its|your) )?(?:expended|spent)[^.]{0,80}?finish (?:a |an )?(short or (?:a )?long|short|long) rest/i,
  /finish (?:a |an )?(short or (?:a )?long|short|long) rest, you regain (?:all |any )?(?:of )?(?:its |your )?(?:expended|spent)/i,
  /(?:is|are) unavailable until you finish (?:a |an )?(short or (?:a )?long|short|long) rest/i,
  /must (?:then )?finish (?:a |an )?(short or (?:a )?long|short|long) rest (?:before you can|to use)/i,
  /can[’']t (?:use (?:it|this \w+(?: \w+)?|the feature)|do so) again until you finish (?:a |an )?(short or (?:a )?long|short|long) rest/i,
];

/** "You regain one expended use when you finish a Short Rest" — a partial, not the full reset. */
const SHORT_REST_PARTIAL = /regain(?:s)? (one|two|three|\d+) (?:of (?:its|your) )?expended[^.]{0,60}?finish (?:a |an )?short rest/i;

/**
 * Which rest returns every use, read from the feature's own prose. Null means the text states no
 * recovery, which is what disqualifies a column or a sentence from being a pool at all.
 */
export const parseResourceReset = (text) => {
  let resetsOn = null;
  for (const pattern of RESET_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    resetsOn = /^short/i.test(match[1]) ? 'short' : 'long';
    break;
  }
  if (!resetsOn) return { resetsOn: null, shortRestRegain: null };

  const partial = resetsOn === 'long' ? SHORT_REST_PARTIAL.exec(text) : null;
  const word = partial?.[1]?.toLowerCase();
  const shortRestRegain = word ? (readCount(word) ?? null) : null;
  return { resetsOn, shortRestRegain };
};

// How many uses the feature has at the level it is gained.
const ABILITY_USES = new RegExp(
  String.raw`a number of times(?: per day)? equal to (?:(\d+) \+ )?your (${ABILITY_NAMES.join('|')}) modifier(?: \((?:a )?minimum of (once|twice|one|two|\d+)\))?`,
  'i'
);
const PROFICIENCY_USES = /a number of times(?: per day)? equal to your proficiency bonus/i;
const FIXED_USES = new RegExp(String.raw`you can use this (?:feature|ability|action|bonus action|reaction) ${COUNT}[.,]`, 'i');
const HELD_USES = /you have (two|three|four) uses of this (?:feature|ability)/i;
const ONCE_PATTERNS = [
  new RegExp(String.raw`once you use this \w+(?: \w+)?, you (?:can[’']t (?:use it|do so) again until you finish|must finish) ${REST}`, 'i'),
  new RegExp(String.raw`you can[’']t use ${FEATURE} again until you finish ${REST}`, 'i'),
  new RegExp(String.raw`must (?:then )?finish ${REST} before you can use ${FEATURE} again`, 'i'),
];
// "You must then finish a short or long rest to use your Channel Divinity again" names the pool.
const NAMED_ONCE = new RegExp(String.raw`must (?:then )?finish ${REST} to use your ([A-Z][\w’']*(?: [A-Z][\w’']*)*) again`, 'i');
// Tasha's: "based on the level you’ve reached in this class: 2nd level, once; 6th level, twice; and
// 18th level, thrice."
const LEVEL_TABLE = /based on the level you[’']ve reached in this class:\s*([^.]+)\./i;
const LEVEL_TABLE_ENTRY = new RegExp(String.raw`${LEVEL}, ${COUNT}`, 'gi');

// More uses at a later level, stated in the same feature.
const ESCALATIONS = [
  new RegExp(String.raw`(?:beginning|starting) (?:at|when you reach) ${LEVEL},? you can use (?:it|this feature|your [a-z’' ]+?) ${COUNT}\b`, 'gi'),
  new RegExp(String.raw`${COUNT}(?: between (?:long |short )?rests| before a (?:long |short )?rest)? (?:starting|beginning) at ${LEVEL}`, 'gi'),
];

const levelOf = (match, first, second) => Number(match[first] ?? match[second]);

const readEscalations = (text) => {
  const steps = [];
  for (const match of text.matchAll(ESCALATIONS[0])) {
    steps.push({ level: levelOf(match, 1, 2), count: readCount(match[3]) });
  }
  for (const match of text.matchAll(ESCALATIONS[1])) {
    steps.push({ level: levelOf(match, 2, 3), count: readCount(match[1]) });
  }
  return steps.filter((step) => Number.isFinite(step.level) && step.count !== undefined);
};

const readLevelTable = (text) => {
  const table = LEVEL_TABLE.exec(text);
  if (!table) return [];
  return [...table[1].matchAll(LEVEL_TABLE_ENTRY)]
    .map((match) => ({ level: levelOf(match, 1, 2), count: readCount(match[3]) }))
    .filter((step) => Number.isFinite(step.level) && step.count !== undefined);
};

const readBaseCount = (text) => {
  const table = readLevelTable(text);
  if (table.length > 0) return { count: table[0].count, table };

  const ability = ABILITY_USES.exec(text);
  if (ability) {
    return {
      usesFromAbility: {
        ability: ability[2].toLowerCase(),
        bonus: ability[1] ? Number(ability[1]) : 0,
        minimum: ability[3] ? (readCount(ability[3]) ?? 1) : 0,
      },
    };
  }
  if (PROFICIENCY_USES.test(text)) return { usesFromProficiencyBonus: true };

  const fixed = FIXED_USES.exec(text) ?? HELD_USES.exec(text);
  if (fixed) return { count: readCount(fixed[1]) };

  const named = NAMED_ONCE.exec(text);
  if (named) return { count: 1, name: named[2] };

  if (ONCE_PATTERNS.some((pattern) => pattern.test(text))) return { count: 1 };
  return null;
};

const perLevelFrom = (fromLevel, steps) => {
  const ordered = [...steps].sort((a, b) => a.level - b.level);
  return Array.from({ length: MAX_LEVEL }, (_, index) => {
    const level = index + 1;
    if (level < fromLevel) return 0;
    let count = 0;
    for (const step of ordered) {
      if (level >= step.level) count = step.count;
    }
    return count;
  });
};

const slug = (value) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replaceAll(/^-+|-+$/g, '');

/**
 * The pool one feature states, or null. `level` is the class level the feature is gained at; below
 * it `perLevel` is 0, which is what keeps a level-1 Cleric from seeing a Channel Divinity tracker.
 */
export const readProseResource = (feature) => {
  const text = feature?.description ?? '';
  const level = Number(feature?.level) || 1;
  const base = readBaseCount(text);
  if (!base) return null;

  const { resetsOn, shortRestRegain } = parseResourceReset(text);
  if (!resetsOn) return null;

  const name = base.name ?? feature.name;
  const resource = {
    id: slug(name),
    name,
    perLevel: [],
    resetsOn,
    shortRestRegain: shortRestRegain ?? undefined,
    featureName: feature.name,
  };

  if (base.usesFromAbility || base.usesFromProficiencyBonus) {
    // The number is the character's, not the class's; the entry only says the pool exists.
    resource.perLevel = perLevelFrom(level, [{ level, count: 1 }]);
    if (base.usesFromAbility) resource.usesFromAbility = base.usesFromAbility;
    if (base.usesFromProficiencyBonus) resource.usesFromProficiencyBonus = true;
    return resource;
  }

  const steps = base.table ?? [{ level, count: base.count }, ...readEscalations(text)];
  resource.perLevel = perLevelFrom(level, steps);
  return resource;
};

// A later feature that changes when an earlier pool comes back: "Beginning when you reach 5th
// level, you regain all of your expended uses of Bardic Inspiration when you finish a short or
// long rest."
const SHORT_REST_UPGRADE = /regain all (?:of )?your expended uses of ([A-Z][\w’']*(?: [A-Z][\w’']*)*) when you finish a short or long rest/i;

const applyShortRestUpgrades = (resources, features) => {
  for (const feature of features) {
    const match = SHORT_REST_UPGRADE.exec(feature.description ?? '');
    if (!match) continue;
    const target = resources.find((resource) => resource.resetsOn === 'long' && resource.name.toLowerCase() === match[1].toLowerCase());
    if (target && target.featureName !== feature.name) {
      target.shortRestFromLevel = Number(feature.level) || 1;
    }
  }
};

/**
 * Every pool a feature list states in prose, added after the ones the table already produced. A
 * feature a column belongs to is the column's — 2024's Second Wind says "You can use this feature
 * twice" and has a column too — so it is skipped here.
 */
export const extractProseResources = (features, tableResources = []) => {
  const claimed = new Set(tableResources.map((resource) => resource.featureName).filter(Boolean));
  const resources = [...tableResources];

  for (const feature of features ?? []) {
    if (!feature?.name || claimed.has(feature.name)) continue;
    const resource = readProseResource(feature);
    if (!resource || resources.some((one) => one.id === resource.id)) continue;
    resources.push(resource);
  }

  applyShortRestUpgrades(resources, features ?? []);
  return resources.length > 0 ? resources : undefined;
};

/** Reads every class and subclass of a content bucket, in place. */
export const applyProseResources = (content) => {
  for (const cls of content?.classes ?? []) {
    cls.resources = extractProseResources(cls.features, cls.resources ?? []);
    for (const subclass of cls.subclasses ?? []) {
      subclass.resources = extractProseResources(subclass.features);
    }
  }
  for (const subclass of content?.subclasses ?? []) {
    subclass.resources = extractProseResources(subclass.features);
  }
  return content;
};
