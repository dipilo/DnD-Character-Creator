import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { useContentLibrary } from '@/data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronRight, Sword } from 'lucide-react';
import { toast } from 'sonner';
import { SourceFilterBar } from '@/components/SourceFilterBar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { sourceMatchesSelection } from '@/data/librarySources';
import { canMixClassEditions, getRulesEdition, getRulesEditionLabel, getSelectedClassEdition, type SelectedClassWithLevel } from '@/lib/builderRules';
import { dedupeCanonicalContent, getCanonicalContentKey, getClassSelectionScore } from '@/lib/contentSelection';

const EMPTY_SOURCE_IDS: string[] = [];

export function ClassSelection() {
  const [searchQuery, setSearchQuery] = useState('');
  const { builderState, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const selectedSourceIds = builderState.selectedSourceIds ?? EMPTY_SOURCE_IDS;
  const { classes } = useContentLibrary();
  const navigate = useNavigate();

  const selectedClasses = useMemo<SelectedClassWithLevel[]>(() => {
    return (builderState.character?.classes || [])
      .map((entry) => {
        const cls = classes.find((candidate) => candidate.id === entry.classId);
        return cls ? { cls, level: entry.level } : undefined;
      })
      .filter((entry): entry is SelectedClassWithLevel => Boolean(entry));
  }, [builderState.character?.classes, classes]);

  const lockedEdition = getSelectedClassEdition(selectedClasses);

  const filteredClasses = useMemo(() => {
    return dedupeCanonicalContent(
      classes.filter((entry) => {
        const matchesSearch =
          entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          entry.source.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesEdition = canMixClassEditions(selectedClasses, entry);
        return matchesSearch && sourceMatchesSelection(entry.source, entry.sourceId, selectedSourceIds) && matchesEdition;
      }),
      getClassSelectionScore
    );
  }, [classes, searchQuery, selectedClasses, selectedSourceIds]);

  const selectedClassKeys = useMemo(() => {
    return new Set(selectedClasses.map(({ cls }) => getCanonicalContentKey(cls)));
  }, [selectedClasses]);

  const groupedClasses = useMemo(() => {
    return {
      '2024': filteredClasses.filter((entry) => getRulesEdition(entry.sourceId, entry.source) === '2024'),
      '2014': filteredClasses.filter((entry) => getRulesEdition(entry.sourceId, entry.source) === '2014'),
      unknown: filteredClasses.filter((entry) => getRulesEdition(entry.sourceId, entry.source) === 'unknown')
    };
  }, [filteredClasses]);

  const isSelected = (candidateClass: (typeof classes)[number]) => selectedClassKeys.has(getCanonicalContentKey(candidateClass));

  const toggleClass = (classId: string, allowDeselect = false) => {
    const existing = builderState.character?.classes || [];
    const candidateClass = classes.find((entry) => entry.id === classId);
    if (!candidateClass) {
      return;
    }

    const candidateKey = getCanonicalContentKey(candidateClass);
    const matchingClassIds = new Set(
      classes
        .filter((entry) => getCanonicalContentKey(entry) === candidateKey)
        .map((entry) => entry.id)
    );
    const selected = existing.some((entry) => matchingClassIds.has(entry.classId));

    if (!selected && !canMixClassEditions(selectedClasses, candidateClass)) {
      toast.error('You cannot multiclass across 2014 and 2024 class rulesets.');
      return;
    }

    let nextClasses = existing;
    if (selected && allowDeselect) {
      nextClasses = existing.filter((entry) => !matchingClassIds.has(entry.classId));
    } else if (!selected) {
      nextClasses = [...existing.filter((entry) => !matchingClassIds.has(entry.classId)), { classId, level: 1, hitDiceUsed: 0 }];
    }

    updateBuilderCharacter({
      classes: nextClasses
    });
    toast.success(selected && allowDeselect ? 'Class deselected' : 'Class selected');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose Your Class</h2>
        <p className="text-muted-foreground">
          Select a class to define your character's abilities and role in the party.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search classes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <SourceFilterBar selectedSourceIds={selectedSourceIds} onChange={(next) => updateBuilderState({ selectedSourceIds: next })} />

      {lockedEdition !== 'unknown' && (
        <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
          Multiclass lock active: only {lockedEdition === '2014' ? '2014 Rules' : '2024 Rules'} classes are available until you remove the current class set.
        </div>
      )}

      {(['2024', '2014', 'unknown'] as const).map((edition) => {
        const entries = groupedClasses[edition];
        if (entries.length === 0) {
          return null;
        }

        return (
          <div key={edition} className="space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">{edition === 'unknown' ? 'Other Sources' : `${edition} Classes`}</h3>
              <Badge variant="outline">{entries.length}</Badge>
            </div>
            <ScrollArea className="h-[32rem] rounded-lg border">
              <div className="grid gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
                {entries.map((cls) => (
                  <Card
                    key={cls.id}
                    role="button"
                    tabIndex={0}
                    className={`cursor-pointer transition-all hover:border-primary ${
                      isSelected(cls) ? 'border-primary ring-1 ring-primary' : ''
                    }`}
                    onClick={() => {
                      toggleClass(cls.id);
                      navigate(`/builder/class/${cls.id}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleClass(cls.id);
                        navigate(`/builder/class/${cls.id}`);
                      }
                    }}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <Sword className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{cls.name}</CardTitle>
                            <CardDescription className="text-xs">{cls.source}</CardDescription>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="outline">{getRulesEditionLabel(cls.sourceId, cls.source)}</Badge>
                            </div>
                          </div>
                        </div>
                        {isSelected(cls) && <Badge variant="default">Selected</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">{cls.description}</p>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Hit Die:</span> d{cls.hitDie} • <span className="font-medium">Subclasses:</span> {cls.subclasses.length}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant={isSelected(cls) ? 'default' : 'outline'}
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleClass(cls.id, true);
                            }}
                          >
                            {isSelected(cls) ? 'Selected' : 'Select'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/builder/class/${cls.id}`);
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
          </div>
        );
      })}

      {filteredClasses.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No classes found matching your search.
        </div>
      )}
    </div>
  );
}
