// 5etools JSON -> canonical content. No network: `--dir` is supplied. See scripts/README.md.

import fs from 'node:fs/promises';
import path from 'node:path';
import { parseBackgroundEquipmentText, skillNames } from './canonical-content.mjs';
import { applyProseResources } from './lib/classResources.mjs';
import { featureDiceFromColumns, resourcesFromColumns } from './lib/classTables.mjs';
import { extractFeatBenefitStructures } from './lib/featBenefits.mjs';
import { expandFiveEToolsVersions, resolveFiveEToolsCopies } from './lib/fiveEToolsCopy.mjs';
import { readAdditionalSpells, SPELL_SCHOOL_BY_CODE } from './lib/fiveEToolsSpells.mjs';

const SIZE_MAP = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
const ABILITY_MAP = { str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' };
const DAMAGE_TYPE_MAP = { S: 'slashing', P: 'piercing', B: 'bludgeoning' };
const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replaceAll(/[^a-z0-9]+/g, '-')
  .replaceAll(/^-+|-+$/g, '');

const toSourcedId = (sourceId, ...parts) => `${sourceId}-${slugify(parts.filter(Boolean).join('-'))}`;

// --- 5etools "entries" markup -> plain text -------------------------------------------------

// Inline tags look like {@tag display|extra|...}; we keep the human-facing portion. For most
// tags that's the first pipe-delimited field, but a few (@link, @5etools) put the label last.
const stripInlineTags = (text) => {
  let previous;
  let current = String(text);
  do {
    previous = current;
    current = current.replace(/\{@(\w+)\s+([^{}]*)\}/g, (_match, tag, body) => {
      const parts = body.split('|');
      if (tag === 'link' || tag === '5etools') {
        return parts[0];
      }
      if (tag === 'dice' || tag === 'damage' || tag === 'scaledice' || tag === 'scaledamage') {
        return parts[0];
      }
      // {@tag name|source|displayText} -> displayText if present, else name.
      return parts.length >= 3 && parts[2] ? parts[2] : parts[0];
    });
  } while (current !== previous && /\{@/.test(current));
  return current;
};

const renderEntries = (entries, depth = 0) => {
  if (entries == null) return '';
  if (typeof entries === 'string') return stripInlineTags(entries);
  if (typeof entries === 'number') return String(entries);
  if (Array.isArray(entries)) {
    return entries.map((entry) => renderEntries(entry, depth)).filter(Boolean).join(' ');
  }
  if (typeof entries !== 'object') return '';

  switch (entries.type) {
    case 'entries':
    case 'inset':
    case 'insetReadaloud':
    case 'section': {
      const name = entries.name ? `${stripInlineTags(entries.name)}. ` : '';
      return `${name}${renderEntries(entries.entries, depth + 1)}`.trim();
    }
    case 'list':
      return (entries.items ?? []).map((item) => renderEntries(item, depth + 1)).filter(Boolean).join(' ');
    case 'item':
    case 'itemSpell':
    case 'itemSub': {
      const name = entries.name ? `${stripInlineTags(entries.name)}: ` : '';
      return `${name}${renderEntries(entries.entry ?? entries.entries, depth + 1)}`.trim();
    }
    case 'table': {
      const caption = entries.caption ? `${stripInlineTags(entries.caption)}: ` : '';
      const rows = (entries.rows ?? [])
        .map((row) => (Array.isArray(row) ? row.map((cell) => renderEntries(cell, depth + 1)).join(' — ') : renderEntries(row, depth + 1)))
        .join('; ');
      return `${caption}${rows}`.trim();
    }
    case 'quote':
      return renderEntries(entries.entries, depth + 1);
    case 'abilityDc':
    case 'abilityAttackMod':
      return '';
    default:
      if (entries.entries) return renderEntries(entries.entries, depth + 1);
      if (entries.entry) return renderEntries(entries.entry, depth + 1);
      return '';
  }
};

const cleanText = (value) => renderEntries(value).replaceAll(/\s+/g, ' ').trim();

// --- source filtering -----------------------------------------------------------------------

const matchesSource = (entry, sourceAbbr, includeOtherSources = false) => {
  if (!sourceAbbr) return true;
  const wanted = sourceAbbr.toLowerCase();
  if (String(entry?.source ?? '').toLowerCase() === wanted) return true;
  // A book that reprints is recorded as `otherSources` on the first printing, so a book whose
  // content 5etools credits elsewhere (Elemental Evil's spells sit under XGE) needs this opt-in.
  if (!includeOtherSources) return false;
  return (entry?.otherSources ?? []).some((other) => String(other?.source ?? '').toLowerCase() === wanted);
};

// --- readers --------------------------------------------------------------------------------

const readJsonSafe = async (filePath) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
};

const collectFromDir = async (dir) => {
  const collected = { spell: [], monster: [], race: [], subrace: [], background: [], feat: [], item: [], baseitem: [], subclass: [], subclassFeature: [], class: [], classFeature: [], classFluff: [], optionalfeature: [], language: [], action: [] };
  const walk = async (current) => {
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith('.json')) {
        const json = await readJsonSafe(full);
        if (!json) continue;
        for (const key of Object.keys(collected)) {
          if (Array.isArray(json[key])) {
            collected[key].push(...json[key]);
          }
        }
      }
    }
  };
  await walk(dir);
  return collected;
};

// --- bucket mappers -------------------------------------------------------------------------

const mapSpell = (spell, ctx) => {
  const components = [];
  if (spell.components?.v) components.push('V');
  if (spell.components?.s) components.push('S');
  if (spell.components?.m) {
    const material = typeof spell.components.m === 'string' ? spell.components.m : spell.components.m?.text;
    components.push(material ? `M (${stripInlineTags(material)})` : 'M');
  }

  const time = spell.time?.[0];
  const range = spell.range;
  const rangeText = range?.distance
    ? `${range.distance.amount ?? ''} ${range.distance.type ?? ''}`.trim()
    : (range?.type ?? '');

  const durationEntry = spell.duration?.[0];
  const concentration = Boolean(durationEntry?.concentration);
  let durationText = durationEntry?.type ?? '';
  if (durationEntry?.duration) {
    durationText = `${durationEntry.duration.amount ?? ''} ${durationEntry.duration.type ?? ''}`.trim();
  }
  if (concentration) durationText = `Concentration, up to ${durationText}`;

  return {
    id: toSourcedId(ctx.sourceId, spell.name),
    name: spell.name,
    level: spell.level ?? 0,
    school: SPELL_SCHOOL_BY_CODE[spell.school] ?? spell.school ?? 'Unknown',
    castingTime: time ? `${time.number ?? 1} ${time.unit ?? 'action'}` : 'Unknown',
    range: rangeText || 'Self',
    components,
    duration: durationText || 'Instantaneous',
    description: cleanText(spell.entries),
    higherLevels: spell.entriesHigherLevel ? cleanText(spell.entriesHigherLevel) : undefined,
    ritual: Boolean(spell.meta?.ritual),
    concentration,
    classes: (spell.classes?.fromClassList ?? []).map((entry) => entry.name),
    source: ctx.label,
    sourceId: ctx.sourceId
  };
};

const mapAbilityIncreases = (abilityBlocks) => {
  const increases = [];
  for (const block of abilityBlocks ?? []) {
    for (const key of abilityKeys) {
      if (typeof block[key] === 'number') {
        increases.push({ ability: ABILITY_MAP[key], amount: block[key] });
      }
    }
    if (block.choose?.from) {
      increases.push({
        ability: 'choose',
        amount: block.choose.amount ?? 1,
        chooseCount: block.choose.count ?? 1,
        chooseFrom: block.choose.from.map((key) => ABILITY_MAP[key]).filter(Boolean)
      });
    }
  }
  return increases;
};

// A named sub-entry is a benefit line with a heading, which is the shape a species trait and a
// feat's benefit share.
const mapNamedSubFeatures = (entries, idPrefix, label) => {
  return (entries ?? [])
    .filter((entry) => entry && typeof entry === 'object' && entry.name && entry.type === 'entries')
    .map((entry, index) => ({
      id: `${idPrefix}-${slugify(entry.name)}-${index}`,
      name: stripInlineTags(entry.name),
      description: cleanText(entry.entries) || stripInlineTags(entry.name),
      level: 1,
      source: label
    }));
};

const mapRaceFeatures = (race, ctx, label) =>
  mapNamedSubFeatures(race.entries, toSourcedId(ctx.sourceId, race.name), label);

// --- what a species or a background grants --------------------------------------------------

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const countWord = (count) => COUNT_WORDS[count] ?? String(count);

// A tool family is picked from, never granted, so the phrase is the one `getToolProficiencyChoice`
// reads ("One type of artisan's tools").
const TOOL_FAMILY_LABELS = {
  anyartisanstool: "artisan's tools",
  anyartisanstools: "artisan's tools",
  anygamingset: 'gaming set',
  anymusicalinstrument: 'musical instrument'
};

