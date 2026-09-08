// The Kids on Bikes export: the publisher's own sheet with the character's answers drawn onto it.
//
// The PDF is a flat scan with no AcroForm fields, so `pdf-lib` writes text at points on the page
// rather than filling anything. Everything below the coordinate table is positions — what goes in
// each blank comes from `generated.ts` and the character, never from a list written here.
//
// The geometry: the line-art layer is placed by the page's own content stream as
// `q 430.65 0 0 637.49 10.77 21.28 cm /I5 Do Q`, so a pixel of that 1574 x 2330 image maps to
// `x = 10.77 + px * 430.65/1574` and `y = 21.28 + (2330 - py) * 637.49/2330`. Every rule and every
// checkbox in the table was measured off the image's alpha channel at those numbers.
import {
  freeStrengthForAge,
  fullName,
  getAgeRules,
  getStrength,
  getTrope,
  kob,
  tropeQuestions,
} from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobCharacter } from '@/types/kob';

/** One writing line on the sheet: where its rule starts, where it ends, and the rule's own y. */
interface SheetLine {
  x: number;
  width: number;
  /** The rule itself. Text is drawn a little above it. */
  y: number;
}

const line = (x: number, right: number, y: number): SheetLine => ({ x, width: right - x, y });

/** The blanks inside the purple box, in the order the sheet prints them. */
const FIELD_LINES = {
  name: [line(68.8, 139.6, 570.4)],
  trope: [line(176.6, 266.6, 570.1)],
  age: [line(62.5, 140.7, 549.1)],
  bike: [line(170.3, 266.0, 548.0)],
  motivation: [line(91.5, 261.9, 525.3)],
  fear: [line(63.0, 262.5, 503.6)],
  flaws: [line(69.9, 261.1, 482.3)],
  obligations: [line(98.0, 261.9, 456.9)],
  knacks: [line(77.5, 261.4, 438.0), line(35.9, 261.7, 415.8)],
  tropeQuestions: [line(117.5, 262.2, 393.7), line(37.6, 262.2, 370.4)],
  description: [line(97.0, 261.7, 349.9), line(37.0, 263.0, 328.5), line(38.4, 265.2, 308.3)],
  notes: [line(23.4, 426.4, 107.7), line(23.4, 426.4, 85.3), line(23.4, 426.4, 61.8), line(23.4, 426.4, 35.8)],
  skilledAt: [line(216.5, 276.4, 221.3)],
  adversityTokens: [line(350.9, 434.0, 372.0)],
} satisfies Record<string, SheetLine[]>;

/** The six stat rules, keyed by the stat printed under each. */
const STAT_LINES: Record<string, SheetLine> = {
  fight: line(313.1, 356.6, 534.3),
  flight: line(365.1, 411.1, 534.6),
  brains: line(313.1, 356.6, 478.2),
  brawn: line(365.1, 411.1, 478.5),
  charm: line(313.1, 356.6, 422.4),
  grit: line(365.1, 411.1, 422.7),
};

/** The centre of each printed Strength's checkbox. Two columns of eight. */
const STRENGTH_BOXES: Record<string, { x: number; y: number }> = {
  'cool-under-pressure': { x: 32.1, y: 278.1 },
  easygoing: { x: 32.1, y: 260.3 },
  gross: { x: 32.1, y: 242.8 },
  heroic: { x: 32.1, y: 227.4 },
  intuitive: { x: 32.1, y: 208.8 },
  loyal: { x: 32.1, y: 191.9 },
  lucky: { x: 32.1, y: 174.6 },
  prepared: { x: 32.1, y: 157.7 },
  protective: { x: 156.6, y: 278.1 },
  'quick-healing': { x: 156.6, y: 260.3 },
  rebellious: { x: 156.6, y: 242.8 },
  'skilled-at': { x: 156.6, y: 227.4 },
  tough: { x: 156.6, y: 208.8 },
  'treasure-hunter': { x: 156.6, y: 191.9 },
  unassuming: { x: 156.6, y: 174.6 },
  wealthy: { x: 156.6, y: 157.7 },
};

/**
 * The standard fonts encode WinAnsi, and a codepoint outside it makes `drawText` throw — which
 * would fail the whole export over one character somebody typed. Curly punctuation is inside it
 * and survives; anything else is dropped.
 */
const winAnsi = (value: string) =>
  [...value]
    .filter((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      if (code >= 0x20 && code <= 0x7e) return true;
      if (code >= 0xa0 && code <= 0xff) return true;
      return '‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ€'.includes(ch);
    })
    .join('');

/** Text sits this far above its rule, so a descender does not cross it. */
const BASELINE_LIFT = 2.5;
const BODY_SIZE = 8;
const HEADING_SIZE = 9.5;

const joinAnswers = (questions: readonly string[], answers: readonly string[]) =>
  questions
    .map((question, index) => {
      const answer = answers[index]?.trim();
      return answer ? `${question} ${answer}` : '';
    })
    .filter(Boolean)
    .join('  ');

