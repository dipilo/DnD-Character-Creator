/**
 * The Kids on Bikes appendices the Obsidian vault has no note for.
 *
 * Appendices C-J are in the vault and are read from there; A, B and K are not, and they are what
 * the Pre-Game Form and the Powered Character need. The rulebook PDF is the source document for
 * those three, on the same terms as the vault: nothing here is transcribed, a gap is reported
 * rather than filled in, and a defect in the book is reported rather than corrected.
 *
 * Every one of these pages is set in two columns, and each numbered table runs 1-n down the left
 * and the rest down the right. Read as a stream of lines the two interleave, which mis-assigns
 * half of every table and errors nowhere, so the split is made on the runs' own x positions.
 */
import { toLines, toColumns, splitBetweenColumns } from './pdfText.mjs';

/** Anything below this is the page number and the watermark the publisher stamps on every page. */
const FOOTER_Y = 30;

/** An appendix opens with its letter and title, centred. */
const APPENDIX_HEADING = /^([A-Z]):\s+(.+)$/;

const SECTION_HEADING = /^Fill in the Blanks\s*[-–]\s*(.+?)\s*\((d\d+) to randomize\)$/i;

const NUMBERED = /^(\d{1,2})\.\s*(.*)$/;

/** The list headings on the Pre-Game Form each end in an icon glyph from a symbol font. */
const LIST_HEADING = /^(.+?\bList)\s*\S?$/;

const RULE_LINE = /^_+$/;

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** The typesetter breaks words across lines; a trailing hyphen after a letter is that break. */
function joinContinuation(text, continuation) {
  if (/[a-z]-$/.test(text)) return text.slice(0, -1) + continuation;
  return `${text} ${continuation}`;
}

function bodyLines(page) {
  return toLines(page.items.filter((item) => item.y > FOOTER_Y));
}

/**
 * Where each appendix starts and ends, read from the headings rather than from page numbers. The
 * printed numbers run six behind the PDF's, and an edition that repaginates would move them again.
 */
function findAppendices(pages) {
  const found = [];
  for (const page of pages) {
    // The first appendix opens under the part title "Appendices", so the heading is the second
    // line on that one page and the first everywhere else.
    const match = bodyLines(page).slice(0, 2).map((line) => APPENDIX_HEADING.exec(line.text)).find(Boolean);
    if (match) found.push({ letter: match[1], title: match[2], from: page.number });
  }
  return found.map((entry, index) => ({
    ...entry,
    to: (found[index + 1]?.from ?? pages.length + 1) - 1,
  }));
}

/**
 * Appendix A. Four lists, each a heading, a prompt of one or two lines, and ruled writing space.
 * The rules are the printed form's; what the app needs is the question each list asks.
 */
function parsePreGameForm(page, warn) {
  const lines = bodyLines(page).filter((line) => !RULE_LINE.test(line.text));
  const intro = [];
  const lists = [];
  for (const line of lines) {
    if (APPENDIX_HEADING.test(line.text) || line.text === 'Appendices') continue;
    const heading = LIST_HEADING.exec(line.text);
    if (heading) {
      lists.push({ id: slug(heading[1]), name: heading[1], prompt: '' });
      continue;
    }
    const current = lists[lists.length - 1];
    if (!current) intro.push(line.text);
    else current.prompt = current.prompt ? joinContinuation(current.prompt, line.text) : line.text;
  }
  if (lists.length === 0) warn('Appendix A: no list headings found on the Pre-Game Form page.');
  for (const list of lists) {
    if (!list.prompt) warn(`Appendix A: "${list.name}" has a heading but no prompt.`);
  }
  return { intro: intro.join(' ').trim(), lists };
}

/**
 * Appendix B. Two columns of `~ Entry`, then a prompt and blank rules for the table's own.
 *
 * An entry that wraps ("Harm to children and young" / "adults") continues on the next line of its
 * own column, which is the whole reason this is read by column and not by line.
 */
