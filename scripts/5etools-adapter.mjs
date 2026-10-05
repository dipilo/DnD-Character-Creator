// Converts 5etools-format JSON data into this app's canonical content buckets.
//
// 5etools publishes clean, complete, structured JSON for every book. Its data files each
// contain entries from many books, tagged with a `source` abbreviation (e.g. "TCE" for
// Tasha's, "XGE" for Xanathar's, "XPHB" for the 2024 PHB). This adapter reads a directory of
// those JSON files, keeps only the entries for a chosen source abbreviation, and maps them
// into our canonical buckets. It performs no network access — the user supplies the files.
//
// What a class's level table means is not restated here: the columns are rendered to the same plain
// text an HTML table yields and handed to `lib/classTables.mjs`, and the pools stated in prose to
// `lib/classResources.mjs`, which is what keeps this path and the document imports from disagreeing
// about whether a column is a pool, a die or neither.

import fs from 'node:fs/promises';
import path from 'node:path';
import { skillNames } from './canonical-content.mjs';
import { applyProseResources } from './lib/classResources.mjs';
import { featureDiceFromColumns, resourcesFromColumns } from './lib/classTables.mjs';

const SIZE_MAP = { T: 'Tiny', S: 'Small', M: 'Medium', L: 'Large', H: 'Huge', G: 'Gargantuan' };
const SCHOOL_MAP = {
  A: 'Abjuration', C: 'Conjuration', D: 'Divination', E: 'Enchantment',
  V: 'Evocation', I: 'Illusion', N: 'Necromancy', T: 'Transmutation'
};
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

