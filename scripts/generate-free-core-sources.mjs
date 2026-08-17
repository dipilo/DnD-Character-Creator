#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSourceModuleText, parseMonsterLanguages, rewriteSourceCrossReferences } from './canonical-content.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(scriptPath), '..');
const dataRoot = path.resolve(workspaceRoot, 'node_modules', 'febdnddata', 'vendor', '5e-database', 'src');
const sourceFilesRoot = path.resolve(workspaceRoot, 'app', 'src', 'data', 'sourceFiles');
const splitBucketOrder = ['species', 'backgrounds', 'spells', 'equipment', 'feats', 'monsters'];
const rawTextCache = new Map();

const abilityIndexMap = {
  str: 'strength',
  dex: 'dexterity',
  con: 'constitution',
  int: 'intelligence',
  wis: 'wisdom',
  cha: 'charisma'
};

const getSplitBucketPath = (sourceId, bucket) => path.resolve(sourceFilesRoot, `${sourceId}-${bucket}.ts`);

const sourceConfigs = {
  'basic-rules-2014': {
    edition: '2014',
    sourceId: 'basic-rules-2014',
    label: 'Basic Rules (2014)',
    category: 'basic',
    includeCoreSpeciesAndBackgrounds: true
  },
  'basic-rules-2024': {
    edition: '2024',
    sourceId: 'basic-rules-2024',
    label: 'Basic Rules (2024)',
    category: 'basic'
  }
};

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const readEditionJson = async (edition, fileName) => {
  const targetPath = path.resolve(dataRoot, edition, fileName);
  if (!(await pathExists(targetPath))) {
    return [];
  }

  return JSON.parse(await fs.readFile(targetPath, 'utf8'));
};

const titleCase = (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();

const readWorkspaceTextFile = async (relativePath) => {
  if (rawTextCache.has(relativePath)) {
    return rawTextCache.get(relativePath);
  }

  const targetPath = path.resolve(workspaceRoot, relativePath);
  let contents = '';
  try {
    contents = await fs.readFile(targetPath, 'utf8');
  } catch {
    contents = '';
  }

  rawTextCache.set(relativePath, contents);
  return contents;
};

const decodeHtmlEntities = (value) => value
  .replaceAll('&amp;', '&')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&rsquo;', "'")
  .replaceAll('&ldquo;', '"')
  .replaceAll('&rdquo;', '"')
  .replaceAll('&ndash;', '-')
  .replaceAll('&mdash;', '-')
  .replaceAll('&nbsp;', ' ')
  .replaceAll(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)));

// Inline tags are removed (not spaced) so D&D Beyond's mid-word wrappers such as
// <span class="No-Break"> do not split words; block tags still become separators.
const inlineTagNames = new Set(['a', 'abbr', 'b', 'cite', 'code', 'em', 'i', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'wbr']);
const tagOrCommentPattern = /<!--[\s\S]*?-->|<\/?([a-z][a-z0-9-]*)(?:\s[^>]*)?\/?>/gi;
const replaceTags = (value) => value.replaceAll(tagOrCommentPattern, (match, tagName) => (
  tagName && inlineTagNames.has(tagName.toLowerCase()) ? '' : ' '
));

const stripHtmlText = (value) => decodeHtmlEntities(replaceTags(value)).replaceAll(/\s+/g, ' ').trim();

const extract2024BackgroundSuggestedCharacteristics = async () => {
  const rawDocument = await readWorkspaceTextFile('BasicRules(2024).txt');
  if (!rawDocument) {
    return [];
  }

  const tableMatch = /<table[^>]*class="table-compendium table-traits"[\s\S]*?<h5[^>]*id="PersonalityTraitsbyAlignment"[\s\S]*?<\/table>/i.exec(rawDocument);
  if (!tableMatch) {
    return [];
  }

  const traitMatches = tableMatch[0].matchAll(/<tr>\s*<td>\d+<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi);
  const traits = Array.from(traitMatches, (match) => stripHtmlText(match[1])).filter(Boolean);
  return Array.from(new Set(traits));
};

const toolIndexes = new Set([
  'alchemist-supplies',
  'bagpipes',
  'brewers-supplies',
  'calligraphers-supplies',
  'carpenters-tools',
  'cartographer-tools',
  'cobblers-tools',
  'cooks-utensils',
  'dice',
  'dice-set',
  'disguise-kit',
  'dragonchess',
  'drum',
  'dulcimer',
  'flute',
  'forgery-kit',
  'glassblowers-tools',
  'herbalism-kit',
  'horn',
  'jewelers-tools',
  'leatherworkers-tools',
  'lute',
  'lyre',
  'masons-tools',
  'navigators-tools',
  'painters-supplies',
  'pan-flute',
  'playing-card-set',
  'playing-cards',
  'poisoners-kit',
  'potters-tools',
  'shawm',
  'smiths-tools',
  'thieves-tools',
  'three-dragon-ante',
  'tinkers-tools',
  'viol',
  'weavers-tools',
  'woodcarvers-tools'
]);

