#!/usr/bin/env node
// Import a book from local 5etools-format JSON into this app's canonical content.
//
//   node scripts/import-5etools.mjs --dir ./5etools-data --id tashas \
//     --label "Tasha's Cauldron of Everything" --source TCE --category supplement
//
// --dir       directory of 5etools JSON files (searched recursively; no network access)
// --id        canonical sourceId to write (matches the app's source manifest)
// --label     human-readable book title
// --source    5etools source abbreviation to keep (e.g. TCE, XGE, XPHB, MM). Omit to keep all.
// --category  core | supplement | expansion | basic | ua  (default: supplement)
// --output    override the generated .ts module path
// --json-output  override the canonical .json path

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { buildCanonicalContentFrom5eTools, load5eToolsData } from './5etools-adapter.mjs';
import {
  coerceToCanonicalSourcePackage,
  countContentEntries,
  generateSourceModuleText,
  validateCanonicalSourcePackage
} from './canonical-content.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const workspaceRoot = path.resolve(path.dirname(scriptPath), '..');
const appRoot = path.resolve(workspaceRoot, 'app');

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  return value && !value.startsWith('--') ? value : fallback;
};

const dir = getArg('--dir');
const sourceId = getArg('--id');
const label = getArg('--label');
const sourceAbbr = getArg('--source');
const category = getArg('--category', 'supplement');
const output = getArg('--output');
const jsonOutput = getArg('--json-output');

if (!dir || !sourceId || !label) {
  console.error('Usage: node scripts/import-5etools.mjs --dir ./5etools-data --id <sourceId> --label "<Label>" [--source <ABBR>] [--category supplement]');
  process.exit(1);
}

const resolvedDir = path.resolve(process.cwd(), dir);
const raw = await load5eToolsData(resolvedDir);
const totalRead = Object.values(raw).reduce((total, list) => total + list.length, 0);
if (totalRead === 0) {
  console.error(`No 5etools JSON entries found under ${resolvedDir}. Expected files like spells/spells-*.json, bestiary/bestiary-*.json, races.json, backgrounds.json, feats.json, items.json, class/class-*.json.`);
  process.exit(1);
}

const content = buildCanonicalContentFrom5eTools(raw, { sourceId, label, sourceAbbr });

const coerced = coerceToCanonicalSourcePackage(
  {
    content,
    source: {
      sourceId,
      label,
      category,
      description: `Imported from 5etools data${sourceAbbr ? ` (source ${sourceAbbr})` : ''}.`,
      origin: 'imported-json',
      parser: '5etools-adapter'
    },
    notes: [`Converted from local 5etools JSON${sourceAbbr ? ` filtered to source "${sourceAbbr}"` : ''}.`]
  },
  { sourceId, label, category }
);

const validation = validateCanonicalSourcePackage(coerced);
if (!validation.valid || !validation.value) {
  console.error('Canonical package validation failed:');
  validation.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

const pack = validation.value;
const resolvedJsonOutput = jsonOutput
  ? path.resolve(process.cwd(), jsonOutput)
  : path.resolve(workspaceRoot, 'imports', `${sourceId}.canonical.json`);
await fs.mkdir(path.dirname(resolvedJsonOutput), { recursive: true });
await fs.writeFile(resolvedJsonOutput, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
console.log(`Wrote ${resolvedJsonOutput}`);

const resolvedModuleOutput = output
  ? path.resolve(process.cwd(), output)
  : path.resolve(appRoot, 'src', 'data', 'sourceFiles', `${sourceId}.ts`);
const exportName = `${path.basename(resolvedModuleOutput, path.extname(resolvedModuleOutput)).replaceAll(/\W/g, '_')}_source`;
await fs.mkdir(path.dirname(resolvedModuleOutput), { recursive: true });
await fs.writeFile(resolvedModuleOutput, generateSourceModuleText(pack, exportName), 'utf8');
console.log(`Wrote ${resolvedModuleOutput}`);

const counts = Object.entries(pack.content)
  .filter(([, list]) => Array.isArray(list) && list.length > 0)
  .map(([bucket, list]) => `${bucket}: ${list.length}`)
  .join(', ');
console.log(`Imported ${label} with ${countContentEntries(pack.content)} entries (${counts}).`);
