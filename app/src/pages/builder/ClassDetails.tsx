import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { getContentSourceLabel, getRuntimeClassById, getRuntimeSubclass } from '@/data';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FeatureOptionSelector } from '@/components/builder/FeatureOptionSelector';
import { ToolProficiencyChoices } from '@/components/builder/ToolProficiencyChoices';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { ArrowLeft, Check, Shield, Sword, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { canMixClassEditions, getRulesEditionLabel, getToolChoiceIdPrefix, sortFeaturesByLevel, type SelectedClassWithLevel } from '@/lib/builderRules';
import { getDescriptionPreview } from '@/lib/contentPresentation';
import { getSelectedFeatureOptionIds, updateFeatureOptionSelections } from '@/lib/featureOptions';

const getOrdinalLevelLabel = (levelIndex: number) => {
  if (levelIndex === 0) return '1st';
  if (levelIndex === 1) return '2nd';
  if (levelIndex === 2) return '3rd';
  return `${levelIndex + 1}th`;
};

const getSourceLabel = (sourceId?: string, sourceText?: string) => {
  if (sourceText?.trim()) {
    return sourceText;
  }

  return sourceId ? getContentSourceLabel(sourceId) : 'Unknown Source';
};

export function ClassDetails() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { builderState, updateBuilderCharacter } = useCharacterStore();

  const cls = classId ? getRuntimeClassById(classId) : undefined;
  // The character stores whichever class id was current when it was saved, and the URL carries
  // whichever id the class list is showing now. Matching on the raw id alone silently missed the
  // entry, so the page fell back to level 1 and showed only 1st-level features next to a
  // Subclasses tab that lists every level — resolve through the class the id actually points at.
  const classEntry = builderState.character?.classes?.find((entry) => {
    return entry.classId === classId || (cls && getRuntimeClassById(entry.classId)?.id === cls.id);
  });
  const isSelected = !!classEntry;
  const selectedSubclass = classEntry?.subclassId ? getRuntimeSubclass(cls?.id ?? '', classEntry.subclassId) : undefined;
  const characterLevel = classEntry?.level || 1;
  const selectedSkills = builderState.character?.proficiencies?.skills || [];
  const selectedFeatureChoices = builderState.character?.features || [];
  const availableTabs = cls?.spellcasting
    ? ['features', 'subclasses', 'proficiencies', 'spellcasting']
    : ['features', 'subclasses', 'proficiencies'];
  const activeTab = availableTabs.includes(searchParams.get('tab') ?? '')
    ? searchParams.get('tab') ?? 'features'
    : 'features';
  const activeSubclassId = searchParams.get('subclass')
    ?? selectedSubclass?.id
    ?? cls?.subclasses[0]?.id;
  const selectedClasses = (builderState.character?.classes || [])
    .map((entry) => {
      const selectedClass = getRuntimeClassById(entry.classId);
      return selectedClass ? { cls: selectedClass, level: entry.level } : undefined;
    })
    .filter((entry): entry is SelectedClassWithLevel => Boolean(entry));

  const allFeatureNamesById = new Map(
    [...cls?.features ?? [], ...selectedSubclass?.features ?? [], ...cls?.subclasses.flatMap((subclass) => subclass.features) ?? []]
      .map((feature) => [feature.id, feature.name])
  );
  const featureSelectionContext = {
    level: characterLevel,
    selectedFeatureChoices,
    selectedSpellIds: (builderState.character?.spells ?? []).map((entry) => entry.spellId)
  };

  if (!cls) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Class not found.</p>
        <Button onClick={() => navigate('/builder/class')} className="mt-4">
          Back to Classes
        </Button>
      </div>
    );
  }

  const setClassEntry = (updater: (current: NonNullable<typeof classEntry>) => NonNullable<typeof classEntry> | undefined) => {
    const existing = builderState.character?.classes || [];
    const nextEntry = classEntry
      ? updater({ ...classEntry, classId: cls.id })
      : updater({ classId: cls.id, level: 1, hitDiceUsed: 0 });

    // Drop the entry under whichever id it was stored with, then re-add it under the current one.
    const nextClasses = existing.filter((entry) => entry !== classEntry && entry.classId !== cls.id);
    if (nextEntry) nextClasses.push(nextEntry);
    updateBuilderCharacter({ classes: nextClasses });
  };

  const handleSelectClass = () => {
    if (isSelected) {
      setClassEntry(() => undefined);
      toast.success(`${cls.name} deselected`);
      return;
    }

    if (!canMixClassEditions(selectedClasses, cls)) {
      toast.error('You cannot multiclass across 2014 and 2024 class rulesets.');
      return;
    }

    setClassEntry((current) => ({ ...current, subclassId: current.subclassId }));
    toast.success(`${cls.name} selected`);
  };

  const updateFeatureOptionSelection = (featureId: string, slotIndex: number, optionId: string, chooseCount = 1) => {
    updateBuilderCharacter({
      features: updateFeatureOptionSelections(builderState.character?.features, featureId, slotIndex, optionId, chooseCount)
    });
  };

  const handleToggleSkill = (skill: string) => {
    const current = selectedSkills || [];
    const currentProficiencies = builderState.character?.proficiencies ?? {
      skills: [],
      tools: [],
      languages: [],
      armor: [],
      weapons: [],
      saves: []
    };
    if (current.includes(skill)) {
      updateBuilderCharacter({
        proficiencies: {
          ...currentProficiencies,
          skills: current.filter((s) => s !== skill)
        }
      });
      toast.success(`${skill} removed`);
      return;
    }

    if (current.length >= cls.skillCount) {
      toast.error(`You can only choose ${cls.skillCount} skills`);
      return;
    }

    updateBuilderCharacter({
      proficiencies: {
        ...currentProficiencies,
        skills: [...current, skill]
      }
    });
    toast.success(`${skill} selected`);
  };

  const handleToggleSubclass = (subclassId: string) => {
    if (!classEntry) {
      return;
    }

    setClassEntry((current) => {
      if (current.subclassId === subclassId) {
        return current;
      }

      const next = { ...current, subclassId };
      const subclass = getRuntimeSubclass(cls.id, subclassId);
      toast.success(`${subclass?.name || 'Subclass'} selected`);
      return next;
    });
  };

  const activateSubclassCard = (subclassId: string) => {
    updateSearchParam('subclass', subclassId);
    if (classEntry && characterLevel >= cls.subclassLevel && selectedSubclass?.id !== subclassId) {
      handleToggleSubclass(subclassId);
    }
  };

  const toggleOptionalFeature = (featureId: string) => {
    const currentSelections = builderState.character?.features || [];
    const selected = currentSelections.some((entry) => entry.featureId === featureId);
    updateBuilderCharacter({
      features: selected
        ? currentSelections.filter((entry) => entry.featureId !== featureId)
        : [...currentSelections, { featureId }]
    });
  };

  const getSelectedOptionIds = (featureId: string) => {
    return getSelectedFeatureOptionIds(selectedFeatureChoices, featureId);
  };

  const renderFeatureCard = (feature: (typeof visibleFeatures)[number]) => {
    const selected = selectedFeatureChoices.some((entry) => entry.featureId === feature.id);
    const replacementNames = (feature.replacesFeatureIds ?? [])
      .map((featureId) => allFeatureNamesById.get(featureId))
      .filter((value): value is string => Boolean(value));

    return (
      <AccordionItem key={feature.id} value={feature.id}>
        <AccordionTrigger>
          <div className="flex flex-wrap items-center gap-2 text-left">
            <span className="font-medium">{feature.name}</span>
            <Badge variant="secondary">Level {feature.level}</Badge>
            {feature.optional && <Badge variant="outline">Optional</Badge>}
            {feature.replacesFeatureIds?.length ? <Badge variant="outline">Replacement</Badge> : null}
            {feature.requiresChoice && <Badge variant="outline">Requires Choice</Badge>}
          </div>
        </AccordionTrigger>
        <AccordionContent className="space-y-3">
          <p className="text-sm text-muted-foreground"><ContentReferenceText text={feature.description} /></p>
          {replacementNames.length > 0 ? (
            <p className="text-xs text-muted-foreground">Replaces: {replacementNames.join(', ')}</p>
          ) : null}
          {feature.optional && (!feature.options || feature.options.length === 0) ? (
            <div>
              <Button type="button" size="sm" variant={selected ? 'default' : 'outline'} onClick={() => toggleOptionalFeature(feature.id)}>
                {selected ? 'Enabled' : 'Enable Optional Feature'}
              </Button>
            </div>
          ) : null}
          <FeatureOptionSelector
            feature={feature}
            selectedOptionIds={getSelectedOptionIds(feature.id)}
            onValueChange={(slotIndex, value) => updateFeatureOptionSelection(feature.id, slotIndex, value, feature.chooseCount ?? 1)}
            selectionContext={featureSelectionContext}
          />
        </AccordionContent>
      </AccordionItem>
    );
  };

  const visibleFeatures = sortFeaturesByLevel(cls.features.filter((feature) => (feature.name.trim() || feature.description.trim()) && feature.level <= characterLevel));
  const futureFeatures = sortFeaturesByLevel(cls.features.filter((feature) => (feature.name.trim() || feature.description.trim()) && feature.level > characterLevel));
  const visibleSubclassFeatures = sortFeaturesByLevel(selectedSubclass?.features.filter((feature) => (feature.name.trim() || feature.description.trim()) && feature.level <= characterLevel) || []);
  const futureSubclassFeatures = sortFeaturesByLevel(selectedSubclass?.features.filter((feature) => (feature.name.trim() || feature.description.trim()) && feature.level > characterLevel) || []);
  const inspectedSubclass = cls.subclasses.find((subclass) => subclass.id === activeSubclassId) ?? cls.subclasses[0];
  const inspectedSubclassFeatures = sortFeaturesByLevel(inspectedSubclass?.features.filter((feature) => (feature.name.trim() || feature.description.trim())) || []);

  const updateSearchParam = (name: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set(name, value);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/builder/class')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{cls.name}</h2>
          <p className="text-sm text-muted-foreground">{cls.source}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{getRulesEditionLabel(cls.sourceId, cls.source)}</Badge>
          </div>
          {selectedSubclass && <p className="text-xs text-muted-foreground">Subclass: {selectedSubclass.name}</p>}
        </div>
        <Button onClick={handleSelectClass} variant={isSelected ? 'default' : 'outline'}>
          {isSelected && <Check className="mr-2 h-4 w-4" />}
          {isSelected ? 'Selected' : 'Select'}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => updateSearchParam('tab', value)} className="w-full">
        <TabsList className={`grid w-full ${cls.spellcasting ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="subclasses">Subclasses</TabsTrigger>
          <TabsTrigger value="proficiencies">Proficiencies</TabsTrigger>
          {cls.spellcasting && <TabsTrigger value="spellcasting">Spellcasting</TabsTrigger>}
        </TabsList>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{cls.description}</p>
            </CardContent>
          </Card>

          {visibleFeatures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Class Features (Level {characterLevel})</CardTitle>
                {isSelected ? null : (
                  <p className="text-sm text-muted-foreground">
                    Previewing at level 1 because {cls.name} is not part of this character yet. Select it to see the features for your level.
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="multiple" className="w-full">
                  {visibleFeatures.map(renderFeatureCard)}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {visibleSubclassFeatures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Subclass Features (Unlocked)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="multiple" className="w-full">
                  {visibleSubclassFeatures.map(renderFeatureCard)}
                </Accordion>
              </CardContent>
            </Card>
          )}

          {futureSubclassFeatures.length > 0 && (
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle>Future Subclass Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {futureSubclassFeatures.slice(0, 5).map((feature) => (
                  <div key={feature.id} className="border-b pb-4 last:border-0 last:pb-0">
                    <div className="mb-1 flex items-center gap-2">
                      <h4 className="font-medium">{feature.name}</h4>
                      <Badge variant="secondary">Level {feature.level}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground"><ContentReferenceText text={feature.description} /></p>
                  </div>
                ))}
                {futureSubclassFeatures.length > 5 && (
                  <p className="text-center text-sm text-muted-foreground">
                    And {futureSubclassFeatures.length - 5} more subclass features...
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {futureFeatures.length > 0 && (
            <Card className="opacity-60">
              <CardHeader>
                <CardTitle>Future Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {futureFeatures.slice(0, 5).map((feature) => (
                  <div key={feature.id} className="border-b pb-4 last:border-0 last:pb-0">
                    <div className="mb-1 flex items-center gap-2">
                      <h4 className="font-medium">{feature.name}</h4>
                      <Badge variant="secondary">Level {feature.level}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground"><ContentReferenceText text={feature.description} /></p>
                  </div>
                ))}
                {futureFeatures.length > 5 && (
                  <p className="text-center text-sm text-muted-foreground">
                    And {futureFeatures.length - 5} more features...
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="subclasses" className="space-y-4">
          <ScrollArea className="h-[32rem] rounded-lg border">
            <div className="space-y-4 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                {cls.subclasses.map((subclass) => {
                  const selected = selectedSubclass?.id === subclass.id;
                  const inspecting = inspectedSubclass?.id === subclass.id;
                  const previewFeatures = sortFeaturesByLevel(subclass.features).slice(0, 3);
                  let cardStateClassName = '';
                  if (selected) {
                    cardStateClassName = 'border-primary ring-1 ring-primary';
                  } else if (inspecting) {
                    cardStateClassName = 'ring-1 ring-ring/40';
                  }

                  return (
                    <Card
                      key={subclass.id}
                      role="button"
                      tabIndex={0}
                      className={`cursor-pointer overflow-hidden transition-all hover:border-primary ${cardStateClassName}`}
                      onClick={() => activateSubclassCard(subclass.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          activateSubclassCard(subclass.id);
                        }
                      }}
                    >
                      <CardHeader className="space-y-4 pb-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">Unlocks at level {cls.subclassLevel}</Badge>
                              <Badge variant="secondary">{getSourceLabel(subclass.sourceId ?? cls.sourceId, subclass.source ?? cls.source)}</Badge>
                            </div>
                            <CardTitle className="text-lg">{subclass.name}</CardTitle>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {inspecting && !selected && <Badge variant="outline">Viewing</Badge>}
                            {selected && <Badge>Selected</Badge>}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-lg border bg-muted/30 p-4">
                          <p className="text-sm leading-6 text-muted-foreground"><ContentReferenceText text={getDescriptionPreview(subclass.description)} /></p>
                        </div>
                        {previewFeatures.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-sm font-medium">Key Features</p>
                            <div className="grid gap-2">
                              {previewFeatures.map((feature) => (
                                <div key={feature.id} className="rounded-lg border bg-background/80 p-3">
                                  <div className="mb-1 flex items-center justify-between gap-2">
                                    <span className="font-medium">{feature.name}</span>
                                    <Badge variant="outline">Level {feature.level}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground"><ContentReferenceText text={getDescriptionPreview(feature.description, 1)} /></p>
                                </div>
                              ))}
                            </div>
                            {subclass.features.length > previewFeatures.length && (
                              <p className="text-sm text-muted-foreground">And {subclass.features.length - previewFeatures.length} more features...</p>
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
                            navigate(`/builder/subclass/${cls.id}/${subclass.id}`);
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
                  <CardHeader className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>{inspectedSubclass.name}</CardTitle>
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
                          variant={selectedSubclass?.id === inspectedSubclass.id ? 'default' : 'outline'}
                          onClick={() => handleToggleSubclass(inspectedSubclass.id)}
                        >
                          {selectedSubclass?.id === inspectedSubclass.id ? 'Selected' : 'Select Subclass'}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Unlocks at level {cls.subclassLevel}</Badge>
                      <Badge variant="secondary">{getSourceLabel(inspectedSubclass.sourceId ?? cls.sourceId, inspectedSubclass.source ?? cls.source)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm leading-6 text-muted-foreground"><ContentReferenceText text={inspectedSubclass.description} /></p>
                    </div>
                    {inspectedSubclassFeatures.length > 0 ? (
                      <div className="space-y-4">
                        {inspectedSubclassFeatures.map((feature) => {
                          return (
                            <div key={feature.id} className="border-b pb-4 last:border-0 last:pb-0">
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className="font-medium">{feature.name}</h4>
                                <Badge variant="secondary">Level {feature.level}</Badge>
                                {feature.optional && <Badge variant="outline">Optional</Badge>}
                                {feature.requiresChoice && <Badge variant="outline">Requires Choice</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground"><ContentReferenceText text={feature.description} /></p>
                              <div className="mt-2">
                                <FeatureOptionSelector
                                  feature={feature}
                                  selectedOptionIds={getSelectedOptionIds(feature.id)}
                                  onValueChange={(slotIndex, value) => updateFeatureOptionSelection(feature.id, slotIndex, value, feature.chooseCount ?? 1)}
                                  selectionContext={featureSelectionContext}
                                  showDescriptions={false}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No subclass features are defined for this subclass yet.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="proficiencies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Proficiencies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium">
                  <Shield className="h-4 w-4" /> Armor
                </h4>
                <div className="flex flex-wrap gap-2">
                  {cls.armorProficiencies.length > 0 ? (
                    cls.armorProficiencies.map((prof) => (
                      <Badge key={prof} variant="secondary">{prof}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">None</span>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium">
                  <Sword className="h-4 w-4" /> Weapons
                </h4>
                <div className="flex flex-wrap gap-2">
                  {cls.weaponProficiencies.map((prof) => (
                    <Badge key={prof} variant="secondary"><ContentReferenceText text={prof} /></Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 flex items-center gap-2 font-medium">
                  <Wand2 className="h-4 w-4" /> Tools
                </h4>
                {cls.toolProficiencies?.length ? (
                  <ToolProficiencyChoices
                    labels={cls.toolProficiencies}
                    idPrefix={getToolChoiceIdPrefix('class', cls.id)}
                    disabled={!isSelected}
                    disabledHint="Select this class first to lock in its tool choices."
                  />
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 font-medium">Saving Throws</h4>
                <div className="flex flex-wrap gap-2">
                  {cls.savingThrows.map((save) => (
                    <Badge key={save} variant="secondary">
                      {save.charAt(0).toUpperCase() + save.slice(1)}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="mb-2 font-medium">Skills</h4>
                <p className="text-sm text-muted-foreground">Choose {cls.skillCount} from:</p>
                <div className="flex flex-wrap gap-2">
                  {cls.skillChoices.map((skill) => {
                    const selected = selectedSkills.includes(skill);
                    return (
                      <button
                        key={skill}
                        type="button"
                        className={`rounded-md border px-3 py-1 transition-colors ${selected ? 'border-primary bg-primary text-primary-foreground' : ''}`}
                        onClick={() => handleToggleSkill(skill)}
                      >
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="spellcasting" className="space-y-4">
          {cls.spellcasting ? (
            <Card>
              <CardHeader>
                <CardTitle>Spellcasting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="font-medium">Spellcasting Ability: </span>
                    <span className="text-muted-foreground">
                    {Array.isArray(cls.spellcasting.ability)
                      ? cls.spellcasting.ability.map((ability) => ability.charAt(0).toUpperCase() + ability.slice(1)).join(' or ')
                      : cls.spellcasting.ability.charAt(0).toUpperCase() + cls.spellcasting.ability.slice(1)}
                  </span>
                </div>
                {cls.spellcasting.spellPreparation && (
                  <div>
                    <Badge variant="secondary">Spell Preparation</Badge>
                    <p className="mt-1 text-sm text-muted-foreground"><ContentReferenceText text="You must prepare spells before casting them." /></p>
                  </div>
                )}
                {cls.spellcasting.cantripsKnown && (
                  <div>
                    <span className="font-medium">Cantrips Known: </span>
                    <span className="text-muted-foreground">{cls.spellcasting.cantripsKnown[characterLevel - 1]} at level {characterLevel}</span>
                  </div>
                )}
                {cls.spellcasting.spellsKnown && (
                  <div>
                    <span className="font-medium">Spells Known: </span>
                    <span className="text-muted-foreground">{cls.spellcasting.spellsKnown[characterLevel - 1]} at level {characterLevel}</span>
                  </div>
                )}
                {cls.spellcasting.spellSlots && (
                  <div>
                    <span className="font-medium">Spell Slots at Level {characterLevel}: </span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(cls.spellcasting.spellSlots[characterLevel - 1] ?? [])
                        .map((slots, level) => ({ slots, level }))
                        .filter(({ slots }) => slots > 0)
                        .map(({ slots, level }) => {
                          const isWarlock = /warlock/i.test(`${cls.id} ${cls.name}`);
                          const label = isWarlock ? `Pact Slot ${level + 1}` : getOrdinalLevelLabel(level);

                          return (
                            <Badge key={`spell-slot-${level + 1}-${slots}`} variant="outline">
                              {label}: {slots}
                            </Badge>
                          );
                        })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">This class does not have spellcasting abilities.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
