import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  applyInlineFeatureChoiceOptions,
  collectHeadingBlocks,
  extractStructuredTexts,
  setDocumentReferenceContext,
  sliceSectionBody
} from './canonical-content.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(scriptPath), '..');

const htmlEntityMap = {
  '&amp;': '&',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' '
};

const decodeHtmlEntities = (value) => {
  return String(value ?? '').replaceAll(/&(amp|quot|#x27|#39|lt|gt|nbsp);/g, (match) => htmlEntityMap[match] ?? match);
};

// Inline elements render without whitespace; D&D Beyond splits words across inline tags
// (e.g. <span class="No-Break">), so inline tags are removed while block tags become
// spaces to keep adjacent cells/paragraphs separated.
const inlineTagNames = new Set(['a', 'abbr', 'b', 'cite', 'code', 'em', 'i', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'wbr']);
const tagOrCommentPattern = /<!--[\s\S]*?-->|<\/?([a-z][a-z0-9-]*)(?:\s[^>]*)?\/?>/gi;
const replaceTags = (value) => value.replaceAll(tagOrCommentPattern, (match, tagName) => (
  tagName && inlineTagNames.has(tagName.toLowerCase()) ? '' : ' '
));

const stripTags = (value) => {
  return decodeHtmlEntities(replaceTags(String(value ?? '')))
    .replaceAll(/[\u2018\u2019]/g, "'")
    .replaceAll(/[\u201C\u201D]/g, '"')
    .replaceAll(/\s+/g, ' ')
    .trim();
};

const normalizeIdentifier = (value) => stripTags(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();
const toOptionId = (value) => normalizeIdentifier(value).replaceAll(' ', '-');

const createFeatureOption = (name, description, prerequisites = undefined) => ({
  id: toOptionId(name),
  name: stripTags(name),
  description: stripTags(description),
  prerequisites
});

const extractParagraphEntries = (raw) => {
  return [...String(raw ?? '').matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/gi)]
    .map((match) => ({
      attrs: match[1] ?? '',
      raw: match[2] ?? '',
      text: stripTags(match[2] ?? '')
    }))
    .filter((entry) => entry.text);
};

const mergeFeatureOptions = (...collections) => {
  const merged = new Map();

  collections.flat().filter(Boolean).forEach((option) => {
    const key = option.id || toOptionId(option.name);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, option);
      return;
    }

    merged.set(key, {
      ...existing,
      description: existing.description?.length >= option.description?.length ? existing.description : option.description,
      prerequisites: existing.prerequisites ?? option.prerequisites
    });
  });

  return Array.from(merged.values()).sort((left, right) => left.name.localeCompare(right.name));
};

// Prerequisites are written both ways: "9th level" and "12th-level warlock". Requiring
// whitespace before the noun missed every hyphenated form, so those options (Bond of the
// Talisman, Far Scribe, Undying Servitude, ...) carried no minimum level and stayed selectable
// at level 1.
const minimumLevelPattern = /\b(\d+)(?:st|nd|rd|th)?\+?[\s-]?(?:level|warlock|sorcerer|fighter)\b/i;

const parseMinimumLevel = (text) => {
  const match = minimumLevelPattern.exec(stripTags(text));
  return match ? Number(match[1]) : undefined;
};

const extractAnchorTexts = (raw) => {
  return [...String(raw ?? '').matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ href: match[1] ?? '', text: stripTags(match[2] ?? '') }))
    .filter((entry) => entry.text);
};

const parseFeatureOptionPrerequisites = (raw, text) => {
  const normalizedText = stripTags(text);
  if (!normalizedText || !/^prerequisite/i.test(normalizedText)) {
    return undefined;
  }

  const prerequisiteText = normalizedText.replace(/^prerequisite\s*:\s*/i, '').trim();
  const minimumLevel = parseMinimumLevel(prerequisiteText);
  const requiredOptionIds = extractAnchorTexts(raw)
    .filter((entry) => entry.href.startsWith('#'))
    .map((entry) => toOptionId(entry.text));
  const extraRequiredOptions = [];
  // Talisman is a Tasha's Pact Boon option, so it belongs here alongside the three core boons —
  // without it the talisman invocations carried no pact requirement at all.
  const pactMatch = prerequisiteText.match(/Pact of the (Blade|Chain|Tome|Talisman)/gi) ?? [];
  pactMatch.forEach((entry) => {
    extraRequiredOptions.push(toOptionId(entry));
  });
  const requiredSpellIds = [];
  if (/eldritch blast/i.test(prerequisiteText)) {
    requiredSpellIds.push('eldritch-blast');
  }

  return {
    text: prerequisiteText,
    minimumLevel,
    requiredOptionIds: [...new Set([...requiredOptionIds, ...extraRequiredOptions])],
    requiredSpellIds: [...new Set(requiredSpellIds)]
  };
};

