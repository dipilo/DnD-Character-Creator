// PDF text with coordinates: the appendices are two-column, so lines alone interleave.
import fs from 'node:fs';

/** Items closer than this on the y axis are the same line. Body text here is set on ~11pt leading. */
const LINE_TOLERANCE = 2.5;

/** Deliberately small: the typesetter breaks words across items ("a rela" + "tionship"). */
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

/** Joined on the measured gap, so a word split across runs stays one word. */
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

/** A run belongs to the column it *starts* in; `splitX` is a coordinate, not a fraction. */
export function toColumns(items, splitX) {
  return [
    toLines(items.filter((item) => item.x < splitX)),
    toLines(items.filter((item) => item.x >= splitX)),
  ];
}

/** How far left of the right column the split sits. One em at the body size these pages use. */
const GUTTER_MARGIN = 10;

/** The widest gap between row-opening runs, split just left of the right column. */
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
