import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { useContentLibrary } from '@/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, ChevronDown, ChevronRight, User } from 'lucide-react';
import { toast } from 'sonner';
import { SourceFilterBar } from '@/components/SourceFilterBar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SpeciesLineageList } from '@/components/builder/SpeciesLineageList';
import { sourceMatchesSelection } from '@/data/librarySources';
import { getRulesEdition, getRulesEditionLabel } from '@/lib/builderRules';
import { dedupeCanonicalContent, getSpeciesSelectionScore } from '@/lib/contentSelection';
import { collectGroupSpeciesIds, groupSpeciesByBase, parseSpeciesLineage, type SpeciesGroup, type SpeciesLineageNode } from '@/lib/speciesGroups';
import type { Species } from '@/types/dnd';

const EMPTY_SOURCE_IDS: string[] = [];
const EDITIONS = ['2024', '2014', 'unknown'] as const;
type Edition = (typeof EDITIONS)[number];

const matchesQuery = (value: string | undefined, query: string) =>
  typeof value === 'string' && value.toLowerCase().includes(query);

const lineageMatches = (nodes: SpeciesLineageNode[], query: string): boolean =>
  nodes.some((node) => matchesQuery(node.name, query) || lineageMatches(node.children, query));

const firstSelectable = (nodes: SpeciesLineageNode[]): Species | undefined => {
  for (const node of nodes) {
    if (node.species) {
      return node.species;
    }
    const nested = firstSelectable(node.children);
    if (nested) {
      return nested;
    }
  }
  return undefined;
};

