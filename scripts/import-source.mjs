#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  coerceToCanonicalSourcePackage,
  countContentEntries,
  generateSourceModuleText,
  parseDocumentToCanonicalSourcePackage,
  validateCanonicalSourcePackage
} from './canonical-content.mjs';
import { createFreeCorePackForSourceId } from './generate-free-core-sources.mjs';
import { enrichCanonicalSourcePackageFeatureChoices } from './structured-feature-choices.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(scriptPath), '..');
const appRoot = path.resolve(workspaceRoot, 'app');

const defaultSourceModuleFiles = {
  'phb-2014': 'src/data/sourceFiles/phb-2014.ts',
  'phb-2024': 'src/data/sourceFiles/phb-2024.ts',
  dmg: 'src/data/sourceFiles/dmg.ts',
  mm: 'src/data/sourceFiles/mm.ts',
  'mm-2024': 'src/data/sourceFiles/mm-2024.ts',
  tashas: 'src/data/sourceFiles/tashas-cauldron-of-everything.ts',
  xanathars: 'src/data/sourceFiles/xanathars-guide-to-everything.ts',
  mtof: 'src/data/sourceFiles/mordenkainens-tome-of-foes.ts',
  fizbans: 'src/data/sourceFiles/fizbans-treasury-of-dragons.ts',
  motm: 'src/data/sourceFiles/mordenkainen-presents-monsters-of-the-multiverse.ts',
  erlw: 'src/data/sourceFiles/eberron-rising-from-the-last-war.ts',
  'basic-rules-2014': 'src/data/sourceFiles/basic-rules-2014.ts',
  'basic-rules-2024': 'src/data/sourceFiles/basic-rules-2024.ts',
  'unearthed-arcana': 'src/data/sourceFiles/unearthed-arcana.ts'
};

const normalizeKey = (value) => String(value ?? '').toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();
const isPlaceholderText = (value) => !value || /from the basic rules|available in the source data/i.test(value);
const choosePreferredText = (primary, fallback) => {
  if (isPlaceholderText(primary) && fallback) {
    return fallback;
  }

  return primary ?? fallback;
};

const choosePreferredArray = (primary, fallback) => Array.isArray(primary) && primary.length > 0 ? primary : (fallback ?? []);

const mergeBackgroundEntry = (primary, fallback) => {
  if (!fallback) {
    return primary;
  }

  return {
    ...primary,
    description: choosePreferredText(primary.description, fallback.description),
    skillProficiencies: choosePreferredArray(primary.skillProficiencies, fallback.skillProficiencies),
    toolProficiencies: choosePreferredArray(primary.toolProficiencies, fallback.toolProficiencies),
    languageCount: primary.languageCount ?? fallback.languageCount,
    equipment: choosePreferredArray(primary.equipment, fallback.equipment),
    feature: {
      name: choosePreferredText(primary.feature?.name, fallback.feature?.name),
      description: choosePreferredText(primary.feature?.description, fallback.feature?.description)
    },
    suggestedCharacteristics: choosePreferredArray(primary.suggestedCharacteristics, fallback.suggestedCharacteristics),
    personalityTraits: choosePreferredArray(primary.personalityTraits, fallback.personalityTraits),
    ideals: choosePreferredArray(primary.ideals, fallback.ideals),
    bonds: choosePreferredArray(primary.bonds, fallback.bonds),
    flaws: choosePreferredArray(primary.flaws, fallback.flaws)
  };
};

const mergeContentWithFallback = (content, fallbackContent) => {
  const mergedBuckets = Object.fromEntries(Object.entries(content).map(([bucket, entries]) => {
    const fallbackEntries = fallbackContent?.[bucket] ?? [];
    return [bucket, Array.isArray(entries) && entries.length > 0 ? entries : fallbackEntries];
  }));

  if ((content.backgrounds?.length ?? 0) > 0 && (fallbackContent?.backgrounds?.length ?? 0) > 0) {
    const fallbackBackgrounds = new Map(
      fallbackContent.backgrounds.map((entry) => [normalizeKey(entry.id || entry.name), entry])
    );

    mergedBuckets.backgrounds = content.backgrounds.map((entry) => {
      const fallback = fallbackBackgrounds.get(normalizeKey(entry.id || entry.name));
      return mergeBackgroundEntry(entry, fallback);
    });
  }

  return mergedBuckets;
};

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const projectRoot = (await pathExists(path.resolve(process.cwd(), 'src/data/sourceFiles')))
  ? process.cwd()
  : appRoot;