const extractFeatureOptionsFromSection = (raw, config) => {
  if (!raw || !config) {
    return [];
  }

  const sectionBlock = collectHeadingBlocks(raw, config.sectionLevel)
    .find((block) => normalizeIdentifier(block.title) === normalizeIdentifier(config.sectionTitle));
  if (!sectionBlock) {
    return [];
  }

  return collectHeadingBlocks(sectionBlock.content, config.optionLevel)
    .map((block) => {
      const body = sliceSectionBody(block.content);
      const paragraphs = extractParagraphEntries(body);
      const prerequisiteEntry = paragraphs.find((entry) => /^prerequisite/i.test(entry.text));
      // Only the first paragraph used to survive, which stripped the effect off every option
      // written in more than one: Gift of the Protectors and Far Scribe both ended up describing
      // nothing but the blank page they add, and Investment of the Chain Master promised
      // "the following benefits" with the bullet list that lists them dropped.
      const description = extractStructuredTexts(body)
        .filter((entry) => !/^prerequisite\b/i.test(entry) && !/^repeatable\.?$/i.test(entry))
        .join(' ')
        .trim();

      return createFeatureOption(
        block.title,
        description || `${block.title} option.`,
        parseFeatureOptionPrerequisites(prerequisiteEntry?.raw, prerequisiteEntry?.text)
      );
    })
    .filter((option) => option.name);
};

const extractNamedBattleMasterManeuvers = (raw) => {
  return [...new Set(
    extractParagraphEntries(raw)
      .filter((entry) => /^Maneuvers:/i.test(entry.text))
      .flatMap((entry) => entry.text.replace(/^Maneuvers:\s*/i, '').split(','))
      .map((name) => name.replaceAll('*', '').trim())
      .filter(Boolean)
  )].sort((left, right) => left.localeCompare(right));
};

const documentChoicePoolConfigs = {
  'basic-rules-2014': {
    metamagic: { sectionTitle: 'Metamagic', sectionLevel: 3, optionLevel: 4 },
    eldritchInvocations: { sectionTitle: 'Eldritch Invocations', sectionLevel: 2, optionLevel: 4 },
    pactBoons: { sectionTitle: 'Pact Boon', sectionLevel: 3, optionLevel: 4 }
  },
  'basic-rules-2024': {
    metamagic: { sectionTitle: 'Metamagic Options', sectionLevel: 4, optionLevel: 5 },
    eldritchInvocations: { sectionTitle: 'Eldritch Invocation Options', sectionLevel: 3, optionLevel: 4 }
  },
  tashas: {
    metamagic: { sectionTitle: 'Metamagic Options', sectionLevel: 3, optionLevel: 4 },
    eldritchInvocations: { sectionTitle: 'Eldritch Invocation Options', sectionLevel: 3, optionLevel: 4 },
    maneuverOptions: { sectionTitle: 'Maneuver Options', sectionLevel: 2, optionLevel: 3 },
    pactBoons: { sectionTitle: 'Pact Boon Option', sectionLevel: 3, optionLevel: 4 }
  }
};

const getChoicePoolEdition = (sourceId) => (/2024/i.test(sourceId ?? '') ? '2024' : '2014');

const createGrantFeature = (id, name, description, level, source, chooseCount, options) => ({
  id,
  name,
  description,
  level,
  source,
  requiresChoice: true,
  chooseCount,
  options
});

const normalizeFeatureName = (value) => normalizeIdentifier(value).replace(/^level \d+ /, '').trim();