const PROFICIENCY_NOUNS = { skill: 'skill', tool: 'tool', weapon: 'weapon', armor: 'armor', language: 'language' };

const proficiencyName = (type, key) => {
  const term = proficiencyTerm(key);
  if (type === 'skill') return titleCaseSkill(term);
  if (type === 'armor') return ARMOR_PROFICIENCY_LABELS[term.toLowerCase()] ?? term;
  if (type === 'weapon') {
    if (/^simple$/i.test(term)) return 'Simple weapons';
    if (/^martial$/i.test(term)) return 'Martial weapons';
  }
  return term.charAt(0).toUpperCase() + term.slice(1);
};

/** "any", "anyArtisansTool" and "choose" are pending choices, so each reads as the phrase the builder offers a selector for. */
const choiceProficiencyLabel = (type, key, count, from) => {
  if (from?.length > 0) return `${countWord(count)} of your choice: ${from.join(', ')}`;
  const family = TOOL_FAMILY_LABELS[String(key).toLowerCase()];
  if (family) return `${countWord(count)} type of ${family}`;
  const noun = PROFICIENCY_NOUNS[type] ?? 'proficiency';
  return `${countWord(count)} ${noun}${count > 1 ? 's' : ''} of your choice`;
};

const readProficiencyEntry = (type, key, value) => {
  if (key === 'choose') {
    const from = (value?.from ?? []).map((entry) => proficiencyName(type, entry));
    return from.length > 0 ? { name: choiceProficiencyLabel(type, key, value?.count ?? 1, from), type } : null;
  }
  if (/^any/i.test(key)) {
    return { name: choiceProficiencyLabel(type, key, Number(value) || 1, null), type };
  }
  return value === true ? { name: proficiencyName(type, key), type } : null;
};

/** One entity's structured proficiency block, its grants and its pending choices alike. */
const readProficiencyBlock = (blocks, type) => (blocks ?? [])
  .filter((block) => block && typeof block === 'object')
  .flatMap((block) => Object.entries(block)
    .map(([key, value]) => readProficiencyEntry(type, key, value))
    .filter(Boolean));

const mapEntityProficiencies = (entity) => [
  ...readProficiencyBlock(entity?.skillProficiencies, 'skill'),
  ...readProficiencyBlock(entity?.toolProficiencies, 'tool'),
  ...readProficiencyBlock(entity?.weaponProficiencies, 'weapon'),
  ...readProficiencyBlock(entity?.armorProficiencies, 'armor')
];

/** A language the entity picks is a slot, so it is written as the phrase the static data uses. */
const mapEntityLanguages = (blocks) => {
  const languages = [];
  // A lineage restates the race's languages beside its own, so a named one is granted once; an
  // open slot is a separate pick every time it is stated.
  const granted = new Set();

  for (const block of blocks ?? []) {
    if (!block || typeof block !== 'object') continue;
    for (const [key, value] of Object.entries(block)) {
      if (/^any/i.test(key)) {
        for (let slot = 0; slot < (Number(value) || 1); slot += 1) languages.push('One of your choice');
        continue;
      }
      if (value !== true) continue;
      const name = proficiencyName('language', key);
      if (granted.has(name)) continue;
      granted.add(name);
      languages.push(name);
    }
  }

  return languages;
};

/** How many languages a background leaves open, which is the only part of the block it states. */
const countLanguageChoices = (blocks) => {
  const count = (blocks ?? []).reduce((total, block) => total + Object.entries(block ?? {})
    .filter(([key]) => /^any/i.test(key))
    .reduce((slots, [, value]) => slots + (Number(value) || 1), 0), 0);
  return count > 0 ? count : undefined;
};

/** `additionalSpells` read into the species shape; an unresolvable name is warned, never guessed. */
const mapEntitySpells = (entity, idPrefix, ctx) => {
  if (!entity?.additionalSpells) return [];
  const { speciesSpells, unresolved } = readAdditionalSpells(entity.additionalSpells, {
    idPrefix,
    spellLevelByName: ctx.spellLevelByName
  });
  for (const name of unresolved) {
    console.warn(`${entity.name}: "${name}" is granted by this entry, but no book in the directory states its level; it is left off.`);
  }
  return speciesSpells;
};

const mapSpeed = (speed) => {
  if (typeof speed === 'number') return speed;
  if (speed && typeof speed === 'object') return speed.walk ?? 30;
  return 30;
};

/** Both printings let some species pick their size, and the data states both letters. */
const mapSizeOptions = (size) => {
  const options = [...new Set((Array.isArray(size) ? size : [size]).map((entry) => SIZE_MAP[entry]).filter(Boolean))];
  return options.length > 1 ? options : undefined;
};

/** A `_versions` lineage already prints the race in its name, so prefixing it again doubles it. */
const lineageName = (race, subrace, index) => {
  const name = subrace.name ? stripInlineTags(subrace.name) : '';
  if (!name) return `${race.name} Variant ${index + 1}`;
  return name.startsWith(race.name) ? name : `${race.name} (${name})`;
};

// The merge below mirrors `Renderer.race._getMergedSubrace` in 5etools; the rules are its, not
// this repo's, so a lineage reads the way the site renders it.
const SUBRACE_CONCAT_KEYS = ['traitTags', 'languageProficiencies'];

/** A subrace entry replaces the race trait its `data.overwrite` names, and otherwise adds to them. */
const mergeSubraceEntries = (raceEntries, subraceEntries) => {
  const merged = [...(raceEntries ?? [])];
  for (const entry of subraceEntries ?? []) {
    const target = entry?.data?.overwrite;
    if (!target) {
      merged.push(entry);
      continue;
    }
    const replaced = merged.findIndex((existing) => stripInlineTags(existing?.name ?? '').toLowerCase().trim() === String(target).toLowerCase().trim());
    if (replaced === -1) merged.push(entry);
    else merged[replaced] = entry;
  }
  return merged;
};

/** An increase the lineage states replaces the race's for that ability, and adds for the rest. */
const mergeSubraceAbility = (raceAbility, subraceAbility, overwrite) => {
  const base = overwrite || !raceAbility ? subraceAbility.map(() => ({})) : raceAbility.map((block) => ({ ...block }));
  if (base.length !== subraceAbility.length) {
    console.warn('subrace ability blocks do not line up with the base race; the lineage states them alone.');
    return subraceAbility.map((block) => ({ ...block }));
  }
  return base.map((block, index) => ({ ...block, ...subraceAbility[index] }));
};

/**
 * A book whose species contribution is a subrace of another book's race (MToF's Eladrin, Eberron's
 * dragonmarks, SCAG's Ghostwise Halfling) states only the lineage, so the base race is folded in
 * here and the lineage ships as a species of its own.
 */
const mergeSubraceOntoRace = (race, subrace, index) => {
  const merged = { ...race };
  delete merged.subraces;
  delete merged._versions;
  delete merged._copy;
  delete merged.reprintedAs;
  delete merged.hasFluff;
  delete merged.hasFluffImages;

  const { name, source, raceName, raceSource, overwrite, entries, ability, ...rest } = subrace;

  if (ability) merged.ability = mergeSubraceAbility(race.ability, ability, Boolean(overwrite?.ability));
  if (entries) merged.entries = mergeSubraceEntries(race.entries, entries);

  for (const key of SUBRACE_CONCAT_KEYS) {
    if (rest[key] === undefined) continue;
    merged[key] = overwrite?.[key] ? rest[key] : [...(race[key] ?? []), ...rest[key]];
    delete rest[key];
  }

  if (rest.skillProficiencies) {
    // A lineage's skills merge into the race's single block rather than adding a second one.
    if (!race.skillProficiencies || overwrite?.skillProficiencies || rest.skillProficiencies.length > 1 || race.skillProficiencies.length > 1) {
      merged.skillProficiencies = rest.skillProficiencies;
    } else {
      merged.skillProficiencies = [{ ...race.skillProficiencies[0], ...rest.skillProficiencies[0] }];
    }
    delete rest.skillProficiencies;
  }

  // Everything the lineage restates it restates in full, `additionalSpells` included: the Zariel
  // tiefling's Legacy of Avernus is not the Tiefling's Infernal Legacy plus two spells.
  Object.assign(merged, rest);

  for (const [key, value] of Object.entries(merged)) {
    if (value === null || value === undefined) delete merged[key];
  }

  merged.name = lineageName(race, subrace, index);
  merged.source = source ?? race.source;
  return merged;
};

