import type { Species, SpeciesVariant } from '@/types/dnd';

// A lineage reaches the library two ways: nested in its race's `variants` when one book printed
// both, and as a species of its own named "Race (Lineage)" when the subrace was adopted from a
// book that did not print the race. Both read as one tree here so the picker shows one card.

const LINEAGE_MARKER = /^variants?$/i;

/** "Dragonborn (Chromatic; Black)" is the Black lineage of Dragonborn's Chromatic branch. */
export const parseSpeciesLineage = (name: string): { base: string; path: string[] } => {
  const match = /^(.+?)\s*\(([^()]*)\)\s*$/.exec(String(name ?? ''));
  if (!match) return { base: String(name ?? '').trim(), path: [] };

  const stated = match[2].split(';').map((part) => part.trim()).filter(Boolean);
  const path = LINEAGE_MARKER.test(stated[0] ?? '') ? stated.slice(1) : stated;
  if (path.length === 0) return { base: String(name).trim(), path: [] };
  return { base: match[1].trim(), path };
};

export interface SpeciesLineageNode {
  key: string;
  /** The segment this node adds, not the whole printed name. */
  name: string;
  path: string[];
  /** The species to select. Absent on a branch the book prints only as a heading. */
  species?: Species;
  /** Set when the lineage is nested in `species.variants` rather than a species of its own. */
  owner?: Species;
  variant?: SpeciesVariant;
  children: SpeciesLineageNode[];
}

export interface SpeciesGroup {
  key: string;
  name: string;
  /** The entry printed with no lineage, when the filtered library kept one. */
  base?: Species;
  lineages: SpeciesLineageNode[];
  /** How many entries in this group a player can actually pick, base included. */
  selectableCount: number;
  sources: string[];
}

const findOrAddChild = (siblings: SpeciesLineageNode[], name: string, path: string[]) => {
  const existing = siblings.find((node) => node.name === name);
  if (existing) return existing;
  const added: SpeciesLineageNode = { key: path.join(' > '), name, path, children: [] };
  siblings.push(added);
  return added;
};

const addLineage = (roots: SpeciesLineageNode[], path: string[], leaf: Partial<SpeciesLineageNode>) => {
  let siblings = roots;
  let node: SpeciesLineageNode | undefined;
  path.forEach((segment, index) => {
    node = findOrAddChild(siblings, segment, path.slice(0, index + 1));
    siblings = node.children;
  });
  if (!node) return;

  // A lineage printed as a species of its own carries more than the nested record of the same
  // name, so it wins whichever arrived first.
  if (leaf.species && !node.species) {
    node.species = leaf.species;
    node.variant = undefined;
    node.owner = undefined;
    return;
  }
  if (leaf.variant && !node.species && !node.variant) {
    node.variant = leaf.variant;
    node.owner = leaf.owner;
  }
};

// A branch is the heading its lineages sit under, never a pick of its own, so it is not counted.
const countSelectable = (nodes: SpeciesLineageNode[]): number => nodes.reduce(
  (total, node) => total
    + (node.children.length === 0 && (node.species || node.variant) ? 1 : 0)
    + countSelectable(node.children),
  0
);

const sortTree = (nodes: SpeciesLineageNode[]): SpeciesLineageNode[] => nodes
  .map((node) => ({ ...node, children: sortTree(node.children) }))
  .sort((left, right) => left.name.localeCompare(right.name));

/**
 * One group per base species name, in the order the entries arrive, so the sections the picker
 * already splits by rules edition keep their own grouping.
 */
export const groupSpeciesByBase = (entries: Species[]): SpeciesGroup[] => {
  const groups = new Map<string, SpeciesGroup>();

  for (const entry of entries) {
    const { base, path } = parseSpeciesLineage(entry.name);
    const key = base.toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { key, name: base, lineages: [], selectableCount: 0, sources: [] });
    }
    const group = groups.get(key)!;
    if (!group.sources.includes(entry.source)) group.sources.push(entry.source);

    if (path.length === 0) {
      // Two printings of the same base reach one section only when the dedupe missed them; the
      // first one wins so the card does not change under the player as the filter changes.
      group.base ??= entry;
    } else {
      addLineage(group.lineages, path, { species: entry });
    }

    // A nested variant hangs off whichever entry states it, base or lineage.
    for (const variant of entry.variants ?? []) {
      addLineage(group.lineages, [...path, variant.name], { owner: entry, variant });
    }
  }

  return [...groups.values()].map((group) => ({
    ...group,
    lineages: sortTree(group.lineages),
    selectableCount: (group.base ? 1 : 0) + countSelectable(group.lineages)
  }));
};

/** Every species id in a group, so a selection made anywhere in it reads as selected on the card. */
export const collectGroupSpeciesIds = (group: SpeciesGroup): string[] => {
  const ids: string[] = group.base ? [group.base.id] : [];
  const walk = (nodes: SpeciesLineageNode[]) => {
    for (const node of nodes) {
      if (node.species) ids.push(node.species.id);
      if (node.owner) ids.push(node.owner.id);
      walk(node.children);
    }
  };
  walk(group.lineages);
  return [...new Set(ids)];
};

/** The group a species belongs to, for the sibling list on its details page. */
export const findSpeciesGroup = (groups: SpeciesGroup[], species: Species) => {
  const { base } = parseSpeciesLineage(species.name);
  return groups.find((group) => group.key === base.toLowerCase());
};

/** Whether the printed entry is a heading the book expects a lineage to be chosen under. */
export const isLineageBranch = (node: SpeciesLineageNode) => node.children.length > 0;

/**
 * The group's tree with the lineages `speciesId` states in its own `variants` removed: those get
 * the panel that prints their description and increases, so listing them twice says less, not more.
 */
export const lineagesBesideVariantsOf = (nodes: SpeciesLineageNode[], speciesId: string): SpeciesLineageNode[] => nodes
  .filter((node) => !(node.variant && node.owner?.id === speciesId))
  .map((node) => ({ ...node, children: lineagesBesideVariantsOf(node.children, speciesId) }))
  .filter((node) => node.species || node.variant || node.children.length > 0);

/** The node a printed name resolves to inside its group, for the lineages it stands over. */
export const findLineageNode = (nodes: SpeciesLineageNode[], path: string[]): SpeciesLineageNode | undefined => {
  if (path.length === 0) return undefined;
  const [segment, ...rest] = path;
  const node = nodes.find((candidate) => candidate.name === segment);
  if (!node) return undefined;
  return rest.length === 0 ? node : findLineageNode(node.children, rest);
};
