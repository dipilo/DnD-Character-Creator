export const canonicalSchemaVersion = 'ddbcc-v1';

export const contentBucketKeys = [
  'species',
  'classes',
  'subclasses',
  'backgrounds',
  'spells',
  'equipment',
  'feats',
  'monsters',
  'ua'
];

const allowedCategories = new Set(['core', 'supplement', 'expansion', 'basic', 'ua', 'homebrew']);
const htmlEntityMap = {
  '&amp;': '&',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' '
};

const mojibakeMap = {
  'â€™': "'",
  'â€˜': "'",
  'â€œ': '"',
  'â€�': '"',
  'â€“': '-',
  'â€”': '-',
  'â€¦': '...',
  'Â ': ' ',
  'Â': ''
};

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export const createEmptyImportedContentBucket = () => ({
  species: [],
  classes: [],
  subclasses: [],
  backgrounds: [],
  spells: [],
  equipment: [],
  feats: [],
  monsters: [],
  ua: []
});

export const countContentEntries = (content) => {
  return contentBucketKeys.reduce((total, bucket) => total + (content?.[bucket]?.length ?? 0), 0);
};

const decodeHtmlEntities = (value) => {
  return value.replaceAll(/&(amp|quot|#x27|#39|lt|gt|nbsp);/g, (match) => htmlEntityMap[match] ?? match);
};

const repairMojibake = (value) => {
  return Object.entries(mojibakeMap).reduce((current, [broken, fixed]) => current.replaceAll(broken, fixed), value);
};

// Inline elements render without whitespace in a browser, and D&D Beyond wraps mid-word
// fragments in tags such as <span class="No-Break">ason's tools</span>. Removing inline
// tags (instead of replacing them with a space) keeps those words intact; block-level
// tags still become spaces so adjacent cells/paragraphs stay separated.
const inlineTagNames = new Set(['a', 'abbr', 'b', 'cite', 'code', 'em', 'i', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'wbr']);
const tagOrCommentPattern = /<!--[\s\S]*?-->|<\/?([a-z][a-z0-9-]*)(?:\s[^>]*)?\/?>/gi;
const replaceTags = (value) => value.replaceAll(tagOrCommentPattern, (match, tagName) => (
  tagName && inlineTagNames.has(tagName.toLowerCase()) ? '' : ' '
));

// Blockquotes carry two very different things: an entity's own boxed rules text, and page
// furniture. The furniture is the chapter epigraph (`compendium-first-line-blockquote`, e.g.
// "— Elaine Cunningham, Daughter of the Drow"), the grey sidebar box (whose first paragraph
// carries a `Sidebar-Styles_` heading, e.g. "YOUR PACT BOON" printed beside Eldritch Master),
// and the in-character marginalia Xanathar's Guide prints throughout ("Hexblade. What a cool
// name!"). None of it belongs to the entity whose section happens to contain it.
const furnitureBlockquoteClassPattern = /compendium-first-line-blockquote|compendium-parchment-blockquote|xanathar-talking-blockquote|adventure-read-aloud-text|compendium-toc-blockquote/i;
const sidebarHeadingClassPattern = /class="[^"]*Sidebar-Styles_/i;
const blockquotePattern = /<blockquote\b([^>]*)>([\s\S]*?)<\/blockquote>/gi;
const removeFurnitureBlockquotes = (value) => value.replaceAll(blockquotePattern, (match, attrs, body) => (
  furnitureBlockquoteClassPattern.test(attrs) || sidebarHeadingClassPattern.test(body) ? ' ' : match
));

// Asides (designer commentary boxes), figures (art plus captions), and script/style
// blocks are page furniture interleaved with the article body; they are never part of
// an entity's own text.
const removeNonContentBlocks = (value) => removeFurnitureBlockquotes(value)
  .replaceAll(/<aside\b[\s\S]*?<\/aside>/gi, ' ')
  .replaceAll(/<figure\b[\s\S]*?<\/figure>/gi, ' ')
  .replaceAll(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replaceAll(/<style\b[\s\S]*?<\/style>/gi, ' ');

const extractedTextNoisePatterns = [
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

// Removing a tag can leave the whitespace that surrounded it stranded in front of the punctuation
// that followed ("you can't be blinded , deafened , or incapacitated"). Runs after whitespace has
// been collapsed, so a single literal space is all there is to match.
const strandedPunctuationPattern = / ([,;.])/g;

const sanitizeExtractedText = (value) => {
  return extractedTextNoisePatterns.reduce((current, pattern) => current.replace(pattern, ' '), value)
    .replaceAll(/\s+/g, ' ')
    .replaceAll(strandedPunctuationPattern, '$1')
    .trim();
};

// A printed book navigates by chapter ("see chapter 5, "Equipment""); a builder has none, so a
// bare chapter number is dead text. The document itself says what its chapters are called, so the
// titles are indexed from the references that name one and reused for the references that don't.
// Only chapters that correspond to a builder step survive as a reference — `ContentReferenceText`
// turns "see Equipment" into a link to it; everything else is dropped rather than left pointing at
// a page the player cannot open.
const navigableChapterTitles = new Set(['equipment', 'spells', 'feats', 'backgrounds', 'classes']);
// The closing quote — or the period that stands in for it when the book drops one — terminates
// the title, so the title run excludes those instead of repeating the opening class. Adjacent runs
// that can match the same characters are what make a pattern backtrack super-linearly.
const chapterTitleReferencePattern = /\bchapters?\s+(\d+)\s*,\s*[“"']([A-Za-z][^”"'.]{1,40})[”"'.]/gi;
const spellChapterReferencePattern = /\ba spell in chapters?\s+\d+/gi;
const bareChapterReferencePattern = /\bchapters?\s+(\d+)(?:\s+of\s+the\s+[^,.;)]+)?/gi;
// Marks a chapter pointer that resolved to nothing a player can open, so the surrounding
// parenthetical, clause, or navigation-only sentence can be removed around it. Each run leading up
// to the marker excludes it, so no run can swallow the marker and then have to give it back.
const deadReferenceMarker = '\uE000';
const deadParentheticalPattern = new RegExp(String.raw`\s*\([^()${deadReferenceMarker}]*${deadReferenceMarker}[^()]*\)`, 'g');
const navigationSentencePattern = new RegExp(
  String.raw`(?:^|(?<=[.!?]\s))(?:See|For more information[^.!?]*see)\b[^.!?${deadReferenceMarker}]*${deadReferenceMarker}[^.!?]*[.!?]\s*`,
  'g'
);
const deadClausePattern = new RegExp(
  String.raw`[,;]?(?: (?:as )?(?:see|described in|explained in|detailed in|found in|presented in|provided in|from|in|of))? ?${deadReferenceMarker}`,
  'g'
);

let documentChapterTitles = new Map();
let documentSourceLabel = '';

export const setDocumentReferenceContext = (raw, label) => {
  documentChapterTitles = new Map();
  documentSourceLabel = label ?? '';

  for (const match of String(raw ?? '').matchAll(chapterTitleReferencePattern)) {
    const title = decodeHtmlEntities(match[2]).replaceAll('­', '').trim();
    if (title && !documentChapterTitles.has(match[1])) {
      documentChapterTitles.set(match[1], title);
    }
  }
};

const resolveChapterReference = (chapterNumber, printedTitle) => {
  const title = (printedTitle ?? documentChapterTitles.get(chapterNumber) ?? '').trim();
  return navigableChapterTitles.has(title.toLowerCase()) ? title : deadReferenceMarker;
};

const rewriteBookReferences = (value) => {
  if (!value.includes('chapter') && !value.includes('Chapter')) {
    return value;
  }

  const resolved = value
    // A footnote marker pointing at the book's own spell chapter is more useful as the book's name.
    .replaceAll(spellChapterReferencePattern, documentSourceLabel ? `a ${documentSourceLabel} spell` : 'a spell from this source')
    .replaceAll(chapterTitleReferencePattern, (match, chapterNumber, printedTitle) => {
      const replacement = resolveChapterReference(chapterNumber, printedTitle);
      // The title pattern eats the punctuation that closed the quote; put a period back.
      return match.endsWith('.') && replacement !== deadReferenceMarker ? `${replacement}.` : replacement;
    })
    .replaceAll(bareChapterReferencePattern, (_match, chapterNumber) => resolveChapterReference(chapterNumber));

  if (!resolved.includes(deadReferenceMarker)) {
    return resolved;
  }

  return resolved
    .replace(navigationSentencePattern, '')
    .replaceAll(deadParentheticalPattern, '')
    .replaceAll(deadClausePattern, '')
    .replaceAll(deadReferenceMarker, '');
};

// "detailed at the end of the class description" is a page-layout instruction; in the builder the
// options and subclasses it points at render directly beneath the feature.
const trailingSectionReferencePattern = /\bat the end of the (?:class|subclass|species|race) description\b/gi;

// Sidebars are page furniture and are removed with the rest of it, so a pointer at one — "(see the
// "Your Spellbook" sidebar)" — would send the player to something that is no longer there.
const sidebarPointerPattern = /\s*\((?:see|described in|explained in) the [^()]{0,60}sidebar[^()]{0,20}\)/gi;

// Pointers to another part of the printed page. Every one of them carries a locating phrase
// ("later in this class's description", "earlier in this section", "a class's section"), which is
// what separates them from the ordinary noun — "a 10-foot section of wall" stays untouched.
const sectionPointerRewrites = [
  // "...described in the "Eldritch Invocation Options" section later in this class's description."
  // "...two Metamagic options of your choice from "Metamagic Options" later in this class's
  // description." Either way the thing being pointed at renders directly under the feature.
  [/\s+(?:in|from) (?:the )?[“"'][^”"']{1,60}[”"'](?: section)?(?: (?:later|earlier))? in this (?:class|subclass|species|race)[’']?s? description/gi, ' below'],
  // "(see the Cleric class's section for a list of Cleric spells)" — that list is the Spells step.
  [/\s*\([^()]{0,40}class[’']?s? section[^()]{0,40}spells?[^()]{0,20}\)/gi, ' (see Spells)'],
  [/\s*\([^()]{0,40}(?:later|earlier) in this section[^()]{0,20}\)/gi, '']
];

const sectionPointerHintPattern = /section|description/i;
const rewriteSectionPointers = (value) => {
  return sectionPointerHintPattern.test(value)
    ? sectionPointerRewrites.reduce((current, [pattern, replacement]) => current.replaceAll(pattern, replacement), value)
    : value;
};

// InDesign discretionary hyphens survive the export inside words ("Equip­ment"), which breaks
// both reading and any match against the word.
const softHyphenPattern = /\u00AD/g;

// Turns a book's internal navigation into something a builder can honour. Shared with the
// SRD-derived generator, whose entries never pass through the HTML extractor but carry the same
// "(described later in this section)" pointers.
export const rewriteSourceCrossReferences = (value) => {
  if (typeof value !== 'string' || !value) {
    return value;
  }

  const normalized = value
    .replaceAll(softHyphenPattern, '')
    .replaceAll(sidebarPointerPattern, '')
    .replaceAll(trailingSectionReferencePattern, 'below');

  return rewriteBookReferences(sanitizeExtractedText(rewriteSectionPointers(normalized)));
};

const stripTags = (value) => {
  return rewriteSourceCrossReferences(repairMojibake(decodeHtmlEntities(replaceTags(value))));
};

const slugify = (value, fallback = 'entry') => {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '') || fallback;
};

const normalizeEntity = (entry, source, fallbackPrefix, index) => {
  if (!isObject(entry)) {
    return null;
  }

  const normalized = { ...entry };
  const fallbackName = typeof normalized.name === 'string' && normalized.name.trim().length > 0
    ? normalized.name.trim()
    : `${fallbackPrefix} ${index + 1}`;

  if (typeof normalized.id !== 'string' || normalized.id.trim().length === 0) {
    normalized.id = slugify(fallbackName, `${fallbackPrefix}-${index + 1}`);
  }

  if (typeof normalized.name !== 'string' || normalized.name.trim().length === 0) {
    normalized.name = fallbackName;
  }

  if (typeof normalized.source !== 'string' || normalized.source.trim().length === 0) {
    normalized.source = source.label;
  }

  if (typeof normalized.sourceId !== 'string' || normalized.sourceId.trim().length === 0) {
    normalized.sourceId = source.sourceId;
  }

  return normalized;
};

const sanitizeContent = (content, source) => {
  const sanitized = createEmptyImportedContentBucket();

  for (const bucket of contentBucketKeys) {
    const entries = Array.isArray(content?.[bucket]) ? content[bucket] : [];
    if (bucket === 'ua') {
      sanitized.ua = entries.filter(isObject);
      continue;
    }

    sanitized[bucket] = entries
      .map((entry, index) => normalizeEntity(entry, source, bucket.slice(0, -1) || bucket, index))
      .filter(Boolean);
  }

  return sanitized;
};

const extractTitle = (raw) => {
  const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    return stripTags(titleMatch[1]);
  }

  const headingMatch = raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return headingMatch ? stripTags(headingMatch[1]) : '';
};

const extractHeadingSections = (raw) => {
  const seen = new Set();
  const sections = [];
  const matches = raw.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi);

  for (const match of matches) {
    const title = stripTags(match[2]);
    if (!title || seen.has(title.toLowerCase())) {
      continue;
    }

    seen.add(title.toLowerCase());
    sections.push({
      id: slugify(title, `section-${sections.length + 1}`),
      title,
      level: Number(match[1])
    });
  }

  return sections;
};

const extractAnchorSections = (raw, existingSections) => {
  const seen = new Set(existingSections.map((section) => `${section.title.toLowerCase()}::${section.href ?? ''}`));
  const sections = [...existingSections];
  const matches = raw.matchAll(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi);

  for (const match of matches) {
    const href = match[1];
    const title = stripTags(match[2]);
    if (!title || title.length > 140) {
      continue;
    }
    if (!href.includes('/sources/') && !href.startsWith('#')) {
      continue;
    }

    const key = `${title.toLowerCase()}::${href}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    sections.push({
      id: slugify(title, `section-${sections.length + 1}`),
      title,
      level: 2,
      href
    });
  }

  return sections;
};

const extractTextSections = (raw) => {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length < 120)
    .slice(0, 120)
    .map((line, index) => ({
      id: slugify(line, `section-${index + 1}`),
      title: line,
      level: 2
    }));
};

const headingIdRegex = /\sid="([^"]+)"/i;
const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
const tableCellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
const anchorLinkRegex = /<a[^>]*href="#([^"]+)"[^>]*>([\s\S]*?)<\/a>/i;

// A section ends where the document outline leaves it: at the next heading of the same level or
// of any *higher* level. Ending only at the next same-level heading let a section run straight
// through the chapter boundary that follows it — the Warlock's last class feature (Eldritch
// Master, an <h3>) swallowed the whole "Eldritch Invocations" <h2> chapter because the next <h3>
// only came inside it.
const openingHeadingPattern = /<h([1-6])\b[^>]*>/gi;

const findSectionEnd = (raw, level, contentStart) => {
  openingHeadingPattern.lastIndex = contentStart;
  let match;

  while ((match = openingHeadingPattern.exec(raw)) !== null) {
    if (Number(match[1]) <= level) {
      return match.index;
    }
  }

  return raw.length;
};

export const collectHeadingBlocks = (raw, level) => {
  const regex = new RegExp(String.raw`<h${level}([^>]*)>([\s\S]*?)<\/h${level}>`, 'gi');
  const blocks = [];
  let match;

  while ((match = regex.exec(raw)) !== null) {
    const attrs = match[1] ?? '';
    const title = stripTags(match[2] ?? '');
    if (!title) {
      continue;
    }

    const idMatch = headingIdRegex.exec(attrs);
    const contentStart = regex.lastIndex;
    blocks.push({
      id: idMatch?.[1] ?? slugify(title),
      title,
      start: match.index,
      contentStart,
      content: raw.slice(contentStart, findSectionEnd(raw, level, contentStart))
    });
  }

  return blocks;
};

// A heading block's `content` runs to the next heading *of the same level*, so it can swallow
// every nested subsection. When only the section's own body is wanted, cut at the next heading
// of any level.
const anyHeadingPattern = /<h[1-6]\b[^>]*>/i;
export const sliceSectionBody = (raw, contentStart = 0) => {
  const body = raw.slice(contentStart);
  const nextHeading = anyHeadingPattern.exec(body);
  return nextHeading ? body.slice(0, nextHeading.index) : body;
};

const extractParagraphTexts = (raw) => {
  return [...removeNonContentBlocks(raw).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
};

const extractParagraphEntries = (raw) => {
  return [...removeNonContentBlocks(raw).matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/gi)]
    .map((match) => ({
      attrs: match[1] ?? '',
      raw: match[2] ?? '',
      text: stripTags(match[2] ?? '')
    }))
    .filter((entry) => entry.text);
};

const extractListItems = (raw) => {
  return [...removeNonContentBlocks(raw).matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean);
};

const extractStructuredTableRows = (raw) => {
  return [...raw.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) => {
      const cells = [...rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)]
        .map((cellMatch) => stripTags(cellMatch[1]))
        .filter(Boolean);

      return cells;
    })
    .filter((row) => row.length > 0);
};

const formatTableRows = (rows) => {
  if (rows.length === 0) {
    return [];
  }

  if (rows[0].length === 2) {
    return rows.slice(1).map((row) => `${row[0]}: ${row[1]}`);
  }

  return rows.map((row) => row.join(' | '));
};

export const extractStructuredTexts = (raw) => {
  return [...removeNonContentBlocks(raw).matchAll(/<(p|ul|ol|table)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .flatMap((match) => {
      const tagName = match[1]?.toLowerCase();
      const blockRaw = match[0] ?? '';

      if (tagName === 'p') {
        const text = stripTags(match[2] ?? '');
        return text ? [text] : [];
      }

      if (tagName === 'ul' || tagName === 'ol') {
        return extractListItems(blockRaw).map((entry) => `• ${entry}`);
      }

      if (tagName === 'table') {
        return formatTableRows(extractStructuredTableRows(blockRaw));
      }

      return [];
    })
    .filter(Boolean);
};

// An expanded/additional spell list is laid out as a torn-paper aside: bold level headings
// ("Cantrip (0 Level)", "3rd Level") each followed by one paragraph per spell link. Asides are
// page furniture everywhere else, so the list is only read back for features that announce one —
// otherwise "Additional Warlock Spells" ships the sentence "The spells in the following list..."
// with no list behind it.
const spellListLevelPattern = /^(cantrip|\d(?:st|nd|rd|th))\b/i;
const spellListAnnouncementPattern = /following list|following spells|(?:added to|expand) the [\w' -]{0,30}spell list/i;

const parseSpellListGroups = (body) => {
  const groups = [];
  let current = null;

  for (const match of String(body ?? '').matchAll(/<p([^>]*)>([\s\S]*?)<\/p>/gi)) {
    const inner = match[2] ?? '';
    const text = stripTags(inner);
    if (!text) {
      continue;
    }

    const boldText = stripTags(/<strong[^>]*>([\s\S]*?)<\/strong>/i.exec(inner)?.[1] ?? '');
    const levelMatch = boldText === text ? spellListLevelPattern.exec(text) : null;
    if (levelMatch) {
      current = { label: levelMatch[1], spells: [] };
      groups.push(current);
      continue;
    }

    if (current) {
      current.spells.push(text.replaceAll(/\s+\*/g, '*'));
    }
  }

  return groups.filter((group) => group.spells.length > 0);
};

export const extractSpellListLines = (raw, announcementText) => {
  if (!spellListAnnouncementPattern.test(announcementText ?? '')) {
    return [];
  }

  return [...String(raw ?? '').matchAll(/<aside\b[^>]*>([\s\S]*?)<\/aside>/gi)]
    .flatMap((match) => parseSpellListGroups(match[1] ?? ''))
    .map((group) => `${group.label}: ${group.spells.join(', ')}`);
};

const classIdByName = new Map([
  ['barbarian', 'barbarian'],
  ['bard', 'bard'],
  ['cleric', 'cleric'],
  ['druid', 'druid'],
  ['fighter', 'fighter'],
  ['monk', 'monk'],
  ['paladin', 'paladin'],
  ['ranger', 'ranger'],
  ['rogue', 'rogue'],
  ['sorcerer', 'sorcerer'],
  ['warlock', 'warlock'],
  ['wizard', 'wizard']
]);

const getClassIdFromName = (value) => classIdByName.get(value.toLowerCase().trim());

const abilityScoreKeys = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const abilityScoreKeySet = new Set(abilityScoreKeys);
const countWords = new Map([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6]
]);
const skillNames = [
  'Acrobatics',
  'Animal Handling',
  'Arcana',
  'Athletics',
  'Deception',
  'History',
  'Insight',
  'Intimidation',
  'Investigation',
  'Medicine',
  'Nature',
  'Perception',
  'Performance',
  'Persuasion',
  'Religion',
  'Sleight of Hand',
  'Stealth',
  'Survival'
];
const basicRulesSpeciesNamesBySource = new Map([
  ['basic-rules-2014', ['Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Half-Orc', 'Halfling', 'Human', 'Tiefling']],
  ['basic-rules-2024', ['Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Goliath', 'Halfling', 'Human', 'Orc', 'Tiefling']]
]);
const subclassFeaturePattern = /subclass|primal path|bard college|divine domain|druid circle|martial archetype|monastic tradition|sacred oath|ranger archetype|roguish archetype|sorcerous origin|otherworldly patron|arcane tradition|artificer specialist/i;
const monsterConditionNames = new Set([
  'blinded',
  'charmed',
  'deafened',
  'exhaustion',
  'frightened',
  'grappled',
  'incapacitated',
  'invisible',
  'paralyzed',
  'petrified',
  'poisoned',
  'prone',
  'restrained',
  'stunned',
  'unconscious'
]);
const monsterAbilityMap = new Map([
  ['str', 'strength'],
  ['dex', 'dexterity'],
  ['con', 'constitution'],
  ['int', 'intelligence'],
  ['wis', 'wisdom'],
  ['cha', 'charisma']
]);
const basicRules2014SubclassSectionClassIds = new Map([
  ['primalpaths', 'barbarian'],
  ['bardcolleges', 'bard'],
  ['divinedomains', 'cleric'],
  ['druidcircles', 'druid'],
  ['martialarchetypes', 'fighter'],
  ['monastictraditions', 'monk'],
  ['sacredoaths', 'paladin'],
  ['rangerarchetypes', 'ranger'],
  ['roguisharchetypes', 'rogue'],
  ['sorcerousorigins', 'sorcerer'],
  ['otherworldlypatrons', 'warlock'],
  ['arcanetraditions', 'wizard']
]);

const normalizeLabel = (value) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '');

const toSourceSpecificId = (sourceId, value) => `${sourceId}-${slugify(value)}`;

const escapeRegExp = (value) => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

const parseCountWord = (value, fallback = 0) => {
  const numberMatch = value.match(/(\d+)/);
  if (numberMatch) {
    return Number(numberMatch[1]);
  }

  const lowered = value.toLowerCase();
  for (const [word, count] of countWords.entries()) {
    if (lowered.includes(word)) {
      return count;
    }
  }

  return fallback;
};

const parseHitDieFromText = (value) => {
  const match = value?.match(/d(\d+)/i);
  return match ? Number(match[1]) : undefined;
};

const parseAbilityNames = (value) => {
  return Array.from(new Set((value.match(/strength|dexterity|constitution|intelligence|wisdom|charisma/gi) ?? []).map((entry) => entry.toLowerCase())));
};

const parsePrimaryAbility = (value) => {
  const abilities = parseAbilityNames(value);
  if (abilities.length === 0) {
    return undefined;
  }

  return abilities.length === 1 ? abilities[0] : abilities;
};

const parseSavingThrows = (value) => parseAbilityNames(value);

// "or" separates alternatives, not list members: the Monk's "Choose one type of artisan's tools
// or one musical instrument" is a single choice across two families. Splitting on it turned that
// into two separate proficiencies (and lost the "choose one" framing), so only commas and
// semicolons split entries — "A, B, or C" still splits correctly on its commas.
const parseSimpleList = (value) => {
  if (!value || /^none$/i.test(value.trim())) {
    return [];
  }

  return value
    .split(/\s*[,;]\s*/)
    .map((entry) => repairMojibake(entry.trim()).replace(/^or\s+/i, ''))
    .filter(Boolean);
};

const parseSkillChoices = (value) => {
  if (!value) {
    return { skillChoices: [], skillCount: 0 };
  }

  const skillCount = parseCountWord(value);
  if (/choose any/i.test(value)) {
    return { skillChoices: [...skillNames], skillCount };
  }

  const matchedSkills = skillNames.filter((skill) => new RegExp(String.raw`\b${escapeRegExp(skill)}\b`, 'i').test(value));
  return {
    skillChoices: matchedSkills,
    skillCount: skillCount || matchedSkills.length
  };
};

const sizeOrder = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const normalizeSizeToken = (token) => sizeOrder.find((size) => size.toLowerCase() === token.toLowerCase()) ?? null;

// Collect the distinct size words in a passage, using word boundaries so descriptive
// text like "somewhat larger" does not register as the Large size category.
const findSizeTokens = (value) => {
  const found = [];
  for (const match of value.matchAll(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/gi)) {
    const size = normalizeSizeToken(match[1]);
    if (size && !found.includes(size)) {
      found.push(size);
    }
  }
  return found;
};

// An explicit statement such as "Your size is Medium" (or "Your size is Medium or
// Small") is authoritative; the clause up to the end of the sentence bounds which size
// words count, so sizes mentioned in surrounding flavor text are ignored.
const getExplicitSizeClause = (value) => {
  const explicit = /\b(?:your\s+size\s+is|size\s+category\s+is)([^.]*)/i.exec(value);
  return explicit ? explicit[1] : undefined;
};

const parseSizeFromText = (value, fallback = 'Medium') => {
  if (!value) return fallback;

  const tokens = findSizeTokens(getExplicitSizeClause(value) ?? value);
  if (tokens.length === 0) {
    return fallback;
  }

  // When a species can be one of several sizes (e.g. "Small or Medium"), treat the
  // largest option as the primary size so the default matches the conventional choice.
  return tokens.sort((left, right) => sizeOrder.indexOf(right) - sizeOrder.indexOf(left))[0];
};

// Species whose Size trait offers a choice ("Small or Medium") should surface that choice
// in the builder. Returns the options ordered largest-first so the default matches the
// primary size reported by parseSizeFromText.
const parseSizeOptionsFromText = (value) => {
  if (!value || !/\bor\b/i.test(value)) {
    return undefined;
  }

  const scopedValue = getExplicitSizeClause(value) ?? value;
  if (!/\bor\b/i.test(scopedValue)) {
    return undefined;
  }

  const tokens = findSizeTokens(scopedValue);
  if (tokens.length < 2) {
    return undefined;
  }

  return tokens.sort((left, right) => sizeOrder.indexOf(right) - sizeOrder.indexOf(left));
};

const parseSpeedFromText = (value, fallback = 30) => {
  const match = value.match(/(\d+)\s*feet?/i);
  return match ? Number(match[1]) : fallback;
};

const languageNamePattern = /common(?: sign language)?|draconic|dwarvish|elvish|giant|gnomish|goblin|halfling|orc|abyssal|celestial|deep speech|druidic|infernal|primordial|sylvan|undercommon/gi;
// A Languages trait states the grant in its first sentence and then rambles about the culture,
// name-dropping other tongues ("...Orc curses, Elvish musical expressions, Dwarvish military
// phrases"). Scanning the whole trait turns that colour text into granted languages, so the scan
// is scoped to the explicit grant clause.
const languageGrantClausePattern = /(?:you (?:can|know how to) speak,?\s*read,?\s*and write|your languages? (?:are|is))\s+([^.]*)\./i;
const languageChoicePattern = /\b(one|two|three|four|\d+)\s+(?:extra|additional|other|more)?\s*languages?\s+of your choice/i;
export const languageChoicePlaceholder = 'One of your choice';

const parseLanguagesText = (value) => {
  if (!value) {
    return [];
  }

  const grantClause = languageGrantClausePattern.exec(value)?.[1] ?? value.split('.')[0] ?? value;
  const matched = grantClause.match(languageNamePattern) ?? [];
  const languages = Array.from(new Set(
    matched.map((entry) => repairMojibake(entry.trim()).replaceAll(/\b\w/g, (char) => char.toUpperCase()))
  ));

  const choiceMatch = languageChoicePattern.exec(grantClause);
  const choiceCount = choiceMatch ? parseCountWord(choiceMatch[1], 1) : 0;
  return [...languages, ...Array.from({ length: choiceCount }, () => languageChoicePlaceholder)];
};

const parseAbilityScoreIncreaseText = (value) => {
  if (!value) {
    return undefined;
  }

  const increases = [];
  const lowered = value.toLowerCase();

  if (/ability scores each increase by\s+(\d+)/i.test(value)) {
    const amount = Number(value.match(/ability scores each increase by\s+(\d+)/i)?.[1] ?? 1);
    return abilityScoreKeys.map((ability) => ({ ability, amount }));
  }

  for (const match of value.matchAll(/your\s+(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+score\s+increases?\s+by\s+(\d+)/gi)) {
    increases.push({ ability: match[1].toLowerCase(), amount: Number(match[2]) });
  }

  const chooseMatch = lowered.match(/(one|two|three|four|five|six|\d+)\s+(?:different\s+)?(?:other\s+)?ability scores? of your choice\s+increase\s+by\s+(\d+)/i);
  if (chooseMatch) {
    const amount = Number(chooseMatch[2]);
    const chooseFrom = abilityScoreKeys.filter((ability) => !increases.some((entry) => entry.ability === ability));
    increases.push({
      ability: 'choose',
      amount,
      chooseFrom,
      chooseCount: parseCountWord(chooseMatch[1], 1)
    });
  }

  if (increases.length === 0 && /one ability score of your choice increases by\s+(\d+)/i.test(value)) {
    increases.push({
      ability: 'choose',
      amount: Number(value.match(/one ability score of your choice increases by\s+(\d+)/i)?.[1] ?? 1),
      chooseFrom: [...abilityScoreKeys],
      chooseCount: 1
    });
  }

  return increases.length > 0 ? increases : undefined;
};

// Features often present an explicit inline choice as a colon-separated list, e.g.
// "You gain proficiency with the artisan's tools of your choice: smith's tools,
// brewer's supplies, or mason's tools." Surface those as structured options so the
// builder can offer an inline selector instead of plain text.
const inlineChoiceLeadPattern = /(?:\b(one|two|three|four|a|an)\s+)?(?:[\w'’-]+\s+){0,4}of your choice(?:\s+from the following(?:\s+list)?)?\s*:\s*([^.:;]+)[.;]/i;
const inlineChoiceFollowingPattern = /choose\s+(one|two|three|four|\d+)\s+of the following(?:\s+options)?\s*:\s*([^.:;]+)[.;]/i;

// Books close an inline list with a relative clause about the list as a whole ("..., the Fiend, or
// the Great Old One, each of which is detailed below"). It is commentary, never an option.
const trailingListClausePattern = /^(?:each|both|all|any|either|one|none|most)\s+of\s+(?:which|them|these)\b/i;

const splitInlineChoiceList = (listText) => {
  return listText
    .replaceAll(/\s+or\s+/gi, ', ')
    .replaceAll(/\s+and\s+/gi, ', ')
    .split(/,\s*/)
    .map((entry) => entry.trim().replace(/^(?:or|and)\s+/i, ''))
    .filter((entry) => entry && !trailingListClausePattern.test(entry));
};

const parseInlineChoiceFromDescription = (description) => {
  const text = String(description ?? '');
  const match = inlineChoiceLeadPattern.exec(text) ?? inlineChoiceFollowingPattern.exec(text);
  if (!match) {
    return undefined;
  }

  const optionNames = splitInlineChoiceList(match[2]);

  // Guard against prose colons: a real inline list has a handful of short entries.
  const looksLikeOptionList = optionNames.length >= 2
    && optionNames.length <= 12
    && optionNames.every((entry) => entry.length <= 60 && !/[.!?]/.test(entry));
  if (!looksLikeOptionList) {
    return undefined;
  }

  return {
    chooseCount: parseCountWord(match[1] ?? '', 1) || 1,
    options: optionNames.map((name) => ({
      id: slugify(name),
      name,
      description: `${name} option.`
    }))
  };
};

export const applyInlineFeatureChoiceOptions = (feature) => {
  if (!feature || typeof feature !== 'object' || feature.options?.length) {
    return feature;
  }

  // "Otherworldly Patron" and "Primal Path" name their subclasses inline, but a subclass is not an
  // inline option: the builder picks it on the Subclasses tab, where the full features live. An
  // inline selector here would be a second, competing control that records nothing the sheet reads.
  if (subclassFeaturePattern.test(feature.name ?? '')) {
    return feature;
  }

  const parsedChoice = parseInlineChoiceFromDescription(feature.description);
  if (!parsedChoice) {
    return feature;
  }

  return {
    ...feature,
    requiresChoice: feature.requiresChoice ?? true,
    chooseCount: feature.chooseCount ?? parsedChoice.chooseCount,
    options: parsedChoice.options
  };
};

const collectTableBlocks = (raw) => {
  return [...raw.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
};

const extractTableLabelValuePairs = (raw) => {
  const pairs = new Map();

  for (const match of raw.matchAll(/<tr[^>]*>\s*<t[hd][^>]*>([\s\S]*?)<\/t[hd]>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    const label = stripTags(match[1]);
    const value = stripTags(match[2]);
    if (!label || !value) {
      continue;
    }

    pairs.set(normalizeLabel(label), value);
  }

  return pairs;
};

const extractLabeledParagraphPairs = (raw) => {
  const pairs = new Map();

  for (const match of raw.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = stripTags(match[1]);
    const labeledMatch = text.match(/^([A-Z][A-Za-z' -]+):\s+(.+)$/);
    if (!labeledMatch || labeledMatch[1].length > 40) {
      continue;
    }

    pairs.set(normalizeLabel(labeledMatch[1]), labeledMatch[2]);
  }

  return pairs;
};

// Page furniture (site footers, cookie/JavaScript notices, navigation) can match the
// "Label. Value" trait shape. These never appear in real species traits, so drop them.
const traitChromeNoisePattern = /javascript|enable javascript|works best with|cookie|your browser|sign in|log in|dndbeyond|all rights reserved|privacy policy/i;

// The article body is followed by page chrome (footer link lists, nav, cookie notices). These
// markers only appear in that furniture, so extracted text is truncated at the first one so
// trailing chrome never leaks into a description.
const chromeCutoffPattern = /\s*(?:\/\/\s*)?(?:•\s*)?(?:Help Portal|This site works best with JavaScript|Toggle mobile navigation|Do Not Sell or Share My Personal Information|Download the D&D Beyond App|Sign in Create Account|Latest Changelog)[\s\S]*$/i;
const stripTrailingChrome = (text) => (typeof text === 'string'
  ? text.replace(chromeCutoffPattern, '').replace(/[\s•/]+$/u, '').trim()
  : text);

// Footer/nav sections can be captured as feature headings. Features with these names are chrome.
const chromeFeatureNamePattern = /^(?:Support|About|Company|Community|Legal|Follow Us|More|Contact Us|Careers|Marketplace|Download the D&D Beyond App)$/i;
const isChromeFeatureName = (name) => chromeFeatureNamePattern.test(name) || traitChromeNoisePattern.test(name);

// A whole paragraph or list item that is page chrome (footer link lists, nav, legal notices).
const chromeParagraphPattern = /help portal|support forum|do not sell|toggle mobile|works best with javascript|megamenu|you agree to the new terms|privacy choices|cookie notice|open search|create account|latest changelog|find players|events & conventions/i;
const isChromeParagraph = (text) => typeof text === 'string' && (traitChromeNoisePattern.test(text) || chromeParagraphPattern.test(text));

// Keep the leading items up to the first chrome paragraph, then trim any residual chrome tail.
const takeUntilChrome = (items) => {
  const chromeIndex = items.findIndex(isChromeParagraph);
  return (chromeIndex === -1 ? items : items.slice(0, chromeIndex))
    .map(stripTrailingChrome)
    .filter(Boolean);
};

const extractTraitEntries = (raw) => {
  return [...removeNonContentBlocks(raw).matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .map((text) => {
      const labeledMatch = text.match(/^([A-Z][A-Za-z' -]+)[.:]\s+(.+)$/);
      if (!labeledMatch || labeledMatch[1].length > 50) {
        return null;
      }

      const label = repairMojibake(labeledMatch[1].trim());
      const value = stripTrailingChrome(repairMojibake(labeledMatch[2].trim()));
      if (!value || traitChromeNoisePattern.test(label) || traitChromeNoisePattern.test(value)) {
        return null;
      }

      return { label, value };
    })
    .filter(Boolean);
};

const getPairValue = (maps, ...labels) => {
  for (const label of labels) {
    const key = normalizeLabel(label);
    for (const map of maps) {
      const value = map?.get?.(key);
      if (value) {
        return value;
      }
    }
  }

  return '';
};

const extractBasicRules2014ClassSummaries = (raw) => {
  const summaries = new Map();
  const summaryTableMatch = raw.match(/<h2[^>]*id="ClassesSummary"[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!summaryTableMatch) {
    return summaries;
  }

  for (const rowMatch of summaryTableMatch[1].matchAll(tableRowRegex)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) => cellMatch[1]);
    if (cells.length < 6) {
      continue;
    }

    const className = stripTags(cells[0]);
    const classId = getClassIdFromName(className);
    if (!classId) {
      continue;
    }

    summaries.set(classId, {
      description: stripTags(cells[1]),
      hitDieText: stripTags(cells[2]),
      primaryAbilityText: stripTags(cells[3]),
      savingThrowsText: stripTags(cells[4]),
      proficienciesText: stripTags(cells[5])
    });
  }

  return summaries;
};

const extractFeatureNamesFromCell = (featuresCell) => {
  const strippedFeatures = stripTags(featuresCell);
  const linkedNames = [...featuresCell.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((match) => stripTags(match[1]));
  if (linkedNames.length > 0) {
    return { strippedFeatures, names: linkedNames };
  }

  return {
    strippedFeatures,
    names: strippedFeatures
      .split(/,\s*/)
      .map((entry) => entry.replaceAll(/\s*\([^)]*\)\s*$/g, '').trim())
      .filter(Boolean)
  };
};

const addFeatureLevelsFromRow = (cells, featureLevels, currentSubclassLevel, featuresColumnIndex) => {
  const levelText = stripTags(cells[0]);
  const level = parseOrdinalLevel(levelText, Number.NaN);
  if (!Number.isFinite(level)) {
    return currentSubclassLevel;
  }

  const featuresCell = cells[featuresColumnIndex];
  if (featuresCell === undefined) {
    return currentSubclassLevel;
  }
  const { strippedFeatures, names } = extractFeatureNamesFromCell(featuresCell);
  let subclassLevel = currentSubclassLevel;

  if (subclassFeaturePattern.test(strippedFeatures)) {
    subclassLevel = Math.min(subclassLevel, level);
  }

  for (const featureName of names) {
    const normalized = normalizeFeatureName(featureName);
    if (!normalized || /feature$/i.test(featureName) || /^level\s+\d+/i.test(featureName)) {
      continue;
    }

    // A feature repeated on later rows (Metamagic at 2/10/17, Ability Score Improvement at
    // 4/8/12/16) is gained at its first row; later rows only grant additional uses.
    const existingLevel = featureLevels.get(normalized);
    featureLevels.set(normalized, existingLevel === undefined ? level : Math.min(existingLevel, level));
  }

  return subclassLevel;
};

// Class tables do not agree on where the Features column sits: the Barbarian's is third, but
// classes with their own resource columns push it further right (Rogue's Sneak Attack, Monk's
// Martial Arts/Ki/Unarmored Movement, Sorcerer's Sorcery Points). Reading a fixed index made
// those tables yield no feature levels at all, which dropped every one of their features.
const findFeaturesColumnIndex = (table) => {
  for (const rowMatch of table.matchAll(tableRowRegex)) {
    const headers = [...rowMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
      .map((cellMatch) => normalizeLabel(stripTags(cellMatch[1])));
    const featuresIndex = headers.indexOf('features');
    if (featuresIndex !== -1) {
      return featuresIndex;
    }
  }

  return 2;
};

const extractClassFeatureLevels = (raw) => {
  const featureLevels = new Map();
  let subclassLevel = 3;

  for (const table of collectTableBlocks(raw)) {
    if (!/features/i.test(stripTags(table)) || !/level/i.test(stripTags(table))) {
      continue;
    }

    const featuresColumnIndex = findFeaturesColumnIndex(table);
    for (const rowMatch of table.matchAll(tableRowRegex)) {
      const cells = [...rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellMatch) => cellMatch[1]);
      if (cells.length <= featuresColumnIndex) {
        continue;
      }

      subclassLevel = addFeatureLevelsFromRow(cells, featureLevels, subclassLevel, featuresColumnIndex);
    }
  }

  return { featureLevels, subclassLevel };
};

const extractTableRows = (table) => {
  return [...table.matchAll(tableRowRegex)].map((rowMatch) => {
    return [...rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cellMatch) => cellMatch[1]);
  });
};

const parseProgressionCellValue = (value) => {
  const normalized = stripTags(value ?? '');
  if (!normalized || /^[—-]+$/.test(normalized)) {
    return 0;
  }

  const match = normalized.match(/\d+/);
  return match ? Number(match[0]) : 0;
};

const extractSpellcastingAbilityFromText = (raw, primaryAbility) => {
  const text = stripTags(raw);
  const abilityMatch = text.match(/\b(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b is (?:the|your) spellcasting ability/i);
  if (abilityMatch) {
    return abilityMatch[1].toLowerCase();
  }

  if (Array.isArray(primaryAbility)) {
    return primaryAbility.at(-1) ?? primaryAbility[0];
  }

  return primaryAbility;
};

const splitEquipmentList = (value) => {
  const entries = [];
  let current = '';
  let depth = 0;

  for (const character of value) {
    if (character === '(') {
      depth += 1;
      current += character;
      continue;
    }

    if (character === ')') {
      depth = Math.max(0, depth - 1);
      current += character;
      continue;
    }

    if (character === ',' && depth === 0) {
      const entry = current.trim();
      if (entry) {
        entries.push(entry);
      }
      current = '';
      continue;
    }

    current += character;
  }

  const trailingEntry = current.trim();
  if (trailingEntry) {
    entries.push(trailingEntry);
  }

  return entries
    .map((entry) => entry.replace(/^and\s+/i, '').trim())
    .filter(Boolean);
};

const weaponOptionKeywords = [
  'weapon', 'weapons', 'sword', 'axe', 'bow', 'crossbow', 'dagger', 'dart', 'flail', 'glaive', 'greataxe', 'greatsword',
  'halberd', 'hammer', 'handaxe', 'javelin', 'lance', 'longbow', 'longsword', 'mace', 'maul', 'morningstar', 'pike',
  'quarterstaff', 'rapier', 'scimitar', 'shortbow', 'shortsword', 'sickle', 'sling', 'spear', 'staff', 'trident', 'war pick', 'warhammer', 'whip'
];
const armorOptionPattern = /\b(armor|shield|mail|shirt)\b/i;
const toolOptionPattern = /\b(tool|tools|instrument|kit|utensils|supplies)\b/i;
const packOptionPattern = /\bpack\b/i;

const containsKeyword = (text, keywords) => {
  const normalizedText = ` ${text.toLowerCase()} `;
  return keywords.some((keyword) => normalizedText.includes(` ${keyword} `));
};

const inferEquipmentOptionType = (value) => {
  if (/\b\d+\s*(cp|sp|ep|gp|pp)\b/i.test(value)) {
    return 'gold';
  }

  if (packOptionPattern.test(value)) {
    return 'pack';
  }

  if (armorOptionPattern.test(value)) {
    return 'armor';
  }

  if (toolOptionPattern.test(value)) {
    return 'tool';
  }

  if (containsKeyword(value, weaponOptionKeywords)) {
    return 'weapon';
  }

  return 'gear';
};

const parseEquipmentOptionText = (value) => {
  const normalized = repairMojibake(value).replaceAll(/\s+/g, ' ').replace(/^and\s+/i, '').trim();
  if (!normalized) {
    return undefined;
  }

  if (/^\d+\s*(cp|sp|ep|gp|pp)$/i.test(normalized)) {
    return {
      name: normalized.toUpperCase().replaceAll(/\b(CP|SP|EP|GP|PP)\b/g, (match) => match.toUpperCase()),
      type: 'gold'
    };
  }

  const countedMatch = normalized.match(/^(\d+)\s+(.+)$/);
  if (countedMatch && !/^(\d+)\s*(cp|sp|ep|gp|pp)$/i.test(normalized)) {
    return {
      name: countedMatch[2].trim(),
      type: inferEquipmentOptionType(countedMatch[2]),
      count: Number(countedMatch[1])
    };
  }

  return {
    name: normalized,
    type: inferEquipmentOptionType(normalized)
  };
};

const parseClassEquipmentOptionGroups = (body) => {
  const matches = [];
  const optionStartPattern = /\(([A-Z])\)\s*/g;
  const optionStarts = [...body.matchAll(optionStartPattern)];

  optionStarts.forEach((match, index) => {
    const startIndex = (match.index ?? 0) + match[0].length;
    const endIndex = optionStarts[index + 1]?.index ?? body.length;
    const optionLabel = match[1];
    const optionText = body
      .slice(startIndex, endIndex)
      .replaceAll(/;\s*or\s*$/gi, '')
      .replaceAll(/;\s*$/g, '')
      .replaceAll(/^or\s+/gi, '')
      .trim();

    matches.push([optionLabel, optionText]);
  });

  return matches;
};

const parseClassEquipmentOptions = (equipmentText) => {
  const normalized = repairMojibake(equipmentText).replaceAll(/\s+/g, ' ').trim();
  if (!/^Choose\s+.+:\s+/i.test(normalized)) {
    return [];
  }

  const body = normalized.replace(/^Choose\s+.+?:\s+/i, '');
  const optionMatches = parseClassEquipmentOptionGroups(body);
  if (optionMatches.length < 2) {
    return [];
  }

  const packageOptions = optionMatches
    .map((match) => {
      const [optionLabel, optionText] = match;
      const contents = splitEquipmentList(optionText)
        .map((entry) => parseEquipmentOptionText(entry))
        .filter(Boolean);

      if (contents.length === 0) {
        return undefined;
      }

      const goldOnly = contents.length === 1 && contents[0].type === 'gold';

      return {
        name: goldOnly ? `Option ${optionLabel} (${contents[0].name})` : `Option ${optionLabel}`,
        type: goldOnly ? 'gold' : 'gear',
        contents
      };
    })
    .filter(Boolean);

  return packageOptions.length > 1 ? [packageOptions] : [];
};

// 2014 class chapters have no "Starting Equipment" label; they list starting gear as bullets
// under an Equipment heading, one choice group per bullet ("(a) a greataxe or (b) any martial
// melee weapon"). Bullets without a marker are fixed grants, so they become single-option groups.
const equipmentChoiceMarkerPattern = /\(([a-z])\)\s*/gi;
const capitalizeFirst = (value) => (value ? value[0].toUpperCase() + value.slice(1) : value);

const parseBasicRulesEquipmentBullets = (classBlockContent) => {
  const equipmentSection = [...collectHeadingBlocks(classBlockContent, 3), ...collectHeadingBlocks(classBlockContent, 4)]
    .find((entry) => /^equipment$/i.test(entry.title));
  if (!equipmentSection) {
    return [];
  }

  return extractListItems(sliceSectionBody(classBlockContent, equipmentSection.contentStart))
    .map((item) => {
      const markers = [...item.matchAll(equipmentChoiceMarkerPattern)];
      const segments = markers.length > 1
        ? markers.map((marker, index) => item.slice(
            (marker.index ?? 0) + marker[0].length,
            markers[index + 1]?.index ?? item.length
          ))
        : [item];

      return segments
        .map((segment) => capitalizeFirst(segment.replace(/[,;]?\s*\bor\s*$/i, '').trim()))
        .map((segment) => parseEquipmentOptionText(segment))
        .filter(Boolean);
    })
    .filter((group) => group.length > 0);
};

const extractBasicRulesSpellcasting = (raw, classId, primaryAbility) => {
  const spellcastingTable = collectTableBlocks(raw)
    .map((table) => ({
      table,
      text: stripTags(table),
      rows: extractTableRows(table)
    }))
    .find(({ text, rows }) => {
      // A class progression table always pairs a level column with a Features column
      // ("Features Table", "Class Features", or the book's own "The <Class> ... Features").
      if (!/features table|class features|\bfeatures\b/i.test(text) || !/\blevel\b/i.test(text)) {
        return false;
      }

      if (!/cantrips|prepared spells|spells known|spell slots|slot level/i.test(text)) {
        return false;
      }

      return rows.some((row) => Number.isFinite(parseOrdinalLevel(stripTags(row[0] ?? ''), Number.NaN)));
    });

  if (!spellcastingTable) {
    return undefined;
  }

  const rowTexts = spellcastingTable.rows.map((row) => row.map((cell) => stripTags(cell)));
  const firstDataRowIndex = rowTexts.findIndex((row) => Number.isFinite(parseOrdinalLevel(row[0] ?? '', Number.NaN)));
  if (firstDataRowIndex <= 0) {
    return undefined;
  }

  const headers = rowTexts[firstDataRowIndex - 1].map((header) => stripTags(header));
  const normalizedHeaders = headers.map((header) => normalizeLabel(header));
  const cantripsIndex = normalizedHeaders.findIndex((header) => header.includes('cantrips'));
  const spellsKnownIndex = normalizedHeaders.findIndex((header) => header === 'spellsknown' || header === 'preparedspells' || header === 'spellsprepared');
  const spellSlotsIndex = normalizedHeaders.indexOf('spellslots');
  const slotLevelIndex = normalizedHeaders.indexOf('slotlevel');
  // Slot columns are numbered either "1".."9" (Basic Rules) or "1st".."9th" (Tasha's).
  const slotColumns = headers
    .map((header, index) => ({ header: stripTags(header), index }))
    .filter(({ header }) => /^\d+(?:st|nd|rd|th)?$/i.test(header))
    .map(({ header, index }) => ({ level: parseOrdinalLevel(header), index }));

  const cantripsKnown = [];
  const spellsKnown = [];
  const spellSlots = [];

  rowTexts.slice(firstDataRowIndex).forEach((row) => {
    const level = parseOrdinalLevel(row[0] ?? '', Number.NaN);
    if (!Number.isFinite(level)) {
      return;
    }

    if (cantripsIndex >= 0) {
      cantripsKnown.push(parseProgressionCellValue(row[cantripsIndex]));
    }
    if (spellsKnownIndex >= 0) {
      spellsKnown.push(parseProgressionCellValue(row[spellsKnownIndex]));
    }

    if (slotColumns.length > 0) {
      spellSlots.push(slotColumns.map(({ index }) => parseProgressionCellValue(row[index])));
      return;
    }

    if (spellSlotsIndex >= 0 && slotLevelIndex >= 0) {
      const slotCount = parseProgressionCellValue(row[spellSlotsIndex]);
      const slotLevel = parseProgressionCellValue(row[slotLevelIndex]);
      const slotRow = Array.from({ length: Math.max(slotLevel, 0) }, (_, index) => (index === slotLevel - 1 ? slotCount : 0));
      spellSlots.push(slotRow);
    }
  });

  if (cantripsKnown.length === 0 && spellsKnown.length === 0 && spellSlots.length === 0) {
    return undefined;
  }

  const ability = extractSpellcastingAbilityFromText(raw, primaryAbility);
  if (!ability) {
    return undefined;
  }

  const normalizedText = stripTags(raw);
  const spellcasting = {
    ability,
    cantripsKnown: cantripsKnown.some((value) => value > 0) ? cantripsKnown : undefined,
    spellsKnown: spellsKnown.some((value) => value > 0) ? spellsKnown : undefined,
    spellSlots: spellSlots.some((row) => row.some((value) => value > 0)) ? spellSlots : undefined,
    ritualCasting: /ritual/i.test(normalizedText) || undefined,
    spellPreparation: /prepare the list of|prepared spells/i.test(normalizedText) || undefined
  };

  if (!spellcasting.spellSlots && classId === 'warlock') {
    return undefined;
  }

  return spellcasting;
};

const extractClassFeaturesFromBlock = (raw, label, featureLevels) => {
  const headingBlocks = [...collectHeadingBlocks(raw, 3), ...collectHeadingBlocks(raw, 4), ...collectHeadingBlocks(raw, 5)];
  const seen = new Set();

  return headingBlocks
    .map((block) => {
      const normalizedTitle = normalizeFeatureName(block.title.replace(/^Level\s+\d+:\s*/i, ''));
      const level = featureLevels.get(normalizedTitle);
      if (!level || seen.has(normalizedTitle)) {
        return null;
      }

      // Rage lists its benefits as bullets and Pact Magic tabulates its slots, so a
      // paragraphs-only read shipped "you gain the following benefits:" with nothing after it.
      const texts = takeUntilChrome(extractStructuredTexts(block.content))
        .filter((entry) => !featureLevelBoilerplatePattern.test(entry));
      const description = stripTrailingChrome(
        [...texts, ...extractSpellListLines(block.content, texts.join(' '))].join(' ')
      );
      if (!description) {
        return null;
      }

      seen.add(normalizedTitle);
      const featureName = repairMojibake(block.title.replace(/^Level\s+\d+:\s*/i, ''));
      return {
        id: slugify(block.title),
        name: featureName,
        description,
        level,
        source: label
      };
    })
    .filter(Boolean);
};

const getSubclassSectionForClassBlock = (block, sourceId) => {
  if (sourceId === 'basic-rules-2024') {
    return collectHeadingBlocks(block.content, 3).find((entry) => / subclass$/i.test(entry.title));
  }

  return collectHeadingBlocks(block.content, 2).find((entry) => /(paths|colleges|domains|circles|archetypes|traditions|oaths|origins|patrons)$/i.test(entry.title));
};

// Subclass features state their level in prose, and 5e uses every phrasing under the sun:
// "Beginning at 6th level", "Starting at 3rd level", "At 14th level", "By 13th level",
// "When you reach 17th level", "When you choose this archetype at 3rd level". Missing one of
// these silently falls the feature back to the subclass's unlock level, so a 17th-level feature
// shows up as available at 3rd. Keep the alternatives in one place.
const subclassFeatureLevelPattern = /\b(?:when you (?:choose|select|adopt|join|reach|gain)[^.]{0,60}?\bat|when you reach|beginning at|starting at|by|at)\s+(\d+)(?:st|nd|rd|th)[\s-]level/i;

const parseFeatureLevelFromSubclassText = (title, description, fallbackLevel) => {
  const titleMatch = title.match(/^Level\s+(\d+)/i);
  if (titleMatch) {
    return Number(titleMatch[1]);
  }

  // Tasha's-style boilerplate opens each feature with e.g. "3rd-level Path of the Beast feature".
  const boilerplateMatch = description.match(/^(\d+)(?:st|nd|rd|th)-level\s[^.]*?\bfeature\b/i);
  if (boilerplateMatch) {
    return Number(boilerplateMatch[1]);
  }

  const descriptionMatch = subclassFeatureLevelPattern.exec(description);
  if (descriptionMatch) {
    return Number(descriptionMatch[1]);
  }

  return fallbackLevel;
};

// Boilerplate lines such as "3rd-level Path of the Beast feature" carry the level but are
// not descriptive text, so use them for the level and drop them from the description.
const featureLevelBoilerplatePattern = /^(\d+)(?:st|nd|rd|th)-level\s[^.]*?\bfeature\b\.?$/i;

const extractSubclassFeaturesFromBlock = (subclassBlock, label, featureHeadingLevel, fallbackLevel) => {
  return collectHeadingBlocks(subclassBlock.content, featureHeadingLevel)
    .map((featureBlock) => {
      const name = repairMojibake(featureBlock.title.replace(/^Level\s+\d+:\s*/i, ''));
      const texts = extractStructuredTexts(featureBlock.content);
      const levelSourceText = texts.join(' ');
      const description = stripTrailingChrome(texts.filter((entry) => !featureLevelBoilerplatePattern.test(entry)).join(' '));
      if (!description || isChromeFeatureName(name)) {
        return null;
      }

      return {
        id: slugify(`${subclassBlock.title}-${featureBlock.title}`),
        name,
        description,
        level: parseFeatureLevelFromSubclassText(featureBlock.title, levelSourceText, fallbackLevel),
        source: label
      };
    })
    .filter(Boolean);
};

const extractBasicRulesSubclasses = (raw, label, sourceId) => {
  if (sourceId === 'basic-rules-2014') {
    const classBlocksById = new Map(
      collectHeadingBlocks(raw, 2)
        .filter((block) => Boolean(getClassIdFromName(block.title)))
        .map((block) => [getClassIdFromName(block.title), block])
    );

    return collectHeadingBlocks(raw, 2)
      .flatMap((section) => {
        const classKey = basicRules2014SubclassSectionClassIds.get(normalizeLabel(section.title));
        if (!classKey) {
          return [];
        }

        const classBlock = classBlocksById.get(classKey);
        const fallbackLevel = classBlock ? extractClassFeatureLevels(classBlock.content).subclassLevel : 3;

        return collectHeadingBlocks(section.content, 3)
          .map((subclassBlock) => {
            const firstFeatureMatch = subclassBlock.content.search(/<h4[^>]*>/i);
            const introRaw = firstFeatureMatch >= 0 ? subclassBlock.content.slice(0, firstFeatureMatch) : subclassBlock.content;
            const description = stripTrailingChrome(extractParagraphTexts(introRaw).join(' '));
            const features = extractSubclassFeaturesFromBlock(subclassBlock, label, 4, fallbackLevel);

            if (!description && features.length === 0) {
              return null;
            }

            return {
              id: toSourceSpecificId(sourceId, `${classKey}-${subclassBlock.title}`),
              classId: toSourceSpecificId(sourceId, classKey),
              name: repairMojibake(subclassBlock.title),
              description,
              features,
              source: label,
              sourceId
            };
          })
          .filter(Boolean);
          });
  }

  const classBlocks = collectHeadingBlocks(raw, 2).filter((block) => Boolean(getClassIdFromName(block.title)));

  return classBlocks.flatMap((block) => {
    const classKey = getClassIdFromName(block.title);
    if (!classKey) {
      return [];
    }

    const fallbackLevel = extractClassFeatureLevels(block.content).subclassLevel;
    const subclassSection = getSubclassSectionForClassBlock(block, sourceId);
    if (!subclassSection) {
      return [];
    }

    const subclassHeadingLevel = sourceId === 'basic-rules-2024' ? 4 : 3;
    const featureHeadingLevel = sourceId === 'basic-rules-2024' ? 5 : 4;
    const subclassBlocks = collectHeadingBlocks(subclassSection.content, subclassHeadingLevel)
      .filter((entry) => !/^Level\s+\d+/i.test(entry.title));

    return subclassBlocks
      .map((subclassBlock) => {
        const firstFeatureMatch = subclassBlock.content.search(new RegExp(String.raw`<h${featureHeadingLevel}[^>]*>`, 'i'));
        const introRaw = firstFeatureMatch >= 0 ? subclassBlock.content.slice(0, firstFeatureMatch) : subclassBlock.content;
        const description = stripTrailingChrome(extractParagraphTexts(introRaw).join(' '));
        const features = extractSubclassFeaturesFromBlock(subclassBlock, label, featureHeadingLevel, fallbackLevel);

        if (!description && features.length === 0) {
          return null;
        }

        return {
          id: toSourceSpecificId(sourceId, `${classKey}-${subclassBlock.title}`),
          classId: toSourceSpecificId(sourceId, classKey),
          name: repairMojibake(subclassBlock.title),
          description,
          features,
          source: label,
          sourceId
        };
      })
      .filter(Boolean);
  });
};

const extractDivBlocksByClass = (raw, className) => {
  const startRegex = new RegExp(String.raw`<div[^>]*class="[^"]*\b${escapeRegExp(className)}\b[^"]*"[^>]*>`, 'gi');
  const blocks = [];
  let startMatch;

  while ((startMatch = startRegex.exec(raw)) !== null) {
    let depth = 1;
    const divRegex = /<\/?div\b[^>]*>/gi;
    divRegex.lastIndex = startRegex.lastIndex;
    let divMatch;

    while (depth > 0 && (divMatch = divRegex.exec(raw)) !== null) {
      if (divMatch[0].startsWith('</div')) {
        depth -= 1;
      } else {
        depth += 1;
      }
    }

    if (depth !== 0 || !divMatch) {
      break;
    }

    const endIndex = divRegex.lastIndex;
    blocks.push(raw.slice(startMatch.index, endIndex));
    startRegex.lastIndex = endIndex;
  }

  return blocks;
};

const parseSignedNumber = (value) => {
  const normalized = repairMojibake(value ?? '').replaceAll('−', '-');
  const match = normalized.match(/[+-]?\d+/);
  return match ? Number(match[0]) : undefined;
};

const splitMonsterValueList = (value, separator = /[,;]\s*/) => {
  return value
    .split(separator)
    .map((entry) => repairMojibake(entry.trim()))
    .filter(Boolean);
};

// Language lines mix plain lists ("Common, Draconic") with semantic phrases that must not
// be split on commas ("understands Common, Elvish, and Sylvan but can't speak") and
// telepathy notes. Splitting phrases apart produced fragments like "and Undercommon but
// can't speak", so keep each phrase whole and only comma-split plain lists.
export const parseMonsterLanguages = (value) => {
  const normalized = repairMojibake(String(value ?? '').trim()).replace(/^Languages?\s+/i, '').trim();
  if (!normalized || /^(?:none|[—–-]+)$/i.test(normalized)) {
    return undefined;
  }

  const languages = [];
  for (const segment of normalized.split(/;\s*/)) {
    let rest = segment.trim();
    if (!rest) {
      continue;
    }

    // Telepathy is an independent note; lift it out before phrase/list handling.
    const telepathyMatch = /(?:^|,\s*)(telepathy\s[^,]*)$/i.exec(rest);
    let telepathyNote;
    if (telepathyMatch) {
      telepathyNote = telepathyMatch[1].trim();
      rest = rest.slice(0, telepathyMatch.index).trim().replace(/[,;]\s*$/, '');
    }

    if (rest) {
      const isPhrase = /\bunderstands?\b/i.test(rest) || /\b(?:can't|can’t|cannot)\s+speak\b/i.test(rest);
      if (isPhrase) {
        languages.push(rest);
      } else {
        languages.push(...rest
          .split(/,\s*/)
          .map((entry) => entry.replace(/^and\s+/i, '').trim())
          .filter((entry) => entry && !/^(?:none|[—–-]+)$/i.test(entry)));
      }
    }

    if (telepathyNote) {
      languages.push(telepathyNote);
    }
  }

  return languages.length > 0 ? languages : undefined;
};

const parseMonsterIdentity = (value) => {
  const [identityPart = '', alignmentPart = ''] = value.split(/,\s*/, 2);
  const sizeMatch = identityPart.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\b/i);
  if (!sizeMatch) {
    return null;
  }

  const size = sizeMatch[1].charAt(0).toUpperCase() + sizeMatch[1].slice(1).toLowerCase();
  const type = repairMojibake(identityPart.replace(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)(?:\s+or\s+(?:Tiny|Small|Medium|Large|Huge|Gargantuan))?\s+/i, '').trim());
  const alignment = repairMojibake(alignmentPart.trim());

  if (!type || !alignment) {
    return null;
  }

  return { size, type, alignment };
};

const parseMonsterAbilityScoreTable = (raw) => {
  const abilityScores = {};
  const savingThrows = [];

  for (const rowMatch of raw.matchAll(/<tr>\s*<th>(Str|Dex|Con|Int|Wis|Cha)<\/th>\s*<td>(\d+)<\/td>\s*<td>([^<]+)<\/td>\s*<td>([^<]+)<\/td>\s*<\/tr>/gi)) {
    const abilityKey = monsterAbilityMap.get(rowMatch[1].toLowerCase());
    if (!abilityKey) {
      continue;
    }

    abilityScores[abilityKey] = Number(rowMatch[2]);
    const modifier = parseSignedNumber(rowMatch[3]);
    const save = parseSignedNumber(rowMatch[4]);
    if (Number.isFinite(modifier) && Number.isFinite(save) && save !== modifier) {
      savingThrows.push(`${abilityKey.charAt(0).toUpperCase() + abilityKey.slice(1)} ${save >= 0 ? '+' : ''}${save}`);
    }
  }

  return {
    abilityScores,
    savingThrows
  };
};

const parseMonsterAbilityScoreDivs = (raw) => {
  const abilityScores = {};

  for (const block of extractDivBlocksByClass(raw, 'stat-block-ability-scores-stat')) {
    const abilityLabel = stripTags(block.match(/stat-block-ability-scores-heading[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const abilityKey = monsterAbilityMap.get(abilityLabel.toLowerCase());
    const score = Number(block.match(/stat-block-ability-scores-score[^>]*>(\d+)<\/span>/i)?.[1] ?? Number.NaN);
    if (!abilityKey || !Number.isFinite(score)) {
      continue;
    }

    abilityScores[abilityKey] = score;
  }

  return abilityScores;
};

const parseMonsterAbilityScores = (raw) => {
  const parsedTable = parseMonsterAbilityScoreTable(raw);
  const abilityScores = Object.keys(parsedTable.abilityScores).length > 0
    ? parsedTable.abilityScores
    : parseMonsterAbilityScoreDivs(raw);

  return {
    abilityScores,
    savingThrows: parsedTable.savingThrows.length > 0 ? parsedTable.savingThrows : undefined
  };
};

const splitMonsterImmunities = (value) => {
  const damageImmunities = [];
  const conditionImmunities = [];

  for (const entry of splitMonsterValueList(value)) {
    if (monsterConditionNames.has(normalizeLabel(entry))) {
      conditionImmunities.push(entry);
    } else {
      damageImmunities.push(entry);
    }
  }

  return {
    damageImmunities: damageImmunities.length > 0 ? damageImmunities : undefined,
    conditionImmunities: conditionImmunities.length > 0 ? conditionImmunities : undefined
  };
};

const parseMonsterEntryParagraph = (raw) => {
  const nameMatch = raw.match(/<strong>\s*([\s\S]*?)\s*<\/strong>/i);
  if (!nameMatch) {
    return null;
  }

  const name = repairMojibake(stripTags(nameMatch[1]).replace(/\.$/, '').trim());
  const description = repairMojibake(stripTags(raw.replace(nameMatch[0], ' ')).replace(/^[.:]\s*/, '').trim());
  if (!name) {
    return null;
  }

  return {
    name,
    description,
    attackBonus: parseSignedNumber(description.match(/(?:Attack Roll|Weapon Attack):\s*([+\-−]?\d+)/i)?.[1] ?? ''),
    damage: description.match(/(?:Hit|Failure|Success):\s*\d+\s*\(([^)]+)\)/i)?.[1]?.replaceAll(/\s+/g, '')
  };
};

const pushMonsterSectionEntry = (entries, paragraph, monsterId, sectionId) => {
  const parsedEntry = parseMonsterEntryParagraph(paragraph.raw);
  if (parsedEntry) {
    entries.push({
      id: `${monsterId}-${sectionId}-${entries.length + 1}`,
      name: parsedEntry.name,
      description: parsedEntry.description,
      attackBonus: parsedEntry.attackBonus,
      damage: parsedEntry.damage
    });
    return;
  }

  if (entries.length === 0) {
    return;
  }

  entries[entries.length - 1].description = `${entries[entries.length - 1].description} ${paragraph.text}`.trim();
};

const extractMonsterSections = (paragraphs, monsterId) => {
  const sections = {
    traits: [],
    actions: [],
    bonusActions: [],
    reactions: [],
    legendaryActions: []
  };
  const sectionLabelMap = {
    traits: 'traits',
    actions: 'actions',
    bonusactions: 'bonusActions',
    reactions: 'reactions',
    legendaryactions: 'legendaryActions'
  };
  const metadataLinePattern = /^(Armor Class|AC|Hit Points|HP|Speed|Saving Throws|Skills|Damage Vulnerabilities|Vulnerabilities|Damage Resistances|Resistances|Damage Immunities|Condition Immunities|Immunities|Senses|Languages|Challenge|CR)\b/i;
  let currentSection;

  for (const paragraph of paragraphs) {
    if (/monster-header|Stat-Block-Heading/i.test(paragraph.attrs)) {
      currentSection = sectionLabelMap[normalizeLabel(paragraph.text)];
      continue;
    }

    if (/Stat-Block-(?:Title|Metadata)/i.test(paragraph.attrs) || metadataLinePattern.test(paragraph.text)) {
      continue;
    }

    if (!currentSection && /Stat-Block-(?:Data|Body)/i.test(paragraph.attrs) && parseMonsterEntryParagraph(paragraph.raw)) {
      currentSection = 'traits';
    }

    if (/legendary-actions/i.test(paragraph.attrs) || !currentSection) {
      continue;
    }

    pushMonsterSectionEntry(sections[currentSection], paragraph, monsterId, currentSection.replaceAll(/[A-Z]/g, (char) => `-${char.toLowerCase()}`));
  }

  return sections;
};

const extractBasicRules2024Monsters = (raw, label, sourceId) => {
  return extractDivBlocksByClass(raw, 'stat-block')
    .map((block) => {
      if (!/<strong>AC<\/strong>/i.test(block) || !/<strong>HP<\/strong>/i.test(block)) {
        return null;
      }

      const headingMatch = block.match(/<h[34][^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h[34]>/i);
      if (!headingMatch) {
        return null;
      }

      const monsterName = repairMojibake(stripTags(headingMatch[2]));
      const monsterId = toSourceSpecificId(sourceId, headingMatch[1]);
      const paragraphs = extractParagraphEntries(block);
      const identity = parseMonsterIdentity(paragraphs[0]?.text ?? '');
      const acLine = paragraphs.find((entry) => /^AC\s+/i.test(entry.text))?.text ?? '';
      const hpLine = paragraphs.find((entry) => /^HP\s+/i.test(entry.text))?.text ?? '';
      const speedLine = paragraphs.find((entry) => /^Speed\s+/i.test(entry.text))?.text ?? '';
      const skillsLine = paragraphs.find((entry) => /^Skills\s+/i.test(entry.text))?.text ?? '';
      const vulnerabilitiesLine = paragraphs.find((entry) => /^Vulnerabilities\s+/i.test(entry.text))?.text ?? '';
      const resistancesLine = paragraphs.find((entry) => /^Resistances\s+/i.test(entry.text))?.text ?? '';
      const immunitiesLine = paragraphs.find((entry) => /^Immunities\s+/i.test(entry.text))?.text ?? '';
      const sensesLine = paragraphs.find((entry) => /^Senses\s+/i.test(entry.text))?.text ?? '';
      const languagesLine = paragraphs.find((entry) => /^Languages\s+/i.test(entry.text))?.text ?? '';
      const challengeLine = paragraphs.find((entry) => /^CR\s+/i.test(entry.text))?.text ?? '';
      const ac = Number(acLine.match(/^AC\s+(\d+)/i)?.[1] ?? Number.NaN);
      const hpAverage = Number(hpLine.match(/^HP\s+(\d+)/i)?.[1] ?? Number.NaN);
      const hpFormula = hpLine.match(/\(([^)]+)\)/)?.[1] ?? '';
      const speed = speedLine.replace(/^Speed\s+/i, '').trim();
      const { abilityScores, savingThrows } = parseMonsterAbilityScores(block);
      const { damageImmunities, conditionImmunities } = splitMonsterImmunities(immunitiesLine.replace(/^Immunities\s+/i, ''));
      const sections = extractMonsterSections(paragraphs, monsterId);
      const challengeRating = challengeLine.match(/^CR\s+([^\s(]+)/i)?.[1] ?? '';
      const proficiencyBonus = Number(challengeLine.match(/PB\s*\+?(\d+)/i)?.[1] ?? Number.NaN);

      if (!identity || !monsterName || !Number.isFinite(ac) || !Number.isFinite(hpAverage) || !hpFormula || !speed) {
        return null;
      }

      return {
        id: monsterId,
        name: monsterName,
        description: `${monsterName} from the ${label}.`,
        size: identity.size,
        type: identity.type,
        alignment: identity.alignment,
        ac,
        hp: {
          average: hpAverage,
          formula: hpFormula
        },
        speed,
        abilityScores,
        savingThrows,
        skills: skillsLine ? splitMonsterValueList(skillsLine.replace(/^Skills\s+/i, '')) : undefined,
        damageVulnerabilities: vulnerabilitiesLine ? splitMonsterValueList(vulnerabilitiesLine.replace(/^Vulnerabilities\s+/i, '')) : undefined,
        damageResistances: resistancesLine ? splitMonsterValueList(resistancesLine.replace(/^Resistances\s+/i, '')) : undefined,
        damageImmunities,
        conditionImmunities,
        senses: sensesLine ? splitMonsterValueList(sensesLine.replace(/^Senses\s+/i, ''), /;\s*/) : undefined,
        languages: parseMonsterLanguages(languagesLine),
        challengeRating,
        proficiencyBonus: Number.isFinite(proficiencyBonus) ? proficiencyBonus : undefined,
        traits: sections.traits,
        actions: sections.actions,
        bonusActions: sections.bonusActions.length > 0 ? sections.bonusActions : undefined,
        reactions: sections.reactions.length > 0 ? sections.reactions : undefined,
        legendaryActions: sections.legendaryActions.length > 0 ? sections.legendaryActions : undefined,
        source: label,
        sourceId
      };
    })
    .filter((entry) => entry?.actions?.length > 0);
};

const splitModernStatBlockBlocks = (raw) => {
  const wrapperBlocks = extractDivBlocksByClass(raw, 'stat-block-finder');
  const candidates = wrapperBlocks.length > 0 ? wrapperBlocks : [raw];
  const titleRegex = /<p[^>]*class="[^"]*Stat-Block-Title[^"]*"[^>]*>[\s\S]*?<\/p>/gi;

  return candidates.flatMap((candidate) => {
    const titleMatches = Array.from(candidate.matchAll(titleRegex));
    if (titleMatches.length <= 1) {
      return /Stat-Block-Title/i.test(candidate) ? [candidate] : [];
    }

    return titleMatches.map((match, index) => {
      const start = match.index ?? 0;
      const end = titleMatches[index + 1]?.index ?? candidate.length;
      return candidate.slice(start, end);
    });
  });
};

const extractModernStatBlockMonsters = (raw, label, sourceId) => {
  return splitModernStatBlockBlocks(raw)
    .map((block, index) => {
      const paragraphs = extractParagraphEntries(block);
      const titleParagraph = paragraphs.find((entry) => /Stat-Block-Title/i.test(entry.attrs));
      const identityParagraph = paragraphs.find((entry) => /Stat-Block-Metadata/i.test(entry.attrs));
      const dataParagraphs = paragraphs.filter((entry) => /Stat-Block-Data(?:-Last)?/i.test(entry.attrs));
      const findDataLine = (pattern) => dataParagraphs.find((entry) => pattern.test(entry.text))?.text ?? '';
      const monsterName = repairMojibake(titleParagraph?.text ?? '');
      const monsterId = toSourceSpecificId(sourceId, monsterName || `monster-${index + 1}`);
      const identity = parseMonsterIdentity(identityParagraph?.text ?? '');
      const acLine = findDataLine(/^Armor Class\b/i);
      const hpLine = findDataLine(/^Hit Points\b/i);
      const speedLine = findDataLine(/^Speed\b/i);
      const savingThrowsLine = findDataLine(/^Saving Throws\b/i);
      const skillsLine = findDataLine(/^Skills\b/i);
      const vulnerabilitiesLine = findDataLine(/^Damage Vulnerabilities\b/i);
      const resistancesLine = findDataLine(/^Damage Resistances\b/i);
      const damageImmunitiesLine = findDataLine(/^Damage Immunities\b/i);
      const conditionImmunitiesLine = findDataLine(/^Condition Immunities\b/i);
      const genericImmunitiesLine = findDataLine(/^Immunities\b/i);
      const sensesLine = findDataLine(/^Senses\b/i);
      const languagesLine = findDataLine(/^Languages\b/i);
      const challengeLine = findDataLine(/^Challenge\b/i);
      const ac = Number(acLine.match(/^Armor Class\s+(\d+)/i)?.[1] ?? Number.NaN);
      const hpAverage = Number(hpLine.match(/^Hit Points\s+(\d+)/i)?.[1] ?? Number.NaN);
      const hpFormula = hpLine.match(/\(([^)]+)\)/)?.[1] ?? '';
      const speed = speedLine.replace(/^Speed\s+/i, '').trim();
      const { abilityScores, savingThrows } = parseMonsterAbilityScores(block);
      const genericImmunities = genericImmunitiesLine
        ? splitMonsterImmunities(genericImmunitiesLine.replace(/^Immunities\s+/i, ''))
        : { damageImmunities: undefined, conditionImmunities: undefined };
      const sections = extractMonsterSections(paragraphs, monsterId);
      const challengeRating = challengeLine.match(/^Challenge\s+([^\s(]+)/i)?.[1] ?? '';
      const proficiencyBonus = Number(challengeLine.match(/Proficiency Bonus\s*\+?(\d+)/i)?.[1] ?? Number.NaN);

      if (!identity || !monsterName || !Number.isFinite(ac) || !Number.isFinite(hpAverage) || !hpFormula || !speed) {
        return null;
      }

      return {
        id: monsterId,
        name: monsterName,
        description: `${monsterName} from the ${label}.`,
        size: identity.size,
        type: identity.type,
        alignment: identity.alignment,
        ac,
        hp: {
          average: hpAverage,
          formula: hpFormula
        },
        speed,
        abilityScores,
        savingThrows: savingThrowsLine
          ? splitMonsterValueList(savingThrowsLine.replace(/^Saving Throws\s+/i, ''))
          : savingThrows,
        skills: skillsLine ? splitMonsterValueList(skillsLine.replace(/^Skills\s+/i, '')) : undefined,
        damageVulnerabilities: vulnerabilitiesLine ? splitMonsterValueList(vulnerabilitiesLine.replace(/^Damage Vulnerabilities\s+/i, '')) : undefined,
        damageResistances: resistancesLine ? splitMonsterValueList(resistancesLine.replace(/^Damage Resistances\s+/i, '')) : undefined,
        damageImmunities: damageImmunitiesLine
          ? splitMonsterValueList(damageImmunitiesLine.replace(/^Damage Immunities\s+/i, ''))
          : genericImmunities.damageImmunities,
        conditionImmunities: conditionImmunitiesLine
          ? splitMonsterValueList(conditionImmunitiesLine.replace(/^Condition Immunities\s+/i, ''))
          : genericImmunities.conditionImmunities,
        senses: sensesLine ? splitMonsterValueList(sensesLine.replace(/^Senses\s+/i, ''), /;\s*/) : undefined,
        languages: parseMonsterLanguages(languagesLine),
        challengeRating,
        proficiencyBonus: Number.isFinite(proficiencyBonus) ? proficiencyBonus : undefined,
        traits: sections.traits,
        actions: sections.actions,
        bonusActions: sections.bonusActions.length > 0 ? sections.bonusActions : undefined,
        reactions: sections.reactions.length > 0 ? sections.reactions : undefined,
        legendaryActions: sections.legendaryActions.length > 0 ? sections.legendaryActions : undefined,
        source: label,
        sourceId
      };
    })
    .filter((entry) => entry?.actions?.length > 0);
};

// The 2014 dump splits every class chapter across sibling <h2> sections — the class name
// ("Barbarian"), then "Class Features", then the subclass section ("Primal Paths") — so a block
// sliced at the next <h2> stops before the proficiencies, equipment, and feature bodies. Extend
// each class block to the next class heading (or the next chapter <h1>) so the whole chapter
// travels with its class.
const collectBasicRules2014ClassBlocks = (raw) => {
  const chapterStarts = collectHeadingBlocks(raw, 1).map((entry) => entry.start);
  const classBlocks = collectHeadingBlocks(raw, 2).filter((block) => Boolean(getClassIdFromName(block.title)));

  return classBlocks.map((block, index) => {
    const nextClassStart = classBlocks[index + 1]?.start ?? raw.length;
    const nextChapterStart = chapterStarts.find((start) => start > block.start) ?? raw.length;
    return { ...block, content: raw.slice(block.contentStart, Math.min(nextClassStart, nextChapterStart)) };
  });
};

const extractBasicRulesClasses = (raw, label, sourceId) => {
  const classBlocks = sourceId === 'basic-rules-2014'
    ? collectBasicRules2014ClassBlocks(raw)
    : collectHeadingBlocks(raw, 2).filter((block) => Boolean(getClassIdFromName(block.title)));
  const classSummaries = sourceId === 'basic-rules-2014' ? extractBasicRules2014ClassSummaries(raw) : new Map();

  return classBlocks
    .map((block) => {
      const classId = getClassIdFromName(block.title);
      if (!classId) {
        return null;
      }

      const summary = classSummaries.get(classId) ?? {};
      const tablePairs = extractTableLabelValuePairs(block.content);
      const paragraphPairs = extractLabeledParagraphPairs(block.content);
      const introDescription = extractParagraphTexts(block.content.split(/<h[3-6][^>]*>/i)[0]).join(' ') || summary.description;
      // The subclass section's heading ("Sorcerer Subclass") collides with the class-table
      // feature of the same name, and its section block would win the name dedupe and swallow
      // the whole subclass body as the feature description. Subclasses are extracted
      // separately, so cut the section out before collecting class features.
      const subclassSection = getSubclassSectionForClassBlock(block, sourceId);
      const classFeatureContent = subclassSection
        ? block.content.slice(0, subclassSection.start) + block.content.slice(subclassSection.contentStart + subclassSection.content.length)
        : block.content;
      const { featureLevels, subclassLevel } = extractClassFeatureLevels(block.content);
      const hitDieText = getPairValue([tablePairs, paragraphPairs], 'Hit Point Die', 'Hit Dice') || (summary.hitDieText ?? '');
      const primaryAbilityText = getPairValue([tablePairs, paragraphPairs], 'Primary Ability') || (summary.primaryAbilityText ?? '');
      const savingThrowsText = getPairValue([tablePairs, paragraphPairs], 'Saving Throw Proficiencies', 'Saving Throws') || (summary.savingThrowsText ?? '');
      const hitDie = parseHitDieFromText(hitDieText);
      const primaryAbility = parsePrimaryAbility(primaryAbilityText);
      const savingThrows = parseSavingThrows(savingThrowsText);
      const armorProficiencies = parseSimpleList(getPairValue([tablePairs, paragraphPairs], 'Armor Training', 'Armor'));
      const weaponProficiencies = parseSimpleList(getPairValue([tablePairs, paragraphPairs], 'Weapon Proficiencies', 'Weapons'));
      const toolProficiencies = parseSimpleList(getPairValue([tablePairs, paragraphPairs], 'Tool Proficiencies', 'Tools'));
      const { skillChoices, skillCount } = parseSkillChoices(getPairValue([tablePairs, paragraphPairs], 'Skill Proficiencies', 'Skills'));
      const equipmentText = getPairValue([tablePairs, paragraphPairs], 'Starting Equipment');
      const labelledEquipmentOptions = parseClassEquipmentOptions(equipmentText);
      const equipmentOptions = labelledEquipmentOptions.length > 0
        ? labelledEquipmentOptions
        : parseBasicRulesEquipmentBullets(classFeatureContent);
      const startingGold = (() => {
        const goldMatches = [...equipmentText.matchAll(/(\d+)\s*GP/gi)];
        return goldMatches.length > 0 ? Number(goldMatches.at(-1)[1]) : undefined;
      })();

      if (!hitDie || !primaryAbility || savingThrows.length === 0) {
        return null;
      }

      return {
        id: toSourceSpecificId(sourceId, classId),
        name: repairMojibake(block.title),
        description: introDescription,
        hitDie,
        primaryAbility,
        savingThrows,
        armorProficiencies,
        weaponProficiencies,
        toolProficiencies: toolProficiencies.length > 0 ? toolProficiencies : undefined,
        skillChoices,
        skillCount,
        features: extractClassFeaturesFromBlock(classFeatureContent, label, featureLevels),
        subclasses: [],
        subclassLevel,
        spellcasting: extractBasicRulesSpellcasting(block.content, classId, primaryAbility),
        equipmentOptions,
        startingGold,
        source: label,
        sourceId
      };
    })
    .filter(Boolean);
};

const speciesMetadataLabels = new Set(['Ability Score Increase', 'Age', 'Size', 'Speed', 'Languages', 'Creature Type', 'Subrace']);

const buildSpeciesTraitFeatures = (traitEntries, ownerTitle, label) => {
  return traitEntries
    .filter((entry) => !speciesMetadataLabels.has(entry.label))
    .map((entry) => ({
      id: slugify(`${ownerTitle}-${entry.label}`),
      name: entry.label,
      description: entry.value,
      level: 1,
      source: label
    }));
};

// A species chapter ends with its subrace/lineage subsections (Hill Dwarf, High Elf, ...), which
// are siblings of the traits heading rather than nested under it.
const extractSpeciesSubraceVariants = (block, traitHeading, headingLevel, label) => {
  if (!traitHeading) {
    return [];
  }

  return collectHeadingBlocks(block.content, headingLevel)
    .filter((entry) => entry.start > traitHeading.start && !/ traits$/i.test(entry.title) && !isChromeFeatureName(entry.title))
    .map((entry) => {
      const traitEntries = extractTraitEntries(entry.content);
      const description = stripTrailingChrome(extractParagraphTexts(sliceSectionBody(entry.content)).join(' '));
      if (traitEntries.length === 0) {
        return null;
      }

      return {
        id: slugify(entry.title),
        name: repairMojibake(entry.title),
        description,
        abilityScoreIncreases: parseAbilityScoreIncreaseText(
          traitEntries.find((trait) => trait.label === 'Ability Score Increase')?.value
        ) ?? [],
        features: buildSpeciesTraitFeatures(traitEntries, entry.title, label)
      };
    })
    .filter(Boolean);
};

// Optional variants ship as a sidebar rather than a subsection, e.g. the "VARIANT HUMAN TRAITS"
// box that replaces the base Ability Score Increase with two choices, a skill, and a feat.
const variantTraitsSidebarPattern = /<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi;
const variantTraitsHeadingPattern = /^VARIANT\s+(.+?)\s+TRAITS$/i;

const extractSpeciesVariantSidebars = (block, label) => {
  return [...block.content.matchAll(variantTraitsSidebarPattern)]
    .map((match) => {
      const paragraphs = extractParagraphTexts(match[1] ?? '');
      const headingMatch = variantTraitsHeadingPattern.exec(paragraphs[0] ?? '');
      if (!headingMatch) {
        return null;
      }

      const traitEntries = extractTraitEntries(match[1] ?? '');
      const traitLabels = new Set(traitEntries.map((entry) => entry.label));
      const name = `Variant ${headingMatch[1].toLowerCase().replaceAll(/\b\w/g, (char) => char.toUpperCase())}`;
      const description = paragraphs.slice(1).find((text) => !traitLabels.has(text.split(/[.:]/)[0])) ?? '';

      return {
        id: slugify(name),
        name,
        description: stripTrailingChrome(description),
        abilityScoreIncreases: parseAbilityScoreIncreaseText(
          traitEntries.find((trait) => trait.label === 'Ability Score Increase')?.value
        ) ?? [],
        features: buildSpeciesTraitFeatures(traitEntries, name, label)
      };
    })
    .filter(Boolean);
};

const extractBasicRulesSpecies = (raw, label, sourceId) => {
  const speciesNames = basicRulesSpeciesNamesBySource.get(sourceId) ?? [];
  const headingLevel = sourceId === 'basic-rules-2024' ? 3 : 2;
  const speciesBlocks = collectHeadingBlocks(raw, headingLevel).filter((block) => speciesNames.some((name) => name.toLowerCase() === block.title.toLowerCase()));

  return speciesBlocks
    .map((block) => {
      const traitsHeadingLevel = sourceId === 'basic-rules-2024' ? 4 : 3;
      const traitHeading = collectHeadingBlocks(block.content, traitsHeadingLevel).find((entry) => / traits$/i.test(entry.title));
      // A species chapter is mostly lore subsections (ethnicities, names, sidebars) between the
      // opening paragraphs and the traits block. Slicing at the traits heading swept all of that
      // into the description — for Human that was the whole chapter — so keep only the lead
      // paragraphs that precede the first subsection.
      const description = stripTrailingChrome(extractParagraphTexts(sliceSectionBody(block.content)).join(' '));
      const traitsRaw = traitHeading?.content ?? block.content;
      const traitEntries = extractTraitEntries(traitsRaw);
      const getTraitValue = (...labels) => traitEntries.find((entry) => labels.includes(entry.label))?.value ?? '';
      const sizeText = getTraitValue('Size');
      const speedText = getTraitValue('Speed');
      const languagesText = getTraitValue('Languages');
      const abilityScoreText = getTraitValue('Ability Score Increase');
      const features = buildSpeciesTraitFeatures(traitEntries, block.title, label);
      const variants = [
        ...extractSpeciesSubraceVariants(block, traitHeading, traitsHeadingLevel, label),
        ...extractSpeciesVariantSidebars(block, label)
      ];

      if (!description || !sizeText || !speedText) {
        return null;
      }

      return {
        id: toSourceSpecificId(sourceId, block.title),
        name: repairMojibake(block.title),
        description,
        size: parseSizeFromText(sizeText),
        sizeOptions: parseSizeOptionsFromText(sizeText),
        speed: parseSpeedFromText(speedText),
        abilityScoreIncreases: parseAbilityScoreIncreaseText(abilityScoreText) ?? [],
        features,
        languages: parseLanguagesText(languagesText),
        variants,
        source: label,
        sourceId
      };
    })
    .filter(Boolean);
};

const extractCompendiumSpells = (raw, label, sourceId, classNamesBySpellKey = undefined) => {
  const spellDescriptionMatch = raw.match(/<h[1-3][^>]*id="SpellDescriptions"[\s\S]*?>/i);
  if (!spellDescriptionMatch) {
    return [];
  }

  const spellSectionStart = spellDescriptionMatch.index ?? 0;
  const spellSectionRest = raw.slice(spellSectionStart);
  const nextMajorHeadingMatch = spellSectionRest.slice(spellDescriptionMatch[0].length).match(/<h1[^>]*id="(?!SpellDescriptions)[^"]+"/i);
  const spellRaw = nextMajorHeadingMatch
    ? spellSectionRest.slice(0, spellDescriptionMatch[0].length + nextMajorHeadingMatch.index)
    : spellSectionRest;
  const spellClassMap = extractSpellClassMap(raw);

  return collectHeadingBlocks(spellRaw, 3)
    .filter((block) => !/^Spells\s*\(/i.test(block.title))
    .map((block) => {
      const paragraphs = extractParagraphTexts(block.content);
      const metadata = paragraphs[0] ?? '';
      const parsedMetadata = parseSpellMetadata(metadata);
      if (!parsedMetadata) {
        return null;
      }

      const castingTime = extractLabeledParagraph(block.content, 'Casting Time');
      const range = extractLabeledParagraph(block.content, 'Range');
      const components = extractLabeledParagraph(block.content, 'Components');
      const duration = extractLabeledParagraph(block.content, 'Duration');
      const descriptionParagraphs = paragraphs.filter((entry) => {
        if (entry === metadata) return false;
        const labelKey = normalizeMetadataLabelKey(entry.split(':')[0] ?? entry);
        return !['castingtime', 'range', 'components', 'duration'].includes(labelKey);
      });
      const higherLevels = descriptionParagraphs.find((entry) => /^(At Higher Levels\.|Using a Higher-Level Spell Slot\.)/i.test(entry));

      return {
        // Both editions publish the same spell names, so ids must be source-specific or
        // one edition's entry silently shadows the other in the merged registry.
        id: toSourceSpecificId(sourceId, block.title),
        name: repairMojibake(block.title),
        level: parsedMetadata.level,
        school: parsedMetadata.school.charAt(0).toUpperCase() + parsedMetadata.school.slice(1),
        castingTime,
        range,
        components: components ? components.split(',').map((entry) => repairMojibake(entry.trim())).filter(Boolean) : [],
        duration,
        description: stripTrailingChrome(descriptionParagraphs.filter((entry) => entry !== higherLevels).join(' ')),
        higherLevels: stripTrailingChrome(higherLevels),
        ritual: parsedMetadata.ritual,
        concentration: /concentration/i.test(duration),
        classes: parsedMetadata.classes?.length > 0
          ? parsedMetadata.classes
          : (classNamesBySpellKey?.get(normalizeLabel(block.title)) ?? Array.from(spellClassMap.get(block.id) ?? [])),
        source: label,
        sourceId
      };
    })
    .filter((entry) => entry?.description && entry.castingTime && entry.range && entry.duration);
};

const extractBasicRulesContent = (raw, label, sourceId) => {
  const content = createEmptyImportedContentBucket();
  content.classes = extractBasicRulesClasses(raw, label, sourceId);
  content.subclasses = extractBasicRulesSubclasses(raw, label, sourceId);
  content.species = extractBasicRulesSpecies(raw, label, sourceId);
  content.spells = extractCompendiumSpells(raw, label, sourceId);
  if (sourceId === 'basic-rules-2024') {
    content.monsters = extractBasicRules2024Monsters(raw, label, sourceId);
  }
  return content;
};

const parseOrdinalLevel = (value, fallback = 1) => {
  const match = value.match(/(\d+)/);
  return match ? Number(match[1]) : fallback;
};

const normalizeFeatureName = (value) => {
  return value
    .toLowerCase()
    .replaceAll(/\s*\([^)]*\)/g, '')
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();
};

const extractSubclassRows = (raw) => {
  const rows = [];
  for (const rowMatch of raw.matchAll(tableRowRegex)) {
    const cells = [...rowMatch[1].matchAll(tableCellRegex)].map((cellMatch) => cellMatch[1]);
    if (cells.length < 4) {
      continue;
    }

    const classLink = anchorLinkRegex.exec(cells[0]);
    const subclassLink = anchorLinkRegex.exec(cells[1]);
    if (!classLink || !subclassLink) {
      continue;
    }

    const className = stripTags(classLink[2]);
    const subclassName = stripTags(subclassLink[2]);
    const classId = getClassIdFromName(className);
    if (!classId || !subclassName) {
      continue;
    }

    rows.push({
      className,
      classId,
      subclassId: subclassLink[1],
      subclassName,
      level: parseOrdinalLevel(stripTags(cells[2]), 3),
      summary: stripTags(cells[3])
    });
  }

  return rows;
};

const extractSpellClassMap = (raw) => {
  const classesBySpellId = new Map();
  const blocks = [...collectHeadingBlocks(raw, 2), ...collectHeadingBlocks(raw, 3)].filter((block) => / spells$/i.test(block.title));

  for (const block of blocks) {
    const className = block.title.replace(/ spells$/i, '').trim();
    for (const match of block.content.matchAll(/href="#([^"]+)"/gi)) {
      const spellId = match[1];
      if (!classesBySpellId.has(spellId)) {
        classesBySpellId.set(spellId, new Set());
      }

      classesBySpellId.get(spellId).add(className);
    }
  }

  return classesBySpellId;
};

const parseFeatPrerequisites = (value) => {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/^Prerequisite:\s*/i, '').trim();
  const raceMatches = normalized.match(/elf|half-elf|dwarf|halfling|dragonborn|tiefling|human|gnome|half-orc|orc|goblin|aasimar|genasi/gi);
  const classMatches = normalized.match(/barbarian|bard|cleric|druid|fighter|monk|paladin|ranger|rogue|sorcerer|warlock|wizard/gi);
  const levelMatch = normalized.match(/level\s+(\d+)/i);
  const abilityMatches = Array.from(normalized.matchAll(/(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+(\d+)/gi));

  const prerequisites = {
    race: raceMatches ? Array.from(new Set(raceMatches.map((entry) => entry.toLowerCase()))) : undefined,
    class: classMatches ? Array.from(new Set(classMatches.map((entry) => entry.toLowerCase()))) : undefined,
    level: levelMatch ? Number(levelMatch[1]) : undefined,
    ability: abilityMatches.length > 0
      ? Object.fromEntries(abilityMatches.map((match) => [match[1].toLowerCase(), Number(match[2])]))
      : undefined,
    spellcasting: /ability to cast at least one spell|spellcasting feature/i.test(normalized) || undefined,
    pactMagic: /pact magic/i.test(normalized) || undefined,
    text: normalized
  };

  if (!prerequisites.race && !prerequisites.class && !prerequisites.level && !prerequisites.ability && !prerequisites.spellcasting && !prerequisites.pactMagic) {
    return undefined;
  }

  return prerequisites;
};

const parseAbilityScoreIncreaseFromBullets = (items) => {
  const line = items.find((entry) => /increase your /i.test(entry));
  if (!line) {
    return undefined;
  }

  const amountMatch = line.match(/by\s+(\d+)/i);
  const amount = amountMatch ? Number(amountMatch[1]) : 1;
  const abilityMatches = line.match(/strength|dexterity|constitution|intelligence|wisdom|charisma/gi) ?? [];
  const abilities = Array.from(new Set(abilityMatches.map((entry) => entry.toLowerCase())));

  if (abilities.length === 1) {
    return [{ ability: abilities[0], amount }];
  }

  if (abilities.length > 1) {
    return [{ ability: 'choose', amount, chooseFrom: abilities, chooseCount: 1 }];
  }

  return undefined;
};

const parseSpellMetadata = (value) => {
  const cantripMatch = value.match(/^([a-z]+)\s+cantrip(?:\s*\(([^)]+)\))?/i);
  if (cantripMatch) {
    const parenthetical = cantripMatch[2]?.trim() ?? '';
    return {
      level: 0,
      school: cantripMatch[1],
      ritual: /^ritual$/i.test(parenthetical),
      classes: parenthetical && !/^ritual$/i.test(parenthetical)
        ? parenthetical.split(/,\s*/).map((entry) => repairMojibake(entry.trim())).filter(Boolean)
        : []
    };
  }

  const modernSpellMatch = value.match(/^level\s+(\d+)\s+([a-z]+)(?:\s*\(([^)]+)\))?/i);
  if (modernSpellMatch) {
    const parenthetical = modernSpellMatch[3]?.trim() ?? '';
    return {
      level: Number(modernSpellMatch[1]),
      school: modernSpellMatch[2],
      ritual: /\britual\b/i.test(parenthetical),
      classes: parenthetical && !/\britual\b/i.test(parenthetical)
        ? parenthetical.split(/,\s*/).map((entry) => repairMojibake(entry.trim())).filter(Boolean)
        : []
    };
  }

  const spellMatch = value.match(/^(\d+)(?:st|nd|rd|th)-level\s+([a-z]+)(?:\s*\((ritual)\))?/i);
  if (!spellMatch) {
    return null;
  }

  return {
    level: Number(spellMatch[1]),
    school: spellMatch[2],
    ritual: Boolean(spellMatch[3]),
    classes: []
  };
};

const normalizeMetadataLabelKey = (value) => value.toLowerCase().replaceAll(/[^a-z]/g, '');

const stripMetadataLabel = (value, label) => {
  const escapedLabel = label.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
  const spacedLabel = escapedLabel.split('').join(String.raw`\s*`);
  return value.replace(new RegExp(String.raw`^${spacedLabel}\s*:\s*`, 'i'), '').trim();
};

const extractLabeledParagraph = (raw, label) => {
  const normalizedLabel = normalizeMetadataLabelKey(label);

  for (const entry of extractParagraphTexts(raw)) {
    const normalizedEntry = normalizeMetadataLabelKey(entry.split(':')[0] ?? entry);
    if (normalizedEntry === normalizedLabel) {
      return stripMetadataLabel(entry, label);
    }
  }

  return '';
};

const extractXanatharContent = (raw, label, sourceId) => {
  const content = createEmptyImportedContentBucket();
  const h2Blocks = collectHeadingBlocks(raw, 2);
  const h3Blocks = collectHeadingBlocks(raw, 3);
  const racialFeatSummaryMatch = raw.match(/<h2[^>]*id="RacialFeatsSummary"[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  const featIds = racialFeatSummaryMatch
    ? Array.from(new Set(Array.from(racialFeatSummaryMatch[1].matchAll(/href="#([^"]+)"/gi)).map((match) => match[1])))
    : [];
  const h3BlocksById = new Map(h3Blocks.map((block) => [block.id, block]));
  const subclassRows = extractSubclassRows(raw);
  const subclassBlocksById = new Map(h2Blocks.map((block) => [block.id, block]));

  content.subclasses = subclassRows
    .map((row) => {
      const block = subclassBlocksById.get(row.subclassId);
      if (!block) {
        return null;
      }

      const introParagraphs = extractParagraphTexts(block.content.split(/<h4/i)[0]).filter((entry) => !/features$/i.test(entry));
      const featureLevels = new Map();
      for (const featureRow of block.content.matchAll(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
        const level = parseOrdinalLevel(stripTags(featureRow[1]), row.level);
        const name = stripTags(featureRow[2]);
        if (name) {
          featureLevels.set(normalizeFeatureName(name), level);
        }
      }

      const featureBlocks = collectHeadingBlocks(block.content, 4)
        .filter((feature) => !/ features$/i.test(feature.title) && !isChromeFeatureName(feature.title))
        .map((feature, index) => {
          const description = stripTrailingChrome(extractStructuredTexts(feature.content).join(' '));
          return {
            id: `${slugify(row.subclassName)}-feature-${index + 1}`,
            name: feature.title,
            description,
            // The subclass table is the authority, but it does not always list every feature
            // (Consult the Spirits, Vengeful Ancestors). Read the level out of the feature's own
            // prose before giving up and stamping it with the subclass's unlock level, which
            // otherwise makes a 14th-level feature look available at 3rd.
            level: featureLevels.get(normalizeFeatureName(feature.title))
              ?? parseFeatureLevelFromSubclassText(feature.title, description, row.level),
            source: label
          };
        })
        .filter((feature) => feature.description);

      return {
        id: slugify(row.subclassName),
        classId: row.classId,
        name: row.subclassName,
        description: stripTrailingChrome(introParagraphs.join(' ')) || row.summary,
        features: foldExpandedSpellTables(featureBlocks),
        source: label,
        sourceId
      };
    })
    .filter(Boolean);

  const spellClassMap = extractSpellClassMap(raw);

  content.spells = h3Blocks
    .map((block) => {
      const paragraphs = extractParagraphTexts(block.content);
      const metadata = paragraphs[0] ?? '';
      const parsedMetadata = parseSpellMetadata(metadata);
      if (!parsedMetadata) {
        return null;
      }

      const castingTime = extractLabeledParagraph(block.content, 'Casting Time');
      const range = extractLabeledParagraph(block.content, 'Range');
      const components = extractLabeledParagraph(block.content, 'Components');
      const duration = extractLabeledParagraph(block.content, 'Duration');
      const descriptionParagraphs = paragraphs.filter((entry) => {
        if (entry === metadata) return false;
        const labelKey = normalizeMetadataLabelKey(entry.split(':')[0] ?? entry);
        return !['castingtime', 'range', 'components', 'duration'].includes(labelKey);
      });
      const higherLevels = descriptionParagraphs.find((entry) => /^At Higher Levels\./i.test(entry));

      return {
        id: slugify(block.title),
        name: repairMojibake(block.title),
        level: parsedMetadata.level,
        school: parsedMetadata.school.charAt(0).toUpperCase() + parsedMetadata.school.slice(1),
        castingTime,
        range,
        components: components ? components.split(',').map((entry) => repairMojibake(entry.trim())).filter(Boolean) : [],
        duration,
        description: stripTrailingChrome(descriptionParagraphs.filter((entry) => entry !== higherLevels).join(' ')),
        higherLevels: stripTrailingChrome(higherLevels),
        ritual: parsedMetadata.ritual,
        concentration: /concentration/i.test(duration),
        classes: Array.from(spellClassMap.get(block.id) ?? []),
        source: label,
        sourceId
      };
    })
    .filter((entry) => entry?.description && entry.castingTime && entry.range && entry.duration);

  content.feats = featIds
    .map((featId) => h3BlocksById.get(featId))
    .map((block) => {
      if (!block) {
        return null;
      }

      const paragraphs = extractParagraphTexts(block.content);
      const firstParagraph = paragraphs[0] ?? '';
      const listItems = extractListItems(block.content);
      const looksLikeFeat = /^Prerequisite:/i.test(firstParagraph) || listItems.length > 0;
      if (!looksLikeFeat || / spells$/i.test(block.title)) {
        return null;
      }

      const descriptionParts = takeUntilChrome(paragraphs.filter((entry) => !/^Prerequisite:/i.test(entry)));
      // The last feat's block absorbs the page footer, whose nav <li> items pollute listItems.
      // Drop that chrome; if no real benefit list survives, fall back to the prose description.
      const cleanListItems = takeUntilChrome(listItems);
      const featureTexts = cleanListItems.length > 0 ? cleanListItems : descriptionParts;
      return {
        id: slugify(block.title),
        name: block.title,
        description: descriptionParts.join(' '),
        prerequisites: parseFeatPrerequisites(firstParagraph),
        abilityScoreIncreases: parseAbilityScoreIncreaseFromBullets(cleanListItems),
        features: featureTexts.map((item, index) => ({
          id: `${slugify(block.title)}-feature-${index + 1}`,
          name: `${block.title} Benefit ${index + 1}`,
          description: item,
          level: 1,
          source: label
        })),
        source: label,
        sourceId
      };
    })
    .filter((entry) => entry?.description && entry.features?.length > 0);

  return content;
};

// --- Tasha's Cauldron of Everything ------------------------------------------------------

const tashasSubclassSectionClassIds = new Map([
  ...basicRules2014SubclassSectionClassIds,
  ['artificerspecialists', 'artificer']
]);

// A subclass that expands the spell list prints two headings: the prose "Expanded Spell List" and
// the table "<Subclass> Expanded Spells". They are one feature, so the table is folded into the
// prose instead of surfacing as a second, duplicate feature.
const expandedSpellTablePattern = / expanded spells$/i;
const expandedSpellListPattern = /^expanded spell list$/i;

const foldExpandedSpellTables = (features) => {
  const tableFeature = features.find((feature) => expandedSpellTablePattern.test(feature.name));
  const listFeature = features.find((feature) => expandedSpellListPattern.test(feature.name));
  if (!tableFeature || !listFeature) {
    return features;
  }

  return features
    .filter((feature) => feature !== tableFeature)
    .map((feature) => (feature === listFeature
      ? { ...feature, description: `${feature.description} ${tableFeature.description}`.trim() }
      : feature));
};

const buildOptionalFeatureFromBlock = (featureBlock, classKey, label) => {
  // Sections that introduce a pool ("Eldritch Invocation Options", "Pact Boon Option") nest each
  // option under their own heading. The block's content runs to the next *same-level* heading, so
  // reading all of it glued the option bodies — prerequisites and all — onto the section's own
  // description. The options are extracted separately into the feature's choice pool.
  const body = sliceSectionBody(featureBlock.content);
  const texts = extractStructuredTexts(body);
  const levelLine = texts.find((entry) => featureLevelBoilerplatePattern.test(entry));
  const bodyTexts = takeUntilChrome(texts.filter((entry) => !featureLevelBoilerplatePattern.test(entry)));
  // "Additional Warlock Spells" announces a list that is printed in a torn-paper aside beside the
  // paragraph, so the spells have to be read back out of it or the feature is just a promise.
  const description = stripTrailingChrome(
    [...bodyTexts, ...extractSpellListLines(body, bodyTexts.join(' '))].join(' ')
  );
  if (!description || isChromeFeatureName(featureBlock.title)) {
    return null;
  }

  return {
    id: slugify(`tashas-${classKey}-${featureBlock.title}`),
    name: repairMojibake(featureBlock.title),
    description,
    level: levelLine ? parseOrdinalLevel(levelLine, 1) : 1,
    source: label,
    optional: true
  };
};

// Optional class features amend an existing class, so they ride in placeholder class
// entries (hitDie 0). The runtime merges same-name classes and drops the placeholder,
// leaving the optional features attached to the real class.
const extractTashasOptionalFeatureSupplements = (raw, label, sourceId) => {
  const supplementsByClassKey = new Map();

  for (const block of collectHeadingBlocks(raw, 1)) {
    const classKey = getClassIdFromName(block.title);
    if (!classKey || supplementsByClassKey.has(classKey)) {
      continue;
    }

    const optionalSection = collectHeadingBlocks(block.content, 2)
      .find((section) => /^optional class features?$/i.test(section.title));
    if (!optionalSection) {
      continue;
    }

    const features = collectHeadingBlocks(optionalSection.content, 3)
      .map((featureBlock) => buildOptionalFeatureFromBlock(featureBlock, classKey, label))
      .filter(Boolean);

    if (features.length === 0) {
      continue;
    }

    supplementsByClassKey.set(classKey, {
      id: toSourceSpecificId(sourceId, `${classKey}-optional-features`),
      name: repairMojibake(block.title),
      description: `Optional ${block.title} class features from ${label}.`,
      hitDie: 0,
      primaryAbility: 'charisma',
      savingThrows: [],
      armorProficiencies: [],
      weaponProficiencies: [],
      toolProficiencies: [],
      skillChoices: [],
      skillCount: 0,
      features,
      subclasses: [],
      subclassLevel: 1,
      equipmentOptions: [],
      source: label,
      sourceId
    });
  }

  return Array.from(supplementsByClassKey.values());
};

const extractTashasSubclasses = (raw, label, sourceId) => {
  const results = [];
  const seenIds = new Set();

  for (const block of collectHeadingBlocks(raw, 1)) {
    for (const section of collectHeadingBlocks(block.content, 2)) {
      const sectionClassKey = tashasSubclassSectionClassIds.get(normalizeLabel(section.title));
      if (!sectionClassKey) {
        continue;
      }

      for (const subclassBlock of collectHeadingBlocks(section.content, 3)) {
        const id = toSourceSpecificId(sourceId, `${sectionClassKey}-${subclassBlock.title}`);
        if (seenIds.has(id)) {
          continue;
        }

        const firstFeatureMatch = subclassBlock.content.search(/<h4[^>]*>/i);
        const introRaw = firstFeatureMatch >= 0 ? subclassBlock.content.slice(0, firstFeatureMatch) : subclassBlock.content;
        const description = stripTrailingChrome(takeUntilChrome(extractParagraphTexts(introRaw)).join(' '));
        const features = extractSubclassFeaturesFromBlock(subclassBlock, label, 4, 3);
        if (features.length === 0) {
          continue;
        }

        seenIds.add(id);
        results.push({
          id,
          classId: sectionClassKey,
          name: repairMojibake(subclassBlock.title),
          description,
          features,
          source: label,
          sourceId
        });
      }
    }
  }

  return results;
};

const splitTopLevelAlternatives = (value) => {
  return value
    .replace(/^your choice of\s+/i, '')
    .split(/\s+or\s+(?![^(]*\))/i)
    .map((entry) => entry.replace(/^\((?:a|b|c)\)\s*/i, '').trim())
    .filter(Boolean);
};

const parseBulletEquipmentGroups = (items) => {
  return items
    .map((item) => splitTopLevelAlternatives(item)
      .map((entry) => parseEquipmentOptionText(entry))
      .filter(Boolean))
    .filter((group) => group.length > 0);
};

const extractTashasArtificerClass = (raw, label, sourceId) => {
  const artificerBlock = collectHeadingBlocks(raw, 1)
    .find((block) => /^artificer$/i.test(block.title.trim()) && /id="ClassFeatures"/i.test(block.content));
  if (!artificerBlock) {
    return undefined;
  }

  const content = artificerBlock.content;
  const paragraphPairs = extractLabeledParagraphPairs(content);
  const tablePairs = extractTableLabelValuePairs(content);
  const hitDie = parseHitDieFromText(getPairValue([paragraphPairs, tablePairs], 'Hit Dice', 'Hit Point Die'));
  const savingThrows = parseSavingThrows(getPairValue([paragraphPairs, tablePairs], 'Saving Throws', 'Saving Throw Proficiencies'));
  const spellcastingAbility = extractSpellcastingAbilityFromText(content, undefined);
  const { featureLevels, subclassLevel } = extractClassFeatureLevels(content);
  const { skillChoices, skillCount } = parseSkillChoices(getPairValue([paragraphPairs, tablePairs], 'Skills', 'Skill Proficiencies'));
  const introDescription = stripTrailingChrome(
    takeUntilChrome(extractParagraphTexts(content.split(/<h2[^>]*>/i)[0])).join(' ')
  );
  const startingEquipmentBlock = collectHeadingBlocks(content, 3)
    .find((entry) => /^starting equipment$/i.test(entry.title));
  const equipmentOptions = startingEquipmentBlock
    ? parseBulletEquipmentGroups(takeUntilChrome(extractListItems(startingEquipmentBlock.content)))
    : [];

  if (!hitDie || savingThrows.length === 0) {
    return undefined;
  }

  return {
    id: toSourceSpecificId(sourceId, 'artificer'),
    name: repairMojibake(artificerBlock.title),
    description: introDescription,
    hitDie,
    primaryAbility: spellcastingAbility ?? 'intelligence',
    savingThrows,
    armorProficiencies: parseSimpleList(getPairValue([paragraphPairs, tablePairs], 'Armor', 'Armor Training')),
    weaponProficiencies: parseSimpleList(getPairValue([paragraphPairs, tablePairs], 'Weapons', 'Weapon Proficiencies')),
    toolProficiencies: parseSimpleList(getPairValue([paragraphPairs, tablePairs], 'Tools', 'Tool Proficiencies')),
    skillChoices,
    skillCount,
    features: extractClassFeaturesFromBlock(content, label, featureLevels),
    subclasses: [],
    subclassLevel,
    spellcasting: extractBasicRulesSpellcasting(content, 'artificer', spellcastingAbility ?? 'intelligence'),
    equipmentOptions,
    source: label,
    sourceId
  };
};

const extractTashasFeats = (raw, label, sourceId) => {
  const featsByKey = new Map();

  for (const block of collectHeadingBlocks(raw, 1)) {
    if (!/^feats$/i.test(block.title.trim())) {
      continue;
    }

    for (const featBlock of collectHeadingBlocks(block.content, 2)) {
      if (/^feats$/i.test(featBlock.title.trim()) || isChromeFeatureName(featBlock.title)) {
        continue;
      }

      const paragraphs = extractParagraphTexts(featBlock.content);
      const prerequisiteParagraph = paragraphs.find((entry) => /^Prerequisite:/i.test(entry));
      const descriptionParts = takeUntilChrome(paragraphs.filter((entry) => entry !== prerequisiteParagraph));
      const listItems = takeUntilChrome(extractListItems(featBlock.content));
      const featureTexts = listItems.length > 0 ? listItems : descriptionParts;
      const id = toSourceSpecificId(sourceId, featBlock.title);
      if (featsByKey.has(id) || descriptionParts.length === 0 || featureTexts.length === 0) {
        continue;
      }

      featsByKey.set(id, {
        id,
        name: repairMojibake(featBlock.title),
        description: descriptionParts.join(' '),
        prerequisites: parseFeatPrerequisites(prerequisiteParagraph),
        abilityScoreIncreases: parseAbilityScoreIncreaseFromBullets(listItems),
        features: featureTexts.map((item, index) => ({
          id: `${slugify(featBlock.title)}-feature-${index + 1}`,
          name: `${repairMojibake(featBlock.title)} Benefit ${index + 1}`,
          description: item,
          level: 1,
          source: label
        })),
        source: label,
        sourceId
      });
    }
  }

  return Array.from(featsByKey.values());
};

const magicItemMetadataPattern = /^(wondrous item|weapon|armor|rod|ring|staff|wand|potion|scroll|tattoo)/i;

const magicItemEquipmentType = (metadata) => {
  const lowered = metadata.toLowerCase();
  if (lowered.startsWith('weapon')) return 'weapon';
  if (lowered.startsWith('armor')) return 'armor';
  if (lowered.startsWith('potion') || lowered.startsWith('scroll')) return 'consumable';
  return 'gear';
};

const extractTashasMagicItems = (raw, label, sourceId) => {
  const descriptionsSection = collectHeadingBlocks(raw, 2)
    .find((section) => /^magic item descriptions$/i.test(section.title));
  if (!descriptionsSection) {
    return [];
  }

  return collectHeadingBlocks(descriptionsSection.content, 3)
    .map((itemBlock) => {
      const paragraphs = extractParagraphTexts(itemBlock.content);
      const metadata = paragraphs[0] ?? '';
      if (!magicItemMetadataPattern.test(metadata)) {
        return null;
      }

      const description = takeUntilChrome(paragraphs.slice(1)).join(' ');
      if (!description) {
        return null;
      }

      return {
        id: toSourceSpecificId(sourceId, itemBlock.title),
        name: repairMojibake(itemBlock.title),
        type: magicItemEquipmentType(metadata),
        source: label,
        sourceId,
        cost: { amount: 0, unit: 'gp' },
        weight: 0,
        description: `${metadata}. ${description}`
      };
    })
    .filter(Boolean);
};

const extractTashasSpellClassMap = (raw) => {
  const classNamesBySpellKey = new Map();
  const spellsTableBlock = collectHeadingBlocks(raw, 3).find((block) => block.id === 'SpellsTable');
  if (!spellsTableBlock) {
    return classNamesBySpellKey;
  }

  for (const rowMatch of spellsTableBlock.content.matchAll(tableRowRegex)) {
    const cells = [...rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((cellMatch) => stripTags(cellMatch[1]));
    if (cells.length < 6 || !cells[1] || /^spell$/i.test(cells[1])) {
      continue;
    }

    const classNames = cells[5].split(/,\s*/).map((entry) => repairMojibake(entry.trim())).filter(Boolean);
    if (classNames.length > 0) {
      classNamesBySpellKey.set(normalizeLabel(cells[1]), classNames);
    }
  }

  return classNamesBySpellKey;
};

const extractTashasContent = (raw, label, sourceId) => {
  const content = createEmptyImportedContentBucket();
  const artificerClass = extractTashasArtificerClass(raw, label, sourceId);
  content.classes = [
    ...(artificerClass ? [artificerClass] : []),
    ...extractTashasOptionalFeatureSupplements(raw, label, sourceId)
  ];
  content.subclasses = extractTashasSubclasses(raw, label, sourceId);
  content.feats = extractTashasFeats(raw, label, sourceId);
  content.spells = extractCompendiumSpells(raw, label, sourceId, extractTashasSpellClassMap(raw));
  content.equipment = extractTashasMagicItems(raw, label, sourceId);
  return content;
};

// --- Compendium species (Monsters of the Multiverse and similar layouts) ----------------

const speciesTraitsHeadingPattern = / traits$/i;
const speciesMetadataTraitLabels = new Set([
  'Ability Score Increase',
  'Age',
  'Alignment',
  'Creature Type',
  'Languages',
  'Size',
  'Speed',
  'Subrace',
  'Subraces'
]);

const buildSpeciesFeaturesFromTraits = (traitEntries, ownerTitle, label) => {
  return traitEntries
    .filter((entry) => !speciesMetadataTraitLabels.has(entry.label))
    .map((entry) => ({
      id: slugify(`${ownerTitle}-${entry.label}`),
      name: entry.label,
      description: entry.value,
      level: 1,
      source: label
    }));
};

const getSpeciesVariantDescription = (variantBlock, variantName, speciesTitle) => {
  const introText = extractParagraphTexts(variantBlock.content)
    .find((entry) => !/^[A-Z][A-Za-z' -]+[.:]\s/.test(entry));
  return introText ?? `${variantName} lineage of the ${speciesTitle}.`;
};

// Species chapters such as Monsters of the Multiverse print each species as a heading
// followed by an "<Name> Traits" section. Some species (e.g. Genasi) publish several
// trait sections, one per lineage; those become variants.
const extractCompendiumSpecies = (raw, label, sourceId, { speciesHeadingLevel = 2, traitsHeadingLevel = 3 } = {}) => {
  return collectHeadingBlocks(raw, speciesHeadingLevel)
    .map((block) => {
      const traitsBlocks = collectHeadingBlocks(block.content, traitsHeadingLevel)
        .filter((entry) => speciesTraitsHeadingPattern.test(entry.title));
      if (traitsBlocks.length === 0) {
        return null;
      }

      const mainTraitsBlock = traitsBlocks.find((entry) => normalizeLabel(entry.title) === normalizeLabel(`${block.title} Traits`));
      const statsBlock = mainTraitsBlock ?? traitsBlocks[0];
      const introRaw = block.content.slice(0, traitsBlocks[0].start);
      const description = stripTrailingChrome(takeUntilChrome(extractParagraphTexts(introRaw)).join(' '));
      const statsTraitEntries = extractTraitEntries(statsBlock.content);
      const getTraitValue = (...labels) => statsTraitEntries.find((entry) => labels.includes(entry.label))?.value ?? '';
      const sizeText = getTraitValue('Size');
      const speedText = getTraitValue('Speed');
      const features = mainTraitsBlock
        ? buildSpeciesFeaturesFromTraits(extractTraitEntries(mainTraitsBlock.content), block.title, label)
        : [];
      const variants = traitsBlocks
        .filter((entry) => entry !== mainTraitsBlock)
        .map((variantBlock) => {
          const variantName = repairMojibake(variantBlock.title.replace(speciesTraitsHeadingPattern, '').trim());
          const variantFeatures = buildSpeciesFeaturesFromTraits(extractTraitEntries(variantBlock.content), variantBlock.title, label);
          if (!variantName || variantFeatures.length === 0) {
            return null;
          }

          return {
            id: toSourceSpecificId(sourceId, variantName),
            name: variantName,
            description: getSpeciesVariantDescription(variantBlock, variantName, block.title),
            features: variantFeatures
          };
        })
        .filter(Boolean);

      if (!description || !sizeText || !speedText) {
        return null;
      }

      return {
        id: toSourceSpecificId(sourceId, block.title),
        name: repairMojibake(block.title),
        description,
        size: parseSizeFromText(sizeText),
        sizeOptions: parseSizeOptionsFromText(sizeText),
        speed: parseSpeedFromText(speedText),
        abilityScoreIncreases: parseAbilityScoreIncreaseText(getTraitValue('Ability Score Increase')) ?? [],
        features,
        languages: parseLanguagesText(getTraitValue('Languages')),
        variants: variants.length > 0 ? variants : undefined,
        source: label,
        sourceId
      };
    })
    .filter(Boolean);
};

const determineParsedDocumentContent = ({ raw, label, sourceId, looksLikeHtml, shouldExtractXanathar, shouldExtractBasicRules, shouldExtractTashas }) => {
  if (!looksLikeHtml) {
    return createEmptyImportedContentBucket();
  }

  if (shouldExtractXanathar) {
    return extractXanatharContent(raw, label, sourceId);
  }

  if (shouldExtractBasicRules) {
    return extractBasicRulesContent(raw, label, sourceId);
  }

  if (shouldExtractTashas) {
    return extractTashasContent(raw, label, sourceId);
  }

  const content = createEmptyImportedContentBucket();
  content.species = extractCompendiumSpecies(raw, label, sourceId);
  content.monsters = extractModernStatBlockMonsters(raw, label, sourceId);
  return content;
};

const resolveParserName = ({ parser, shouldExtractXanathar, shouldExtractBasicRules, shouldExtractTashas, looksLikeHtml, extractedContent }) => {
  if (parser !== 'auto') {
    return parser;
  }

  if (shouldExtractXanathar) {
    return 'xgte-html';
  }

  if (shouldExtractBasicRules) {
    return 'basic-rules-html';
  }

  if (shouldExtractTashas) {
    return 'tcoe-html';
  }

  if (looksLikeHtml && (extractedContent.monsters.length > 0 || extractedContent.species.length > 0)) {
    return 'html-statblock';
  }

  if (looksLikeHtml) {
    return 'html-outline';
  }

  return 'text-outline';
};

export const parseDocumentToCanonicalSourcePackage = ({
  raw,
  inputPath,
  sourceId,
  label,
  category,
  aliases = [],
  description,
  parser = 'auto'
}) => {
  const looksLikeHtml = /<html|<body|<!doctype/i.test(raw);
  // Chapter titles and the book's own name resolve cross-references while this document is parsed.
  setDocumentReferenceContext(raw, label);
  const title = extractTitle(raw) || label;
  const headingSections = looksLikeHtml ? extractHeadingSections(raw) : extractTextSections(raw);
  const sections = looksLikeHtml ? extractAnchorSections(raw, headingSections) : headingSections;
  const shouldExtractXanathar = looksLikeHtml && /xanathar|xgte/i.test(sourceId);
  const shouldExtractBasicRules = looksLikeHtml && /^basic-rules-(2014|2024)$/i.test(sourceId);
  const shouldExtractTashas = looksLikeHtml && /^(tashas|tcoe)$/i.test(sourceId);
  const extractedContent = determineParsedDocumentContent({
    raw,
    label,
    sourceId,
    looksLikeHtml,
    shouldExtractXanathar,
    shouldExtractBasicRules,
    shouldExtractTashas
  });
  const extractedCount = countContentEntries(extractedContent);
  const resolvedParser = resolveParserName({ parser, shouldExtractXanathar, shouldExtractBasicRules, shouldExtractTashas, looksLikeHtml, extractedContent });

  return {
    schemaVersion: canonicalSchemaVersion,
    source: {
      sourceId,
      label,
      category,
      aliases,
      description,
      origin: looksLikeHtml ? 'parsed-html' : 'manual',
      importedAt: new Date().toISOString(),
      parser: resolvedParser,
      visibility: 'private'
    },
    content: extractedContent,
    sections,
    documents: [
      {
        type: looksLikeHtml ? 'html' : 'text',
        title,
        path: inputPath,
        contentExcerpt: stripTags(raw).slice(0, 180),
        sectionCount: sections.length
      }
    ],
    notes: [
      'Document structure extracted from a raw source file.',
      extractedCount > 0
        ? `Semantic extraction mapped ${extractedCount} entries into canonical content buckets.`
        : 'Content buckets remain empty until the document is mapped into concrete entities.'
    ]
  };
};

export const coerceToCanonicalSourcePackage = (input, overrides = {}) => {
  const sourceId = overrides.sourceId ?? input?.source?.sourceId ?? input?.sourceId;
  const label = overrides.label ?? input?.source?.label ?? input?.label;
  const category = overrides.category ?? input?.source?.category ?? input?.category ?? 'supplement';
  const aliases = overrides.aliases ?? input?.source?.aliases ?? input?.aliases ?? [];
  const description = overrides.description ?? input?.source?.description ?? input?.description;
  let notes = [];
  if (Array.isArray(input?.notes)) {
    notes = input.notes.filter((entry) => typeof entry === 'string');
  } else if (typeof input?.note === 'string') {
    notes = [input.note];
  }

  return {
    schemaVersion: canonicalSchemaVersion,
    source: {
      sourceId,
      label,
      category,
      aliases,
      description,
      origin: input?.source?.origin ?? 'imported-json',
      importedAt: input?.source?.importedAt ?? new Date().toISOString(),
      parser: input?.source?.parser,
      visibility: input?.source?.visibility ?? 'private'
    },
    content: sanitizeContent(input?.content ?? input, {
      sourceId,
      label
    }),
    sections: Array.isArray(input?.sections) ? input.sections.filter(isObject) : [],
    documents: Array.isArray(input?.documents) ? input.documents.filter(isObject) : [],
    notes
  };
};

export const validateCanonicalSourcePackage = (candidate) => {
  const errors = [];
  if (!isObject(candidate)) {
    return { valid: false, errors: ['Canonical source package must be an object.'] };
  }

  if (candidate.schemaVersion !== canonicalSchemaVersion) {
    errors.push(`schemaVersion must be ${canonicalSchemaVersion}.`);
  }

  if (!isObject(candidate.source)) {
    errors.push('source must be an object.');
  }

  if (typeof candidate.source?.sourceId !== 'string' || candidate.source.sourceId.trim().length === 0) {
    errors.push('source.sourceId is required.');
  }

  if (typeof candidate.source?.label !== 'string' || candidate.source.label.trim().length === 0) {
    errors.push('source.label is required.');
  }

  if (!allowedCategories.has(candidate.source?.category)) {
    errors.push(`source.category must be one of: ${Array.from(allowedCategories).join(', ')}.`);
  }

  const normalized = {
    schemaVersion: canonicalSchemaVersion,
    source: {
      sourceId: candidate.source?.sourceId,
      label: candidate.source?.label,
      category: candidate.source?.category,
      aliases: Array.isArray(candidate.source?.aliases)
        ? candidate.source.aliases.filter((entry) => typeof entry === 'string')
        : [],
      description: typeof candidate.source?.description === 'string' ? candidate.source.description : undefined,
      origin: candidate.source?.origin ?? 'imported-json',
      importedAt: candidate.source?.importedAt ?? new Date().toISOString(),
      parser: candidate.source?.parser,
      visibility: candidate.source?.visibility ?? 'private'
    },
    content: sanitizeContent(candidate.content, candidate.source ?? {}),
    sections: Array.isArray(candidate.sections) ? candidate.sections.filter(isObject) : [],
    documents: Array.isArray(candidate.documents) ? candidate.documents.filter(isObject) : [],
    notes: Array.isArray(candidate.notes) ? candidate.notes.filter((entry) => typeof entry === 'string') : []
  };

  return {
    valid: errors.length === 0,
    errors,
    value: normalized
  };
};

export const generateSourceModuleText = (pack, constName = undefined) => {
  const safeName = constName ?? pack.source.sourceId.replaceAll(/\W/g, '_');
  const sourceObject = {
    schemaVersion: pack.schemaVersion,
    sourceId: pack.source.sourceId,
    label: pack.source.label,
    category: pack.source.category,
    aliases: pack.source.aliases,
    description: pack.source.description ?? 'Source pack scaffold generated by the importer.',
    content: pack.content,
    note: pack.notes?.[0] ?? 'Populate this file with licensed or user-provided content data.',
    notes: pack.notes,
    documents: pack.documents,
    sections: pack.sections,
    meta: {
      origin: pack.source.origin,
      importedAt: pack.source.importedAt,
      parser: pack.source.parser,
      visibility: pack.source.visibility
    }
  };

  const serializedObjectLiteral = JSON.stringify(JSON.stringify(sourceObject));

  return `import type { ImportedContentSourceFile } from '../librarySources';

export const ${safeName}: ImportedContentSourceFile = JSON.parse(${serializedObjectLiteral});

export default ${safeName};
`;
};