const mapRace = (race, subracesByRace, ctx) => {
  const variants = (subracesByRace.get(`${race.name}|${race.source}`) ?? []).map((subrace, index) => {
    const variantId = toSourcedId(ctx.sourceId, race.name, subrace.name ?? `variant-${index + 1}`);
    const spells = mapEntitySpells(subrace, variantId, ctx);
    const proficiencies = mapEntityProficiencies(subrace);
    const sizeOptions = mapSizeOptions(subrace.size);
    return {
      id: variantId,
      name: lineageName(race, subrace, index),
      description: cleanText(subrace.entries) || `${race.name} lineage option.`,
      abilityScoreIncreases: mapAbilityIncreases(subrace.ability),
      features: mapRaceFeatures(subrace, ctx, ctx.label),
      ...(proficiencies.length > 0 ? { proficiencies } : {}),
      ...(spells.length > 0 ? { spells } : {}),
      ...(sizeOptions ? { sizeOptions } : {})
    };
  });

  const raceId = toSourcedId(ctx.sourceId, race.name);
  const proficiencies = mapEntityProficiencies(race);
  const spells = mapEntitySpells(race, raceId, ctx);
  const sizeOptions = mapSizeOptions(race.size);

  return {
    id: raceId,
    name: race.name,
    description: cleanText(race.entries?.filter?.((entry) => typeof entry === 'string')) || `${race.name} from ${ctx.label}.`,
    size: SIZE_MAP[Array.isArray(race.size) ? race.size[0] : race.size] ?? 'Medium',
    ...(sizeOptions ? { sizeOptions } : {}),
    speed: mapSpeed(race.speed),
    abilityScoreIncreases: mapAbilityIncreases(race.ability),
    features: mapRaceFeatures(race, ctx, ctx.label),
    ...(proficiencies.length > 0 ? { proficiencies } : {}),
    ...(spells.length > 0 ? { spells } : {}),
    languages: mapEntityLanguages(race.languageProficiencies),
    variants: variants.length > 0 ? variants : undefined,
    source: ctx.label,
    sourceId: ctx.sourceId
  };
};

/** A background states its proficiencies, its equipment and its feature in a hanging list, so a top-level search finds neither. */
const findNamedEntry = (entries, pattern) => {
  for (const entry of [entries].flat()) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.name && pattern.test(stripInlineTags(entry.name))) return entry;
    const nested = findNamedEntry(entry.items ?? entry.entries ?? entry.entry, pattern);
    if (nested) return nested;
  }
  return undefined;
};

const collectTables = (entries, tables = []) => {
  for (const entry of [entries].flat()) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.type === 'table') tables.push(entry);
    collectTables(entry.items ?? entry.entries ?? entry.entry, tables);
  }
  return tables;
};

/** The suggested characteristics are rolled on a table each, labelled by what it rolls. */
const readCharacteristicTable = (entries, pattern) => {
  const table = collectTables(entries).find((entry) => pattern.test(stripInlineTags(
    [entry.caption, ...(entry.colLabels ?? [])].filter(Boolean).join(' ')
  )));
  if (!table) return [];

  return (table.rows ?? [])
    .map((row) => (Array.isArray(row) ? cleanText(row.at(-1)) : cleanText(row)))
    .filter(Boolean);
};

const mapBackgroundSkills = (blocks) => {
  const granted = [];
  const named = new Set();
  let count = 0;
  let anyCount = 0;

  const readEntry = (key, value) => {
    if (key === 'choose') {
      for (const skill of value?.from ?? []) named.add(titleCaseSkill(proficiencyTerm(skill)));
      count += value?.count ?? 1;
      return;
    }
    if (/^any/i.test(key)) {
      anyCount += Number(value) || 1;
      return;
    }
    if (value === true) granted.push(titleCaseSkill(proficiencyTerm(key)));
  };

  for (const block of blocks ?? []) {
    for (const [key, value] of Object.entries(block ?? {})) readEntry(key, value);
  }

  count += anyCount;
  return {
    skillProficiencies: granted,
    // "any" is the whole list, which the document importer answers the same way.
    skillChoices: anyCount > 0 ? [...skillNames] : [...named],
    skillCount: count
  };
};

/** One slot per group, the alternatives of a choice line under it, exactly as the 2024 packs read. */
const toBackgroundEquipment = (groups) => groups.flatMap((group) => {
  if (group.length === 1) return group;
  return [{
    name: 'Choose 1',
    type: group[0]?.type ?? 'gear',
    alternatives: group.map((option) => (option.contents
      ? { name: [option.name, ...option.contents.map((entry) => entry.name)].join(', '), type: option.type }
      : option))
  }];
});

const mapBackgroundEquipment = (background, itemIndex) => {
  // A background states its groups as the list itself; a class wraps the same list in `defaultData`.
  if (background.startingEquipment) {
    const groups = Array.isArray(background.startingEquipment)
      ? { defaultData: background.startingEquipment }
      : background.startingEquipment;
    return toBackgroundEquipment(mapEquipmentOptions(groups, itemIndex));
  }

  const line = findNamedEntry(background.entries, /^equipment\b/i);
  return line ? parseBackgroundEquipmentText(cleanText(line.entry ?? line.entries)) : [];
};

/** A feat a background grants is a pointer, and the feat itself is in the pack's own bucket. */
const mapGrantedFeatNames = (feats) => [...new Set((feats ?? [])
  .flatMap((block) => Object.entries(block ?? {}).filter(([, held]) => held === true).map(([name]) => name))
  .map((name) => titleCaseWords(proficiencyTerm(name)))
  .filter(Boolean))];

const mapBackground = (background, ctx, itemIndex) => {
  const feature = findNamedEntry(background.entries, /feature/i);
  const { skillProficiencies, skillChoices, skillCount } = mapBackgroundSkills(background.skillProficiencies);
  const toolProficiencies = readProficiencyBlock(background.toolProficiencies, 'tool').map((entry) => entry.name);
  const grantedFeatNames = mapGrantedFeatNames(background.feats);
  const personalityTraits = readCharacteristicTable(background.entries, /personality trait/i);
  const ideals = readCharacteristicTable(background.entries, /\bideal/i);
  const bonds = readCharacteristicTable(background.entries, /\bbond/i);
  const flaws = readCharacteristicTable(background.entries, /\bflaw/i);
  const suggested = [...personalityTraits, ...ideals, ...bonds, ...flaws];

  if (background.additionalSpells) {
    console.warn(`${background.name}: this background states spells of its own, which no background field holds; they reach the character only through the feat it grants.`);
  }

  return {
    id: toSourcedId(ctx.sourceId, background.name),
    name: background.name,
    description: cleanText(background.entries?.filter?.((entry) => typeof entry === 'string')) || `${background.name} background.`,
    skillProficiencies,
    ...(skillCount > 0 ? { skillChoices, skillChoiceCount: skillCount } : {}),
    ...(toolProficiencies.length > 0 ? { toolProficiencies } : {}),
    languageCount: countLanguageChoices(background.languageProficiencies),
    ...(grantedFeatNames.length > 0 ? { grantedFeatNames } : {}),
    equipment: mapBackgroundEquipment(background, itemIndex),
    feature: {
      // A background that grants a feat states no feature of its own, and the feat is the grant.
      name: feature?.name ? stripInlineTags(feature.name) : (grantedFeatNames[0] ?? `${background.name} Feature`),
      description: feature ? cleanText(feature.entries) : cleanText(background.entries)
    },
    personalityTraits,
    ideals,
    bonds,
    flaws,
    ...(suggested.length > 0 ? { suggestedCharacteristics: suggested } : {}),
    source: ctx.label,
    sourceId: ctx.sourceId
  };
};

/** Read alongside `text`, because `evaluateFeatPrerequisites` enforces the structured half. */
const mapFeatPrerequisiteFields = (prerequisites) => {
  const fields = {};

  for (const prereq of prerequisites ?? []) {
    const level = typeof prereq.level === 'object' ? prereq.level.level : prereq.level;
    if (Number(level) > 0) fields.level = Math.max(fields.level ?? 0, Number(level));
    for (const block of prereq.ability ?? []) {
      for (const [key, value] of Object.entries(block)) {
        const ability = ABILITY_MAP[key];
        if (!ability || !Number.isFinite(Number(value))) continue;
        fields.ability = { ...fields.ability, [ability]: Math.max(fields.ability?.[ability] ?? 0, Number(value)) };
      }
    }
    if (prereq.spellcasting || prereq.spellcasting2020) fields.spellcasting = true;
    if (prereq.pact) fields.pactMagic = true;
    if (prereq.race) fields.race = [...(fields.race ?? []), ...prereq.race.map((entry) => stripInlineTags(entry.name ?? ''))].filter(Boolean);
    if (prereq.class) fields.class = [...(fields.class ?? []), ...[prereq.class].flat().map((entry) => stripInlineTags(entry?.name ?? entry ?? ''))].filter(Boolean);
  }

  return fields;
};