function parseContentWarnings(page, warn) {
  const items = page.items.filter((item) => item.y > FOOTER_Y);
  const bullets = items.filter((item) => item.text.trim() === '~').map((item) => item.x);
  if (bullets.length === 0) {
    warn('Appendix B: no bullets found, so the content warning list did not import.');
    return { entries: [], additionalPrompt: '' };
  }
  const splitX = splitBetweenColumns(bullets, page.width * 0.45);
  const entries = [];
  let additionalPrompt = '';

  for (const column of toColumns(items, splitX)) {
    for (const line of column) {
      if (APPENDIX_HEADING.test(line.text)) continue;
      const text = line.text.replace(/^~\s*/, '').trim();
      if (text === '' || RULE_LINE.test(text)) continue;
      if (text.endsWith(':')) { additionalPrompt = text; continue; }
      if (line.text.startsWith('~')) entries.push(text);
      else if (entries.length > 0) entries[entries.length - 1] = joinContinuation(entries[entries.length - 1], text);
    }
  }

  for (const entry of entries) {
    if (/^[a-z]/.test(entry)) {
      warn(`Appendix B: "${entry}" starts lowercase. The book's own PDF is missing that glyph and it is left as printed.`);
    }
  }
  return { entries, additionalPrompt };
}

/**
 * Where the two columns part, measured from the runs that open a numbered row.
 *
 * It has to be the *runs*, not the assembled lines: a line already spans both columns, so its x is
 * always the left one's and the split comes out at the left margin. A fraction of the page width
 * does not work either — the soft hyphen ending "deck manipu-" sits at x=197.6 on a 442.8pt page,
 * and a split at 45% files it under the right column, which loses the hyphen from its own entry
 * and buries the right column's next number inside it.
 */
function columnSplit(items, page) {
  const starts = items.filter((item) => NUMBERED.test(item.text)).map((item) => item.x);
  return splitBetweenColumns(starts, page.width * 0.45);
}

/**
 * Fold a group's two columns into what the book prints.
 *
 * Most tables run one list of 1-12 down both columns; the Powers table runs a *separate* 1-12
 * under each, headed "Heads" and "Tails". The numbering says which: a right column that starts
 * again at 1 is a second list, not the back half of the first.
 */
function settleGroup(group, warn) {
  const [left, right] = [group.left, group.right];
  const byRoll = (a, b) => a.roll - b.roll;
  const restarts = left.entries.length > 0 && right.entries.length > 0
    && right.entries.some((entry) => entry.roll === 1);

  group.variants = restarts
    ? [left, right].map((column) => ({ label: column.label, entries: column.entries.sort(byRoll) }))
    : [{ label: '', entries: [...left.entries, ...right.entries].sort(byRoll) }];

  for (const variant of group.variants) {
    const rolls = variant.entries.map((entry) => entry.roll);
    const expected = rolls.map((_, index) => index + 1);
    if (rolls.join(',') !== expected.join(',')) {
      const where = variant.label ? `"${group.prompt}" (${variant.label})` : `"${group.prompt}"`;
      warn(`Appendix K: ${where} numbers ${rolls.join(', ') || 'nothing'} rather than 1-${rolls.length}.`);
    }
  }
  delete group.left;
  delete group.right;
  delete group.y;
  delete group.page;
}

/**
 * Appendix K. Sections ("Fill in the Blanks - Good (d12 to randomize)"), each a run of prompts
 * with a numbered table under it.
 *
 * A table's numbers do not split evenly between the columns, and one runs 1-7 down the left, so an
 * entry keeps the number the book gave it rather than its position. The right column carries no
 * prompts at all: its entries belong to the last prompt above them on the same page.
 */