const consumableIndexes = new Set([
  'acid',
  'acid-vial',
  'alchemists-fire',
  'alchemists-fire-flask',
  'animal-feed-1-day',
  'antitoxin',
  'antitoxin-vial',
  'arrow',
  'arrows',
  'blowgun-needle',
  'bolts',
  'bullets-firearm',
  'bullets-sling',
  'crossbow-bolt',
  'holy-water',
  'holy-water-flask',
  'oil',
  'oil-flask',
  'poison-basic',
  'poison-basic-vial',
  'potion-of-healing',
  'rations',
  'rations-1-day',
  'sling-bullet',
  'spell-scroll-cantrip',
  'spell-scroll-level-1'
]);

const weaponIndexes = new Set([
  'net'
]);

const normalizeEquipmentText = (...parts) => parts.join(' ').toLowerCase();

const toAbilityScoreIncrease = (entry) => ({
  ability: abilityIndexMap[entry.ability_score?.index] ?? 'strength',
  amount: entry.bonus
});

const inferEquipmentType = (entry) => {
  if (entry.armor_category === 'Shield' || entry.index === 'shield') return 'shield';

  const normalizedText = normalizeEquipmentText(
    entry.index,
    entry.name,
    entry.equipment_category?.name,
    ...(entry.properties ?? []).map((property) => property.name),
    ...(entry.desc ?? [])
  );
  const weaponPropertyNames = new Set((entry.properties ?? []).map((property) => property.name));

  if (weaponIndexes.has(entry.index)) return 'weapon';
  if (entry.weapon_category || entry.weapon_range || entry.damage?.damage_dice) return 'weapon';
  if ([
    'Ammunition',
    'Finesse',
    'Heavy',
    'Light',
    'Loading',
    'Reach',
    'Special',
    'Thrown',
    'Two-Handed',
    'Versatile'
  ].some((property) => weaponPropertyNames.has(property))) {
    return 'weapon';
  }
  if (entry.armor_category || entry.armor_class) return 'armor';

  const category = entry.equipment_category?.name?.toLowerCase() ?? '';
  if (category.includes('weapon')) return 'weapon';
  if (category.includes('armor')) return 'armor';
  if (
    category.includes('tool')
    || category.includes('gaming set')
    || category.includes('musical instrument')
    || category.includes("artisan's tools")
  ) {
    return 'tool';
  }
  if (category.includes('potion') || category.includes('ammunition') || category.includes('poison')) return 'consumable';
  if (toolIndexes.has(entry.index)) return 'tool';
  if (consumableIndexes.has(entry.index)) return 'consumable';
  if (normalizedText.includes('ammunition')) return 'consumable';
  if (normalizedText.includes('potion')) return 'consumable';
  if (normalizedText.includes('musical instrument') || normalizedText.includes('gaming set')) return 'tool';
  if (category.includes('adventuring gear')) return 'gear';
  return 'gear';
};

// The 2014 SRD records a tool's family in `tool_category`; the 2024 dataset dropped that field
// and lists the family as one of the entry's `equipment_categories` instead.
const toolCategoryNames = new Set(['Artisan’s Tools', "Artisan's Tools", 'Gaming Sets', 'Musical Instruments', 'Other Tools']);

const getToolCategory = (entry) => {
  if (entry.tool_category) {
    return entry.tool_category;
  }

  return (entry.equipment_categories ?? [])
    .map((category) => category?.name)
    .find((name) => name && toolCategoryNames.has(name));
};

// Spellcasting foci are named by family in a class kit ("an arcane focus"), so the family has to
// travel with the item or the builder has nothing to offer. 2014 states it as `gear_category`,
// 2024 lists it among `equipment_categories` — the same shape change that hit tools and weapons.
const gearCategoryNames = new Set(['Arcane Foci', 'Druidic Foci', 'Holy Symbols']);

const getGearCategory = (entry) => {
  if (gearCategoryNames.has(entry.gear_category?.name)) {
    return entry.gear_category.name;
  }

  return (entry.equipment_categories ?? [])
    .map((category) => category?.name)
    .find((name) => name && gearCategoryNames.has(name));
};

// The same shape change hit weapons: 2014 states `weapon_category` ("Martial") and `weapon_range`
// ("Melee") outright, 2024 states neither and lists "Martial Melee Weapons" among its
// `equipment_categories`. Without these two the 2024 printings carried no category at all, so a
// sheet could not tell whether the character was proficient with them and read every one as melee.
const weaponCategoryIndexes = new Set(['simple', 'martial']);
const weaponRangeIndexes = new Set(['melee', 'ranged']);

const getWeaponFacet = (entry, allowed, explicit) => {
  if (explicit) return explicit.toLowerCase();
  for (const category of entry.equipment_categories ?? []) {
    // "martial-melee-weapons" -> ['martial', 'melee', 'weapons']
    for (const part of String(category?.index ?? '').split('-')) {
      if (allowed.has(part)) return part;
    }
  }
  return undefined;
};

