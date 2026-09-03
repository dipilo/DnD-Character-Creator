/**
 * Text out of a PDF, with the coordinates intact.
 *
 * The Kids on Bikes rulebook is the second source document beside the Obsidian vault: the vault
 * has no note for the appendices, and they are what the Pre-Game Form and the Powered Character
 * need. Its `/Encrypt` dictionary is an owner password only (`/V 4 /R 4`), so pdf.js opens it with
 * the empty user password like any other reader — the "incorrect header check" a hand-rolled
 * `zlib.inflateSync` reports is the standard security handler on that file and `DCTDecode` image
 * streams on the three sheet PDFs, never a password nobody has.
 *
 * Coordinates matter because the appendices are set in two columns and every one of them numbers
 * 1-6 down the left and 7-12 down the right. Reading a page as a stream of lines interleaves the
 * two, so a table read that way mis-assigns half its entries and nothing errors.
 */
import fs from 'node:fs';

/** Items closer than this on the y axis are the same line. Body text here is set on ~11pt leading. */
const LINE_TOLERANCE = 2.5;

/**
 * A gap this wide is a space. It is deliberately small: the typesetter breaks words across items
 * ("a rela" + "tionship with"), and inserting a space at every item boundary is what splits them.
 */
const SPACE_GAP = 1.2;

export async function readPdf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(file));
  // Standard fonts are only needed to render glyphs; text extraction reads the content stream.
  return await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: false, verbosity: 0 }).promise;
}

/** Every positioned run of text on one 1-based page. */
export async function readPage(doc, number) {
  const page = await doc.getPage(number);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = [];
  for (const item of content.items) {
    if (typeof item.str !== 'string' || item.str === '') continue;
    items.push({
      text: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width ?? 0,
      height: item.height ?? 0,
    });
  }
  return { number, width: viewport.width, height: viewport.height, items };
}

export async function readPages(doc, from, to) {
  const pages = [];
  for (let n = from; n <= to; n += 1) pages.push(await readPage(doc, n));
  return pages;
}

/** Every page of one file. The rulebook is read whole because its sections are found by heading. */
export async function readAllPages(file) {
  const doc = await readPdf(file);
  return await readPages(doc, 1, doc.numPages);
}

/**
 * Group positioned runs into lines, top to bottom. `text` is joined on the measured gap rather
 * than on the item boundary, so a word the typesetter split across two runs stays one word.
 */
export function toLines(items) {
  const rows = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= LINE_TOLERANCE);
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  return rows.map((row) => {
    const ordered = [...row.items].sort((a, b) => a.x - b.x);
    let text = '';
    let end = null;
    for (const item of ordered) {
      if (end !== null && item.x - end > SPACE_GAP) text += ' ';
      text += item.text;
      end = item.x + item.width;
    }
    return { y: row.y, x: ordered[0].x, text: text.replace(/\s+/g, ' ').trim(), items: ordered };
  }).filter((line) => line.text !== '');
}

/**
 * Split a page down a vertical rule and read each side on its own.
 *
 * A run belongs to the column it *starts* in, never the one its midpoint lands in. Left-column
 * text is set right up to the gutter — the soft hyphen ending "deck manipu-" sits at x=197.6 on a
 * 442.8pt page — and a heading that spans both columns starts in the left one, which is where a
 * reader takes it from.
 *
 * `splitX` is a page coordinate, not a fraction, because these pages are not set on a centred
 * gutter: Appendix K's second column starts well right of the middle.
 */
export function toColumns(items, splitX) {
  return [
    toLines(items.filter((item) => item.x < splitX)),
    toLines(items.filter((item) => item.x >= splitX)),
  ];
}

/** How far left of the right column the split sits. One em at the body size these pages use. */
const GUTTER_MARGIN = 10;

/**
 * Where the gutter is, measured from the runs rather than assumed.
 *
 * `starts` are the x positions of runs that are known to begin a column's rows — a bullet, a
 * number. The widest gap between two of them is the gutter, and the split sits just left of the
 * right column so that a left-column run reaching towards it still lands on its own side.
 */
export function splitBetweenColumns(starts, fallback) {
  const sorted = [...new Set(starts)].sort((a, b) => a - b);
  if (sorted.length < 2) return fallback;
  let best = { gap: 0, right: sorted[0] };
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > best.gap) best = { gap, right: sorted[i] };
  }
  return best.gap > 0 ? best.right - GUTTER_MARGIN : fallback;
}

/** The whole page as text, one line per row. Single-column pages only. */
export function pageText(page) {
  return toLines(page.items).map((line) => line.text).join('\n');
}
