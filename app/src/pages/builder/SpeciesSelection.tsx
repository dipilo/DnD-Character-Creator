import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { useContentLibrary } from '@/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight, User } from 'lucide-react';
import { toast } from 'sonner';
import { SourceFilterBar } from '@/components/SourceFilterBar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sourceMatchesSelection } from '@/data/librarySources';
import { getRulesEdition, getRulesEditionLabel } from '@/lib/builderRules';
import { dedupeCanonicalContent, getCanonicalContentKey, getSpeciesSelectionScore } from '@/lib/contentSelection';

const EMPTY_SOURCE_IDS: string[] = [];

export function SpeciesSelection() {
  const [searchQuery, setSearchQuery] = useState('');
  const { builderState, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const selectedSourceIds = builderState.selectedSourceIds ?? EMPTY_SOURCE_IDS;
  const { species } = useContentLibrary();
  const navigate = useNavigate();

  const filteredSpecies = useMemo(() => {
    return dedupeCanonicalContent(
      species.filter((entry) => {
        const matchesSearch =
          entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.source.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch && sourceMatchesSelection(entry.source, entry.sourceId, selectedSourceIds);
      }),
      getSpeciesSelectionScore
    );
  }, [searchQuery, selectedSourceIds, species]);

  const selectedSpecies = builderState.character?.speciesId
    ? species.find((entry) => entry.id === builderState.character?.speciesId)
    : undefined;
  const selectedSpeciesKey = selectedSpecies ? getCanonicalContentKey(selectedSpecies) : undefined;

  const groupedSpecies = useMemo(() => {
    return {
      '2024': filteredSpecies.filter((entry) => getRulesEdition(entry.sourceId, entry.source) === '2024'),
      '2014': filteredSpecies.filter((entry) => getRulesEdition(entry.sourceId, entry.source) === '2014'),
      unknown: filteredSpecies.filter((entry) => getRulesEdition(entry.sourceId, entry.source) === 'unknown')
    };
  }, [filteredSpecies]);

  const isSelected = (entry: (typeof species)[number]) => getCanonicalContentKey(entry) === selectedSpeciesKey;

  const selectSpecies = (speciesId: string, allowDeselect = false) => {
    const candidateSpecies = species.find((entry) => entry.id === speciesId);
    if (!candidateSpecies) {
      return;
    }

    const selected = getCanonicalContentKey(candidateSpecies) === selectedSpeciesKey;
    updateBuilderCharacter({
      speciesId: selected && allowDeselect ? undefined : speciesId,
      variantId: selected && allowDeselect ? undefined : builderState.character?.variantId
    });
    toast.success(selected && allowDeselect ? 'Species deselected' : 'Species selected');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose Your Species</h2>
        <p className="text-muted-foreground">
          Select a species.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search species..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <SourceFilterBar selectedSourceIds={selectedSourceIds} onChange={(next) => updateBuilderState({ selectedSourceIds: next })} />

      <ScrollArea className="h-[32rem] rounded-lg border">
        <div className="space-y-6 p-4">
          {(['2024', '2014', 'unknown'] as const).map((edition) => {
            const entries = groupedSpecies[edition];
            if (entries.length === 0) {
              return null;
            }

            return (
              <div key={edition} className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{edition === 'unknown' ? 'Other Sources' : `${edition} Species`}</h3>
                  <Badge variant="outline">{entries.length}</Badge>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {entries.map((s) => (
                    <Card
                      key={s.id}
                      role="button"
                      tabIndex={0}
                      className={`cursor-pointer transition-all hover:border-primary ${
                        isSelected(s) ? 'border-primary ring-1 ring-primary' : ''
                      }`}
                      onClick={() => {
                        selectSpecies(s.id);
                        navigate(`/builder/species/${s.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectSpecies(s.id);
                          navigate(`/builder/species/${s.id}`);
                        }
                      }}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{s.name}</CardTitle>
                              <CardDescription className="text-xs">{s.source}</CardDescription>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Badge variant="outline">{getRulesEditionLabel(s.sourceId, s.source)}</Badge>
                              </div>
                            </div>
                          </div>
                          {isSelected(s) && <Badge variant="default">Selected</Badge>}
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Size:</span> {s.size} • <span className="font-medium">Speed:</span> {s.speed}ft
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant={isSelected(s) ? 'default' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectSpecies(s.id, true);
                              }}
                            >
                              {isSelected(s) ? 'Selected' : 'Select'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/builder/species/${s.id}`);
                              }}
                            >
                              Details
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {s.variants && s.variants.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground">
                              Variants: {s.variants.map((v) => v.name).join(', ')}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {filteredSpecies.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No species found matching your search.
        </div>
      )}
    </div>
  );
}