// A choice feature's section nests one heading per option, so its own description runs on into
// the option bodies — Pact Boon read as its intro sentence followed by all three boons glued
// together, immediately above the selector that lists the same three. The options are extracted
// from that very text, so the description can be cut at the first one it repeats.
const trimRepeatedOptionBodies = (description, options) => {
  if (!description) {
    return description;
  }

  const cutIndex = (options ?? [])
    .map((option) => option.description?.slice(0, 60))
    .filter((snippet) => snippet && snippet.length >= 20)
    .map((snippet) => description.indexOf(snippet))
    .filter((index) => index > 0)
    .reduce((lowest, index) => Math.min(lowest, index), Number.POSITIVE_INFINITY);

  if (!Number.isFinite(cutIndex)) {
    return description;
  }

  return description.slice(0, cutIndex).replace(/[\s;,]+$/u, '').trim() || description;
};

const applyFeatureChoice = (features, featureName, supplement) => {
  const targetName = normalizeFeatureName(featureName);
  return (features ?? []).map((feature) => {
    if (normalizeFeatureName(feature.name) !== targetName) {
      return feature;
    }

    const options = mergeFeatureOptions(feature.options ?? [], supplement.options ?? []);
    return {
      ...feature,
      description: trimRepeatedOptionBodies(feature.description, options),
      options,
      chooseCount: feature.chooseCount ?? supplement.chooseCount,
      requiresChoice: feature.requiresChoice ?? true
    };
  });
};

const addGrantFeatures = (features, grants) => {
  if (!Array.isArray(grants) || grants.length === 0) {
    return features ?? [];
  }

  const existingIds = new Set((features ?? []).map((feature) => feature.id));
  const existingKeys = new Set((features ?? []).map((feature) => `${normalizeFeatureName(feature.name)}::${feature.level}`));
  const nextFeatures = [...(features ?? [])];

  grants.forEach((grant) => {
    const grantKey = `${normalizeFeatureName(grant.name)}::${grant.level}`;
    if (existingIds.has(grant.id) || existingKeys.has(grantKey)) {
      return;
    }

    nextFeatures.push(grant);
  });

  return nextFeatures;
};

const emptyClassSupplement = ({ id, name, description, source, sourceId, primaryAbility = 'charisma', features }) => ({
  id,
  name,
  description,
  hitDie: 0,
  primaryAbility,
  savingThrows: [],
  armorProficiencies: [],
  weaponProficiencies: [],
  toolProficiencies: [],
  skillChoices: [],
  skillCount: 0,
  features,
  subclasses: [],
  subclassLevel: 1,
  equipmentOptions: [],
  source,
  sourceId
});

const emptySubclassSupplement = ({ id, classId, name, description, source, sourceId, features }) => ({
  id,
  classId,
  name,
  description,
  features,
  source,
  sourceId
});

const resolveRawDocument = async (pack, rawDocument) => {
  if (rawDocument) {
    return rawDocument;
  }

  const documentPath = pack?.documents?.find((entry) => typeof entry?.path === 'string')?.path;
  if (!documentPath) {
    return null;
  }

  try {
    return await fs.readFile(documentPath, 'utf8');
  } catch {
    return null;
  }
};

const readOptionalWorkspaceDocument = async (fileName) => {
  const targetPath = path.resolve(workspaceRoot, fileName);
  try {
    return await fs.readFile(targetPath, 'utf8');
  } catch {
    return null;
  }
};