function parseAspects(pages, warn) {
  const sections = [];
  let group = null;

  const startSection = (name, die) => {
    sections.push({ id: slug(name), name, die, groups: [] });
    group = null;
  };

  const startGroup = (prompt, y, page) => {
    if (sections.length === 0) {
      warn(`Appendix K: "${prompt}" appears before any "Fill in the Blanks" heading.`);
      startSection('', '');
    }
    group = {
      id: slug(prompt),
      prompt,
      left: { label: '', entries: [] },
      right: { label: '', entries: [] },
      y,
      page,
    };
    sections[sections.length - 1].groups.push(group);
  };

  /**
   * An unnumbered line is one of three things, and which one is decided by where it sits: flush
   * left it is the next prompt, before a column's first entry it is that column's heading
   * ("Heads", "Tails"), and anywhere else it is the previous entry running on.
   */
  const addLine = (owner, side, line, promptX) => {
    if (!owner) { warn(`Appendix K: "${line.text}" has no prompt above it.`); return; }
    const column = owner[side];
    const numbered = NUMBERED.exec(line.text);
    if (numbered) {
      column.entries.push({ roll: Number(numbered[1]), text: numbered[2] });
      return;
    }
    if (column.entries.length === 0) {
      if (promptX === null || line.x > promptX + 2) column.label = line.text;
      return;
    }
    const last = column.entries.at(-1);
    last.text = joinContinuation(last.text, line.text);
  };

  for (const page of pages) {
    const items = page.items.filter((item) => item.y > FOOTER_Y);
    const lines = toLines(items).filter((line) => !APPENDIX_HEADING.test(line.text));
    if (lines.length === 0) continue;
    if (!lines.some((line) => NUMBERED.test(line.text) || SECTION_HEADING.test(line.text))) break;

    const [left, right] = toColumns(items, columnSplit(items, page));
    // The margins shift between recto and verso, so a prompt is found by being flush with the
    // leftmost run on its own page rather than at a fixed coordinate.
    const promptX = left.length > 0 ? Math.min(...left.map((line) => line.x)) : 0;

    for (const line of left) {
      if (APPENDIX_HEADING.test(line.text)) continue;
      const section = SECTION_HEADING.exec(line.text);
      if (section) { startSection(section[1], section[2]); continue; }
      if (!NUMBERED.test(line.text) && line.x <= promptX + 2) { startGroup(line.text, line.y, page.number); continue; }
      addLine(group, 'left', line, promptX);
    }

    const onThisPage = sections.flatMap((section) => section.groups).filter((g) => g.page === page.number);
    for (const line of right) {
      if (APPENDIX_HEADING.test(line.text)) continue;
      addLine(onThisPage.filter((candidate) => candidate.y > line.y).at(-1), 'right', line, null);
    }
  }

  for (const section of sections) for (const entry of section.groups) settleGroup(entry, warn);
  return sections;
}

/**
 * Read Appendices A, B and K out of the rulebook's pages.
 *
 * `warn` is the importer's own, so a gap here lands in `meta.warnings` beside the vault's and is
 * surfaced in the UI rather than filled in.
 */
export function readRulebookAppendices(pages, warn) {
  const appendices = findAppendices(pages);
  const find = (letter) => appendices.find((entry) => entry.letter === letter) ?? null;

  const a = find('A');
  const b = find('B');
  const k = find('K');
  for (const [letter, entry] of [['A', a], ['B', b], ['K', k]]) {
    if (!entry) warn(`Rulebook: appendix ${letter} was not found, so its heading may have moved.`);
  }

  const form = a ? parsePreGameForm(pages[a.from - 1], warn) : { intro: '', lists: [] };
  const contentWarnings = b ? parseContentWarnings(pages[b.from - 1], warn) : { entries: [], additionalPrompt: '' };

  return {
    preGameForm: {
      title: a?.title ?? '',
      intro: form.intro,
      lists: form.lists,
      contentWarnings: contentWarnings.entries,
      additionalPrompt: contentWarnings.additionalPrompt,
    },
    poweredCharacterAspects: {
      title: k?.title ?? '',
      sections: k ? parseAspects(pages.slice(k.from - 1, k.to), warn) : [],
    },
  };
}