/** The sentence the player is shown, which `evaluateFeatPrerequisites` reads alongside the fields. */
const mapFeatPrerequisiteText = (prerequisites) => {
  const parts = [];
  for (const prereq of prerequisites ?? []) {
    if (prereq.level) parts.push(`Level ${prereq.level.level ?? prereq.level}`);
    if (prereq.ability) parts.push(prereq.ability.map((block) => Object.entries(block).map(([key, value]) => `${ABILITY_MAP[key] ?? key} ${value}`).join(', ')).join('; '));
    if (prereq.spellcasting || prereq.spellcasting2020) parts.push('Spellcasting feature');
    if (prereq.other) parts.push(stripInlineTags(prereq.other));
    if (prereq.race) parts.push(prereq.race.map((entry) => entry.name).join(' or '));
  }
  return parts.join('; ');
};

const mapFeat = (feat, ctx) => {
  const prerequisiteText = mapFeatPrerequisiteText(feat.prerequisite);
  const featId = toSourcedId(ctx.sourceId, feat.name);
  const description = cleanText(feat.entries);
  const features = mapNamedSubFeatures(feat.entries, featId, ctx.label);
  // The benefit lines are prose here too, so they go through the same reader the document imports
  // use — a spell the feat grants or leaves open is otherwise silently dropped.
  const parsed = extractFeatBenefitStructures(featId, [description, ...features.map((entry) => entry.description)]);
  const structuredIncreases = mapAbilityIncreases(feat.ability);
  // The spells are structured here, and a feat that names a *list* rather than a spell ("two
  // cantrips from the Lorehold and Prismari lists") states nothing the prose reader can resolve.
  const stated = readAdditionalSpells(feat.additionalSpells, { idPrefix: featId, spellLevelByName: ctx.spellLevelByName });
  const grantedSpells = [...new Set([...(parsed.grantedSpells ?? []), ...stated.grantedSpellNames])];
  const spellChoices = stated.spellChoices.length > 0 ? stated.spellChoices : parsed.spellChoices;
  const prerequisiteFields = mapFeatPrerequisiteFields(feat.prerequisite);

  return {
    id: featId,
    name: feat.name,
    description,
    prerequisites: prerequisiteText ? { ...prerequisiteFields, text: prerequisiteText } : undefined,
    // `ability` is structured here, so it wins; the prose reader only supplies what it has no field
    // for — the alternatives, and the two increases a feat offers as a mode.
    abilityScoreIncreases: structuredIncreases.length > 0 ? structuredIncreases : parsed.abilityScoreIncreases,
    ...(parsed.abilityScoreIncreaseAlternatives ? { abilityScoreIncreaseAlternatives: parsed.abilityScoreIncreaseAlternatives } : {}),
    ...(grantedSpells.length > 0 ? { grantedSpells } : {}),
    ...(spellChoices?.length > 0 ? { spellChoices } : {}),
    ...(parsed.optionChoices ? { optionChoices: parsed.optionChoices } : {}),
    features,
    source: ctx.label,
    sourceId: ctx.sourceId
  };
};

const ITEM_TYPE_TO_BUCKET_TYPE = (item) => {
  const type = (item.type ?? '').split('|')[0];
  if (['M', 'R', 'GS', 'AF'].includes(type) || item.weaponCategory) return 'weapon';
  if (['LA', 'MA', 'HA'].includes(type)) return 'armor';
  if (type === 'S') return 'shield';
  if (['AT', 'T', 'INS', 'GS'].includes(type)) return 'tool';
  if (['P', 'SCF', 'RD', 'WD'].includes(type)) return 'consumable';
  return 'gear';
};

const COST_UNIT_ORDER = [['pp', 1000], ['gp', 100], ['ep', 50], ['sp', 10], ['cp', 1]];
const mapCost = (valueInCp) => {
  if (!valueInCp) return { amount: 0, unit: 'gp' };
  for (const [unit, factor] of COST_UNIT_ORDER) {
    if (valueInCp % factor === 0 && valueInCp >= factor) {
      return { amount: valueInCp / factor, unit };
    }
  }
  return { amount: valueInCp, unit: 'cp' };
};

// The family a "one type of <x>" choice draws from, keyed by the letter the data files it under.
const TOOL_CATEGORY_BY_TYPE = { AT: "Artisan's Tools", INS: 'Musical Instruments', GS: 'Gaming Sets', T: 'Other Tools' };
const GEAR_CATEGORY_BY_FOCUS = { arcane: 'Arcane Foci', druid: 'Druidic Foci', holy: 'Holy Symbols' };

const mapItem = (item, ctx) => {
  const armorCategoryByType = { LA: 'light', MA: 'medium', HA: 'heavy', S: 'shield' };
  const type = (item.type ?? '').split('|')[0];
  return {
    ...(TOOL_CATEGORY_BY_TYPE[type] ? { toolCategory: TOOL_CATEGORY_BY_TYPE[type] } : {}),
    ...(GEAR_CATEGORY_BY_FOCUS[String(item.scfType ?? '').toLowerCase()] ? { gearCategory: GEAR_CATEGORY_BY_FOCUS[String(item.scfType).toLowerCase()] } : {}),
    // The two-handed die the source states, never one inferred from the die it replaces.
    ...(item.dmg2 ? { versatileDamage: item.dmg2 } : {}),
    ...(Number(item.strength) > 0 ? { strengthRequirement: Number(item.strength) } : {}),
    id: toSourcedId(ctx.sourceId, item.name),
    name: item.name,
    type: ITEM_TYPE_TO_BUCKET_TYPE(item),
    source: ctx.label,
    sourceId: ctx.sourceId,
    cost: mapCost(item.value),
    weight: item.weight ?? 0,
    description: item.entries ? cleanText(item.entries) : undefined,
    weaponCategory: item.weaponCategory ? item.weaponCategory.toLowerCase() : undefined,
    weaponType: type === 'R' ? 'ranged' : (item.weaponCategory ? 'melee' : undefined),
    damage: item.dmg1,
    damageType: DAMAGE_TYPE_MAP[item.dmgType] ?? undefined,
    properties: (item.property ?? []).map((prop) => (typeof prop === 'string' ? prop.split('|')[0] : prop)),
    range: item.range ? { normal: Number(String(item.range).split('/')[0]) || 0, long: Number(String(item.range).split('/')[1]) || undefined } : undefined,
    armorCategory: armorCategoryByType[type],
    ac: item.ac,
    stealthDisadvantage: item.stealth || undefined
  };
};

// A damage line is a list of types, or a block of them carrying the note that qualifies them
// ("from nonmagical attacks"), which both printings print as part of the line.
const flattenDamageList = (list, key) => (list ?? []).flatMap((entry) => {
  if (typeof entry === 'string') return [stripInlineTags(entry)];
  if (!entry || typeof entry !== 'object') return [];
  return [...flattenDamageList(entry[key], key), ...(entry.note ? [stripInlineTags(entry.note)] : [])];
});

const mapMonsterSenses = (monster) => {
  const senses = (monster.senses ?? []).map(stripInlineTags);
  const passive = Number.isFinite(Number(monster.passive)) ? `passive Perception ${monster.passive}` : null;
  const line = [...senses, passive].filter(Boolean).join(', ');
  return line ? [line] : undefined;
};

const mapMonster = (monster, ctx) => {
  const abilityScores = Object.fromEntries(abilityKeys.map((key) => [ABILITY_MAP[key], monster[key] ?? 10]));
  const senses = mapMonsterSenses(monster);
  const acEntry = Array.isArray(monster.ac) ? monster.ac[0] : monster.ac;
  const ac = typeof acEntry === 'object' ? (acEntry.ac ?? 10) : (acEntry ?? 10);
  const mapActions = (list, prefix) => (list ?? []).map((entry, index) => ({
    id: toSourcedId(ctx.sourceId, monster.name, prefix, String(index)),
    name: stripInlineTags(entry.name ?? `${prefix} ${index + 1}`),
    description: cleanText(entry.entries)
  }));

  const speedText = typeof monster.speed === 'number'
    ? `${monster.speed} ft.`
    : Object.entries(monster.speed ?? {}).filter(([, value]) => typeof value === 'number' || typeof value?.number === 'number').map(([mode, value]) => `${mode === 'walk' ? '' : mode + ' '}${typeof value === 'object' ? value.number : value} ft.`).join(', ').trim();

  return {
    id: toSourcedId(ctx.sourceId, monster.name),
    name: monster.name,
    description: `${monster.name} from ${ctx.label}.`,
    size: SIZE_MAP[Array.isArray(monster.size) ? monster.size[0] : monster.size] ?? 'Medium',
    type: stripInlineTags(typeof monster.type === 'object' ? monster.type.type : monster.type ?? 'Unknown'),
    alignment: Array.isArray(monster.alignment) ? monster.alignment.join(' ') : (monster.alignment ?? 'Unaligned'),
    ac,
    hp: { average: monster.hp?.average ?? 0, formula: monster.hp?.formula ?? '' },
    speed: speedText || '30 ft.',
    abilityScores,
    challengeRating: typeof monster.cr === 'object' ? (monster.cr.cr ?? '0') : String(monster.cr ?? '0'),
    ...(monster.save ? { savingThrows: Object.entries(monster.save).map(([key, value]) => `${titleCaseWords(key)} ${stripInlineTags(String(value))}`) } : {}),
    ...(monster.skill ? { skills: Object.entries(monster.skill).map(([key, value]) => `${titleCaseSkill(key)} ${stripInlineTags(String(value))}`) } : {}),
    ...(monster.vulnerable ? { damageVulnerabilities: flattenDamageList(monster.vulnerable, 'vulnerable') } : {}),
    ...(monster.resist ? { damageResistances: flattenDamageList(monster.resist, 'resist') } : {}),
    ...(monster.immune ? { damageImmunities: flattenDamageList(monster.immune, 'immune') } : {}),
    ...(monster.conditionImmune ? { conditionImmunities: flattenDamageList(monster.conditionImmune, 'conditionImmune') } : {}),
    ...(senses ? { senses } : {}),
    traits: mapActions(monster.trait, 'trait'),
    actions: mapActions(monster.action, 'action'),
    bonusActions: mapActions(monster.bonus, 'bonus'),
    reactions: mapActions(monster.reaction, 'reaction'),
    legendaryActions: mapActions(monster.legendary, 'legendary'),
    languages: monster.languages ?? undefined,
    source: ctx.label,
    sourceId: ctx.sourceId
  };
};

