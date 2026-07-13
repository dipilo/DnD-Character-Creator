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

function renderStructuredLine(line: string, lineIndex: number) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const labelMatch = /^([^.:]{2,80})([.:])\s*(.*)$/.exec(trimmed);
  const label = labelMatch?.[1]?.trim() ?? '';
  const isStructuredLabel = structuredSectionLabels.includes(label as (typeof structuredSectionLabels)[number]) || spellTierPattern.test(label);

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

export function ContentReferenceText({ text }: Readonly<{ text: string }>) {
  const lines = normalizeStructuredText(text).split(/\n+/);
  const nodes: ReactNode[] = [];

  lines.forEach((line, index) => {
    const renderedLine = renderStructuredLine(line, index);
    if (!renderedLine) {
      return;
    }

    if (nodes.length > 0) {
      nodes.push(<br key={`br-${nodes.length}-${line.length}`} />);
    }

    nodes.push(renderedLine);
  });

  return nodes.length === 1 ? nodes[0] : nodes;
}