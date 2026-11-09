// Scrubbing imported prose of the page furniture a scrape drags in. Pure string handling, kept out
// of `runtimeContent.ts` so it can be tested without pulling the content packs into the test.

/** Everything past one of these is a compendium page's own chrome, never an entity's text. */
const chromeNoisePatterns = [
  /\/\/\s*<!\[CDATA\[[\s\S]*$/i,
  /Waterdeep\.CompendiumPage\.initialize[\s\S]*$/i,
  /\/\/\s*This site works best with JavaScript enabled\.[\s\S]*$/i,
  /\bMy Characters\b[\s\S]*$/i,
  /\bHomebrew Classes Backgrounds Species Feats Spells Equipment\b[\s\S]*$/i,
  /\bTools Character Builder Sigil 3D VTT\b[\s\S]*$/i,
  /\bBrowse Spells Browse Monsters Browse Magic Items Browse Backgrounds Browse Feats Browse Species Browse Subclasses\b[\s\S]*$/i,
  /\bnew URLSearchParams\(document\.location\.search\)[\s\S]*$/i,
  /Hexblade\. What a cool name![\s\S]*$/i,
  /\bThis section presents the [^.]+ spell list\.[\s\S]*$/i,
  /\b[A-Z][^.]+ subclass is a specialization that grants you features at certain [^.]+ levels, as specified in the subclass\.[\s\S]*$/i
];

export function sanitizeImportedText(value?: string): string | undefined {
  if (!value) {
    return value;
  }

  return chromeNoisePatterns.reduce((current, pattern) => current.replace(pattern, ' '), value)
    .replaceAll(/[“"][^\S\n]+/g, (match) => match.trimEnd())
    .replaceAll(/[^\S\n]+[”"]/g, (match) => match.trimStart())
    // Horizontal whitespace only. A line break is structure by the time it reaches here — the
    // importers write a feature's paragraphs and a table's rows as lines — and collapsing it put
    // Wild Shape's Beast Shapes table back into one run of prose *after* the pipeline fixed it.
    .replaceAll(/[^\S\n]+/g, ' ')
    .replaceAll(/ ?\n ?/g, '\n')
    .replaceAll(/\n{3,}/g, '\n\n')
    // Joining separately extracted paragraphs can strand the joining space in front of the
    // punctuation that opened the next one ("back into its true form . Its statistics are...").
    .replaceAll(/[^\S\n]+([,;.])/g, '$1')
    .trim();
}