const buildExtractedChoicePools = async (pack, rawDocument) => {
  const sourceId = pack?.source?.sourceId;
  const localRaw = await resolveRawDocument(pack, rawDocument);
  const localConfig = documentChoicePoolConfigs[sourceId] ?? {};
  const edition = getChoicePoolEdition(sourceId);

  const localMetamagicOptions = extractFeatureOptionsFromSection(localRaw, localConfig.metamagic);
  const localInvocationOptions = extractFeatureOptionsFromSection(localRaw, localConfig.eldritchInvocations);
  const localTashaManeuvers = extractFeatureOptionsFromSection(localRaw, localConfig.maneuverOptions);
  const localPactBoonOptions = extractFeatureOptionsFromSection(localRaw, localConfig.pactBoons);

  let tashasRaw = null;
  let borrowedTashasDocument = false;
  if (sourceId === 'tashas') {
    tashasRaw = localRaw;
  } else if (edition === '2014') {
    tashasRaw = await readOptionalWorkspaceDocument('TCOE.txt');
    borrowedTashasDocument = Boolean(tashasRaw);
  }

  // These options are read out of Tasha's even while another pack is being imported, so the
  // cross-reference context has to follow the document: a "chapter 3" footnote inside a Tasha's
  // option means a Tasha's spell, not one from whichever book is currently being parsed.
  if (borrowedTashasDocument) {
    setDocumentReferenceContext(tashasRaw, "Tasha's Cauldron of Everything");
  }

  const tashasConfig = documentChoicePoolConfigs.tashas;
  const tashasMetamagicOptions = extractFeatureOptionsFromSection(tashasRaw, tashasConfig.metamagic);
  const tashasInvocationOptions = extractFeatureOptionsFromSection(tashasRaw, tashasConfig.eldritchInvocations);
  const tashasManeuverAdditions = extractFeatureOptionsFromSection(tashasRaw, tashasConfig.maneuverOptions);
  const tashasPactBoonOptions = extractFeatureOptionsFromSection(tashasRaw, tashasConfig.pactBoons);
  const baseBattleMasterNames = extractNamedBattleMasterManeuvers(tashasRaw)
    .filter((name) => !tashasManeuverAdditions.some((option) => normalizeIdentifier(option.name) === normalizeIdentifier(name)))
    .map((name) => createFeatureOption(name, 'Battle Master maneuver option.'));

  if (borrowedTashasDocument) {
    setDocumentReferenceContext(localRaw, pack?.source?.label);
  }

  return {
    edition,
    metamagicOptions: edition === '2014'
      ? mergeFeatureOptions(localMetamagicOptions, tashasMetamagicOptions)
      : localMetamagicOptions,
    eldritchInvocationOptions: edition === '2014'
      ? mergeFeatureOptions(localInvocationOptions, tashasInvocationOptions)
      : localInvocationOptions,
    // Pact of the Talisman lives in Tasha's, and the talisman invocations require it, so the
    // 2014 boon pool has to include the supplement's option or those invocations can never
    // become selectable.
    pactBoonOptions: edition === '2014'
      ? mergeFeatureOptions(localPactBoonOptions, tashasPactBoonOptions)
      : localPactBoonOptions,
    battleMasterManeuverOptions: mergeFeatureOptions(baseBattleMasterNames, localTashaManeuvers, tashasManeuverAdditions)
  };
};

const enrichClassEntry = (entry, extractedPools) => {
  const classKey = normalizeIdentifier(entry.name);

  if (classKey === 'sorcerer' && extractedPools.metamagicOptions.length > 0) {
    const additionalChoiceCount = extractedPools.edition === '2024' ? 2 : 1;
    return {
      ...entry,
      features: addGrantFeatures(
        applyFeatureChoice(entry.features, 'metamagic', { chooseCount: 2, options: extractedPools.metamagicOptions }),
        [10, 17].map((level) => createGrantFeature(
          `metamagic-additional-option-${level}`,
          'Additional Metamagic',
          `You learn ${additionalChoiceCount === 1 ? 'one additional Metamagic option' : 'two additional Metamagic options'}.`,
          level,
          entry.source,
          additionalChoiceCount,
          extractedPools.metamagicOptions
        ))
      )
    };
  }

  if (classKey === 'warlock' && extractedPools.eldritchInvocationOptions.length > 0) {
    const levels = extractedPools.edition === '2024' ? [2, 5, 7, 9, 12, 15, 18] : [5, 7, 9, 12, 15, 18];
    const baseChooseCount = extractedPools.edition === '2024' ? 1 : 2;
    const withPactBoons = extractedPools.pactBoonOptions.length > 0
      ? applyFeatureChoice(entry.features, 'pact boon', { chooseCount: 1, options: extractedPools.pactBoonOptions })
      : entry.features;
    return {
      ...entry,
      features: addGrantFeatures(
        applyFeatureChoice(withPactBoons, 'eldritch invocations', { chooseCount: baseChooseCount, options: extractedPools.eldritchInvocationOptions }),
        levels.map((level) => createGrantFeature(
          `eldritch-invocations-additional-${level}`,
          'Additional Eldritch Invocation',
          'You learn one additional Eldritch Invocation for which you qualify.',
          level,
          entry.source,
          1,
          extractedPools.eldritchInvocationOptions
        ))
      )
    };
  }

  return entry;
};

