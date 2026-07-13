const whitespacePattern = /\s+/g;
const sentencePattern = /[^.!?]+[.!?]?/g;

const normalizeWhitespace = (value: string) => value.replaceAll(whitespacePattern, ' ').trim();

export const getDescriptionPreview = (value: string, maxSentences = 2) => {
  const firstParagraph = value
    .split(/\n\s*\n/)
    .map(normalizeWhitespace)
    .find(Boolean);

  if (!firstParagraph) {
    return '';
  }

  const sentences = firstParagraph.match(sentencePattern)?.map((sentence) => sentence.trim()).filter(Boolean) ?? [firstParagraph];
  const preview = sentences.slice(0, maxSentences).join(' ').trim();
  return preview || firstParagraph;
};