const matchesSource = (entry, sourceAbbr) => {
  if (!sourceAbbr) return true;
  return String(entry?.source ?? '').toLowerCase() === sourceAbbr.toLowerCase();
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
  const collected = { spell: [], monster: [], race: [], subrace: [], background: [], feat: [], item: [], baseitem: [], subclass: [], subclassFeature: [], class: [], classFeature: [], classFluff: [] };
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
    school: SCHOOL_MAP[spell.school] ?? spell.school ?? 'Unknown',
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

const mapRaceFeatures = (race, ctx, label) => {
  return (race.entries ?? [])
    .filter((entry) => entry && typeof entry === 'object' && entry.name && entry.type === 'entries')
    .map((entry, index) => ({
      id: toSourcedId(ctx.sourceId, race.name, entry.name, String(index)),
      name: stripInlineTags(entry.name),
      description: cleanText(entry.entries) || stripInlineTags(entry.name),
      level: 1,
      source: label
    }));
};

const mapSpeed = (speed) => {
  if (typeof speed === 'number') return speed;
  if (speed && typeof speed === 'object') return speed.walk ?? 30;
  return 30;
};

const mapRace = (race, subracesByRace, ctx) => {
  const variants = (subracesByRace.get(`${race.name}|${race.source}`) ?? []).map((subrace, index) => ({
    id: toSourcedId(ctx.sourceId, race.name, subrace.name ?? `variant-${index + 1}`),
    name: subrace.name ? `${race.name} (${stripInlineTags(subrace.name)})` : `${race.name} Variant ${index + 1}`,
    description: cleanText(subrace.entries) || `${race.name} lineage option.`,
    abilityScoreIncreases: mapAbilityIncreases(subrace.ability),
    features: mapRaceFeatures(subrace, ctx, ctx.label)
  }));

  return {
    id: toSourcedId(ctx.sourceId, race.name),
    name: race.name,
    description: cleanText(race.entries?.filter?.((entry) => typeof entry === 'string')) || `${race.name} from ${ctx.label}.`,
    size: SIZE_MAP[Array.isArray(race.size) ? race.size[0] : race.size] ?? 'Medium',
    speed: mapSpeed(race.speed),
    abilityScoreIncreases: mapAbilityIncreases(race.ability),
    features: mapRaceFeatures(race, ctx, ctx.label),
    languages: (race.languageProficiencies?.[0] ? Object.keys(race.languageProficiencies[0]).filter((key) => race.languageProficiencies[0][key] === true).map((key) => key.charAt(0).toUpperCase() + key.slice(1)) : []),
    variants: variants.length > 0 ? variants : undefined,
    source: ctx.label,
    sourceId: ctx.sourceId
  };
};

const mapBackground = (background, ctx) => {
  const feature = (background.entries ?? []).find((entry) => entry?.name && /feature/i.test(entry.name));
  return {
    id: toSourcedId(ctx.sourceId, background.name),
    name: background.name,
    description: cleanText(background.entries?.filter?.((entry) => typeof entry === 'string')) || `${background.name} background.`,
    skillProficiencies: Object.keys(background.skillProficiencies?.[0] ?? {}).filter((key) => background.skillProficiencies[0][key] === true).map((key) => key.charAt(0).toUpperCase() + key.slice(1)),
    toolProficiencies: Object.keys(background.toolProficiencies?.[0] ?? {}).filter((key) => background.toolProficiencies[0][key] === true),
    languageCount: background.languageProficiencies?.[0]?.anyStandard,
    equipment: [],
    feature: {
      name: feature?.name ? stripInlineTags(feature.name) : `${background.name} Feature`,
      description: feature ? cleanText(feature.entries) : cleanText(background.entries)
    },
    personalityTraits: [],
    ideals: [],
    bonds: [],
    flaws: [],
    source: ctx.label,
    sourceId: ctx.sourceId
  };
};

const mapFeat = (feat, ctx) => {
  const prereqParts = [];
  for (const prereq of feat.prerequisite ?? []) {
    if (prereq.level) prereqParts.push(`Level ${prereq.level.level ?? prereq.level}`);
    if (prereq.ability) prereqParts.push(prereq.ability.map((block) => Object.entries(block).map(([key, value]) => `${ABILITY_MAP[key] ?? key} ${value}`).join(', ')).join('; '));
    if (prereq.spellcasting || prereq.spellcasting2020) prereqParts.push('Spellcasting feature');
    if (prereq.other) prereqParts.push(stripInlineTags(prereq.other));
    if (prereq.race) prereqParts.push(prereq.race.map((entry) => entry.name).join(' or '));
  }

  return {
    id: toSourcedId(ctx.sourceId, feat.name),
    name: feat.name,
    description: cleanText(feat.entries),
    prerequisites: prereqParts.length > 0 ? { text: prereqParts.join('; ') } : undefined,
    abilityScoreIncreases: mapAbilityIncreases(feat.ability),
    features: [],
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

const mapItem = (item, ctx) => {
  const armorCategoryByType = { LA: 'light', MA: 'medium', HA: 'heavy', S: 'shield' };
  const type = (item.type ?? '').split('|')[0];
  return {
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

const mapMonster = (monster, ctx) => {
  const abilityScores = Object.fromEntries(abilityKeys.map((key) => [ABILITY_MAP[key], monster[key] ?? 10]));
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

const mapSubclasses = (subclasses, subclassFeatures, ctx) => {
  const featuresByKey = new Map();
  for (const feature of subclassFeatures) {
    const key = `${feature.subclassShortName}|${feature.className}|${feature.subclassSource ?? feature.source}`;
    if (!featuresByKey.has(key)) featuresByKey.set(key, []);
    featuresByKey.get(key).push(feature);
  }

  return subclasses.map((subclass) => {
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

    return {
      id: toSourcedId(ctx.sourceId, subclass.className, subclass.name),
      classId: slugify(subclass.className),
      name: subclass.name,
      description: cleanText(subclass.entries) || `${subclass.name} subclass for the ${subclass.className}.`,
      features,
      source: ctx.label,
      sourceId: ctx.sourceId
    };
  }).filter((subclass) => subclass.features.length > 0);
};

// --- classes --------------------------------------------------------------------------------

// A class's level table arrives as entry objects rather than text, so each cell is rendered to the
// same plain text an HTML table yields and handed to `lib/classTables.mjs`. What a column *means* —
// which ones are pools, which are dice, which are neither — is stated once, there.
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

// "name|className|classSource|level|source": the class source defaults to the PHB and the feature's
// own source to the class's, which is how a book that adds features to an existing class points at
// them.
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

/**
 * The class's features in level order, plus the level at which it gains its subclass — which the
 * data states on the pointer (`gainSubclassFeature`) rather than on the class, and which is read
 * from the subclass features themselves only when no pointer claims it.
 */
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

/**
 * What the class lets a character choose from, and how many. "any: 4" is the whole skill list, which
 * is why the list is shared with the document importer rather than restated here.
 */
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

/**
 * Who may take the class after their first. The data keeps "or" apart from "and" natively, which is
 * the distinction the parsed `primaryAbility` has already lost, so it is read from here.
 */
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

// A category the player still has to resolve is written as the phrase `lib/startingEquipment.ts`
// reads ("Any simple weapon", "Any musical instrument"), never as a bare category name, or the
// builder renders it as a fixed grant and the pick never gets made.
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
    return { name: `${Math.round(entry.value / GOLD_IN_COPPER)} gp`, type: 'gold' };
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

/**
 * One slot per group, with its alternatives beside each other — the shape the builder renders a
 * selector from.
 *
 * Several items under one key are one option granting all of them, so the extras ride along as
 * `contents`: a selection resolves to a single `Equipment` row, and "(a) a longsword and a shield"
 * has to stay one alternative or it loses its pairing with (b). A group with only one key is
 * granted outright rather than chosen, so each of its items becomes a fixed slot of its own instead
 * of being nested under the first — the alternative read four javelins as the contents of a pack.
 */
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

// Both real sources are tried first — the pointer that says it grants a subclass feature, then the
// lowest level any of the class's own subclasses states a feature at. Neither is a guess; the last
// resort is, so it says so rather than passing as read.
const SUBCLASS_LEVEL_WHEN_UNSTATED = 3;

const resolveSubclassLevel = (cls, statedLevel, lowestSubclassLevel) => {
  if (statedLevel) return statedLevel;
  if (lowestSubclassLevel) return lowestSubclassLevel;
  console.warn(`${cls.name}: no source states the level at which it gains a subclass; using ${SUBCLASS_LEVEL_WHEN_UNSTATED}.`);
  return SUBCLASS_LEVEL_WHEN_UNSTATED;
};

const mapClass = (cls, context) => {
  const { featureIndex, itemIndex, fluffByName, subclassesByClass, ctx } = context;
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

  return {
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
};

/**
 * Every class the chosen book states. A source that reprints optional features for an existing class
 * carries no hit die, and a class with no positive hit die is unbuildable, so it is dropped rather
 * than shipped as a class nobody can take.
 */
const mapClasses = (classes, classFeatures, items, fluff, subclasses, ctx) => {
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
    .map((cls) => mapClass(cls, { featureIndex, itemIndex, fluffByName, subclassesByClass, ctx }));
};

// --- entry point ----------------------------------------------------------------------------

export const buildCanonicalContentFrom5eTools = (raw, { sourceId, label, sourceAbbr }) => {
  const ctx = { sourceId, label };
  const keep = (list) => list.filter((entry) => matchesSource(entry, sourceAbbr));

  const races = keep(raw.race);
  const subracesByRace = new Map();
  for (const subrace of keep(raw.subrace)) {
    const key = `${subrace.raceName}|${subrace.raceSource}`;
    if (!subracesByRace.has(key)) subracesByRace.set(key, []);
    subracesByRace.get(key).push(subrace);
  }

  const subclasses = mapSubclasses(keep(raw.subclass), keep(raw.subclassFeature), ctx);
  // Features and items are matched by the UID they are referenced with, so they are looked up across
  // every book in the directory: a supplement's class points at the PHB's longsword and at features
  // printed under the class's own source.
  const classes = mapClasses(keep(raw.class), raw.classFeature, [...raw.item, ...raw.baseitem], keep(raw.classFluff), subclasses, ctx);

  // A pool the level table does not state is read from the feature's own sentences, by the same
  // module the document imports use.
  return applyProseResources({
    species: races.map((race) => mapRace(race, subracesByRace, ctx)),
    classes,
    subclasses,
    backgrounds: keep(raw.background).map((background) => mapBackground(background, ctx)),
    spells: keep(raw.spell).map((spell) => mapSpell(spell, ctx)),
    equipment: [...keep(raw.item), ...keep(raw.baseitem)].map((item) => mapItem(item, ctx)),
    feats: keep(raw.feat).map((feat) => mapFeat(feat, ctx)),
    monsters: keep(raw.monster).map((monster) => mapMonster(monster, ctx)),
    ua: []
  });
};

export const load5eToolsData = collectFromDir;