/** The Flaw the player settled on: a written-in one wins over the list, as the builder has it. */
const flawLabel = (character: KobCharacter) =>
  character.customFlaw.trim() || kob.flaws.find((entry) => entry.id === character.flawId)?.name || '';

/** Every Strength on the sheet, the age's free one included — it is derived, never stored. */
const checkedStrengthIds = (character: KobCharacter) => {
  const free = freeStrengthForAge(character.age);
  const ids = new Set(character.strengthIds.filter((id) => getStrength(id) !== null));
  if (free) ids.add(free.id);
  return ids;
};

const bikeLabel = (character: KobCharacter) => character.bike.name.trim();

/**
 * Greedy wrap across the lines a field was given. Anything past the last line is dropped: the
 * sheet is a fixed page, and a value that will not fit is the player's to shorten.
 */
function wrapAcross(
  text: string,
  lines: readonly SheetLine[],
  size: number,
  widthOf: (value: string, size: number) => number,
): Array<{ line: SheetLine; text: string }> {
  const words = text.split(/\s+/).filter(Boolean);
  const drawn: Array<{ line: SheetLine; text: string }> = [];
  let index = 0;
  let current = '';
  for (const word of words) {
    if (index >= lines.length) break;
    const candidate = current ? `${current} ${word}` : word;
    if (widthOf(candidate, size) <= lines[index].width || !current) {
      current = candidate;
      continue;
    }
    drawn.push({ line: lines[index], text: current });
    index += 1;
    current = word;
  }
  if (current && index < lines.length) drawn.push({ line: lines[index], text: current });
  return drawn;
}

export async function exportKobCharacterToPdf(character: KobCharacter) {
  const [templateResponse, pdfLib] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}kids-on-bikes/character-sheet.pdf`),
    import('pdf-lib'),
  ]);
  if (!templateResponse.ok) {
    throw new Error('Unable to load the Kids on Bikes sheet.');
  }

  const { PDFDocument, StandardFonts, rgb } = pdfLib;
  const pdf = await PDFDocument.load(await templateResponse.arrayBuffer());
  const page = pdf.getPages()[0];
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.13, 0.11, 0.2);
  const widthOf = (value: string, size: number) => font.widthOfTextAtSize(value, size);

  const draw = (text: string, lines: readonly SheetLine[], size = BODY_SIZE) => {
    const value = winAnsi(text).trim();
    if (!value || lines.length === 0) return;
    for (const part of wrapAcross(value, lines, size, widthOf)) {
      page.drawText(part.text, { x: part.line.x + 1.5, y: part.line.y + BASELINE_LIFT, size, font, color: ink });
    }
  };

  const trope = getTrope(character.tropeId);
  const age = getAgeRules(character.age);

  draw(fullName(character), FIELD_LINES.name, HEADING_SIZE);
  draw(trope?.name ?? '', FIELD_LINES.trope, HEADING_SIZE);
  draw(age?.name ?? '', FIELD_LINES.age, HEADING_SIZE);
  draw(bikeLabel(character), FIELD_LINES.bike, HEADING_SIZE);
  draw(character.motivation, FIELD_LINES.motivation);
  draw(character.fear, FIELD_LINES.fear);
  draw(flawLabel(character), FIELD_LINES.flaws);
  draw(character.obligations, FIELD_LINES.obligations);
  draw(character.knacks.map((knack) => knack.trim()).filter(Boolean).join(', '), FIELD_LINES.knacks);
  draw(joinAnswers(tropeQuestions(character.tropeId), character.tropeAnswers), FIELD_LINES.tropeQuestions);
  draw(character.description, FIELD_LINES.description);
  draw(character.notes, FIELD_LINES.notes);
  draw(character.skilledAt, FIELD_LINES.skilledAt);
  draw(String(character.adversityTokens), FIELD_LINES.adversityTokens, HEADING_SIZE);

  for (const [statId, target] of Object.entries(STAT_LINES)) {
    const die = character.statDice[statId as keyof typeof character.statDice];
    if (!die) continue;
    const size = 11;
    const centred = target.x + (target.width - widthOf(die, size)) / 2;
    page.drawText(die, { x: centred, y: target.y + BASELINE_LIFT, size, font, color: ink });
  }

  for (const id of checkedStrengthIds(character)) {
    const box = STRENGTH_BOXES[id];
    if (!box) continue;
    const size = 11;
    page.drawText('X', {
      x: box.x - widthOf('X', size) / 2,
      y: box.y - size * 0.36,
      size,
      font,
      color: ink,
    });
  }

  const output = await pdf.save();
  const bytes = new Uint8Array(output.length);
  bytes.set(output);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${(fullName(character) || 'character').replaceAll(/[\\/:*?"<>|]+/g, '').trim() || 'character'}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
