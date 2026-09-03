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
 * Chapter 5. The sections a screen quotes, plus the two numbers the chapter states: the shared
 * Power Token pool and how many Aspects the GM deals per player.
 */
export function readPoweredCharacters(pages, warn) {
  const chapter = findChapters(pages).find((entry) => /powered characters/i.test(entry.title));
  if (!chapter) {
    warn('Rulebook: the Powered Characters chapter was not found, so its rules did not import.');
    return { title: '', sections: [], powerTokens: null, aspectsPerPlayer: null };
  }
  const sections = collectSections(pages.slice(chapter.from - 1, chapter.to), warn, chapter.title);
  return {
    title: chapter.title,
    sections,
    powerTokens: statedNumber(sections, /pool of (\d+|[a-z]+) Power Tokens/i, 'the size of the Power Token pool', warn),
    aspectsPerPlayer: statedNumber(sections, /shares (\d+|[a-z]+) Aspects per player/i, 'the number of Aspects dealt per player', warn),
  };
}