// Feats carry their benefits in two different shapes: the 2014 dataset splits them into a `desc`
// array whose benefit lines start with "-", while the 2024 dataset ships one markdown
// `description` string whose benefits are "**Name.** text" lines. Reading only the 2014 shape
// left every 2024 feat with an empty description and no benefits at all.
const featBenefitHeadingPattern = /^\*\*(.+?)\.?\*\*\s*/;

const parseFeatText = (feat) => {
  const lines = Array.isArray(feat.desc) && feat.desc.length > 0
    ? feat.desc
    : String(feat.description ?? '').split('\n');
  const preamble = [];
  const benefits = [];

  lines.map((line) => String(line).trim()).filter(Boolean).forEach((line) => {
    const headingMatch = featBenefitHeadingPattern.exec(line);
    if (headingMatch) {
      benefits.push({ name: headingMatch[1].trim(), description: line.slice(headingMatch[0].length).trim() });
      return;
    }

    if (line.startsWith('-')) {
      benefits.push({ name: '', description: line.replace(/^-\s*/, '') });
      return;
    }

    preamble.push(line);
  });

  return { description: preamble.join(' '), benefits };
};

const toEquipmentOptionType = (name = 'gear') => {
  const normalized = name.toLowerCase();
  if (normalized.includes('weapon')) return 'weapon';
  if (normalized.includes('armor') || normalized.includes('shield')) return 'armor';
  if (
    normalized.includes('tool')
    || normalized.includes('musical instrument')
    || normalized.includes('gaming set')
    || normalized.includes('supplies')
    || normalized.includes('utensils')
  ) {
    return 'tool';
  }
  if (normalized.includes('pack')) return 'pack';
  if (/\b(cp|sp|ep|gp|pp)\b/.test(normalized)) return 'gold';
  return 'gear';
};

const formatStructuredEquipmentOption = (option) => {
  if (!option) {
    return '';
  }

  const prefix = option.count ? `${option.count} ` : '';
  return `${prefix}${option.name}`;
};

const getOptionsArraySource = (optionSet) => {
  if (optionSet?.option_set_type === 'options_array') {
    return optionSet;
  }

  if (optionSet?.from?.option_set_type === 'options_array') {
    return optionSet.from;
  }

  return undefined;
};

const toCountedReferenceEquipmentOption = (optionSet, equipmentTypeByIndex) => {
  const referenced = optionSet.of ?? optionSet.item;
  const name = referenced?.name;
  if (!name) {
    return undefined;
  }

  return {
    name,
    type: equipmentTypeByIndex.get(referenced.index) ?? toEquipmentOptionType(name),
    count: optionSet.count ?? 1
  };
};

const toMoneyEquipmentOption = (optionSet) => {
  if (!optionSet.count || !optionSet.unit) {
    return undefined;
  }

  return {
    name: `${optionSet.count} ${optionSet.unit}`,
    type: 'gold'
  };
};

const toReferenceEquipmentOption = (optionSet, equipmentTypeByIndex) => {
  const referenced = optionSet.item ?? optionSet.of;
  const name = referenced?.name;
  if (!name) {
    return undefined;
  }

  return {
    name,
    type: equipmentTypeByIndex.get(referenced.index) ?? toEquipmentOptionType(name)
  };
};

const toMultipleEquipmentOption = (optionSet, equipmentTypeByIndex) => {
  const items = (optionSet.items ?? []).map((entry) => toStructuredEquipmentOption(entry, equipmentTypeByIndex)).filter(Boolean);
  if (items.length === 0) {
    return undefined;
  }

  return {
    name: items.map(formatStructuredEquipmentOption).join(', '),
    type: items.every((entry) => entry.type === 'gold') ? 'gold' : 'gear'
  };
};

const toOptionsArrayEquipmentOption = (optionSet, equipmentTypeByIndex) => {
  const optionsArray = getOptionsArraySource(optionSet);
  if (!optionsArray) {
    return undefined;
  }

  const alternatives = (optionsArray.options ?? [])
    .map((entry) => toStructuredEquipmentOption(entry, equipmentTypeByIndex))
    .filter(Boolean);

  if (alternatives.length === 0) {
    return undefined;
  }

  return {
    name: `Choose ${optionSet.choose ?? 1}`,
    type: 'gear',
    alternatives
  };
};

const toEquipmentCategoryOption = (optionSet) => {
  if (optionSet?.from?.option_set_type !== 'equipment_category') {
    return undefined;
  }

  const categoryName = optionSet.from.equipment_category?.name ?? 'equipment';
  return {
    name: `Choose ${optionSet.choose ?? 1} from ${categoryName}`,
    type: toEquipmentOptionType(categoryName)
  };
};

