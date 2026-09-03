/**
 * A chapter of the Kids on Bikes rulebook, as headed sections of prose.
 *
 * Chapter 5 is the Powered Character, and the vault has no note for it. What the app needs from it
 * is the rules a screen quotes rather than paraphrases (CLAUDE.md's copy rule) and the two numbers
 * the chapter states in a sentence: the size of the Power Token pool, and how many Aspects the GM
 * puts out per player. Both are read here, never written into a component.
 *
 * Headings are found by type size, not by position: the body is set at 10pt, a section heading at
 * 20 and a chapter heading at 24, which separates them from an indented example or a bullet that a
 * position test would confuse.
 */
import { toLines } from './pdfText.mjs';

const FOOTER_Y = 30;

const CHAPTER_SIZE = 22;
const HEADING_SIZE = 14;

const CHAPTER_HEADING = /^Chapter (\d+):\s*(.+)$/;

/** "amount of experience + deviation + scope + degree of control = difficulty", as the book states it. */
const EQUATION = /equation:\s*([^=]+?)\s*=\s*difficulty/i;

/** A bullet under a factor heading: "Low: +1 (e.g., sending a wave of force in all directions)". */
const FACTOR_OPTION = /^(.+?):\s*\+(\d+)(?:\s*\((.*)\))?$/;

const FACTOR_NOTE = /^Note:\s*/;

const CONSEQUENCE_HEADING = /^PT Spent\s+Consequences/i;

const CONSEQUENCE_TOKENS = /^(\d+)\s*PT$/;

/** How far right of a page's own left margin a line has to sit to belong to the bullet above it. */
const INDENT = 5;

/** A "N PT" cell is set against its row's middle line, so it shares that line's y within this. */
const ROW_TOLERANCE = 2.5;

/**
 * A gap wider than this multiple of the page's usual leading is a paragraph break. The chapter is
 * set on 13pt leading with 18.7pt between paragraphs, so the two are 1.44 apart and the threshold
 * sits below that rather than beside it.
 */
const PARAGRAPH_GAP = 1.25;

const WORD_NUMBERS = new Map([
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6],
  ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
]);

