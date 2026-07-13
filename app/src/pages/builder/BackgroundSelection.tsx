import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { useContentLibrary } from '@/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight, Scroll } from 'lucide-react';
import { toast } from 'sonner';
import { SourceFilterBar } from '@/components/SourceFilterBar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sourceMatchesSelection } from '@/data/librarySources';
import { dedupeCanonicalContent, getBackgroundSelectionScore, getCanonicalContentKey } from '@/lib/contentSelection';

const EMPTY_SOURCE_IDS: string[] = [];

export function BackgroundSelection() {
  const [searchQuery, setSearchQuery] = useState('');
  const { builderState, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const selectedSourceIds = builderState.selectedSourceIds ?? EMPTY_SOURCE_IDS;
  const { backgrounds } = useContentLibrary();
  const navigate = useNavigate();

  const filteredBackgrounds = useMemo(() => {
    return dedupeCanonicalContent(
      backgrounds.filter((entry) => {
        const matchesSearch =
          entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.source.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch && sourceMatchesSelection(entry.source, entry.sourceId, selectedSourceIds);
      }),
      getBackgroundSelectionScore
    );
  }, [backgrounds, searchQuery, selectedSourceIds]);

  const selectedBackground = builderState.character?.backgroundId
    ? backgrounds.find((entry) => entry.id === builderState.character?.backgroundId)
    : undefined;
  const selectedBackgroundKey = selectedBackground ? getCanonicalContentKey(selectedBackground) : undefined;

  const isSelected = (entry: (typeof backgrounds)[number]) => getCanonicalContentKey(entry) === selectedBackgroundKey;

  const selectBackground = (backgroundId: string, allowDeselect = false) => {
    const candidateBackground = backgrounds.find((entry) => entry.id === backgroundId);
    if (!candidateBackground) {
      return;
    }

    const selected = getCanonicalContentKey(candidateBackground) === selectedBackgroundKey;
    updateBuilderCharacter({ backgroundId: selected && allowDeselect ? undefined : backgroundId });
    toast.success(selected && allowDeselect ? 'Background deselected' : 'Background selected');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose Your Background</h2>
        <p className="text-muted-foreground">
          Your background reveals where you came from and how you became an adventurer.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search backgrounds..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <SourceFilterBar selectedSourceIds={selectedSourceIds} onChange={(next) => updateBuilderState({ selectedSourceIds: next })} />

      <ScrollArea className="h-[32rem] rounded-lg border">
        <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredBackgrounds.map((bg) => (
            <Card
              key={bg.id}
              role="button"
              tabIndex={0}
              className={`cursor-pointer transition-all hover:border-primary ${
                isSelected(bg) ? 'border-primary ring-1 ring-primary' : ''
              }`}
              onClick={() => {
                selectBackground(bg.id);
                navigate(`/builder/background/${bg.id}`);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectBackground(bg.id);
                  navigate(`/builder/background/${bg.id}`);
                }
              }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Scroll className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{bg.name}</CardTitle>
                      <CardDescription className="text-xs">{bg.source}</CardDescription>
                    </div>
                  </div>
                  {isSelected(bg) && <Badge variant="default">Selected</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{bg.description}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Skills:</span> {bg.skillProficiencies.join(', ')}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={isSelected(bg) ? 'default' : 'outline'}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        selectBackground(bg.id, true);
                      }}
                    >
                      {isSelected(bg) ? 'Selected' : 'Select'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/builder/background/${bg.id}`);
                      }}
                    >
                      Details
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>

      {filteredBackgrounds.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No backgrounds found matching your search.
        </div>
      )}
    </div>
  );
}