const toStructuredEquipmentOption = (optionSet, equipmentTypeByIndex) => {
  if (!optionSet) {
    return undefined;
  }

  if (Array.isArray(optionSet)) {
    const alternatives = optionSet.map((entry) => toStructuredEquipmentOption(entry, equipmentTypeByIndex)).filter(Boolean);
    if (alternatives.length === 0) {
      return undefined;
    }
    if (alternatives.length === 1) {
      return alternatives[0];
    }
    return {
      name: 'Choose 1',
      type: 'gear',
      alternatives
    };
  }

  if (optionSet.option_type === 'choice') {
    return toStructuredEquipmentOption(optionSet.choice, equipmentTypeByIndex);
  }

  if (optionSet.option_type === 'counted_reference') {
    return toCountedReferenceEquipmentOption(optionSet, equipmentTypeByIndex);
  }

  if (optionSet.option_type === 'money') {
    return toMoneyEquipmentOption(optionSet);
  }

  if (optionSet.option_type === 'reference') {
    return toReferenceEquipmentOption(optionSet, equipmentTypeByIndex);
  }

  if (optionSet.option_type === 'multiple') {
    return toMultipleEquipmentOption(optionSet, equipmentTypeByIndex);
  }

  const optionsArrayOption = toOptionsArrayEquipmentOption(optionSet, equipmentTypeByIndex);
  if (optionsArrayOption) {
    return optionsArrayOption;
  }

  const equipmentCategoryOption = toEquipmentCategoryOption(optionSet);
  if (equipmentCategoryOption) {
    return equipmentCategoryOption;
  }

  return undefined;
};

const extractStructuredEquipmentOptions = (optionSet, equipmentTypeByIndex) => {
  const option = toStructuredEquipmentOption(optionSet, equipmentTypeByIndex);
  return option ? [option] : [];
};

