#!/usr/bin/env node
/**
 * Imports Kids on Bikes (2nd edition) content out of an Obsidian vault into a generated source
 * module the app reads.
 *
 * The vault's notes are the source document, the same way the D&D Beyond HTML dumps are for 5e:
 * nothing here is transcribed into the app by hand, and a gap in the vault is reported rather
 * than filled in. Run it with the vault path, or let it use the default:
 *
 *   node scripts/import-kids-on-bikes.mjs
 *   node scripts/import-kids-on-bikes.mjs --vault "C:/…/Obsidian Vault/TTRPG/Kids on Bikes"
 *
 * Output: app/src/data/gameSystems/kidsOnBikes/generated.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

const DEFAULT_VAULT = 'C:/Users/sgibe/Documents/Obsidian Vault/TTRPG/Kids on Bikes';
const OUTPUT = path.join(
  repoRoot,
  'app',
  'src',
  'data',
  'gameSystems',
  'kidsOnBikes',
  'generated.ts',
);

const STAT_NAMES = ['Brains', 'Brawn', 'Fight', 'Flight', 'Charm', 'Grit'];
const DICE_ORDER = ['d20', 'd12', 'd10', 'd8', 'd6', 'd4'];
const AGES = ['child', 'teen', 'adult'];

/**
 * Two trope tables pluralise a stat ("Charms", "Brawns"). That is a typo in one cell of the
 * source, not a seventh stat, and rejecting it drops the whole trope — so the plural resolves to
 * its stat and the difference is reported rather than corrected in silence.
 */
function resolveStatName(cell) {
  const exact = STAT_NAMES.find((stat) => stat.toLowerCase() === cell.toLowerCase());
  if (exact) return { stat: exact, variant: null };
  const singular = STAT_NAMES.find((stat) => `${stat.toLowerCase()}s` === cell.toLowerCase());
  return singular ? { stat: singular, variant: cell } : { stat: null, variant: null };
}

const warnings = [];
function warn(message) {
  warnings.push(message);
}

