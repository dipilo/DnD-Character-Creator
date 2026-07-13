import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { getContentSourceLabel, getRuntimeClassById, getRuntimeSubclass } from '@/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { resolveCharacterClasses, sortFeaturesByLevel } from '@/lib/builderRules';
import { getDescriptionPreview } from '@/lib/contentPresentation';

const getSourceLabel = (sourceId?: string, sourceText?: string) => {
  if (sourceText?.trim()) {
    return sourceText;
  }

  return sourceId ? getContentSourceLabel(sourceId) : 'Unknown Source';
};

export function SubclassSelection() {
  const navigate = useNavigate();
  const { builderState, updateBuilderCharacter } = useCharacterStore();
  const [inspectedSubclasses, setInspectedSubclasses] = useState<Record<string, string>>({});

  const resolvedClasses = useMemo(() => {
    return resolveCharacterClasses({
      classes: builderState.character?.classes ?? [],
      getClassById: getRuntimeClassById,
      getSubclassById: getRuntimeSubclass
    });
  }, [builderState.character?.classes]);

  if (resolvedClasses.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Please select at least one class first.</p>
        <Button onClick={() => navigate('/builder/class')} className="mt-4">
          Go to Class Selection
        </Button>
      </div>
    );
  }

  const handleSelectSubclass = (classId: string, subclassId: string) => {
    updateBuilderCharacter({
      classes: (builderState.character?.classes ?? []).map((entry) => {
        if (entry.classId !== classId) {
          return entry;
        }

        return {
          ...entry,
          subclassId
        };
      })
    });

    const selectedSubclass = getRuntimeSubclass(classId, subclassId);
    toast.success(selectedSubclass ? `${selectedSubclass.name} selected` : 'Subclass updated');
  };

  const setInspectedSubclass = (classId: string, subclassId: string) => {
    setInspectedSubclasses((current) => ({ ...current, [classId]: subclassId }));
  };

  const activateSubclassCard = (classId: string, subclassId: string, selected: boolean) => {
    setInspectedSubclass(classId, subclassId);
    if (!selected) {
      handleSelectSubclass(classId, subclassId);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Choose Subclasses</h2>
        <p className="text-muted-foreground">
          Each selected class can choose its own subclass once it reaches the class level where that specialization unlocks.
        </p>
      </div>

      <div className="space-y-6">
        {resolvedClasses.map(({ entry, cls, subclass }) => {
          const unlocked = entry.level >= cls.subclassLevel;
          const inspectedSubclass = cls.subclasses.find((candidate) => candidate.id === inspectedSubclasses[cls.id]) ?? subclass ?? cls.subclasses[0];

          return (
            <Card key={cls.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{cls.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Level {entry.level} class. Subclass unlocks at level {cls.subclassLevel}.
                    </p>
                  </div>
                  {subclass ? <Badge>{subclass.name}</Badge> : <Badge variant="outline">No subclass selected</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                {unlocked ? (
                  <ScrollArea className="h-[32rem] rounded-lg border">
                    <div className="space-y-4 p-4">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {cls.subclasses.map((candidate) => {
                          const selected = entry.subclassId === candidate.id;
                          const previewFeatures = sortFeaturesByLevel(candidate.features).slice(0, 3);
                          const inspecting = inspectedSubclass?.id === candidate.id;
                          let cardStateClassName = '';
                          if (selected) {
                            cardStateClassName = 'border-primary ring-1 ring-primary';
                          } else if (inspecting) {
                            cardStateClassName = 'ring-1 ring-ring/40';
                          }

                          return (
                            <Card
                              key={candidate.id}
                              className={`cursor-pointer overflow-hidden transition-all hover:border-primary ${cardStateClassName}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => activateSubclassCard(cls.id, candidate.id, selected)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  activateSubclassCard(cls.id, candidate.id, selected);
                                }
                              }}
                            >
                              <CardHeader className="space-y-4 pb-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="space-y-2">
                                    <Badge variant="outline">{cls.name}</Badge>
                                    <CardTitle className="text-base">{candidate.name}</CardTitle>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {inspecting && !selected && <Badge variant="outline">Preview</Badge>}
                                    {selected && (
                                      <Badge variant="default" className="gap-1">
                                        <Check className="h-3 w-3" />
                                        Selected
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                <div className="rounded-lg border bg-muted/30 p-4">
                                  <p className="text-sm leading-6 text-muted-foreground">{getDescriptionPreview(candidate.description)}</p>
                                </div>
                                {previewFeatures.length > 0 && (
                                  <div className="space-y-3">
                                    <p className="text-sm font-medium">Features</p>
                                    <div className="grid gap-2">
                                      {previewFeatures.map((feature) => (
                                        <div key={feature.id} className="rounded-lg border bg-background/80 p-3 text-sm text-muted-foreground">
                                          <div className="mb-1 flex items-center justify-between gap-2">
                                            <span className="font-medium text-foreground">{feature.name}</span>
                                            <Badge variant="outline" className="text-xs">Level {feature.level}</Badge>
                                          </div>
                                                <p><ContentReferenceText text={getDescriptionPreview(feature.description, 1)} /></p>
                                        </div>
                                      ))}
                                    </div>
                                    {candidate.features.length > previewFeatures.length && (
                                      <p className="text-sm text-muted-foreground">And {candidate.features.length - previewFeatures.length} more features...</p>
                                    )}
                                  </div>
                                )}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="w-fit"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setInspectedSubclass(cls.id, candidate.id);
                                    navigate(`/builder/subclass/${cls.id}/${candidate.id}`);
                                  }}
                                >
                                  View Details
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      {inspectedSubclass && (
                        <Card>
                          <CardHeader>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <CardTitle className="text-lg">{inspectedSubclass.name}</CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">{getSourceLabel(inspectedSubclass.sourceId ?? cls.sourceId, inspectedSubclass.source ?? cls.source)}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => navigate(`/builder/subclass/${cls.id}/${inspectedSubclass.id}`)}
                                >
                                  Open Details
                                </Button>
                                <Button
                                  variant={entry.subclassId === inspectedSubclass.id ? 'default' : 'outline'}
                                  disabled={entry.subclassId === inspectedSubclass.id}
                                  onClick={() => handleSelectSubclass(cls.id, inspectedSubclass.id)}
                                >
                                  {entry.subclassId === inspectedSubclass.id ? 'Selected' : 'Select'}
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="rounded-lg border bg-muted/30 p-4">
                              <p className="text-sm leading-6 text-muted-foreground"><ContentReferenceText text={inspectedSubclass.description} /></p>
                            </div>
                            <div className="space-y-3">
                              {sortFeaturesByLevel(inspectedSubclass.features).map((feature) => (
                                <div key={feature.id} className="border-b pb-4 last:border-0 last:pb-0">
                                  <div className="mb-1 flex items-center gap-2">
                                    <span className="font-medium">{feature.name}</span>
                                    <Badge variant="outline" className="text-xs">Level {feature.level}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground"><ContentReferenceText text={feature.description} /></p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                    {cls.name} does not choose a subclass until level {cls.subclassLevel}.
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => navigate('/builder/background')}>
          Continue to Background
        </Button>
      </div>
    </div>
  );
}
