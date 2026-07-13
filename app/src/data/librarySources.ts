import type {
  Background,
  Class,
  Equipment,
  Feat,
  Monster,
  Species,
  Spell,
  Subclass
} from '@/types/dnd';

export type ContentSourceCategory = 'core' | 'supplement' | 'expansion' | 'basic' | 'ua' | 'homebrew';

export interface ContentSourceManifestEntry {
  id: string;
  label: string;
  category: ContentSourceCategory;
  aliases?: string[];
  description?: string;
  file?: string;
}

export interface ImportedContentBucket {
  species: Species[];
  classes: Class[];
  subclasses: Subclass[];
  backgrounds: Background[];
  spells: Spell[];
  equipment: Equipment[];
  feats: Feat[];
  monsters: Monster[];
  ua: Array<Record<string, unknown>>;
}

export interface ImportedContentDocument {
  type: 'html' | 'text' | 'json';
  title: string;
  path?: string;
  contentExcerpt?: string;
  sectionCount?: number;
}

export interface ImportedContentSection {
  id: string;
  title: string;
  level: number;
  href?: string;
  text?: string;
}

export interface ImportedContentMeta {
  origin?: 'manual' | 'imported-json' | 'parsed-html' | 'generated' | 'homebrew';
  importedAt?: string;
  parser?: string;
  visibility?: 'private' | 'shared';
}

export interface ImportedContentSourceFile {
  schemaVersion?: string;
  sourceId: string;
  label: string;
  category: ContentSourceCategory;
  aliases?: string[];
  description?: string;
  content: ImportedContentBucket;
  note?: string;
  notes?: string[];
  documents?: ImportedContentDocument[];
  sections?: ImportedContentSection[];
  meta?: ImportedContentMeta;
}

export const contentSourceManifest: ContentSourceManifestEntry[] = [
  {
    id: 'phb-2014',
    label: "Player's Handbook (2014)",
    category: 'core',
    aliases: ["player's handbook", 'phb 2014', '2014 phb'],
    description: 'The original 5e player rules. Core species, classes, and backgrounds ship as built-in app content; spells, equipment, and monsters come from the SRD-based Basic Rules (2014) pack.',
    file: 'src/data/sourceFiles/phb-2014.ts'
  },
  {
    id: 'phb-2024',
    label: "Player's Handbook (2024)",
    category: 'core',
    aliases: ["player's handbook 2024", 'phb 2024', '2024 phb'],
    description: 'The revised 2024 player rules. The local PHB(2024) document only covers the table of contents, so the free 2024 core content is bundled under Basic Rules (2024); import a full dump to bundle PHB-exclusive entries.',
    file: 'src/data/sourceFiles/phb-2024.ts'
  },
  {
    id: 'dmg',
    label: "Dungeon Master's Guide",
    category: 'core',
    aliases: ['dmg'],
    description: 'Magic items from the DMG treasure chapter, generated from the local SRD dataset.',
    file: 'src/data/sourceFiles/dmg.ts'
  },
  {
    id: 'mm',
    label: 'Monster Manual (2014)',
    category: 'core',
    aliases: ['monster manual', 'monster manual 2014', 'mm 2014'],
    description: 'The SRD reprint of the 2014 monster stat blocks is bundled under Basic Rules (2014); no separate Monster Manual document is available locally.',
    file: 'src/data/sourceFiles/mm.ts'
  },
  {
    id: 'mm-2024',
    label: 'Monster Manual (2024)',
    category: 'core',
    aliases: ['monster manual 2024', 'mm 2024'],
    description: 'The 2024 monster stat blocks from the free rules are bundled under Basic Rules (2024); no separate 2024 Monster Manual document is available locally.',
    file: 'src/data/sourceFiles/mm-2024.ts'
  },
  {
    id: 'tashas',
    label: "Tasha's Cauldron of Everything",
    category: 'supplement',
    aliases: ['tasha', 'tcoe'],
    description: 'The Artificer, subclasses, optional class features, feats, spells, and magic items imported from the TCOE document.',
    file: 'src/data/sourceFiles/tashas-cauldron-of-everything.ts'
  },
  {
    id: 'xanathars',
    label: "Xanathar's Guide to Everything",
    category: 'supplement',
    aliases: ['xanathars', 'xgte'],
    file: 'src/data/sourceFiles/xanathars-guide-to-everything.ts'
  },
  {
    id: 'mtof',
    label: "Mordenkainen's Tome of Foes",
    category: 'supplement',
    aliases: ['mtof'],
    description: 'Built-in species content only; no local source document is available to bundle more entries.',
    file: 'src/data/sourceFiles/mordenkainens-tome-of-foes.ts'
  },
  {
    id: 'fizbans',
    label: "Fizban's Treasury of Dragons",
    category: 'supplement',
    aliases: ['fizbans', 'ftod'],
    description: 'Built-in species content only; no local source document is available to bundle more entries.',
    file: 'src/data/sourceFiles/fizbans-treasury-of-dragons.ts'
  },
  {
    id: 'motm',
    label: 'Mordenkainen Presents: Monsters of the Multiverse',
    category: 'expansion',
    aliases: ['motm', 'monsters of the multiverse'],
    file: 'src/data/sourceFiles/mordenkainen-presents-monsters-of-the-multiverse.ts'
  },
  {
    id: 'volos',
    label: "Volo's Guide to Monsters",
    category: 'supplement',
    aliases: ['volos', 'vgtm'],
    description: 'Playable monstrous species from the 2016 supplement, shipped as built-in app content.'
  },
  {
    id: 'erlw',
    label: 'Eberron: Rising from the Last War',
    category: 'expansion',
    aliases: ['erlw', 'eberron'],
    description: 'No local source document is available yet; import one with the workspace CLI to bundle entries.',
    file: 'src/data/sourceFiles/eberron-rising-from-the-last-war.ts'
  },
  {
    id: 'basic-rules-2014',
    label: 'Basic Rules (2014)',
    category: 'basic',
    aliases: ['basic rules', '2014 basic rules'],
    file: 'src/data/sourceFiles/basic-rules-2014.ts'
  },
  {
    id: 'basic-rules-2024',
    label: 'Basic Rules (2024)',
    category: 'basic',
    aliases: ['basic rules 2024', '2024 basic rules'],
    file: 'src/data/sourceFiles/basic-rules-2024.ts'
  },
  {
    id: 'unearthed-arcana',
    label: 'Unearthed Arcana',
    category: 'ua',
    aliases: ['ua', 'unearthed arcana'],
    description: 'Playtest material; no local source document is available yet, so no entries are bundled.',
    file: 'src/data/sourceFiles/unearthed-arcana.ts'
  },
  {
    id: 'monstrous-compendium-vol-1-spelljammer-creatures',
    label: 'Monstrous Compendium Vol. 1: Spelljammer Creatures',
    category: 'expansion',
    aliases: ['spelljammer creatures', 'monstrous compendium volume 1'],
    file: 'src/data/sourceFiles/monstrous-compendium-vol-1-spelljammer-creatures.ts'
  },
  {
    id: 'monstrous-compendium-vol-3-minecraft-creatures',
    label: 'Monstrous Compendium Vol. 3: Minecraft Creatures',
    category: 'expansion',
    aliases: ['minecraft creatures', 'monstrous compendium volume 3'],
    file: 'src/data/sourceFiles/monstrous-compendium-vol-3-minecraft-creatures.ts'
  },
  {
    id: 'homebrew',
    label: 'Homebrew',
    category: 'homebrew',
    aliases: ['homebrew', 'custom'],
    description: 'User-authored and private custom content.'
  }
];