const toSentenceList = (values) => {
  if (values.length <= 1) {
    return values[0] ?? '';
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
};

const stringifySpeed = (speed) => {
  if (typeof speed === 'string') return speed;
  if (!speed || typeof speed !== 'object') return '30 ft.';
  return Object.entries(speed)
    .filter(([, value]) => Boolean(value))
    .map(([mode, value]) => (mode === 'walk' ? String(value) : `${mode} ${value}`))
    .join(', ');
};

const formatChoiceOptions = (optionSet, options) => {
  if (options.length === 0) {
    return [];
  }

  if (optionSet.choose && options.length > 1) {
    return [`Choose ${optionSet.choose}: ${options.join(' or ')}`];
  }

  return options;
};

const extractMultipleOptionStrings = (optionSet) => {
  const items = (optionSet.items ?? []).flatMap((entry) => extractOptionStrings(entry));
  return items.length > 0 ? [items.join(', ')] : [];
};

const extractReferenceOptionStrings = (optionSet) => {
  const name = optionSet.of?.name ?? optionSet.item?.name;
  return name ? [`${optionSet.count ?? 1} ${name}`] : [];
};

const extractOptionsArrayStrings = (optionSet, optionsArray) => {
  const options = (optionsArray.options ?? [])
    .map((option) => extractOptionStrings(option).join(', ') || option.desc || option.name)
    .filter(Boolean);

  return formatChoiceOptions(optionSet, options);
};

const extractOptionStrings = (optionSet) => {
  if (!optionSet) {
    return [];
  }

  if (Array.isArray(optionSet)) {
    return optionSet.flatMap((entry) => extractOptionStrings(entry));
  }

  if (optionSet.option_type === 'multiple') {
    return extractMultipleOptionStrings(optionSet);
  }

  if (optionSet.option_type === 'counted_reference') {
    return extractReferenceOptionStrings(optionSet);
  }

  if (optionSet.option_type === 'money') {
    return optionSet.count && optionSet.unit ? [`${optionSet.count} ${optionSet.unit}`] : [];
  }

  if (optionSet.option_type === 'reference') {
    return [optionSet.item?.name ?? optionSet.of?.name].filter(Boolean);
  }

  if (optionSet.option_type === 'choice') {
    return extractOptionStrings(optionSet.choice);
  }

  if (optionSet.option_set_type === 'options_array') {
    return extractOptionsArrayStrings(optionSet, optionSet);
  }

  if (!optionSet?.from) {
    return [];
  }

  if (optionSet.from.option_set_type === 'options_array') {
    return extractOptionsArrayStrings(optionSet, optionSet.from);
  }

  if (optionSet.from.option_set_type === 'equipment_category') {
    return [`Choose ${optionSet.choose ?? 1} from ${optionSet.from.equipment_category?.name ?? 'equipment'}`];
  }

  return [];
};

const splitBackgroundProficiencies = (entries = []) => {
  return entries.reduce((result, entry) => {
    const name = entry.name ?? '';
    if (!name) {
      return result;
    }

    if (/^Skill:/i.test(name)) {
      result.skillProficiencies.push(name.replace(/^Skill:\s*/i, ''));
      return result;
    }

    if (/^Tool:/i.test(name)) {
      result.toolProficiencies.push(name.replace(/^Tool:\s*/i, ''));
      return result;
    }

    if (/^Language:/i.test(name)) {
      result.languageCount += 1;
    }

    return result;
  }, {
    skillProficiencies: [],
    toolProficiencies: [],
    languageCount: 0
  });
};

const buildBackgroundSummary = ({ background, featDescription, skillProficiencies, toolProficiencies }) => {
  const summaryParts = [];
  if (background.feat?.name) {
    const featNote = background.feat.note ? ` (${background.feat.note})` : '';
    summaryParts.push(`Grants the ${background.feat.name} feat${featNote}.`);
  }
  if (skillProficiencies.length > 0) {
    summaryParts.push(`Provides proficiency in ${toSentenceList(skillProficiencies)}.`);
  }
  if (toolProficiencies.length > 0) {
    summaryParts.push(`Also grants ${toSentenceList(toolProficiencies)}.`);
  }
  if (featDescription) {
    summaryParts.push(featDescription);
  }

  return summaryParts.join(' ');
};

export const createPack = async ({ edition, sourceId, label, category, includeCoreSpeciesAndBackgrounds = false }) => {
  // Top-level entry ids must be unique across sources: both editions share the raw SRD
  // indexes (e.g. "fireball", "longsword", "acolyte", "grappler"), and colliding ids make
  // one edition silently shadow the other in the merged registry.
  const toSourcedEntryId = (index) => `${sourceId}-${index}`;
  const [spells, equipment, feats, monsters, backgrounds, races, subraces, traits] = await Promise.all([
    readEditionJson(edition, '5e-SRD-Spells.json'),
    readEditionJson(edition, '5e-SRD-Equipment.json'),
    readEditionJson(edition, '5e-SRD-Feats.json'),
    readEditionJson(edition, '5e-SRD-Monsters.json'),
    readEditionJson(edition, '5e-SRD-Backgrounds.json'),
    readEditionJson(edition, '5e-SRD-Races.json'),
    readEditionJson(edition, '5e-SRD-Subraces.json'),
    readEditionJson(edition, '5e-SRD-Traits.json')
  ]);

  const traitMap = new Map(traits.map((entry) => [entry.index, entry]));
  const subracesByRace = subraces.reduce((groups, entry) => {
    const raceId = entry.race?.index;
    if (!raceId) return groups;
    groups[raceId] = [...(groups[raceId] ?? []), entry];
    return groups;
  }, {});

  const equipmentTypeByIndex = new Map(equipment.map((entry) => [entry.index, inferEquipmentType(entry)]));
  const featDescriptionByIndex = new Map(feats.map((entry) => [entry.index, entry.description ?? (entry.desc ?? []).join(' ')]));
  const edition2024SuggestedCharacteristics = edition === '2024' && !includeCoreSpeciesAndBackgrounds
    ? await extract2024BackgroundSuggestedCharacteristics()
    : [];
  let backgroundEntries = [];

  if (includeCoreSpeciesAndBackgrounds) {
    backgroundEntries = backgrounds.map((background) => ({
      id: toSourcedEntryId(background.index),
      name: background.name,
      description: background.feature?.desc?.[0] ?? `${background.name} background from ${label}.`,
      skillProficiencies: (background.starting_proficiencies ?? []).map((entry) => entry.name?.replace(/^Skill:\s*/i, '')).filter(Boolean),
      toolProficiencies: (background.starting_proficiencies ?? []).map((entry) => entry.name).filter((entry) => entry && !/^Skill:/i.test(entry)).filter(Boolean),
      languageCount: background.language_options?.choose,
      equipment: [
        ...(background.starting_equipment ?? []).map((entry) => ({
          name: entry.equipment?.name,
          type: equipmentTypeByIndex.get(entry.equipment?.index) ?? toEquipmentOptionType(entry.equipment?.name ?? 'gear'),
          count: entry.quantity
        })),
        ...(background.starting_equipment_options ?? []).flatMap((option) => extractStructuredEquipmentOptions(option, equipmentTypeByIndex))
      ].filter((entry) => entry.name),
      feature: {
        name: background.feature?.name ?? `${background.name} Feature`,
        description: (background.feature?.desc ?? []).join(' ')
      },
      personalityTraits: extractOptionStrings(background.personality_traits),
      ideals: extractOptionStrings(background.ideals),
      bonds: extractOptionStrings(background.bonds),
      flaws: extractOptionStrings(background.flaws),
      suggestedCharacteristics: [
        ...extractOptionStrings(background.personality_traits),
        ...extractOptionStrings(background.ideals),
        ...extractOptionStrings(background.bonds),
        ...extractOptionStrings(background.flaws)
      ],
      source: label,
      sourceId
    }));
  } else if (edition === '2024') {
    backgroundEntries = backgrounds.map((background) => {
      const { skillProficiencies, toolProficiencies, languageCount } = splitBackgroundProficiencies(background.proficiencies ?? []);
      const featDescription = featDescriptionByIndex.get(background.feat?.index) ?? '';
      const equipmentChoices = extractStructuredEquipmentOptions(background.equipment_options ?? [], equipmentTypeByIndex);

      return {
        id: toSourcedEntryId(background.index),
        name: background.name,
        description: buildBackgroundSummary({
          background,
          featDescription,
          skillProficiencies,
          toolProficiencies
        }) || `${background.name} background from ${label}.`,
        skillProficiencies,
        toolProficiencies: toolProficiencies.length > 0 ? toolProficiencies : undefined,
        languageCount: languageCount || undefined,
        equipment: equipmentChoices,
        feature: {
          name: background.feat?.name ?? `${background.name} Feature`,
          description: featDescription || `This background grants the ${background.feat?.name ?? background.name} feat.`
        },
        personalityTraits: edition2024SuggestedCharacteristics,
        ideals: [],
        bonds: [],
        flaws: [],
        suggestedCharacteristics: edition2024SuggestedCharacteristics,
        source: label,
        sourceId
      };
    });
  }

  return {
    schemaVersion: 'ddbcc-v1',
    source: {
      sourceId,
      label,
      category,
      aliases: [],
      description: `Generated from local ${edition} SRD/free-core data bundled via febdnddata.`,
      origin: 'generated',
      importedAt: new Date().toISOString(),
      parser: `febdnddata-${edition}`,
      visibility: 'private'
    },
    content: {
      species: includeCoreSpeciesAndBackgrounds
        ? races.map((race) => ({
            id: toSourcedEntryId(race.index),
            name: race.name,
            description: race.alignment || race.size_description || `${race.name} from the ${label}.`,
            size: race.size,
            speed: race.speed,
            abilityScoreIncreases: (race.ability_bonuses ?? []).map(toAbilityScoreIncrease),
            features: (race.traits ?? []).map((trait, index) => ({
              id: `${race.index}-trait-${index + 1}`,
              name: trait.name,
              description: (traitMap.get(trait.index)?.desc ?? []).join(' ') || `${trait.name}.`,
              level: 1,
              source: label
            })),
            languages: (race.languages ?? []).map((entry) => entry.name),
            variants: (subracesByRace[race.index] ?? []).map((subrace) => ({
              id: subrace.index,
              name: subrace.name,
              description: subrace.desc,
              abilityScoreIncreases: (subrace.ability_bonuses ?? []).map(toAbilityScoreIncrease),
              features: (subrace.racial_traits ?? []).map((trait, index) => ({
                id: `${subrace.index}-trait-${index + 1}`,
                name: trait.name,
                description: (traitMap.get(trait.index)?.desc ?? []).join(' ') || `${trait.name}.`,
                level: 1,
                source: label
              }))
            })),
            source: label,
            sourceId
          }))
        : [],
      classes: [],
      subclasses: [],
      backgrounds: backgroundEntries,
      spells: spells.map((spell) => {
        const components = [...(spell.components ?? [])];
        if (spell.material && components.includes('M')) {
          const materialIndex = components.indexOf('M');
          components[materialIndex] = `M (${spell.material})`;
        }

        return {
          id: toSourcedEntryId(spell.index),
          name: spell.name,
          level: spell.level,
          school: spell.school?.name ?? 'Unknown',
          castingTime: spell.casting_time,
          range: spell.range,
          components,
          duration: spell.duration,
          description: (spell.desc ?? []).join(' '),
          higherLevels: (spell.higher_level ?? []).join(' ') || undefined,
          ritual: Boolean(spell.ritual),
          concentration: Boolean(spell.concentration),
          classes: (spell.classes ?? []).map((entry) => entry.name),
          source: label,
          sourceId
        };
      }),
      equipment: equipment.map((entry) => ({
        id: toSourcedEntryId(entry.index),
        name: entry.name,
        type: inferEquipmentType(entry),
        source: label,
        sourceId,
        cost: {
          amount: entry.cost?.quantity ?? 0,
          unit: entry.cost?.unit ?? 'gp'
        },
        weight: entry.weight ?? 0,
        description: (entry.desc ?? []).join(' ') || undefined,
        weaponCategory: getWeaponFacet(entry, weaponCategoryIndexes, entry.weapon_category),
        weaponType: getWeaponFacet(entry, weaponRangeIndexes, entry.weapon_range),
        // "Artisan's Tools" / "Gaming Sets" / "Musical Instruments" — what a proficiency phrased
        // as "one type of gaming set" is actually choosing between.
        toolCategory: getToolCategory(entry),
        // "Arcane Foci" / "Druidic Foci" / "Holy Symbols" — what a starting-equipment line phrased
        // as "an arcane focus" is actually choosing between.
        gearCategory: getGearCategory(entry),
        damage: entry.damage?.damage_dice,
        damageType: entry.damage?.damage_type?.name,
        // Versatile's larger die. The property name alone says a weapon *has* a two-handed line
        // without saying what it is, and a sheet must not guess one die size up.
        versatileDamage: entry.two_handed_damage?.damage_dice,
        properties: (entry.properties ?? []).map((property) => property.name),
        range: entry.range ? { normal: entry.range.normal, long: entry.range.long } : undefined,
        armorCategory: entry.armor_category ? entry.armor_category.toLowerCase() : undefined,
        ac: Array.isArray(entry.armor_class) ? entry.armor_class[0]?.value : entry.armor_class?.base,
        maxDexBonus: entry.armor_class?.dex_bonus ? entry.armor_class.max_bonus : undefined,
        strengthRequirement: entry.str_minimum,
        stealthDisadvantage: entry.stealth_disadvantage || undefined
      })),
      feats: feats.map((feat) => {
        const { description, benefits } = parseFeatText(feat);
        return {
          id: toSourcedEntryId(feat.index),
          name: feat.name,
          description,
          prerequisites: (feat.prerequisites ?? []).length > 0
            ? {
                ability: Object.fromEntries((feat.prerequisites ?? [])
                  .filter((entry) => entry.ability_score?.index)
                  .map((entry) => [abilityIndexMap[entry.ability_score.index], entry.minimum_score]))
              }
            : undefined,
          // Only the 2024 dataset names its benefits; a synthetic "<Feat> Benefit 1" label adds
          // nothing the reader can use, so unnamed benefits stay unnamed and render as plain text.
          features: benefits.map((benefit, index) => ({
            id: `${feat.index}-feature-${index + 1}`,
            name: benefit.name,
            description: benefit.description,
            level: 1,
            source: label
          })),
          source: label,
          sourceId
        };
      }),
      monsters: monsters.map((monster) => ({
        id: toSourcedEntryId(monster.index),
        name: monster.name,
        description: `${monster.name} from the ${label}.`,
        size: monster.size,
        type: titleCase(monster.type),
        alignment: monster.alignment,
        ac: Array.isArray(monster.armor_class) ? monster.armor_class[0]?.value ?? 10 : monster.armor_class?.base ?? 10,
        hp: {
          average: monster.hit_points,
          formula: monster.hit_points_roll || monster.hit_dice
        },
        speed: stringifySpeed(monster.speed),
        abilityScores: {
          strength: monster.strength,
          dexterity: monster.dexterity,
          constitution: monster.constitution,
          intelligence: monster.intelligence,
          wisdom: monster.wisdom,
          charisma: monster.charisma
        },
        savingThrows: (monster.proficiencies ?? []).filter((entry) => /^Saving Throw:/i.test(entry.proficiency?.name ?? '')).map((entry) => entry.proficiency.name),
        skills: (monster.proficiencies ?? []).filter((entry) => /^Skill:/i.test(entry.proficiency?.name ?? '')).map((entry) => entry.proficiency.name.replace(/^Skill:\s*/i, '')),
        damageVulnerabilities: monster.damage_vulnerabilities ?? undefined,
        damageResistances: monster.damage_resistances ?? undefined,
        damageImmunities: monster.damage_immunities ?? undefined,
        conditionImmunities: (monster.condition_immunities ?? []).map((entry) => entry.name ?? entry),
        senses: Object.entries(monster.senses ?? {}).map(([sense, value]) => `${sense} ${value}`),
        languages: parseMonsterLanguages(monster.languages),
        challengeRating: String(monster.challenge_rating),
        proficiencyBonus: monster.proficiency_bonus,
        traits: (monster.special_abilities ?? []).map((entry, index) => ({
          id: `${monster.index}-trait-${index + 1}`,
          name: entry.name,
          description: entry.desc
        })),
        actions: (monster.actions ?? []).map((entry, index) => ({
          id: `${monster.index}-action-${index + 1}`,
          name: entry.name,
          description: entry.desc,
          attackBonus: entry.attack_bonus,
          damage: (entry.damage ?? []).map((damage) => damage.damage_dice).filter(Boolean).join(' + ') || undefined
        })),
        bonusActions: (monster.bonus_actions ?? []).map((entry, index) => ({
          id: `${monster.index}-bonus-action-${index + 1}`,
          name: entry.name,
          description: entry.desc,
          attackBonus: entry.attack_bonus,
          damage: (entry.damage ?? []).map((damage) => damage.damage_dice).filter(Boolean).join(' + ') || undefined
        })),
        reactions: (monster.reactions ?? []).map((entry, index) => ({
          id: `${monster.index}-reaction-${index + 1}`,
          name: entry.name,
          description: entry.desc,
          attackBonus: entry.attack_bonus,
          damage: (entry.damage ?? []).map((damage) => damage.damage_dice).filter(Boolean).join(' + ') || undefined
        })),
        legendaryActions: (monster.legendary_actions ?? []).map((entry, index) => ({
          id: `${monster.index}-legendary-action-${index + 1}`,
          name: entry.name,
          description: entry.desc,
          attackBonus: entry.attack_bonus,
          damage: (entry.damage ?? []).map((damage) => damage.damage_dice).filter(Boolean).join(' + ') || undefined
        })),
        source: label,
        sourceId
      })),
      ua: []
    },
    sections: [],
    documents: [],
    notes: [
      `Generated from the local ${edition} SRD/free-core dataset packaged in febdnddata.`,
      includeCoreSpeciesAndBackgrounds
        ? 'This pack includes species and backgrounds in addition to the core spell, equipment, feat, and monster buckets.'
        : 'This pack focuses on free-core buckets available in the local dataset for this edition.'
    ]
  };
};

// SRD prose carries the same page navigation as the HTML dumps ("a book of spells is a spellbook
// (described later in this section)") but never passes through the HTML extractor, so the shared
// rewriter is applied to the finished pack's prose fields instead.
const crossReferenceTextKeys = new Set(['description', 'text', 'summary', 'feature']);

const rewritePackCrossReferences = (value, key) => {
  if (typeof value === 'string') {
    return crossReferenceTextKeys.has(key) ? rewriteSourceCrossReferences(value) : value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => rewritePackCrossReferences(entry, key));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [entryKey, rewritePackCrossReferences(entryValue, entryKey)])
    );
  }

  return value;
};

