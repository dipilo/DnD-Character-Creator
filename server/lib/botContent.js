// The content the Discord bot may look up: the SRD-derived Basic Rules packs only. The book
// dumps under imports/ (Tasha's, Xanathar's, MotM) are the owner's own scans for their own
// builder and are not served to arbitrary Discord servers through this surface.
const fs = require('node:fs');
const path = require('node:path');

const IMPORTS_DIR = path.join(__dirname, '..', '..', 'imports');
const BOT_CONTENT_SOURCES = ['basic-rules-2024', 'basic-rules-2014'];

// Public kind → the canonical pack's content key. Subclasses and UA are not offered.
const KINDS = {
  spell: 'spells',
  monster: 'monsters',
  item: 'equipment',
  feat: 'feats',
  species: 'species',
  class: 'classes',
  background: 'backgrounds',
};

const MAX_RESULTS = 25;

let library = null;

function normalise(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editionOf(sourceId) {
  const match = /(\d{4})$/.exec(String(sourceId ?? ''));
  return match ? match[1] : '';
}

function ordinal(n) {
  const suffix = n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

function crLabel(value) {
  const cr = Number(value);
  if (!Number.isFinite(cr)) return String(value ?? '');
  if (cr === 0.125) return '1/8';
  if (cr === 0.25) return '1/4';
  if (cr === 0.5) return '1/2';
  return String(cr);
}

/** One line under the name in a picker: what the entry is, in the books' own terms. */
function blurb(kind, entry) {
  switch (kind) {
    case 'spell': {
      const level = Number(entry.level ?? 0);
      const head = level === 0 ? `${entry.school ?? ''} cantrip` : `${ordinal(level)}-level ${entry.school ?? ''}`;
      const tags = [entry.ritual ? 'ritual' : '', entry.concentration ? 'concentration' : ''].filter(Boolean);
      return [head.trim(), ...tags].join(' · ');
    }
    case 'monster':
      return [`${entry.size ?? ''} ${entry.type ?? ''}`.trim(), entry.challengeRating != null ? `CR ${crLabel(entry.challengeRating)}` : '']
        .filter(Boolean).join(' · ');
    case 'item': {
      const cost = entry.cost?.amount != null ? `${entry.cost.amount} ${entry.cost.unit ?? 'gp'}` : '';
      const detail = entry.type === 'weapon'
        ? [entry.weaponCategory, entry.weaponType, entry.damage ? `${entry.damage} ${String(entry.damageType ?? '').toLowerCase()}`.trim() : ''].filter(Boolean).join(' ')
        : entry.type === 'armor' ? `AC ${entry.ac ?? '?'}` : '';
      return [entry.type, detail, cost].filter(Boolean).join(' · ');
    }
    case 'species':
      return [entry.size, entry.speed ? `${entry.speed} ft.` : ''].filter(Boolean).join(' · ');
    case 'class':
      return [entry.hitDie ? `d${entry.hitDie} hit die` : '', entry.primaryAbility ? `${entry.primaryAbility}` : ''].filter(Boolean).join(' · ');
    default:
      return '';
  }
}

function summary(kind, entry) {
  return {
    id: entry.id,
    name: entry.name,
    kind,
    sourceId: entry.sourceId,
    source: entry.source,
    edition: editionOf(entry.sourceId),
    blurb: blurb(kind, entry),
  };
}

/**
 * Read the allowed packs once. A pack that is missing or unreadable is skipped rather than
 * fatal — the route then answers from whatever loaded, and an empty library is an empty result.
 */
function loadLibrary() {
  if (library) return library;
  const byKind = Object.fromEntries(Object.keys(KINDS).map((kind) => [kind, []]));
  for (const sourceId of BOT_CONTENT_SOURCES) {
    let pack;
    try {
      pack = JSON.parse(fs.readFileSync(path.join(IMPORTS_DIR, `${sourceId}.canonical.json`), 'utf8'));
    } catch (e) {
      console.warn(`bot content: could not read ${sourceId}:`, e?.message);
      continue;
    }
    const content = pack?.content ?? {};
    for (const [kind, key] of Object.entries(KINDS)) {
      for (const entry of Array.isArray(content[key]) ? content[key] : []) {
        if (!entry || typeof entry.id !== 'string' || typeof entry.name !== 'string') continue;
        byKind[kind].push({ entry: { ...entry, sourceId: entry.sourceId ?? sourceId }, key: normalise(entry.name) });
      }
    }
  }
  library = byKind;
  return library;
}

function rank(key, query) {
  if (key === query) return 0;
  if (key.startsWith(query)) return 1;
  if (key.split(' ').some((word) => word.startsWith(query))) return 2;
  if (key.includes(query)) return 3;
  return -1;
}

/**
 * Name search. Exact beats prefix beats word-prefix beats substring; ties go to the newer
 * edition, then alphabetically. Both editions of a name are returned unless one is asked for.
 */
function searchContent(kind, query, { limit = MAX_RESULTS, edition = '' } = {}) {
  const rows = loadLibrary()[kind];
  if (!rows) return null;
  const wanted = normalise(query);
  const cap = Math.max(1, Math.min(Number(limit) || MAX_RESULTS, MAX_RESULTS));
  const scored = [];
  for (const row of rows) {
    if (edition && editionOf(row.entry.sourceId) !== edition) continue;
    const score = wanted ? rank(row.key, wanted) : 3;
    if (score < 0) continue;
    scored.push({ score, row });
  }
  scored.sort((a, b) => a.score - b.score
    || editionOf(b.row.entry.sourceId).localeCompare(editionOf(a.row.entry.sourceId))
    || a.row.key.localeCompare(b.row.key));
  return scored.slice(0, cap).map(({ row }) => summary(kind, row.entry));
}

function getContent(kind, id) {
  const rows = loadLibrary()[kind];
  if (!rows) return null;
  const row = rows.find((candidate) => candidate.entry.id === id);
  return row ? { ...summary(kind, row.entry), ...row.entry } : null;
}

module.exports = { BOT_CONTENT_SOURCES, KINDS, MAX_RESULTS, loadLibrary, searchContent, getContent, normalise };