const mapSubclasses = (subclasses, subclassFeatures, optionIndex, ctx) => {
  const featuresByKey = new Map();
  for (const feature of subclassFeatures) {
    const key = `${feature.subclassShortName}|${feature.className}|${feature.subclassSource ?? feature.source}`;
    if (!featuresByKey.has(key)) featuresByKey.set(key, []);
    featuresByKey.get(key).push(feature);
  }

  // A legacy subclass is listed once per printing of its class (`classSource` PHB and XPHB), and
  // both entries resolve to the same features, so they are one subclass here.
  const byIdentity = new Map();
  for (const subclass of subclasses) {
    const identity = `${subclass.shortName}|${subclass.className}|${subclass.source}`;
    const incumbent = byIdentity.get(identity);
    if (!incumbent || (subclass.subclassFeatures ?? []).length > (incumbent.subclassFeatures ?? []).length) {
      byIdentity.set(identity, subclass);
    }
  }

  return [...byIdentity.values()].map((subclass) => {
    const key = `${subclass.shortName}|${subclass.className}|${subclass.source}`;
    const features = (featuresByKey.get(key) ?? [])
      .sort((left, right) => (left.level ?? 0) - (right.level ?? 0))
      .map((feature, index) => ({
        id: toSourcedId(ctx.sourceId, subclass.name, feature.name, String(index)),
        name: stripInlineTags(feature.name),
        description: cleanText(feature.entries),
        level: feature.level ?? 1,
        source: ctx.label
      }))
      .filter((feature) => feature.description);

    const mapped = {
      id: toSourcedId(ctx.sourceId, subclass.className, subclass.name),
      classId: slugify(subclass.className),
      name: subclass.name,
      description: cleanText(subclass.entries) || `${subclass.name} subclass for the ${subclass.className}.`,
      features,
      source: ctx.label,
      sourceId: ctx.sourceId
    };

    return applyOptionalFeatureProgressions(mapped, subclass.optionalfeatureProgression, optionIndex, ctx);
  }).filter((subclass) => subclass.features.length > 0);
};

// --- languages and combat actions -----------------------------------------------------------

// 5etools files a language's table as `type`, and the builder's vocabulary is the book's own:
// "exotic" is 2014's name for the second table, which the app reads as rare.
const LANGUAGE_RARITY_MAP = { standard: 'standard', exotic: 'rare', rare: 'rare', secret: 'rare' };

const mapLanguage = (language, ctx) => ({
  id: toSourcedId(ctx.sourceId, language.name),
  name: stripInlineTags(language.name ?? ''),
  rarity: LANGUAGE_RARITY_MAP[String(language.type ?? '').toLowerCase()] ?? 'standard',
  ...(language.typicalSpeakers?.length ? { origin: language.typicalSpeakers.map(stripInlineTags).join(', ') } : {}),
  ...(language.script ? { script: stripInlineTags(String(language.script)) } : {}),
  ...(language.entries?.length ? { note: cleanText(language.entries) } : {}),
  source: ctx.label,
  sourceId: ctx.sourceId
});

// The timing is on `time`, which is a string ("bonus") or a block ({number, unit}); an entry that
// states none is an action, which is how both books print the unlabelled ones.
const readActionTiming = (time) => {
  const unit = String((Array.isArray(time) ? time[0] : time)?.unit ?? (Array.isArray(time) ? time[0] : time) ?? '').toLowerCase();
  if (unit.startsWith('bonus')) return 'bonus-action';
  if (unit.startsWith('reaction')) return 'reaction';
  return 'action';
};

const mapCombatAction = (action, ctx) => ({
  id: toSourcedId(ctx.sourceId, action.name),
  name: stripInlineTags(action.name ?? ''),
  timing: readActionTiming(action.time),
  // No `summary`: the field is the book's own Actions-table line, and this data states none.
  description: cleanText(action.entries),
  source: ctx.label,
  sourceId: ctx.sourceId
});

// --- optional features ----------------------------------------------------------------------

const titleCaseWords = (value) => String(value ?? '')
  .replaceAll(/\b[a-z]/g, (letter) => letter.toUpperCase());

// Option ids are the plain slug of the name, never source-prefixed: a pool is shared between two
// features by *matching option ids*, so a prefix would stop a supplement's invocations merging.
const toOptionId = (value) => stripInlineTags(String(value ?? ''))
  .toLowerCase()
  .replaceAll(/[^a-z0-9]+/g, ' ')
  .trim()
  .replaceAll(' ', '-');

// An option's own gate, from the structured `prerequisite` rather than a sentence: a level, the
// spell it needs, and the pact or another option it builds on.
const mapOptionalFeaturePrerequisites = (prerequisites) => {
  const texts = [];
  let minimumLevel;
  const requiredOptionIds = [];
  const requiredSpellIds = [];

  for (const prereq of prerequisites ?? []) {
    const level = typeof prereq.level === 'object' ? prereq.level.level : prereq.level;
    if (Number(level) > 0) {
      minimumLevel = minimumLevel === undefined ? Number(level) : Math.min(minimumLevel, Number(level));
      texts.push(`Level ${level}`);
    }
    for (const spell of prereq.spell ?? []) {
      const [name, marker] = String(spell).split('|')[0].split('#');
      if (!name) continue;
      requiredSpellIds.push(toOptionId(name));
      // The data states a spell in lower case and marks a cantrip with `#c`; the gate is shown to
      // the player, so it reads as the book prints it.
      texts.push(`${titleCaseWords(stripInlineTags(name))}${marker === 'c' ? ' cantrip' : ''}`);
    }
    for (const pact of [prereq.pact].flat().filter(Boolean)) {
      requiredOptionIds.push(toOptionId(`Pact of the ${pact}`));
      texts.push(`Pact of the ${pact}`);
    }
    for (const feature of [prereq.optionalfeature ?? prereq.feature].flat().filter(Boolean)) {
      const name = String(feature).split('|')[0];
      requiredOptionIds.push(toOptionId(name));
      texts.push(stripInlineTags(name));
    }
    for (const patron of [prereq.patron].flat().filter(Boolean)) {
      texts.push(`${stripInlineTags(String(patron))} patron`);
    }
    const other = prereq.otherSummary?.entry ?? prereq.other;
    if (other) texts.push(stripInlineTags(String(other)));
  }

  if (texts.length === 0) return undefined;
  return {
    text: texts.join(', '),
    ...(minimumLevel === undefined ? {} : { minimumLevel }),
    requiredOptionIds: [...new Set(requiredOptionIds)],
    requiredSpellIds: [...new Set(requiredSpellIds)]
  };
};

// Keyed by `featureType`; an option lists under every type it carries, since styles are shared.
const indexOptionalFeatures = (optionalFeatures) => {
  const index = new Map();
  for (const feature of optionalFeatures ?? []) {
    const option = {
      id: toOptionId(feature.name),
      name: stripInlineTags(feature.name ?? ''),
      description: cleanText(feature.entries),
      prerequisites: mapOptionalFeaturePrerequisites(feature.prerequisite)
    };
    if (!option.id || !option.description) continue;
    for (const type of feature.featureType ?? []) {
      const key = String(type);
      if (!index.has(key)) index.set(key, new Map());
      if (!index.get(key).has(option.id)) index.get(key).set(option.id, option);
    }
  }
  return index;
};