const args = process.argv.slice(2);
const getArg = (name, fallback = undefined) => {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  const value = args[idx + 1];
  return value && !value.startsWith('--') ? value : fallback;
};

const input = getArg('--file');
const documentPath = getArg('--document');
const sourceId = getArg('--id');
const label = getArg('--label');
const category = getArg('--category', 'supplement');
const output = getArg('--output');
const jsonOutput = getArg('--json-output');
const parser = getArg('--parser', 'auto');

if (!input && !documentPath) {
  console.error(`Usage: npm run import:source -- --file ./imports/source.json [--output ./app/src/data/sourceFiles/phb-2024.ts] [--json-output ./imports/phb-2024.canonical.json]
       npm run import:source -- --document ./downloads/source.html --id xanathars --label "Xanathar's Guide to Everything" [--category supplement] [--json-output ./imports/xanathars.canonical.json]`);
  process.exit(1);
}

if (documentPath && (!sourceId || !label)) {
  console.error('Document parsing requires both --id and --label.');
  process.exit(1);
}

let canonicalPack;
let rawDocument;

if (documentPath) {
  const resolvedDocumentPath = path.resolve(process.cwd(), documentPath);
  rawDocument = await fs.readFile(resolvedDocumentPath, 'utf8');
  canonicalPack = parseDocumentToCanonicalSourcePackage({
    raw: rawDocument,
    inputPath: resolvedDocumentPath,
    sourceId,
    label,
    category,
    parser
  });

  const enrichedPack = await createFreeCorePackForSourceId(sourceId);
  if (enrichedPack) {
    const mergedContent = mergeContentWithFallback(canonicalPack.content, enrichedPack.content);
    const usedFallback = JSON.stringify(mergedContent) !== JSON.stringify(canonicalPack.content);
    if (usedFallback) {
      canonicalPack = {
        ...canonicalPack,
        source: {
          ...canonicalPack.source,
          description: canonicalPack.source.description ?? enrichedPack.source.description,
          parser: `${canonicalPack.source.parser}+free-core-enriched`
        },
        content: mergedContent,
        notes: [
          ...canonicalPack.notes,
          `Sparse Basic Rules content was enriched from the local ${enrichedPack.source.parser} dataset for ${sourceId}.`
        ]
      };
    }
  }
} else {
  const inputPath = path.resolve(process.cwd(), input);
  const raw = await fs.readFile(inputPath, 'utf8');
  const parsed = JSON.parse(raw);
  canonicalPack = coerceToCanonicalSourcePackage(parsed, {
    sourceId,
    label,
    category
  });
}

canonicalPack = await enrichCanonicalSourcePackageFeatureChoices(canonicalPack, { rawDocument });

const validation = validateCanonicalSourcePackage(canonicalPack);
if (!validation.valid || !validation.value) {
  console.error('Canonical package validation failed:');
  validation.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const normalizedPack = validation.value;
const defaultModulePath = defaultSourceModuleFiles[normalizedPack.source.sourceId] ?? `src/data/sourceFiles/${normalizedPack.source.sourceId}.ts`;

let resolvedJsonOutput;
if (jsonOutput) {
  resolvedJsonOutput = path.resolve(process.cwd(), jsonOutput);
} else if (documentPath) {
  resolvedJsonOutput = path.resolve(workspaceRoot, 'imports', `${normalizedPack.source.sourceId}.canonical.json`);
}

if (resolvedJsonOutput) {
  await fs.mkdir(path.dirname(resolvedJsonOutput), { recursive: true });
  await fs.writeFile(resolvedJsonOutput, `${JSON.stringify(normalizedPack, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${resolvedJsonOutput}`);
}

const targetPath = path.resolve(projectRoot, output || defaultModulePath);
const exportName = `${path.basename(targetPath, path.extname(targetPath)).replaceAll(/\W/g, '_')}_source`;

if (output || documentPath || input) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, generateSourceModuleText(normalizedPack, exportName), 'utf8');
  console.log(`Wrote ${targetPath}`);
}

console.log(
  `Imported ${normalizedPack.source.label} with ${countContentEntries(normalizedPack.content)} content entries, ${normalizedPack.sections.length} extracted sections, and ${normalizedPack.documents.length} attached documents.`
);