function parseArgs(argv) {
  const args = { vault: DEFAULT_VAULT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--vault' && argv[i + 1]) {
      args.vault = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function readNote(vault, ...segments) {
  const file = path.join(vault, ...segments);
  if (!fs.existsSync(file)) {
    warn(`Missing note: ${segments.join('/')} — nothing was imported from it.`);
    return null;
  }
  return fs.readFileSync(file, 'utf8');
}

/** Obsidian's YAML frontmatter is editor configuration, never content. */
function stripFrontmatter(text) {
  return text.startsWith('---') ? text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '') : text;
}

/**
 * These notes are written for Obsidian's renderer, so presentation markup is interleaved with the
 * text: `<center>` wrappers, `<font color>` spans for the flaw column, `<br>` line breaks, and
 * `[[wikilinks]]` that point at other notes. Strip the presentation, keep the words.
 */
function cleanCell(raw) {
  return raw
    .replaceAll(/<br\s*\/?>/gi, ' \u2028')
    .replaceAll(/<\/?(?:center|font|span|strong|em|u|b|i)(?:\s[^>]*)?>/gi, '')
    .replaceAll(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replaceAll(/\[\[([^\]]+)\]\]/g, '$1')
    .replaceAll(/\*\*/g, '')
    .replaceAll('\u00ad', '')
    .replaceAll(/\s*\u2028\s*/g, '\n')
    .replaceAll(/[ \t]+/g, ' ')
    .trim();
}

/** Obsidian block ids (`^fc53d5`) anchor links between notes; they are not part of the text. */
function stripBlockId(text) {
  return text.replace(/\s*\^[a-z0-9]{6}\s*$/i, '').trim();
}

function splitList(text) {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** A stable, url-safe id derived from a name — the same shape the 5e packs use. */
function slugify(name) {
  return name
    .toLowerCase()
    .replaceAll(/['\u2019]/g, '')
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

/** `| a | b | c |` → ['a','b','c'], with Obsidian's `<` merge markers dropped. */
function tableCells(line) {
  return line
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((cell) => cleanCell(cell))
    .filter((cell) => cell !== '<');
}

function isSeparatorRow(line) {
  return /^\s*\|[\s|:-]+\|\s*$/.test(line);
}

// ---------------------------------------------------------------------------------------------
// Bullet-list notes: Strengths, Flaws, Bonded Actions
// ---------------------------------------------------------------------------------------------

/**
 * Reads `- **Name:** text` bullets. A bullet with no bold heading is a bare name (the Flaws note),
 * which keeps an empty description rather than a synthetic one.
 */
function parseBulletEntries(text, { label }) {
  const entries = [];
  for (const rawLine of stripFrontmatter(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('- ')) continue;
    const body = stripBlockId(line.slice(2).trim());
    const headed = /^\*\*(?<name>[^*]+?):?\*\*:?\s*(?<description>[\s\S]*)$/.exec(body);
    if (headed) {
      const name = cleanCell(headed.groups.name).replace(/[:.]+$/, '').trim();
      entries.push({
        id: slugify(name),
        name,
        description: cleanCell(headed.groups.description),
      });
      continue;
    }
    const name = cleanCell(body);
    if (!name) continue;
    entries.push({ id: slugify(name), name, description: '' });
  }
  if (entries.length === 0) warn(`${label}: no entries parsed.`);
  return entries;
}

/**
 * A Strength's own text says who it is free for and who may take it, so age eligibility is read
 * from the rules rather than restated in the builder. "Free for and available only to teens"
 * is the whole of Rebellious's restriction.
 */
function readStrengthEligibility(description) {
  const note = /^\((?<note>[^)]*)\)/.exec(description);
  if (!note) return { freeFor: [], restrictedTo: null, note: null };

  const text = note.groups.note.toLowerCase();
  // The book says "kids" where the character sheet says "child"; matching only the sheet's word
  // silently gave Quick Healing no free age at all.
  const AGE_WORDS = {
    child: ['child', 'children', 'kid', 'kids'],
    teen: ['teen', 'teens', 'teenager', 'teenagers'],
    adult: ['adult', 'adults'],
  };
  const agesNamedIn = (clause) =>
    AGES.filter((age) => AGE_WORDS[age].some((word) => new RegExp(`\\b${word}\\b`).test(clause)));

  const freeClause = /free for (?<who>[^;.)]*)/.exec(text);
  const freeFor = freeClause ? agesNamedIn(freeClause.groups.who) : [];

  const onlyClause = /only to (?<who>[^;.)]*)/.exec(text);
  const restricted = onlyClause ? agesNamedIn(onlyClause.groups.who) : [];
  const restrictedTo = restricted.length > 0 ? restricted : null;

  return { freeFor, restrictedTo, note: cleanCell(note.groups.note) };
}

// ---------------------------------------------------------------------------------------------
// Ages
// ---------------------------------------------------------------------------------------------

/**
 * The play rules: what a Stat Check is, the Lucky Break, what failing a roll gives you, and the
 * difficulty table. The app rolls dice, so the numbers a result is read against have to come from
 * the note rather than from a table typed into a component.
 *
 * The note writes its prose as blockquotes and its difficulties as one table, both under `#`
 * headings.
 */
function parsePlayRules(text) {
  const lines = stripFrontmatter(text).split(/\r?\n/);
  const sections = [];
  const difficulties = [];

  let current = null;
  for (const line of lines) {
    const heading = /^#\s+(?<name>.+?)\s*$/.exec(line);
    if (heading) {
      const name = cleanCell(heading.groups.name);
      current = { id: slugify(name), name, paragraphs: [] };
      sections.push(current);
      continue;
    }

    const quoted = /^>\s?(?<body>.*)$/.exec(line);
    if (quoted && current) {
      const body = dropSectionPointers(stripBlockId(cleanCell(quoted.groups.body)));
      if (body) current.paragraphs.push(body);
      continue;
    }

    const cells = tableCells(line);
    if (cells.length >= 2) {
      const band = readDifficultyBand(cells[0], cells[1]);
      if (band) difficulties.push(band);
    }
  }

  const empty = sections.filter((section) => section.paragraphs.length === 0).map((section) => section.name);
  if (empty.length > 0) {
    warn(`Playing The Game: ${empty.join(', ')} ${empty.length === 1 ? 'has' : 'have'} a heading but no text in the vault.`);
  }
  if (difficulties.length === 0) warn('Playing The Game: no difficulty bands parsed.');

  return { sections, difficulties };
}

/**
 * `[[#Lucky Breaks]]` is a link between headings of one note, and the app shows every section at
 * once, so the sentence that carries it navigates nowhere. Drop the sentence, not just the link —
 * "For more details, see ." is worse than either.
 */
function dropSectionPointers(text) {
  return text
    .replaceAll(/\s*(?:For more(?:\s+\w+)*, )?see "#[^"]*\.?"\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * "20 or greater", "13 to 16", "1 or 2" — the bounds are what lets a rolled total be read against
 * the table. A band whose wording does not state them is reported, never guessed at.
 */
function readDifficultyBand(rangeCell, explanationCell) {
  const range = cleanCell(rangeCell);
  const explanation = cleanCell(explanationCell);
  if (!range || !explanation || /^-+$/.test(range) || /^difficul/i.test(range)) return null;

  const orGreater = /^(\d+)\s+or\s+(?:greater|more|higher)$/i.exec(range);
  if (orGreater) {
    return { range, minimum: Number.parseInt(orGreater[1], 10), maximum: null, explanation };
  }

  const span = /^(\d+)\s+(?:to|-|–)\s+(\d+)$/i.exec(range);
  if (span) {
    return { range, minimum: Number.parseInt(span[1], 10), maximum: Number.parseInt(span[2], 10), explanation };
  }

  const either = /^(\d+)\s+or\s+(\d+)$/i.exec(range);
  if (either) {
    return { range, minimum: Number.parseInt(either[1], 10), maximum: Number.parseInt(either[2], 10), explanation };
  }

  warn(`Playing The Game: difficulty band "${range}" states no bounds this import can read.`);
  return null;
}

/**
 * Age is mechanical, not flavour: it grants a Strength for free, may forbid one, and adds +1 to
 * two named stats. The Character Creation note states all three in one paragraph per age, so the
 * paragraph is the record — a table in the app would be the same rule written twice.
 */
function parseAges(text) {
  const source = stripFrontmatter(text);
  const ageSpecs = [
    { id: 'child', name: 'Child', lead: /Children/ },
    { id: 'teen', name: 'Teen', lead: /Teens/ },
    { id: 'adult', name: 'Adult', lead: /Adults/ },
  ];

  return ageSpecs.map(({ id, name, lead }) => {
    const paragraph = source
      .split(/\r?\n/)
      .map((line) => cleanCell(line.replace(/^>\s*/, '')))
      .find((line) => lead.test(line) && /add \+1 to their/.test(line));

    if (!paragraph) {
      warn(`Age "${name}": no rules paragraph found in Character Creation.md.`);
      return { id, name, statBonuses: [], freeStrength: null, forbiddenStrength: null, text: '' };
    }

    const bonusClause = /add \+1 to their (?<stats>[A-Za-z ,and]+?) checks/.exec(paragraph);
    const statBonuses = bonusClause
      ? bonusClause.groups.stats
          .split(/,|\band\b/)
          .map((part) => resolveStatName(part.trim()).stat)
          .filter(Boolean)
          .map((stat) => ({ stat: stat.toLowerCase(), amount: 1 }))
      : [];
    if (statBonuses.length === 0) warn(`Age "${name}": no stat bonuses parsed.`);

    const free = /automatically receive the (?<strength>.+?) Strength/.exec(paragraph);
    const forbidden = /cannot take the (?<strength>.+?) Strength/.exec(paragraph);
    // "Skilled at ___" carries its blank into the name; the blank is the choice, not the name.
    const strengthId = (value) => slugify(value.replace(/_+/g, '').trim());

    return {
      id,
      name,
      statBonuses,
      freeStrength: free ? strengthId(free.groups.strength) : null,
      forbiddenStrength: forbidden ? strengthId(forbidden.groups.strength) : null,
      text: paragraph,
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Bikes
// ---------------------------------------------------------------------------------------------

/**
 * The Bikes note holds two tables of the same shape: a name with an italic adjective under it and
 * the benefit alongside. `<br>` became a newline in `cleanCell`, so the adjective is line two.
 */
function parseBikeTables(text) {
  const lines = stripFrontmatter(text).split(/\r?\n/);
  const tables = [];
  let current = null;

  for (const line of lines) {
    if (!line.trim().startsWith('|')) {
      if (current) tables.push(current);
      current = null;
      continue;
    }
    if (isSeparatorRow(line)) continue;
    const cells = tableCells(line);
    if (cells.length < 2) continue;
    if (!current) {
      current = { header: cells, rows: [] };
      continue;
    }
    current.rows.push(cells);
  }
  if (current) tables.push(current);

  const toOptions = (table) =>
    (table?.rows ?? []).map((row) => {
      const [nameCell, benefit] = row;
      const [name, adjective = ''] = nameCell.split('\n');
      return {
        id: slugify(name),
        name: name.trim(),
        // Each colour's adjective "represents either what you are or what you want to be";
        // each upgrade's phrase is "how someone might describe the bike itself".
        adjective: adjective.replace(/[*_]/g, '').trim(),
        benefit: benefit?.trim() ?? '',
      };
    });

  const colors = toOptions(tables[0]);
  const upgrades = toOptions(tables[1]);
  if (colors.length === 0) warn('Bikes: no colours parsed.');
  if (upgrades.length === 0) warn('Bikes: no upgrades parsed.');
  return { colors, upgrades };
}

// ---------------------------------------------------------------------------------------------
// Relationship questions
// ---------------------------------------------------------------------------------------------

/** `1. …` through `20. …` — the number is the d20 result that selects the question. */
function parseNumberedQuestions(text, { label }) {
  const questions = [];
  for (const rawLine of stripFrontmatter(text).split(/\r?\n/)) {
    const match = /^\s*(?<roll>\d+)\.\s+(?<question>.+?)\s*$/.exec(rawLine);
    if (!match) continue;
    questions.push({
      roll: Number.parseInt(match.groups.roll, 10),
      question: cleanCell(match.groups.question),
    });
  }
  if (questions.length === 0) warn(`${label}: no questions parsed.`);
  return questions.sort((a, b) => a.roll - b.roll);
}

// ---------------------------------------------------------------------------------------------
// Tropes
// ---------------------------------------------------------------------------------------------

/**
 * Reads the "**Teen:** Yellow, Basket" shape into per-age suggestions. A trope offering one age
 * states the bike without a label, so an unlabelled suggestion applies to every age it allows.
 */
function parseSuggestedBikes(cell, ages) {
  const suggestions = [];
  for (const line of cell.split('\n')) {
    // The label is one age, several separated by slashes ("Teen/Adult:"), or "Any".
    const labelled = /^(?<age>(?:Child|Teen|Adult|Any)(?:\/(?:Child|Teen|Adult))*):\s*(?<bike>.+)$/i.exec(
      line.trim(),
    );
    const bikeText = labelled ? labelled.groups.bike : line.trim();
    if (!bikeText) continue;
    const [color = '', upgrade = ''] = splitList(bikeText);
    const labels = (labelled?.groups.age ?? '').toLowerCase().split('/').filter(Boolean);
    const forAges = labels.length > 0 && !labels.includes('any') ? labels : ages;
    for (const age of forAges) {
      suggestions.push({ age, color: color.trim(), upgrade: upgrade.trim() });
    }
  }
  return suggestions;
}

/**
 * One trope block: the die row and the stat row beneath it are positional, so the Nth die belongs
 * to the Nth stat. Reading them any other way silently mis-assigns a character's whole spread.
 */
function parseTropeBlock(name, blockLines) {
  const rows = blockLines
    .filter((line) => line.trim().startsWith('|') && !isSeparatorRow(line))
    .map((line) => tableCells(line));

  const diceRow = rows.find((cells) => cells.some((cell) => /^`?dice:\s*d\d+`?$/i.test(cell)));
  const diceIndex = diceRow ? rows.indexOf(diceRow) : -1;
  const statRow = diceIndex >= 0 ? rows[diceIndex + 1] : undefined;

  if (!diceRow || !statRow) {
    warn(`Trope "${name}": no die/stat rows found — skipped.`);
    return null;
  }

  const dice = diceRow
    .map((cell) => /d\d+/i.exec(cell)?.[0]?.toLowerCase())
    .filter((die) => Boolean(die));

  const stats = [];
  for (const cell of statRow) {
    const { stat, variant } = resolveStatName(cell);
    if (!stat) continue;
    if (variant) warn(`Trope "${name}": stat cell reads "${variant}"; read as ${stat}.`);
    stats.push(stat);
  }

  if (dice.length !== stats.length || stats.length !== STAT_NAMES.length) {
    warn(
      `Trope "${name}": ${dice.length} dice against ${stats.length} stats (expected ${STAT_NAMES.length} of each) — skipped.`,
    );
    return null;
  }

  const statDice = {};
  dice.forEach((die, index) => {
    statDice[stats[index].toLowerCase()] = die;
  });

  const findRowAfter = (headingTest) => {
    const headingIndex = rows.findIndex((cells) => cells.some((cell) => headingTest(cell)));
    return headingIndex >= 0 ? rows[headingIndex + 1] : undefined;
  };

  // "Strenghths" is the vault's typo; match loosely rather than depending on the spelling.
  const ageRow = findRowAfter((cell) => /^Age$/i.test(cell));
  const detailRow = findRowAfter((cell) => /^Suggested Stren/i.test(cell));

  // "Child/Teen" lists the ages; "Any" is how the tables write all three.
  const ageCell = (ageRow?.[0] ?? '').trim();
  const ages = /^any$/i.test(ageCell)
    ? [...AGES]
    : ageCell
        .split('/')
        .map((age) => age.trim().toLowerCase())
        .filter((age) => AGES.includes(age));
  if (ages.length === 0) warn(`Trope "${name}": no ages parsed from "${ageCell}".`);

  const suggestedBikes = parseSuggestedBikes(ageRow?.[1] ?? '', ages);

  return {
    id: slugify(name),
    name,
    ages,
    statDice,
    suggestedStrengths: splitList(detailRow?.[0] ?? '').map((entry) =>
      entry.replace(/\.{2,}$/, '...'),
    ),
    suggestedFlaws: splitList(detailRow?.[1] ?? ''),
    questions: [detailRow?.[2] ?? '', detailRow?.[3] ?? ''].filter((question) => question),
    suggestedBikes,
  };
}

function parseTropes(text) {
  const lines = stripFrontmatter(text).split(/\r?\n/);
  const tropes = [];
  let currentName = null;
  let buffer = [];

  const flush = () => {
    if (!currentName) return;
    const trope = parseTropeBlock(currentName, buffer);
    if (trope) tropes.push(trope);
  };

  for (const line of lines) {
    const heading = /^#\s+(?<name>.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      currentName = cleanCell(heading.groups.name);
      buffer = [];
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (tropes.length === 0) warn('Tropes: no tropes parsed.');
  return tropes;
}

// ---------------------------------------------------------------------------------------------
// Cross-checks and output
// ---------------------------------------------------------------------------------------------

/**
 * The trope tables name bikes and strengths by hand, so they can name one the appendices do not
 * define. Report those rather than quietly dropping them — an unmatched colour is a real gap in
 * the vault, and the builder needs to know to offer it as free text.
 */
function crossCheck({ tropes, strengths, flaws, bikes }) {
  // "Skilled at ..." is written a dozen ways across the tables; compare on the stem. Hyphens go
  // too: the trope tables carry InDesign soft hyphens inside words ("Hot­tempered"), which
  // `cleanCell` strips, so "Hot-tempered" in the appendix would otherwise never match. Both sides
  // go through this — normalising only the trope side reported every hyphenated name as missing.
  const normalise = (value) =>
    value.toLowerCase().replace(/\s*\.{2,}\s*$/, '').replaceAll('-', '').replace(/\s+/g, ' ').trim();

  const colorNames = new Set(bikes.colors.map((color) => normalise(color.name)));
  const upgradeNames = new Set(bikes.upgrades.map((upgrade) => normalise(upgrade.name)));
  const strengthNames = strengths.map((strength) => normalise(strength.name));
  const flawNames = new Set(flaws.map((flaw) => normalise(flaw.name)));

  const unmatched = { colors: new Set(), upgrades: new Set(), strengths: new Set(), flaws: new Set() };

  for (const trope of tropes) {
    for (const bike of trope.suggestedBikes) {
      if (bike.color && !colorNames.has(normalise(bike.color))) unmatched.colors.add(bike.color);
      if (bike.upgrade && !upgradeNames.has(normalise(bike.upgrade))) unmatched.upgrades.add(bike.upgrade);
    }
    for (const strength of trope.suggestedStrengths) {
      // "Skilled at…" appears as "Skilled at...", "Skilled at ___" and "Skilled at ..".
      const stem = normalise(strength).slice(0, 9);
      if (!strengthNames.some((name) => name.startsWith(stem))) unmatched.strengths.add(strength);
    }
    for (const flaw of trope.suggestedFlaws) {
      if (!flawNames.has(normalise(flaw))) unmatched.flaws.add(flaw);
    }
  }

  for (const [kind, values] of Object.entries(unmatched)) {
    if (values.size > 0) {
      warn(`Trope tables name ${kind} the appendices do not define: ${[...values].sort((a, b) => a.localeCompare(b)).join(', ')}`);
    }
  }
}

function renderModule(data) {
  const body = JSON.stringify(data, null, 2);
  return `// GENERATED FILE — do not edit by hand.
// Source: an Obsidian vault of Kids on Bikes (2nd edition) notes.
// Regenerate with: node scripts/import-kids-on-bikes.mjs
//
// Every value below is read out of the vault's notes. Anything the notes do not say is absent
// here rather than invented; \`meta.warnings\` records what the import could not resolve.

import type { KidsOnBikesContent } from './types';

export const kidsOnBikesContent: KidsOnBikesContent = ${body} as const;

export default kidsOnBikesContent;
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const vault = args.vault;

  if (!fs.existsSync(vault)) {
    console.error(`Vault not found: ${vault}`);
    console.error('Pass --vault "<path to the Kids on Bikes vault>".');
    process.exitCode = 1;
    return;
  }

  const tropesNote = readNote(vault, 'Appendices', 'Tropes.md');
  const strengthsNote = readNote(vault, 'Appendices', 'Strengths.md');
  const flawsNote = readNote(vault, 'Appendices', 'Flaws.md');
  const bikesNote = readNote(vault, 'Appendices', 'Bikes.md');
  const bondedNote = readNote(vault, 'Appendices', 'Bonded Actions.md');
  const positiveNote = readNote(vault, 'Appendices', 'Relationship Questions for a Character You Know (Positive).md');
  const negativeNote = readNote(vault, 'Appendices', 'Relationship Questions for a Character You Know (Negative).md');
  const strangerNote = readNote(vault, 'Appendices', 'Relationship Questions for a Character You Don\u2019t Know.md');
  const creationNote = readNote(vault, 'Character Creation.md');
  const playNote = readNote(vault, 'Playing The Game.md');

  const tropes = tropesNote ? parseTropes(tropesNote) : [];
  const rawStrengths = strengthsNote ? parseBulletEntries(strengthsNote, { label: 'Strengths' }) : [];
  const strengths = rawStrengths.map((strength) => ({
    ...strength,
    ...readStrengthEligibility(strength.description),
  }));
  const flaws = flawsNote ? parseBulletEntries(flawsNote, { label: 'Flaws' }) : [];
  const bikes = bikesNote ? parseBikeTables(bikesNote) : { colors: [], upgrades: [] };
  const bondedActions = bondedNote ? parseBulletEntries(bondedNote, { label: 'Bonded Actions' }) : [];

  const relationshipQuestions = {
    positive: positiveNote ? parseNumberedQuestions(positiveNote, { label: 'Positive questions' }) : [],
    negative: negativeNote ? parseNumberedQuestions(negativeNote, { label: 'Negative questions' }) : [],
    stranger: strangerNote ? parseNumberedQuestions(strangerNote, { label: 'Stranger questions' }) : [],
  };

  crossCheck({ tropes, strengths, flaws, bikes });

  const data = {
    meta: {
      systemId: 'kids-on-bikes',
      label: 'Kids on Bikes (2nd Edition)',
      source: 'Obsidian vault notes',
      importedAt: new Date().toISOString().slice(0, 10),
      warnings,
    },
    stats: STAT_NAMES.map((name) => ({ id: name.toLowerCase(), name })),
    diceOrder: DICE_ORDER,
    ages: creationNote ? parseAges(creationNote) : [],
    tropes,
    strengths,
    flaws,
    bikes,
    bondedActions,
    relationshipQuestions,
    playRules: playNote ? parsePlayRules(playNote) : { sections: [], difficulties: [] },
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, renderModule(data), 'utf8');

  console.log(`Wrote ${path.relative(repoRoot, OUTPUT)}`);
  console.log(
    `  ${tropes.length} tropes, ${strengths.length} strengths, ${flaws.length} flaws, ` +
      `${bikes.colors.length} bike colours, ${bikes.upgrades.length} upgrades, ` +
      `${bondedActions.length} bonded actions, ` +
      `${data.playRules.sections.length} play-rule sections, ${data.playRules.difficulties.length} difficulty bands, ` +
      `${relationshipQuestions.positive.length}/${relationshipQuestions.negative.length}/${relationshipQuestions.stranger.length} relationship questions`,
  );
  if (warnings.length > 0) {
    console.log(`  ${warnings.length} warning(s):`);
    for (const warning of warnings) console.log(`    - ${warning}`);
  }
}

main();