export function SpeciesSelection() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
  const { builderState, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const selectedSourceIds = builderState.selectedSourceIds ?? EMPTY_SOURCE_IDS;
  const { species } = useContentLibrary();
  const navigate = useNavigate();

  const selectedSpeciesId = builderState.character?.speciesId;
  const selectedVariantId = builderState.character?.variantId;

  const availableSpecies = useMemo(() => dedupeCanonicalContent(
    species.filter((entry) => sourceMatchesSelection(entry.source, entry.sourceId, selectedSourceIds)),
    getSpeciesSelectionScore
  ), [selectedSourceIds, species]);

  // Grouped inside each edition section, so a 2024 base never collects a 2014 book's lineages.
  const groupedByEdition = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sections = {} as Record<Edition, SpeciesGroup[]>;

    for (const edition of EDITIONS) {
      const groups = groupSpeciesByBase(
        availableSpecies.filter((entry) => getRulesEdition(entry.sourceId, entry.source) === edition)
      );
      sections[edition] = query
        ? groups.filter((group) => matchesQuery(group.name, query)
          || group.sources.some((source) => matchesQuery(source, query))
          || lineageMatches(group.lineages, query))
        : groups;
    }

    return sections;
  }, [availableSpecies, searchQuery]);

  const totalGroups = EDITIONS.reduce((total, edition) => total + groupedByEdition[edition].length, 0);

  const selectSpecies = (entry: Species, variantId?: string) => {
    const variant = variantId ? entry.variants?.find((candidate) => candidate.id === variantId) : undefined;
    const sizeOptions = variant?.sizeOptions ?? entry.sizeOptions ?? [entry.size];
    updateBuilderCharacter({
      speciesId: entry.id,
      variantId,
      size: sizeOptions[0] ?? entry.size,
      speciesLanguageSelections: []
    });
    toast.success(`${variant?.name ?? entry.name} selected`);
  };

  const clearSelection = () => {
    updateBuilderCharacter({ speciesId: undefined, variantId: undefined, size: undefined, speciesLanguageSelections: [] });
    toast.success('Species deselected');
  };

  const selectLineage = (node: SpeciesLineageNode) => {
    if (node.variant && node.owner) {
      if (node.owner.id === selectedSpeciesId && node.variant.id === selectedVariantId) {
        clearSelection();
        return;
      }
      selectSpecies(node.owner, node.variant.id);
      return;
    }

    if (!node.species) {
      return;
    }

    if (node.species.id === selectedSpeciesId && !selectedVariantId) {
      clearSelection();
      return;
    }

    selectSpecies(node.species);
  };

  // The pick is stored as one entry's id, which the source filter or the dedupe may have dropped
  // from this list; the base name it was printed under still names its card.
  const selectedPrinting = useMemo(() => {
    const selected = species.find((entry) => entry.id === selectedSpeciesId);
    return selected
      ? {
        key: parseSpeciesLineage(selected.name).base.toLowerCase(),
        edition: getRulesEdition(selected.sourceId, selected.source)
      }
      : undefined;
  }, [selectedSpeciesId, species]);

  const isGroupSelected = (group: SpeciesGroup, edition: Edition) =>
    (typeof selectedSpeciesId === 'string' && collectGroupSpeciesIds(group).includes(selectedSpeciesId))
    || (group.key === selectedPrinting?.key && edition === selectedPrinting.edition);

  const groupIsExpanded = (group: SpeciesGroup, edition: Edition) =>
    expandedGroups.includes(group.key) || searchQuery.trim().length > 0 || isGroupSelected(group, edition);

  const toggleGroup = (group: SpeciesGroup) => setExpandedGroups((current) =>
    current.includes(group.key) ? current.filter((key) => key !== group.key) : [...current, group.key]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose Your Species</h2>
        <p className="text-muted-foreground">
          Pick a species, then its lineage where a book prints them.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search species and lineages..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
        />
      </div>

      <SourceFilterBar selectedSourceIds={selectedSourceIds} onChange={(next) => updateBuilderState({ selectedSourceIds: next })} />

      <ScrollArea className="h-[32rem] rounded-lg border">
        <div className="space-y-6 p-4">
          {EDITIONS.map((edition) => {
            const groups = groupedByEdition[edition];
            if (groups.length === 0) {
              return null;
            }

            return (
              <div key={edition} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{edition === 'unknown' ? 'Other Sources' : `${edition} Species`}</h3>
                  <Badge variant="outline">{groups.length}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {groups.map((group) => (
                    <SpeciesGroupCard
                      key={group.key}
                      group={group}
                      expanded={groupIsExpanded(group, edition)}
                      selected={isGroupSelected(group, edition)}
                      selectedSpeciesId={selectedSpeciesId}
                      selectedVariantId={selectedVariantId}
                      onToggle={() => toggleGroup(group)}
                      onSelectBase={() => {
                        if (!group.base) {
                          return;
                        }
                        if (group.base.id === selectedSpeciesId && !selectedVariantId) {
                          clearSelection();
                          return;
                        }
                        selectSpecies(group.base);
                      }}
                      onSelectLineage={selectLineage}
                      onShowDetails={(entry) => navigate(`/builder/species/${entry.id}`)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {totalGroups === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No species found matching your search.
        </div>
      )}
    </div>
  );
}

interface SpeciesGroupCardProps {
  group: SpeciesGroup;
  expanded: boolean;
  selected: boolean;
  selectedSpeciesId?: string;
  selectedVariantId?: string;
  onToggle: () => void;
  onSelectBase: () => void;
  onSelectLineage: (node: SpeciesLineageNode) => void;
  onShowDetails: (entry: Species) => void;
}

function SpeciesGroupCard({
  group,
  expanded,
  selected,
  selectedSpeciesId,
  selectedVariantId,
  onToggle,
  onSelectBase,
  onSelectLineage,
  onShowDetails
}: SpeciesGroupCardProps) {
  const lineageCount = group.base ? group.selectableCount - 1 : group.selectableCount;
  // The traits on the card are the base's. With no base printed they are a lineage's, and the
  // card says whose rather than reading as the species' own.
  const shown = group.base ?? firstSelectable(group.lineages);
  const previewLineage = shown && !group.base ? parseSpeciesLineage(shown.name).path.join(' — ') : undefined;
  const baseSelected = Boolean(group.base) && group.base?.id === selectedSpeciesId && !selectedVariantId;

  return (
    <Card className={selected ? 'border-primary ring-1 ring-primary' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">{group.name}</CardTitle>
              <CardDescription className="truncate text-xs">{group.sources.join(', ')}</CardDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                {shown && <Badge variant="outline">{getRulesEditionLabel(shown.sourceId, shown.source)}</Badge>}
                {lineageCount > 0 && <Badge variant="secondary">{lineageCount} lineages</Badge>}
              </div>
            </div>
          </div>
          {selected && <Badge variant="default">Selected</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {shown && <p className="line-clamp-2 text-sm text-muted-foreground">{shown.description}</p>}
        {shown && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Size:</span> {shown.size} • <span className="font-medium">Speed:</span> {shown.speed}ft
            {previewLineage && <> — from the {previewLineage} lineage; no book here prints a plain {group.name}.</>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {group.base && (
            <Button variant={baseSelected ? 'default' : 'outline'} size="sm" onClick={onSelectBase}>
              {baseSelected ? 'Selected' : lineageCount > 0 ? 'Select Base' : 'Select'}
            </Button>
          )}
          {shown && (
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => onShowDetails(group.base ?? shown)}>
              Details
              <ChevronRight className="h-3 w-3" />
            </Button>
          )}
        </div>

        {lineageCount > 0 && (
          <Collapsible open={expanded} onOpenChange={onToggle}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-full justify-between px-2">
                {expanded ? 'Hide lineages' : `Choose a lineage (${lineageCount})`}
                <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-1">
              <SpeciesLineageList
                nodes={group.lineages}
                selectedSpeciesId={selectedSpeciesId}
                selectedVariantId={selectedVariantId}
                onSelect={onSelectLineage}
                onShowDetails={(node) => node.species && onShowDetails(node.species)}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