function slug(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function joinContinuation(text, continuation) {
  if (/[a-z]-$/.test(text)) return text.slice(0, -1) + continuation;
  return `${text} ${continuation}`;
}

/**
 * The type size of a line's dominant run, not its largest.
 *
 * The bullet these lists open with is an 18pt dingbat in front of 10pt body text, so the largest
 * run on the line is the bullet — and reading that as the line's size turns every bullet in the
 * chapter into a section heading with its own body underneath it.
 */
function sizeOf(line) {
  return line.items.reduce((widest, item) => (item.width > widest.width ? item : widest), line.items[0]).height;
}

function linesOf(page) {
  return toLines(page.items.filter((item) => item.y > FOOTER_Y)).map((line) => ({ ...line, size: sizeOf(line) }));
}

/**
 * The page each chapter opens on.
 *
 * A chapter heading has to be the *first* line on its page: the table of contents lists all seven
 * of them at the same 24pt, so taking any line that matches resolves Chapter 5 to the contents page
 * and reads a chapter that is two lines long.
 */
function findChapters(pages) {
  const found = [];
  for (const page of pages) {
    const first = linesOf(page)[0];
    const match = first && first.size >= CHAPTER_SIZE ? CHAPTER_HEADING.exec(first.text) : null;
    if (match) found.push({ number: Number(match[1]), title: match[2], from: page.number });
  }
  return found.map((entry, index) => ({ ...entry, to: (found[index + 1]?.from ?? pages.length + 1) - 1 }));
}

/**
 * The usual line leading on a page, so a paragraph break can be told from a wrapped line. Measured
 * per page: the chapter mixes body text with bulleted lists set on their own leading.
 */
function medianGap(lines) {
  const gaps = [];
  for (let i = 1; i < lines.length; i += 1) {
    const gap = lines[i - 1].y - lines[i].y;
    if (gap > 0 && gap < 40) gaps.push(gap);
  }
  if (gaps.length === 0) return 0;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function collectSections(pages, warn, chapterTitle) {
  const sections = [];
  let section = null;
  let paragraph = null;

  const endParagraph = () => {
    if (paragraph && section) section.paragraphs.push(paragraph);
    paragraph = null;
  };

  // `previous` is carried across page boundaries: a paragraph that runs over one continues, and
  // treating every page as a fresh start split those in half mid-sentence.
  let previous = null;
  let pageChanged = false;

  for (const page of pages) {
    const lines = linesOf(page);
    const gap = medianGap(lines);
    pageChanged = true;

    for (const line of lines) {
      if (line.size >= CHAPTER_SIZE) { previous = line; continue; }
      if (line.size >= HEADING_SIZE) {
        endParagraph();
        section = { id: slug(line.text), name: line.text, paragraphs: [] };
        sections.push(section);
        previous = line;
        continue;
      }
      if (!section) {
        // The chapter's opening paragraphs sit above its first heading; they belong to the chapter.
        section = { id: slug(chapterTitle), name: '', paragraphs: [] };
        sections.push(section);
      }
      const spaced = !pageChanged && gap > 0 && previous.y - line.y > gap * PARAGRAPH_GAP;
      const broke = previous === null || previous.size >= HEADING_SIZE || spaced;
      pageChanged = false;
      if (broke) {
        endParagraph();
        paragraph = line.text;
      } else {
        paragraph = joinContinuation(paragraph ?? '', line.text);
      }
      previous = line;
    }
  }
  endParagraph();

  const empty = sections.filter((entry) => entry.paragraphs.length === 0).map((entry) => entry.name);
  if (empty.length > 0) warn(`Chapter "${chapterTitle}": ${empty.join(', ')} has a heading but no text.`);
  return sections;
}

/** A count the chapter states in a sentence, as a word or a digit. */
function statedNumber(sections, pattern, label, warn) {
  const text = sections.flatMap((section) => section.paragraphs).join(' ');
  const match = pattern.exec(text);
  if (!match) {
    warn(`Chapter 5: could not find ${label} in the chapter's own text, so it is absent rather than assumed.`);
    return null;
  }
  const raw = match[1].toLowerCase();
  return WORD_NUMBERS.get(raw) ?? Number.parseInt(raw, 10);
}

/**
 * The bullets under one factor heading, each already joined with the lines that continue it.
 *
 * A bullet is flush at its own indent and its continuations sit further right, so the two are told
 * apart the way Appendix K tells a prompt from an entry: by x, never by position.
 */
function collectBullets(lines, from) {
  const bullets = [];
  for (let i = from; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.x <= line.margin + INDENT) return { bullets, next: i };
    if (line.text.startsWith('~')) bullets.push(line.text.replace(/^~\s*/, ''));
    else if (bullets.length > 0) bullets[bullets.length - 1] = joinContinuation(bullets.at(-1), line.text);
  }
  return { bullets, next: lines.length };
}

/**
 * The chapter's lines in reading order, each carrying the left margin of the page it is set on.
 *
 * The margin has to travel with the line: the book alternates recto and verso, so the same body
 * text sits at x=39 on one page and x=28 on the next, and a list that runs over the fold is read
 * as a page of headings if the margin is taken from the wrong side.
 */
function chapterLines(pages) {
  const lines = [];
  for (const page of pages) {
    const onPage = linesOf(page);
    if (onPage.length === 0) continue;
    const margin = Math.min(...onPage.map((line) => line.x));
    for (const line of onPage) lines.push({ ...line, margin });
  }
  return lines;
}

function readFactorBullets(factor, bullets, warn) {
  for (const bullet of bullets) {
    if (FACTOR_NOTE.test(bullet)) { factor.note = bullet.replace(FACTOR_NOTE, ''); continue; }
    const option = FACTOR_OPTION.exec(bullet);
    if (!option) {
      warn(`Chapter 5: "${bullet}" sits under ${factor.name} but states no modifier, so it is not an option.`);
      continue;
    }
    factor.options.push({
      id: slug(option[1]),
      label: option[1].trim(),
      modifier: Number.parseInt(option[2], 10),
      examples: (option[3] ?? '').trim(),
    });
  }
}

/**
 * The four things the chapter adds up into a difficulty.
 *
 * Which four is read from the equation the chapter states — "amount of experience + deviation +
 * scope + degree of control = difficulty" — rather than from a list written here, so a printing
 * that adds a fifth arrives on its own. Each name then finds its own heading and the bullets under
 * it, and the heading's capitalisation wins because the equation prints them lowercase.
 */
function readFactors(pages, sections, warn) {
  const equation = EQUATION.exec(sections.flatMap((section) => section.paragraphs).join(' '));
  if (!equation) {
    warn('Chapter 5: the difficulty equation was not found, so the power check has no factors.');
    return { equation: '', factors: [] };
  }

  const wanted = new Map();
  for (const part of equation[1].split('+').map((name) => name.trim()).filter(Boolean)) {
    wanted.set(part.toLowerCase(), { id: slug(part), name: part, question: '', options: [], note: '' });
  }

  const lines = chapterLines(pages);
  const factors = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    i += 1;
    if (line.x > line.margin + INDENT || line.size >= HEADING_SIZE) continue;
    const [head, ...rest] = line.text.split(':');
    const factor = wanted.get(head.trim().toLowerCase());
    if (!factor) continue;
    factor.name = head.trim();
    factor.question = rest.join(':').trim();
    const collected = collectBullets(lines, i);
    readFactorBullets(factor, collected.bullets, warn);
    if (!factors.includes(factor)) factors.push(factor);
    i = collected.next;
  }

  for (const factor of wanted.values()) {
    if (factor.options.length === 0) {
      warn(`Chapter 5: the equation names "${factor.name}" but no list of its own follows the heading.`);
    }
  }
  return { equation: equation[1].trim(), factors: factors.filter((factor) => factor.options.length > 0) };
}