const writePack = async (pack, targetPath) => {
  const exportName = `${path.basename(targetPath, path.extname(targetPath)).replaceAll(/\W/g, '_')}_source`;
  await fs.writeFile(targetPath, generateSourceModuleText(rewritePackCrossReferences(pack, ''), exportName), 'utf8');
};

const createEmptyBucketContent = () => ({
  species: [],
  classes: [],
  subclasses: [],
  backgrounds: [],
  spells: [],
  equipment: [],
  feats: [],
  monsters: [],
  ua: []
});

const createSplitBucketPack = (pack, bucket) => ({
  ...pack,
  notes: [
    `Generated split ${bucket} bucket for ${pack.source.label}.`,
    ...(pack.notes ?? [])
  ],
  content: {
    ...createEmptyBucketContent(),
    [bucket]: pack.content[bucket]
  }
});

const writeSplitPacks = async (sourceId, pack) => {
  const outputs = [];

  for (const bucket of splitBucketOrder) {
    const entries = pack.content[bucket] ?? [];
    const targetPath = getSplitBucketPath(sourceId, bucket);
    if (entries.length === 0) {
      try {
        await fs.unlink(targetPath);
      } catch {
        // Ignore missing split bucket files.
      }
      continue;
    }

    const bucketPack = createSplitBucketPack(pack, bucket);
    await writePack(bucketPack, targetPath);
    outputs.push(targetPath);
  }

  return outputs;
};