const enrichSubclassEntry = (entry, extractedPools) => {
  if (normalizeIdentifier(entry.name) !== 'battle master' || extractedPools.battleMasterManeuverOptions.length === 0) {
    return entry;
  }

  return {
    ...entry,
    features: addGrantFeatures(
      applyFeatureChoice(entry.features, 'combat superiority', { chooseCount: 3, options: extractedPools.battleMasterManeuverOptions }),
      [7, 10, 15].map((level) => createGrantFeature(
        `combat-superiority-additional-maneuvers-${level}`,
        'Additional Maneuvers',
        'You learn two additional maneuvers.',
        level,
        entry.source,
        2,
        extractedPools.battleMasterManeuverOptions
      ))
    )
  };
};

// When the pack already carries a same-name class or subclass entry (e.g. the extracted
// optional-feature supplements), fold the grant features into it instead of appending a
// duplicate placeholder that would inflate entry counts.
const mergeSupplementEntries = (entries, supplements) => {
  const remaining = [...supplements];
  const merged = entries.map((entry) => {
    const matchIndex = remaining.findIndex((candidate) => normalizeIdentifier(candidate.name) === normalizeIdentifier(entry.name) && (entry.hitDie ?? 0) <= 0);
    if (matchIndex === -1) {
      return entry;
    }

    const [match] = remaining.splice(matchIndex, 1);
    return {
      ...entry,
      features: addGrantFeatures(entry.features, match.features)
    };
  });

  return [...merged, ...remaining];
};

const appendTashasSupplements = (pack, extractedPools) => {
  if (pack?.source?.sourceId !== 'tashas') {
    return pack;
  }

  const classSupplements = [];
  const subclassSupplements = [];
  const source = pack.source.label;
  const sourceId = pack.source.sourceId;

  if (extractedPools.metamagicOptions.length > 0) {
    classSupplements.push(emptyClassSupplement({
      id: 'tashas-sorcerer-choice-pool-supplement',
      name: 'Sorcerer',
      description: 'Source-derived Metamagic option supplement.',
      source,
      sourceId,
      features: [createGrantFeature('tashas-metamagic-pool', 'Metamagic', 'Additional Metamagic options become available from this source.', 3, source, 2, extractedPools.metamagicOptions)]
    }));
  }

  if (extractedPools.eldritchInvocationOptions.length > 0 || extractedPools.pactBoonOptions.length > 0) {
    classSupplements.push(emptyClassSupplement({
      id: 'tashas-warlock-choice-pool-supplement',
      name: 'Warlock',
      description: 'Source-derived Eldritch Invocation and Pact Boon option supplement.',
      source,
      sourceId,
      features: [
        ...(extractedPools.eldritchInvocationOptions.length > 0
          ? [createGrantFeature('tashas-eldritch-invocation-pool', 'Eldritch Invocations', 'Additional Eldritch Invocation options become available from this source.', 2, source, 2, extractedPools.eldritchInvocationOptions)]
          : []),
        ...(extractedPools.pactBoonOptions.length > 0
          ? [createGrantFeature('tashas-pact-boon-pool', 'Pact Boon', 'Additional Pact Boon options become available from this source.', 3, source, 1, extractedPools.pactBoonOptions)]
          : [])
      ]
    }));
  }

  if (extractedPools.battleMasterManeuverOptions.length > 0) {
    subclassSupplements.push(emptySubclassSupplement({
      id: 'tashas-battle-master-choice-pool-supplement',
      classId: 'fighter',
      name: 'Battle Master',
      description: 'Source-derived Battle Master maneuver supplement.',
      source,
      sourceId,
      features: [
        createGrantFeature('tashas-combat-superiority-pool', 'Combat Superiority', 'Source-derived maneuver options from this supplement.', 3, source, 3, extractedPools.battleMasterManeuverOptions),
        ...[7, 10, 15].map((level) => createGrantFeature(
          `tashas-combat-superiority-additional-${level}`,
          'Additional Maneuvers',
          'You learn two additional maneuvers.',
          level,
          source,
          2,
          extractedPools.battleMasterManeuverOptions
        ))
      ]
    }));
  }

  return {
    ...pack,
    content: {
      ...pack.content,
      classes: mergeSupplementEntries(pack.content.classes ?? [], classSupplements),
      subclasses: mergeSupplementEntries(pack.content.subclasses ?? [], subclassSupplements)
    }
  };
};