/**
 * The consequences table, whose "N PT" cell is set vertically centred against two or three lines of
 * text. Read as a line stream that cell lands inside whichever line it happens to share a y with,
 * which is what puts "1 PT" in the middle of the sentence it labels; the two columns are separated
 * on the x the table's own heading gives instead.
 */
function readConsequences(pages, warn) {
  for (const page of pages) {
    const items = page.items.filter((item) => item.y > FOOTER_Y);
    const lines = toLines(items);
    const heading = lines.find((line) => CONSEQUENCE_HEADING.test(line.text));
    if (!heading) continue;

    const margin = Math.min(...lines.map((line) => line.x));
    const below = lines.filter((line) => line.y < heading.y - ROW_TOLERANCE);
    const end = below.find((line) => line.x <= margin + INDENT);
    return settleConsequences(items, {
      // The heading's own second cell is where the right-hand column starts.
      splitX: heading.items.filter((item) => item.text.trim()).at(-1).x - INDENT,
      top: heading.y - ROW_TOLERANCE,
      bottom: end ? end.y : 0,
    }, warn);
  }
  warn('Chapter 5: the consequences table was not found, so what spending Power Tokens costs did not import.');
  return [];
}

/** Each line of the right-hand column belongs to the "N PT" cell it is set against. */
function settleConsequences(items, bounds, warn) {
  const { top, bottom, splitX } = bounds;
  const inTable = (item) => item.y < top && item.y > bottom;
  const cells = items
    .filter((item) => inTable(item) && item.x < splitX && CONSEQUENCE_TOKENS.test(item.text.trim()))
    .map((item) => ({ tokens: Number.parseInt(CONSEQUENCE_TOKENS.exec(item.text.trim())[1], 10), y: item.y, text: '' }))
    .sort((a, b) => b.y - a.y);

  if (cells.length === 0) {
    warn('Chapter 5: the consequences table has a heading but no "N PT" rows under it.');
    return [];
  }

  for (const line of toLines(items.filter((item) => inTable(item) && item.x >= splitX))) {
    const owner = cells.reduce((best, cell) => (Math.abs(cell.y - line.y) < Math.abs(best.y - line.y) ? cell : best));
    owner.text = owner.text ? joinContinuation(owner.text, line.text) : line.text;
  }

  for (const cell of cells) {
    if (!cell.text) warn(`Chapter 5: the consequences table's ${cell.tokens} PT row has no text beside it.`);
  }
  return cells.map((cell) => ({ tokens: cell.tokens, text: cell.text }));
}

const EMPTY_POWER_CHECK = { equation: '', factors: [], consequences: [] };

/**
 * Chapter 5. The two numbers the chapter states — the shared Power Token pool and how many Aspects
 * the GM deals per player — and the power check: the four factors a difficulty is added up from and
 * what each Power Token spent on it costs.
 *
 * `sections` is the chapter as prose and no screen renders it, the way the vault's tips and worked
 * examples are imported and not rendered. What a screen shows is the structure beside it.
 */
export function readPoweredCharacters(pages, warn) {
  const chapter = findChapters(pages).find((entry) => /powered characters/i.test(entry.title));
  if (!chapter) {
    warn('Rulebook: the Powered Characters chapter was not found, so its rules did not import.');
    return { title: '', sections: [], powerTokens: null, aspectsPerPlayer: null, powerCheck: EMPTY_POWER_CHECK };
  }
  const chapterPages = pages.slice(chapter.from - 1, chapter.to);
  const sections = collectSections(chapterPages, warn, chapter.title);
  const check = readFactors(chapterPages, sections, warn);
  return {
    title: chapter.title,
    sections,
    powerTokens: statedNumber(sections, /pool of (\d+|[a-z]+) Power Tokens/i, 'the size of the Power Token pool', warn),
    aspectsPerPlayer: statedNumber(sections, /shares (\d+|[a-z]+) Aspects per player/i, 'the number of Aspects dealt per player', warn),
    powerCheck: { ...check, consequences: readConsequences(chapterPages, warn) },
  };
}
