// `additionalSpells` is where 5etools states the spells a species, a background or a feat grants,
// and the picks it leaves open. Nothing about it is prose, so a reader that skips it loses every
// one of them silently. See scripts/README.md.

export const SPELL_SCHOOL_BY_CODE = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
  V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation'
};

const titleCase = (value) => String(value ?? '')
  .split(/\s+/)
  .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
  .join(' ');

// The key an entry sits under states how often it comes back, and the app's own vocabulary for
// that is the three flags on `SpeciesSpell`.
const USAGE_BY_KEY = { will: 'atWill', daily: 'oncePerLongRest', rest: 'oncePerShortRest' };

const ORDINALS = ['Cantrip', '1st-Level', '2nd-Level', '3rd-Level', '4th-Level', '5th-Level', '6th-Level', '7th-Level', '8th-Level', '9th-Level'];

/** "level=0;1|class=Wizard|school=A" — the restriction a `choose` entry states. */
const parseSpellFilter = (filter) => {
  const levels = [];
  const classes = [];
  const schools = [];

  for (const clause of String(filter ?? '').split('|')) {
    const [rawKey, rawValue] = clause.split('=');
    if (!rawValue) continue;
    const values = rawValue.split(';').map((value) => value.trim()).filter(Boolean);

    switch (rawKey.trim().toLowerCase()) {
      case 'level':
        for (const value of values) {
          const [start, end] = value.split('-').map(Number);
          if (!Number.isFinite(start)) continue;
          for (let level = start; level <= (Number.isFinite(end) ? end : start); level += 1) levels.push(level);
        }
        break;
      case 'class':
        classes.push(...values.map(titleCase));
        break;
      case 'school':
        schools.push(...values.map((value) => SPELL_SCHOOL_BY_CODE[value.toUpperCase()] ?? titleCase(value)));
        break;
      default:
        break;
    }
  }

  return { levels: [...new Set(levels)], classes: [...new Set(classes)], schools: [...new Set(schools)] };
};

const choiceLabel = (count, { levels, classes, schools }) => {
  const level = levels.length > 0 ? ORDINALS[levels[0]] ?? `Level ${levels[0]}` : 'Spell';
  const noun = level === 'Cantrip' ? 'cantrip' : `${level.toLowerCase()} spell`;
  const from = [classes.join(' or '), schools.join(' or ')].filter(Boolean).join(' ');
  const plural = count > 1 ? `${count} ${noun}s` : `one ${noun}`;
  return from ? `Choose ${plural} from the ${from} spell list` : `Choose ${plural}`;
};

/**
 * A name reference is "name|source" or "name|source|display name", and a trailing "#c" or "#<n>"
 * states the level the grant is cast at. Leaving the suffix on the name loses the spell: no book
 * states the level of "Thaumaturgy#c".
 */
const readSpellReference = (value) => {
  const [reference, castLevel] = String(value).split('#');
  const [name, , display] = reference.split('|');
  const level = castLevel === undefined ? undefined : (/^c$/i.test(castLevel.trim()) ? 0 : Number(castLevel));
  return {
    name: titleCase(display || name).trim(),
    castLevel: Number.isFinite(level) ? level : undefined
  };
};

const collectLeaves = (value, usage, leaves) => {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const entry of value) leaves.push({ entry, usage });
    return;
  }
  if (typeof value === 'string') {
    leaves.push({ entry: value, usage });
    return;
  }
  if (typeof value !== 'object') return;

  // A `choose` or `all` object is a leaf of its own; anything else keyed is a level or a usage.
  if (value.choose || value.all) {
    leaves.push({ entry: value, usage });
    return;
  }

  for (const [key, nested] of Object.entries(value)) {
    collectLeaves(nested, USAGE_BY_KEY[key] ?? usage, leaves);
  }
};

/**
 * One block's grants, read into the three shapes the app has fields for: a species' own spells,
 * the spells a feat names outright, and the picks it leaves open.
 *
 * @param blocks the entry's `additionalSpells`
 * @param options.idPrefix id stem for the open picks, matching `lib/featBenefits.mjs`
 * @param options.spellLevelByName resolves a referenced spell's own level, across every book
 */
const readNamedLeaf = (entry, kind, usage, out, spellLevelByName) => {
  const { name, castLevel } = readSpellReference(entry);
  if (!name) return;
  if (kind === 'expanded') {
    out.expandedSpellNames.push(name);
    return;
  }

  out.grantedSpellNames.push(name);
  // The level the entry states it is cast at is the grant's level; the spell's own is the fallback.
  const level = castLevel ?? spellLevelByName?.(name);
  if (level === undefined || level === null) {
    out.unresolved.push(name);
    return;
  }
  out.speciesSpells.push({ name, level, ...(usage ? { [usage]: true } : {}) });
};

const readChoiceLeaf = (entry, usage, out, idPrefix) => {
  if (entry.all) {
    // Every spell matching a filter, which no field on a species or a feat can hold.
    out.unresolved.push(`all of ${entry.all}`);
    return;
  }
  if (typeof entry.choose !== 'string') return;

  const filter = parseSpellFilter(entry.choose);
  const count = Number(entry.count ?? 1) || 1;
  const label = choiceLabel(count, filter);
  const level = filter.levels[0] ?? 0;
  out.spellChoices.push({
    id: `${idPrefix}-spell-choice-${out.spellChoices.length}`,
    count,
    level,
    ...(filter.classes.length > 0 ? { classes: filter.classes } : {}),
    ...(filter.schools.length > 0 ? { schools: filter.schools } : {}),
    label
  });
  // A species has no picker of its own, so the open pick rides along as the phrase the static
  // species data uses for one ("Choose Wizard Cantrip").
  out.speciesSpells.push({ name: label, level, ...(usage ? { [usage]: true } : {}) });
};

export const readAdditionalSpells = (blocks, { idPrefix = 'spells', spellLevelByName } = {}) => {
  const out = { speciesSpells: [], grantedSpellNames: [], spellChoices: [], expandedSpellNames: [], unresolved: [] };

  for (const block of blocks ?? []) {
    for (const kind of ['innate', 'known', 'prepared', 'expanded']) {
      const leaves = [];
      collectLeaves(block?.[kind], undefined, leaves);
      for (const { entry, usage } of leaves) {
        if (typeof entry === 'string') {
          readNamedLeaf(entry, kind, usage, out, spellLevelByName);
        } else if (entry && typeof entry === 'object') {
          readChoiceLeaf(entry, usage, out, idPrefix);
        }
      }
    }
  }

  return out;
};
