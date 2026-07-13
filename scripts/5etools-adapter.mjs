// Converts 5etools-format JSON data into this app's canonical content buckets.
//
// 5etools publishes clean, complete, structured JSON for every book. Its data files each
// contain entries from many books, tagged with a `source` abbreviation (e.g. "TCE" for
// Tasha's, "XGE" for Xanathar's, "XPHB" for the 2024 PHB). This adapter reads a directory of
// those JSON files, keeps only the entries for a chosen source abbreviation, and maps them
// into our canonical buckets. It performs no network access — the user supplies the files.

import fs from 'node:fs/promises';
import path from 'node:path';

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
  const collected = { spell: [], monster: [], race: [], subrace: [], background: [], feat: [], item: [], baseitem: [], subclass: [], subclassFeature: [], class: [], classFeature: [] };
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

  return {
    species: races.map((race) => mapRace(race, subracesByRace, ctx)),
    classes: [],
    subclasses: mapSubclasses(keep(raw.subclass), keep(raw.subclassFeature), ctx),
    backgrounds: keep(raw.background).map((background) => mapBackground(background, ctx)),
    spells: keep(raw.spell).map((spell) => mapSpell(spell, ctx)),
    equipment: [...keep(raw.item), ...keep(raw.baseitem)].map((item) => mapItem(item, ctx)),
    feats: keep(raw.feat).map((feat) => mapFeat(feat, ctx)),
    monsters: keep(raw.monster).map((monster) => mapMonster(monster, ctx)),
    ua: []
  };
};

export const load5eToolsData = collectFromDir;