// What the progression states at the level it first grants anything: the pool's codes say which
// options it draws from, so nothing here names a book or a class.
const readProgression = (block) => {
  const levels = Object.entries(block.progression ?? {})
    .map(([level, count]) => [Number(level), Number(count)])
    .filter(([level, count]) => Number.isFinite(level) && Number.isFinite(count) && count > 0)
    .sort((left, right) => left[0] - right[0]);
  if (levels.length === 0) return null;
  return { level: levels[0][0], chooseCount: levels[0][1] };
};

/** Progression -> selector on the feature it names, or its own feature when none matches. */
const applyOptionalFeatureProgressions = (entry, progressions, optionIndex, ctx) => {
  let features = entry.features;

  for (const block of progressions ?? []) {
    const progression = readProgression(block);
    if (!progression) continue;
    const options = [...new Set((block.featureType ?? []).map(String))]
      .flatMap((type) => [...(optionIndex.get(type)?.values() ?? [])]);
    if (options.length === 0) continue;

    const poolName = stripInlineTags(block.name ?? '');
    const target = features.findIndex((feature) => toOptionId(feature.name) === toOptionId(poolName));
    const selector = { requiresChoice: true, chooseCount: progression.chooseCount, options };

    if (target === -1) {
      features = [...features, {
        id: toSourcedId(ctx.sourceId, entry.name, poolName),
        name: poolName,
        description: `Choose from the ${poolName.toLowerCase()} available to you.`,
        level: progression.level,
        source: ctx.label,
        ...selector
      }];
      continue;
    }

    features = features.map((feature, index) => (index === target ? { ...feature, ...selector } : feature));
  }

  return features.length === entry.features.length && features === entry.features
    ? entry
    : { ...entry, features: [...features].sort((left, right) => left.level - right.level) };
};

// --- classes --------------------------------------------------------------------------------

// Cells render to the plain text an HTML table yields; `lib/classTables.mjs` judges the columns.
const renderTableCell = (cell) => {
  if (cell == null) return '';
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'string') return stripInlineTags(cell).trim();
  if (cell.type === 'dice') {
    const roll = (cell.toRoll ?? [])[0];
    return roll ? `${roll.number ?? 1}d${roll.faces}` : '';
  }
  if (cell.type === 'bonus') return `+${cell.value}`;
  if (cell.type === 'bonusSpeed') return `+${cell.value} ft.`;
  return cleanText(cell);
};

const columnsFromTableGroups = (groups) => {
  const columns = [];

  for (const group of groups ?? []) {
    if (!Array.isArray(group?.rows) || !Array.isArray(group?.colLabels)) continue;
    group.colLabels.forEach((label, index) => {
      columns.push({
        header: cleanText(label),
        cells: group.rows.map((row) => renderTableCell(Array.isArray(row) ? row[index] : undefined))
      });
    });
  }

  return columns;
};

// The slot table is its own group, stated as counts per spell level rather than as cells.
const spellSlotsFromTableGroups = (groups) => {
  const group = (groups ?? []).find((entry) => Array.isArray(entry?.rowsSpellProgression));
  return group ? group.rowsSpellProgression : undefined;
};

// --- class features -------------------------------------------------------------------------

// "name|className|classSource|level|source"; class source defaults to PHB, feature's to the class's.
const parseFeatureRef = (ref) => {
  const [name, className, classSource, level, source] = String(ref ?? '').split('|');
  const resolvedClassSource = classSource || 'PHB';
  return {
    name: name ?? '',
    className: className ?? '',
    classSource: resolvedClassSource,
    level: Number(level) || 1,
    source: source || resolvedClassSource
  };
};

const featureRefKey = (parts) => [
  String(parts.name ?? '').toLowerCase(),
  String(parts.className ?? '').toLowerCase(),
  String(parts.classSource ?? '').toLowerCase(),
  Number(parts.level) || 1
].join('|');

const indexClassFeatures = (classFeatures) => {
  const index = new Map();
  for (const feature of classFeatures) {
    const key = featureRefKey({
      name: feature.name,
      className: feature.className,
      classSource: feature.classSource ?? feature.source,
      level: feature.level
    });
    if (!index.has(key)) index.set(key, feature);
  }

  return index;
};

/** Features in level order; the subclass level is on the pointer, not the class. */
const mapClassFeatures = (cls, featureIndex, ctx) => {
  const features = [];
  let subclassLevel = null;

  (cls.classFeatures ?? []).forEach((entry, index) => {
    const ref = typeof entry === 'string' ? entry : entry?.classFeature;
    const parts = parseFeatureRef(ref);
    if (!parts.name) return;

    if (typeof entry === 'object' && entry?.gainSubclassFeature && subclassLevel === null) {
      subclassLevel = parts.level;
    }

    const feature = featureIndex.get(featureRefKey(parts));
    const description = feature ? cleanText(feature.entries) : '';
    if (!description) return;

    features.push({
      id: toSourcedId(ctx.sourceId, cls.name, parts.name, String(index)),
      name: stripInlineTags(parts.name),
      description,
      level: parts.level,
      source: ctx.label
    });
  });

  features.sort((left, right) => left.level - right.level);
  return { features, subclassLevel };
};

// --- proficiencies --------------------------------------------------------------------------

const ARMOR_PROFICIENCY_LABELS = {
  light: 'Light armor',
  medium: 'Medium armor',
  heavy: 'Heavy armor',
  shield: 'Shields'
};

const titleCaseSkill = (value) => String(value ?? '')
  .split(' ')
  .map((word) => (word === 'of' ? word : word.charAt(0).toUpperCase() + word.slice(1)))
  .join(' ');

const proficiencyTerm = (entry) => {
  const raw = typeof entry === 'string' ? entry : (entry?.proficiency ?? '');
  // A weapon or armour proficiency can be an item UID ("longsword|phb").
  return stripInlineTags(String(raw).split('|')[0]).trim();
};

const mapArmorProficiencies = (proficiencies) => (proficiencies?.armor ?? [])
  .map((entry) => {
    const term = proficiencyTerm(entry);
    return ARMOR_PROFICIENCY_LABELS[term.toLowerCase()] ?? term;
  })
  .filter(Boolean);

const mapWeaponProficiencies = (proficiencies) => (proficiencies?.weapons ?? [])
  .map((entry) => {
    const term = proficiencyTerm(entry);
    if (/^simple$/i.test(term)) return 'Simple weapons';
    if (/^martial$/i.test(term)) return 'Martial weapons';
    return term.charAt(0).toUpperCase() + term.slice(1);
  })
  .filter(Boolean);

const mapToolProficiencies = (proficiencies) => {
  const tools = [...(proficiencies?.tools ?? []), ...(proficiencies?.toolProficiencies ?? []).flatMap(
    (entry) => Object.entries(entry ?? {}).filter(([, held]) => held === true).map(([name]) => name)
  )];
  const mapped = tools.map((entry) => {
    const term = proficiencyTerm(entry);
    return term.charAt(0).toUpperCase() + term.slice(1);
  }).filter(Boolean);
  return mapped.length > 0 ? [...new Set(mapped)] : undefined;
};

/** "any: n" is the whole skill list, shared with the document importer rather than restated. */
const mapSkillChoices = (proficiencies) => {
  const named = new Set();
  let count = 0;
  let anyCount = 0;

  for (const entry of proficiencies?.skills ?? []) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.any === 'number') {
      anyCount = Math.max(anyCount, entry.any);
      count += entry.any;
      continue;
    }
    if (entry.choose?.from) {
      for (const skill of entry.choose.from) named.add(titleCaseSkill(skill));
      count += entry.choose.count ?? 1;
      continue;
    }
    // A skill stated outright is a grant, not a choice, and the builder reads grants elsewhere.
    for (const [skill, held] of Object.entries(entry)) {
      if (held === true) named.add(titleCaseSkill(skill));
    }
  }

  if (anyCount > 0) {
    return { skillChoices: [...skillNames], skillCount: count };
  }

  return { skillChoices: [...named], skillCount: count };
};

// --- multiclassing --------------------------------------------------------------------------

/** `requirements.or` is the only place the "or" survives; `primaryAbility` has lost it. */
const mapMulticlassPrerequisites = (requirements) => {
  if (!requirements) return undefined;

  const direct = Object.fromEntries(
    abilityKeys.filter((key) => typeof requirements[key] === 'number').map((key) => [ABILITY_MAP[key], requirements[key]])
  );

  if (Array.isArray(requirements.or) && requirements.or.length > 0) {
    const alternatives = requirements.or.map((alternative) => ({
      ...direct,
      ...Object.fromEntries(
        abilityKeys.filter((key) => typeof alternative?.[key] === 'number').map((key) => [ABILITY_MAP[key], alternative[key]])
      )
    })).filter((alternative) => Object.keys(alternative).length > 0);
    return alternatives.length > 0 ? alternatives : undefined;
  }

  return Object.keys(direct).length > 0 ? [direct] : undefined;
};