const applyInlineChoicesToFeatures = (features) => (features ?? []).map((feature) => applyInlineFeatureChoiceOptions(feature));

// Surface explicit inline choices ("...of your choice: A, B, or C") as structured
// options on every bucket that carries features, so the builder can render selectors.
const applyInlineChoicesToContent = (content) => ({
  ...content,
  classes: (content.classes ?? []).map((entry) => ({
    ...entry,
    features: applyInlineChoicesToFeatures(entry.features),
    subclasses: (entry.subclasses ?? []).map((subclass) => ({
      ...subclass,
      features: applyInlineChoicesToFeatures(subclass.features)
    }))
  })),
  subclasses: (content.subclasses ?? []).map((entry) => ({
    ...entry,
    features: applyInlineChoicesToFeatures(entry.features)
  })),
  species: (content.species ?? []).map((entry) => ({
    ...entry,
    features: applyInlineChoicesToFeatures(entry.features),
    variants: entry.variants?.map((variant) => ({
      ...variant,
      features: applyInlineChoicesToFeatures(variant.features)
    }))
  })),
  feats: (content.feats ?? []).map((entry) => ({
    ...entry,
    features: applyInlineChoicesToFeatures(entry.features)
  }))
});

// A supplement's "…Options" section is a heading that introduces a pool ("When you choose eldritch
// invocations, you have access to these additional options."), not a feature the character gains.
// Its options are extracted into the pool and merged onto the real feature, so leaving the heading
// behind as a feature just prints a promise of options next to the feature that actually lists
// them. Sections that carry their own content, like "Additional Warlock Spells", are not pools and
// are kept.
const isPoolAnnouncementFeature = (feature, poolSectionNames) => {
  return Boolean(feature?.optional)
    && !(feature.options?.length > 0)
    && poolSectionNames.has(normalizeIdentifier(feature.name));
};

const dropPoolAnnouncementFeatures = (content, sourceId) => {
  const poolSectionNames = new Set(
    Object.values(documentChoicePoolConfigs[sourceId] ?? {}).map((config) => normalizeIdentifier(config.sectionTitle))
  );
  if (poolSectionNames.size === 0) {
    return content;
  }

  const filterFeatures = (features) => (features ?? []).filter((feature) => !isPoolAnnouncementFeature(feature, poolSectionNames));

  return {
    ...content,
    classes: (content.classes ?? []).map((entry) => ({
      ...entry,
      features: filterFeatures(entry.features),
      subclasses: (entry.subclasses ?? []).map((subclass) => ({
        ...subclass,
        features: filterFeatures(subclass.features)
      }))
    })),
    subclasses: (content.subclasses ?? []).map((entry) => ({
      ...entry,
      features: filterFeatures(entry.features)
    }))
  };
};

export const enrichCanonicalSourcePackageFeatureChoices = async (pack, { rawDocument } = {}) => {
  if (!pack?.content) {
    return pack;
  }

  const extractedPools = await buildExtractedChoicePools(pack, rawDocument);
  const enrichedPack = {
    ...pack,
    content: dropPoolAnnouncementFeatures(
      applyInlineChoicesToContent({
        ...pack.content,
        classes: (pack.content.classes ?? []).map((entry) => enrichClassEntry(entry, extractedPools)),
        subclasses: (pack.content.subclasses ?? []).map((entry) => enrichSubclassEntry(entry, extractedPools))
      }),
      pack.source?.sourceId
    )
  };

  return appendTashasSupplements(enrichedPack, extractedPools);
};