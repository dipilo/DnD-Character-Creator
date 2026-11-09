import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const referenceTargets = new Map<string, { label: string; to: string }>([
  ['equipment', { label: 'Equipment', to: '/builder/equipment' }],
  ['feat', { label: 'Feats', to: '/builder/advancements' }],
  ['feats', { label: 'Feats', to: '/builder/advancements' }],
  ['spell', { label: 'Spells', to: '/builder/spells' }],
  ['spells', { label: 'Spells', to: '/builder/spells' }],
  ['background', { label: 'Background', to: '/builder/background' }],
  ['backgrounds', { label: 'Backgrounds', to: '/builder/background' }],
  ['class', { label: 'Class', to: '/builder/class' }],
  ['classes', { label: 'Classes', to: '/builder/class' }]
]);

const referencePattern = /(see\s+)([“"'])?\s*(Equipment|Feats|Feat|Spells|Spell|Backgrounds|Background|Classes|Class)\s*([”"'])?/gi;

const structuredSectionLabels = [
  'Prerequisites',
  'Replacing and Gaining Invocations',
  'Special',
  'Benefit',
  'Benefits',
  'Choose One',
  'Choose one',
  'You Have the Following Benefits'
] as const;

const spellTierPattern = /^(Cantrip|1st|2nd|3rd|4th|5th|6th|7th|8th|9th)$/;
const structuredSectionPattern = structuredSectionLabels.join('|').replaceAll(' ', String.raw`\s+`);

function linkifyReferences(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(referencePattern)) {
    const [fullMatch, prefix, openingQuote, referenceName, closingQuote] = match;
    const start = match.index ?? 0;

    if (start > cursor) {
      nodes.push(text.slice(cursor, start));
    }

    const target = referenceTargets.get(referenceName.toLowerCase());
    if (!target) {
      nodes.push(fullMatch);
      cursor = start + fullMatch.length;
      continue;
    }

    nodes.push(prefix);
    if (openingQuote) {
      nodes.push(openingQuote);
    }
    nodes.push(
      <Link
        key={`${keyPrefix}-${target.to}-${start}`}
        to={target.to}
        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 transition-colors hover:text-primary/80"
      >
        {target.label}
      </Link>
    );
    if (closingQuote) {
      nodes.push(closingQuote);
    }

    cursor = start + fullMatch.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function renderInlineText(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    const [fullMatch, boldText] = match;
    const start = match.index ?? 0;

    if (start > cursor) {
      nodes.push(...linkifyReferences(text.slice(cursor, start), `${keyPrefix}-plain-${start}`));
    }

    nodes.push(
      <strong key={`${keyPrefix}-bold-${start}`} className="font-semibold text-foreground">
        {linkifyReferences(boldText, `${keyPrefix}-bold-${start}`)}
      </strong>
    );

    cursor = start + fullMatch.length;
  }

  if (cursor < text.length) {
    nodes.push(...linkifyReferences(text.slice(cursor), `${keyPrefix}-plain-tail`));
  }

  return nodes;
}

function normalizeStructuredText(text: string) {
  return text
    .replaceAll(/\s+([•*-])\s+/g, '\n$1 ')
    .replaceAll(/\s+(?=(Cantrip|1st|2nd|3rd|4th|5th|6th|7th|8th|9th):)/g, '\n')
    .replaceAll(new RegExp(String.raw`\.\s+(?=${structuredSectionPattern}(?:\.|:))`, 'g'), '.\n');
}

const labelFunctionWords = new Set([
  'of', 'the', 'a', 'an', 'and', 'or', 'in', 'on', 'to', 'for', 'with', 'while', 'from', 'by', 'at', 'as'
]);

const capitalizedWordPattern = /^[A-Z][\w’'-]*$/;

/**
 * Both printings set a labelled paragraph's lead-in in bold — "Number of Uses.", "Game
 * Statistics.", "Dexterous Attacks." — so the shape is read rather than listed per feature. An
 * empty remainder is what keeps a short sentence from being mistaken for one of them.
 */
function isBookSectionLabel(label: string, remainder: string): boolean {
  if (!remainder) return false;

  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;

  let capitalized = 0;
  for (const word of words) {
    if (capitalizedWordPattern.test(word)) {
      capitalized += 1;
    } else if (!labelFunctionWords.has(word.toLowerCase())) {
      return false;
    }
  }

  return capitalized > 0;
}

function renderStructuredLine(line: string, lineIndex: number) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const labelMatch = /^([^.:]{2,80})([.:])\s*(.*)$/.exec(trimmed);
  const label = labelMatch?.[1]?.trim() ?? '';
  const isStructuredLabel = structuredSectionLabels.includes(label as (typeof structuredSectionLabels)[number])
    || spellTierPattern.test(label)
    || isBookSectionLabel(label, labelMatch?.[3]?.trim() ?? '');

  if (!labelMatch || !isStructuredLabel) {
    return <span key={`line-${lineIndex}`}>{renderInlineText(trimmed, `line-${lineIndex}`)}</span>;
  }

  const [, , punctuation, remainder] = labelMatch;

  return (
    <span key={`line-${lineIndex}`}>
      <span className="font-medium">{label}{punctuation}</span>
      {remainder ? <> {renderInlineText(remainder, `line-${lineIndex}-body`)}</> : null}
    </span>
  );
}

/** A row the importers write as `a | b | c`, the header among them. */
const isTableRow = (line: string) => line.includes(' | ');

type ContentBlock = { kind: 'text'; line: string } | { kind: 'table'; rows: string[] };

/** A table row keeps its own line; everything else goes through the bullet/section normalizer. */
function toBlocks(text: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  const lines = text
    .split(/\n+/)
    .flatMap((line) => (isTableRow(line) ? [line] : normalizeStructuredText(line).split(/\n+/)));

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const last = blocks.at(-1);
    if (isTableRow(trimmed) && last?.kind === 'table') {
      last.rows.push(trimmed);
    } else if (isTableRow(trimmed)) {
      blocks.push({ kind: 'table', rows: [trimmed] });
    } else {
      blocks.push({ kind: 'text', line: trimmed });
    }
  }

  // One pipe on its own is prose — "Charisma | Deception" in a sentence is not a table.
  return blocks.map((block) =>
    block.kind === 'table' && block.rows.length < 2 ? { kind: 'text' as const, line: block.rows[0] } : block);
}

/**
 * Spans with table roles rather than a `<table>`: every caller wraps this component in a `<p>`,
 * and a table inside one is closed by the parser before it renders. `minmax(0, …)` is what keeps a
 * four-column table inside a phone's width instead of scrolling the page sideways.
 */
/** `overflow-wrap: anywhere` breaks inside digits, so "1/4" renders as 1/ over 4 without this. */
const isNumericCell = (value: string) => /^[\d\s/+\-–—.%]+$/.test(value);

function TableBlock({ rows, keyPrefix }: Readonly<{ rows: readonly string[]; keyPrefix: string }>) {
  const cells = rows.map((row) => row.split('|').map((cell) => cell.trim()));
  const columns = Math.max(...cells.map((row) => row.length));
  const [heading = [], ...body] = cells;

  return (
    <span
      role="table"
      className="my-2 grid gap-x-3 gap-y-1 text-sm"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, auto))` }}
    >
      <span role="row" className="contents">
        {Array.from({ length: columns }, (_, column) => (
          <span
            key={`${keyPrefix}-head-${column}`}
            role="columnheader"
            className="border-b pb-1 text-xs font-medium uppercase tracking-wide text-foreground"
          >
            {heading[column] ?? ''}
          </span>
        ))}
      </span>
      {body.map((row, index) => (
        <span key={`${keyPrefix}-row-${index}-${row[0] ?? ''}`} role="row" className="contents">
          {Array.from({ length: columns }, (_, column) => {
            const value = row[column] ?? '';
            return (
              <span
                key={`${keyPrefix}-cell-${index}-${column}`}
                role="cell"
                className={isNumericCell(value) ? 'tabular-nums' : undefined}
              >
                {value}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

export function ContentReferenceText({ text }: Readonly<{ text: string }>) {
  const nodes: ReactNode[] = [];
  let previousWasText = false;

  toBlocks(text).forEach((block, index) => {
    if (block.kind === 'table') {
      nodes.push(<TableBlock key={`table-${index}`} rows={block.rows} keyPrefix={`table-${index}`} />);
      previousWasText = false;
      return;
    }

    const renderedLine = renderStructuredLine(block.line, index);
    if (!renderedLine) return;

    // The table carries its own margin, so a break beside one would double the gap.
    if (previousWasText) {
      nodes.push(<br key={`br-${index}`} />);
    }

    nodes.push(renderedLine);
    previousWasText = true;
  });

  return nodes.length === 1 ? nodes[0] : nodes;
}