const mapMulticlassProficiencies = (multiclassing) => {
  const gained = multiclassing?.proficienciesGained;
  if (!gained) return undefined;

  const { skillChoices, skillCount } = mapSkillChoices(gained);
  const toolProficiencies = mapToolProficiencies(gained);
  return {
    armorProficiencies: mapArmorProficiencies(gained),
    weaponProficiencies: mapWeaponProficiencies(gained),
    ...(toolProficiencies ? { toolProficiencies } : {}),
    skillChoices,
    skillCount
  };
};

// --- starting equipment ---------------------------------------------------------------------

// Write the phrase `lib/startingEquipment.ts` reads, never a bare category, or the pick is lost.
const EQUIPMENT_TYPE_OPTIONS = {
  weaponSimple: ['Any simple weapon', 'weapon'],
  weaponSimpleMelee: ['Any simple melee weapon', 'weapon'],
  weaponSimpleRanged: ['Any simple ranged weapon', 'weapon'],
  weaponMartial: ['Any martial weapon', 'weapon'],
  weaponMartialMelee: ['Any martial melee weapon', 'weapon'],
  weaponMartialRanged: ['Any martial ranged weapon', 'weapon'],
  weaponMelee: ['Any melee weapon', 'weapon'],
  weaponRanged: ['Any ranged weapon', 'weapon'],
  weapon: ['Any weapon', 'weapon'],
  instrumentMusical: ['Any musical instrument', 'tool'],
  setGaming: ['Any gaming set', 'tool'],
  toolArtisan: ["Any artisan's tools", 'tool'],
  focusSpellcastingArcane: ['Any arcane focus', 'gear'],
  focusSpellcastingDruidic: ['Any druidic focus', 'gear'],
  focusSpellcastingHoly: ['Any holy symbol', 'gear'],
  armorLight: ['Any light armor', 'armor'],
  armorMedium: ['Any medium armor', 'armor'],
  armorHeavy: ['Any heavy armor', 'armor']
};

const OPTION_TYPE_BY_ITEM_TYPE = { weapon: 'weapon', armor: 'armor', shield: 'armor', tool: 'tool', consumable: 'gear', gear: 'gear' };

// Keyed by UID and by bare name, because a book's class points at an item with the source it was
// printed in and the name is the only fallback when that book is not in the directory.
const indexItems = (items) => {
  const byUid = new Map();
  const byName = new Map();
  for (const item of items) {
    const name = String(item.name ?? '').toLowerCase();
    const uid = `${name}|${String(item.source ?? '').toLowerCase()}`;
    if (!byUid.has(uid)) byUid.set(uid, item);
    if (!byName.has(name)) byName.set(name, item);
  }

  return { byUid, byName };
};

const optionTypeForItem = (item) => {
  if (!item) return 'gear';
  if (Array.isArray(item.packContents)) return 'pack';
  return OPTION_TYPE_BY_ITEM_TYPE[ITEM_TYPE_TO_BUCKET_TYPE(item)] ?? 'gear';
};

const GOLD_IN_COPPER = 100;

const mapEquipmentEntry = (entry, itemIndex) => {
  if (typeof entry === 'string') {
    return mapEquipmentEntry({ item: entry }, itemIndex);
  }
  if (!entry || typeof entry !== 'object') return null;

  if (typeof entry.value === 'number') {
    // Stated in copper, so an amount under a gold piece would round to a "0 gp" grant; some
    // pre-2024 entries state a bare coin count, and a zero line is worse than no line.
    const gold = Math.round(entry.value / GOLD_IN_COPPER);
    if (gold <= 0) {
      console.warn(`a starting-equipment line states ${entry.value} copper, under one gold piece; it is left off rather than shown as "0 gp".`);
      return null;
    }
    return { name: `${gold} gp`, type: 'gold' };
  }

  const categories = entry.equipmentTypes ?? (entry.equipmentType ? [entry.equipmentType] : null);
  if (categories) {
    const [label, type] = EQUIPMENT_TYPE_OPTIONS[categories[0]] ?? [null, 'gear'];
    const name = entry.displayName ?? label;
    if (!name) return null;
    return { name, type, ...(entry.quantity > 1 ? { count: entry.quantity } : {}) };
  }

  if (entry.special) {
    return { name: stripInlineTags(entry.special), type: 'gear', ...(entry.quantity > 1 ? { count: entry.quantity } : {}) };
  }

  if (!entry.item) return null;
  const [rawName, rawSource] = String(entry.item).split('|');
  const name = rawName.toLowerCase();
  const item = itemIndex.byUid.get(`${name}|${String(rawSource ?? '').toLowerCase()}`) ?? itemIndex.byName.get(name);
  const displayed = entry.displayName ?? item?.name ?? rawName;
  return {
    name: stripInlineTags(displayed).replace(/\b\w/, (letter) => letter.toUpperCase()),
    type: optionTypeForItem(item),
    ...(entry.quantity > 1 ? { count: entry.quantity } : {})
  };
};

/** One slot per group; extras under one key ride along as `contents` to keep (a) paired. */
const mapEquipmentOptions = (startingEquipment, itemIndex) => {
  const groups = [];

  for (const group of startingEquipment?.defaultData ?? []) {
    if (!group || typeof group !== 'object') continue;
    const alternatives = Object.values(group)
      .filter((entries) => Array.isArray(entries))
      .map((entries) => entries.map((entry) => mapEquipmentEntry(entry, itemIndex)).filter(Boolean))
      .filter((entries) => entries.length > 0);
    if (alternatives.length === 0) continue;

    if (alternatives.length === 1) {
      for (const option of alternatives[0]) groups.push([option]);
      continue;
    }

    groups.push(alternatives.map(([first, ...rest]) => (rest.length > 0 ? { ...first, contents: rest } : first)));
  }

  return groups;
};

// --- spellcasting ---------------------------------------------------------------------------

const mapSpellcasting = (cls) => {
  const ability = ABILITY_MAP[cls.spellcastingAbility];
  if (!ability) return undefined;

  const spellSlots = spellSlotsFromTableGroups(cls.classTableGroups);
  const spellcasting = { ability };
  if (Array.isArray(cls.cantripProgression)) spellcasting.cantripsKnown = cls.cantripProgression;
  if (Array.isArray(cls.spellsKnownProgression)) spellcasting.spellsKnown = cls.spellsKnownProgression;
  if (Array.isArray(cls.preparedSpellsProgression)) spellcasting.spellsKnown = cls.preparedSpellsProgression;
  if (spellSlots) spellcasting.spellSlots = spellSlots;
  // The data states the formula a class prepares by; a class that prepares nothing states none.
  if (cls.preparedSpells || cls.preparedSpellsProgression) spellcasting.spellPreparation = true;
  return spellcasting;
};

// --- the class ------------------------------------------------------------------------------

const mapPrimaryAbility = (cls) => {
  const stated = (cls.primaryAbility ?? []).flatMap(
    (entry) => abilityKeys.filter((key) => entry?.[key] === true).map((key) => ABILITY_MAP[key])
  );
  const unique = [...new Set(stated)];
  if (unique.length === 1) return unique[0];
  if (unique.length > 1) return unique;
  // Nothing states one, so fall back to the first saving throw the class is proficient in rather
  // than guessing: both printings pair a class's primary ability with one of its saves.
  return ABILITY_MAP[(cls.proficiency ?? [])[0]] ?? 'strength';
};

// Pointer first, then the lowest subclass feature level; the 3 is a guess, so it is logged.
const SUBCLASS_LEVEL_WHEN_UNSTATED = 3;

const resolveSubclassLevel = (cls, statedLevel, lowestSubclassLevel) => {
  if (statedLevel) return statedLevel;
  if (lowestSubclassLevel) return lowestSubclassLevel;
  console.warn(`${cls.name}: no source states the level at which it gains a subclass; using ${SUBCLASS_LEVEL_WHEN_UNSTATED}.`);
  return SUBCLASS_LEVEL_WHEN_UNSTATED;
};