const normalize = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').replaceAll(/\s+/g, ' ').trim();

const sourceSelectionFamilies: Record<string, string[]> = {
  'phb-2014': ['phb-2014', 'basic-rules-2014'],
  'basic-rules-2014': ['basic-rules-2014', 'phb-2014'],
  'phb-2024': ['phb-2024', 'basic-rules-2024'],
  'basic-rules-2024': ['basic-rules-2024', 'phb-2024']
};

const getEntryMatchCandidates = (entry: ContentSourceManifestEntry) => {
  return [entry.label, entry.id, ...(entry.aliases || [])].map(normalize);
};

const sourceEntryMatches = (sourceText: string | undefined, entry: ContentSourceManifestEntry) => {
  const normalizedSource = normalize(sourceText ?? '');
  if (!normalizedSource) return false;
  return getEntryMatchCandidates(entry).some((candidate) => normalizedSource.includes(candidate) || candidate.includes(normalizedSource));
};

export const resolveSourceId = (sourceId: string | undefined, sourceText: string | undefined) => {
  if (sourceId) {
    return sourceId;
  }

  const normalizedSource = normalize(sourceText ?? '');
  if (!normalizedSource) {
    return undefined;
  }

  // Prefer an exact label/alias match, then the longest partial overlap. Taking the first
  // partial match instead would let a short alias shadow a more specific sibling source —
  // e.g. "Basic Rules 2024" contains the 2014 alias "basic rules" and would resolve to the
  // wrong edition.
  let bestPartialId: string | undefined;
  let bestPartialLength = 0;

  for (const entry of contentSourceManifest) {
    for (const candidate of getEntryMatchCandidates(entry)) {
      if (candidate === normalizedSource) {
        return entry.id;
      }

      const isPartialMatch = normalizedSource.includes(candidate) || candidate.includes(normalizedSource);
      if (isPartialMatch && candidate.length > bestPartialLength) {
        bestPartialId = entry.id;
        bestPartialLength = candidate.length;
      }
    }
  }

  return bestPartialId;
};

export const sourceMatchesSelection = (
  sourceText: string | undefined,
  sourceId: string | undefined,
  selectedSourceIds: string[]
) => {
  if (selectedSourceIds.length === 0) return true;
  const resolvedSourceId = resolveSourceId(sourceId, sourceText);
  return selectedSourceIds.some((selectedId) => {
    const compatibleIds = sourceSelectionFamilies[selectedId] ?? [selectedId];

    // When the content's canonical source id is known, match strictly against the selected
    // family. Fuzzy text matching is only a fallback for content without a resolvable id;
    // using it here would wrongly match e.g. "Basic Rules (2024)" against the 2014 alias
    // "basic rules", so the two editions could not be filtered independently.
    if (resolvedSourceId) {
      return compatibleIds.includes(resolvedSourceId);
    }

    return compatibleIds.some((candidateId) => {
      const manifestEntry = contentSourceManifest.find((entry) => entry.id === candidateId);
      return manifestEntry ? sourceEntryMatches(sourceText, manifestEntry) : false;
    });
  });
};

export const getContentSourceLabel = (sourceId: string) => {
  return contentSourceManifest.find((entry) => entry.id === sourceId)?.label ?? sourceId;
};