export const createFreeCorePackForSourceId = async (sourceId) => {
  const config = sourceConfigs[sourceId];
  if (!config) {
    return undefined;
  }

  return createPack(config);
};

const magicItemEquipmentTypeByCategory = {
  Armor: 'armor',
  Ammunition: 'consumable',
  Potion: 'consumable',
  Scroll: 'consumable',
  Weapon: 'weapon'
};

// The SRD magic-item list reproduces the Dungeon Master's Guide treasure chapter, which
// is the only DMG player-facing content available in the local dataset.
export const createDmgPack = async () => {
  const label = "Dungeon Master's Guide";
  const sourceId = 'dmg';
  const magicItems = await readEditionJson('2014', '5e-SRD-Magic-Items.json');
  const equipment = magicItems
    .filter((item) => !item.variant)
    .map((item) => ({
      id: `${sourceId}-${item.index}`,
      name: item.name,
      type: magicItemEquipmentTypeByCategory[item.equipment_category?.name] ?? 'gear',
      source: label,
      sourceId,
      cost: { amount: 0, unit: 'gp' },
      weight: 0,
      description: (item.desc ?? []).join(' ') || `${item.name} magic item.`
    }));

  return {
    schemaVersion: 'ddbcc-v1',
    source: {
      sourceId,
      label,
      category: 'core',
      aliases: [],
      description: 'Magic items from the local 2014 SRD dataset bundled via febdnddata.',
      origin: 'generated',
      importedAt: new Date().toISOString(),
      parser: 'febdnddata-2014-magic-items',
      visibility: 'private'
    },
    content: {
      ...createEmptyBucketContent(),
      equipment
    },
    sections: [],
    documents: [],
    notes: [
      'Generated from the local 2014 SRD magic-item dataset packaged in febdnddata.',
      'The SRD covers the DMG magic-item chapter; other DMG chapters have no local source document.'
    ]
  };
};

const main = async () => {
  const basicRules2014Pack = await createFreeCorePackForSourceId('basic-rules-2014');
  const basicRules2024Pack = await createFreeCorePackForSourceId('basic-rules-2024');

  const basicRules2014Outputs = await writeSplitPacks('basic-rules-2014', basicRules2014Pack);
  const basicRules2024Outputs = await writeSplitPacks('basic-rules-2024', basicRules2024Pack);

  basicRules2014Outputs.forEach((outputPath) => console.log(`Wrote ${outputPath}`));
  basicRules2024Outputs.forEach((outputPath) => console.log(`Wrote ${outputPath}`));

  const dmgPack = await createDmgPack();
  const dmgPath = path.resolve(sourceFilesRoot, 'dmg.ts');
  await writePack(dmgPack, dmgPath);
  console.log(`Wrote ${dmgPath} (${dmgPack.content.equipment.length} magic items)`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await main();
}