const mapClass = (cls, context) => {
  const { featureIndex, itemIndex, fluffByName, subclassesByClass, optionIndex, ctx } = context;
  const hitDie = Number(cls.hd?.faces) || 0;
  const { features, subclassLevel } = mapClassFeatures(cls, featureIndex, ctx);
  const classSubclasses = subclassesByClass.get(slugify(cls.name)) ?? [];
  const { skillChoices, skillCount } = mapSkillChoices(cls.startingProficiencies);
  const toolProficiencies = mapToolProficiencies(cls.startingProficiencies);
  const resources = resourcesFromColumns(columnsFromTableGroups(cls.classTableGroups), features);
  const featureDice = featureDiceFromColumns(columnsFromTableGroups(cls.classTableGroups), features);
  const multiclassPrerequisites = mapMulticlassPrerequisites(cls.multiclassing?.requirements);
  const multiclassProficiencies = mapMulticlassProficiencies(cls.multiclassing);
  const spellcasting = mapSpellcasting(cls);
  const fluff = fluffByName.get(String(cls.name).toLowerCase());
  const lowestSubclassLevel = classSubclasses
    .flatMap((subclass) => subclass.features.map((feature) => feature.level))
    .reduce((lowest, level) => (lowest === null || level < lowest ? level : lowest), null);

  const mapped = {
    id: toSourcedId(ctx.sourceId, cls.name),
    name: cls.name,
    description: (fluff ? cleanText(fluff.entries) : '') || `The ${cls.name} class.`,
    hitDie,
    primaryAbility: mapPrimaryAbility(cls),
    savingThrows: (cls.proficiency ?? []).map((key) => ABILITY_MAP[key]).filter(Boolean),
    armorProficiencies: mapArmorProficiencies(cls.startingProficiencies),
    weaponProficiencies: mapWeaponProficiencies(cls.startingProficiencies),
    ...(toolProficiencies ? { toolProficiencies } : {}),
    skillChoices,
    skillCount,
    ...(multiclassProficiencies ? { multiclassProficiencies } : {}),
    ...(multiclassPrerequisites ? { multiclassPrerequisites } : {}),
    features,
    // The subclasses are in the pack's own `subclasses` bucket, each pointing back with `classId`;
    // nesting them here as well would ship every one of them twice.
    subclasses: [],
    subclassLevel: resolveSubclassLevel(cls, subclassLevel, lowestSubclassLevel),
    ...(resources ? { resources } : {}),
    ...(featureDice ? { featureDice } : {}),
    ...(spellcasting ? { spellcasting } : {}),
    equipmentOptions: mapEquipmentOptions(cls.startingEquipment, itemIndex),
    source: ctx.label,
    sourceId: ctx.sourceId
  };

  return applyOptionalFeatureProgressions(mapped, cls.optionalfeatureProgression, optionIndex, ctx);
};

/** A reprint of optional features carries no hit die, and an unbuildable class is dropped. */
const mapClasses = (classes, classFeatures, items, fluff, subclasses, optionIndex, ctx) => {
  const featureIndex = indexClassFeatures(classFeatures);
  const itemIndex = indexItems(items);
  const fluffByName = new Map(fluff.map((entry) => [String(entry.name ?? '').toLowerCase(), entry]));
  const subclassesByClass = new Map();
  for (const subclass of subclasses) {
    const key = String(subclass.classId ?? '');
    if (!subclassesByClass.has(key)) subclassesByClass.set(key, []);
    subclassesByClass.get(key).push(subclass);
  }

  return classes
    .filter((cls) => Number(cls.hd?.faces) > 0)
    .map((cls) => mapClass(cls, { featureIndex, itemIndex, fluffByName, subclassesByClass, optionIndex, ctx }));
};

// --- entry point ----------------------------------------------------------------------------

// A `_copy` is resolved against every book in the directory, and a `_versions` variant is an entry
// of its own; both are pointers, and an unread pointer ships a name with no content behind it.
const RESOLVED_BUCKETS = {
  race: ['race'],
  subrace: ['subrace'],
  background: ['background'],
  feat: ['feat'],
  monster: ['monster'],
  spell: ['spell'],
  item: ['item', 'baseitem'],
  baseitem: ['baseitem', 'item'],
  class: ['class'],
  subclass: ['subclass'],
  classFeature: ['classFeature'],
  subclassFeature: ['subclassFeature'],
  optionalfeature: ['optionalfeature']
};

// A subrace's `_versions` carry `_mod` operations against the *race's* traits ("replace Breath
// Weapon"), so expanding them before the race is merged in appends what was meant to replace.
// The subrace bucket keeps its versions and the species mapping expands them.
const DEFERRED_VERSION_BUCKETS = new Set(['subrace']);

const resolvePointers = (raw) => {
  const resolved = { ...raw };
  for (const [bucket, poolBuckets] of Object.entries(RESOLVED_BUCKETS)) {
    if (!Array.isArray(raw[bucket])) continue;
    const pool = poolBuckets.flatMap((key) => raw[key] ?? []);
    const copied = resolveFiveEToolsCopies(raw[bucket], { pool, bucket });
    resolved[bucket] = DEFERRED_VERSION_BUCKETS.has(bucket)
      ? copied
      : expandFiveEToolsVersions(copied, { bucket });
  }
  return resolved;
};

export const buildCanonicalContentFrom5eTools = (rawInput, { sourceId, label, sourceAbbr, includeOtherSources = false }) => {
  const raw = resolvePointers(rawInput);
  // Levels are read across every book, because a feat or a species grants a spell by name alone.
  const spellLevelByName = new Map(raw.spell.map((spell) => [String(spell.name ?? '').toLowerCase(), spell.level ?? 0]));
  const ctx = {
    sourceId,
    label,
    spellLevelByName: (name) => spellLevelByName.get(String(name).toLowerCase())
  };
  const keep = (list) => list.filter((entry) => matchesSource(entry, sourceAbbr, includeOtherSources));

  const races = keep(raw.race);
  const keptRaceKeys = new Set(races.map((race) => `${race.name}|${race.source}`));
  const subracesByRace = new Map();
  // A subrace whose race this book did not print still belongs to it, so it is adopted below
  // rather than dropped with the race it hangs off.
  const adoptedSubraces = [];
  for (const subrace of keep(raw.subrace)) {
    const key = `${subrace.raceName}|${subrace.raceSource}`;
    if (!keptRaceKeys.has(key)) {
      adoptedSubraces.push(subrace);
      continue;
    }
    if (!subracesByRace.has(key)) subracesByRace.set(key, []);
    for (const expanded of keep(expandFiveEToolsVersions([subrace], { bucket: 'subrace' }))) {
      subracesByRace.get(key).push(expanded);
    }
  }

  const adoptedRaces = adoptedSubraces.flatMap((subrace, index) => {
    const parent = raw.race.find((race) => race.name === subrace.raceName && race.source === subrace.raceSource);
    if (!parent) {
      console.warn(`subrace "${subrace.name ?? '(unnamed)'}" belongs to ${subrace.raceName} (${subrace.raceSource}), which no book in the directory states; it is left off.`);
      return [];
    }
    // Merged first, so a version's `_mod` has the race's own traits to operate on.
    return keep(expandFiveEToolsVersions([mergeSubraceOntoRace(parent, subrace, index)], { bucket: 'race' }));
  });

  // Options are matched by `featureType`, so they are read across every book in the directory for
  // the same reason features and items are: a supplement's class draws on the core book's pool.
  const optionIndex = indexOptionalFeatures(raw.optionalfeature);

  const subclasses = mapSubclasses(keep(raw.subclass), keep(raw.subclassFeature), optionIndex, ctx);
  // Matched by referenced UID, so looked up across every book: a supplement points at PHB items.
  const itemIndex = indexItems([...raw.item, ...raw.baseitem]);
  const classes = mapClasses(keep(raw.class), raw.classFeature, [...raw.item, ...raw.baseitem], keep(raw.classFluff), subclasses, optionIndex, ctx);

  // Two entries with one id is a duplicate the registry would collapse and the counts would not.
  const dedupeById = (entries) => {
    const seen = new Set();
    return entries.filter((entry) => {
      const id = entry?.id;
      if (!id || seen.has(id)) {
        if (id) console.warn(`dropped a second entry sharing the id "${id}".`);
        return false;
      }
      seen.add(id);
      return true;
    });
  };

  // A pool the level table does not state is read from the feature's own sentences, by the same
  // module the document imports use.
  const content = applyProseResources({
    species: [...races, ...adoptedRaces].map((race) => mapRace(race, subracesByRace, ctx)),
    classes,
    subclasses,
    backgrounds: keep(raw.background).map((background) => mapBackground(background, ctx, itemIndex)),
    spells: keep(raw.spell).map((spell) => mapSpell(spell, ctx)),
    equipment: [...keep(raw.item), ...keep(raw.baseitem)].map((item) => mapItem(item, ctx)),
    feats: keep(raw.feat).map((feat) => mapFeat(feat, ctx)),
    monsters: keep(raw.monster).map((monster) => mapMonster(monster, ctx)),
    languages: keep(raw.language).map((language) => mapLanguage(language, ctx)),
    combatActions: keep(raw.action).map((action) => mapCombatAction(action, ctx)),
    ua: []
  });

  for (const [bucket, entries] of Object.entries(content)) {
    if (Array.isArray(entries)) content[bucket] = dedupeById(entries);
  }
  return content;
};

export const load5eToolsData = collectFromDir;
