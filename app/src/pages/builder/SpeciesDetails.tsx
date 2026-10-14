import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { getRuntimeLanguageNames, getRuntimeSpeciesById, getRuntimeSpeciesVariant, useContentLibrary } from '@/data';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FeatureOptionSelector } from '@/components/builder/FeatureOptionSelector';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getRulesEditionLabel, isChoicePlaceholderLabel } from '@/lib/builderRules';
import { getPoolBlockedOptionIds, getSelectedFeatureOptionIds, updateFeatureOptionSelections } from '@/lib/featureOptions';
import { SpeciesLineageList } from '@/components/builder/SpeciesLineageList';
import { findLineageNode, findSpeciesGroup, groupSpeciesByBase, lineagesBesideVariantsOf, parseSpeciesLineage, type SpeciesLineageNode } from '@/lib/speciesGroups';

const getAsiKey = (prefix: string, ability: string, amount: number, chooseFrom?: string[]) => {
  return `${prefix}-${ability}-${amount}-${chooseFrom?.join('-') || 'fixed'}`;
};

export function SpeciesDetails() {
  const { speciesId } = useParams<{ speciesId: string }>();
  const navigate = useNavigate();
  const { builderState, updateBuilderCharacter } = useCharacterStore();

  const { species: librarySpecies } = useContentLibrary();

  const species = speciesId ? getRuntimeSpeciesById(speciesId) : undefined;
  // Every printing of this species' lineages, whether each arrived nested in `variants` or as a
  // species of its own, so one list covers both and a sibling is one click away.
  const group = useMemo(
    () => (species ? findSpeciesGroup(groupSpeciesByBase(librarySpecies), species) : undefined),
    [librarySpecies, species]
  );

  if (!species) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Species not found.</p>
        <Button onClick={() => navigate('/builder/species')} className="mt-4">
          Back to Species
        </Button>
      </div>
    );
  }

  const isSelected = builderState.character?.speciesId === species.id;
  const selectedVariant = builderState.character?.variantId;
  const selectedFeatureChoices = builderState.character?.features || [];
  const selectedSpeciesLanguages = builderState.character?.speciesLanguageSelections ?? [];
  const selectedVariantData = selectedVariant ? getRuntimeSpeciesVariant(species.id, selectedVariant) : undefined;
  const sizeOptions = selectedVariantData?.sizeOptions ?? species.sizeOptions ?? [species.size];
  const selectedSize = (builderState.character?.size && sizeOptions.includes(builderState.character.size))
    ? builderState.character.size
    : sizeOptions[0] ?? species.size;
  const visibleAbilityScoreIncreases = species.abilityScoreIncreases.filter((entry) => {
    if (entry.ability === 'choose') {
      return entry.amount !== 0 && (entry.chooseFrom?.length ?? 0) > 0;
    }

    return entry.amount !== 0;
  });
  const visibleFeatures = [...species.features, ...(selectedVariantData?.features ?? [])]
    .filter((feature) => feature.name.trim() || feature.description.trim());
  const visibleLanguages = species.languages.filter((entry) => entry && !isChoicePlaceholderLabel(entry));
  const languageChoiceCount = species.languages.filter((entry) => isChoicePlaceholderLabel(entry)).length;
  // "One skill of choice" is the Skills feature restated; that feature already renders a selector.
  const visibleProficiencies = [...(species.proficiencies ?? []), ...(selectedVariantData?.proficiencies ?? [])]
    .filter((entry) => !isChoicePlaceholderLabel(entry.name));
  const availableLanguageOptions = getRuntimeLanguageNames();
  const speciesLanguageSlotIds = Array.from(
    { length: languageChoiceCount },
    (_, slotNumber) => `${species.id}-language-slot-${slotNumber + 1}`
  );
  const siblingLineages = group ? lineagesBesideVariantsOf(group.lineages, species.id) : [];
  // Fizban's "Dragonborn (Chromatic)" states "choose one kind of dragon" and prints no list, so the
  // entry itself is never a complete species: its own lineages are the choice.
  const unresolvedBranch = (findLineageNode(group?.lineages ?? [], parseSpeciesLineage(species.name).path)?.children.length ?? 0) > 0;
  const featureSelectionContext = {
    selectedFeatureChoices,
    selectedSpellIds: (builderState.character?.spells ?? []).map((entry) => entry.spellId)
  };

  const handleSelectSpecies = () => {
    if (isSelected && !selectedVariant) {
      updateBuilderCharacter({ speciesId: undefined, variantId: undefined, size: undefined, speciesLanguageSelections: [] });
      toast.success(`${species.name} deselected`);
      return;
    }
    updateBuilderCharacter({ speciesId: species.id, variantId: undefined, size: sizeOptions[0] ?? species.size, speciesLanguageSelections: [] });
    toast.success(`${species.name} selected`);
  };

  const handleSelectVariant = (variantId: string) => {
    if (isSelected && selectedVariant === variantId) {
      updateBuilderCharacter({ speciesId: undefined, variantId: undefined, size: undefined, speciesLanguageSelections: [] });
      toast.success('Variant deselected');
      return;
    }
    const variant = getRuntimeSpeciesVariant(species.id, variantId);
    updateBuilderCharacter({
      speciesId: species.id,
      variantId,
      size: variant?.sizeOptions?.[0] ?? species.sizeOptions?.[0] ?? species.size,
      speciesLanguageSelections: []
    });
    toast.success(`${variant?.name} selected`);
  };

  const selectLineage = (node: SpeciesLineageNode) => {
    if (node.variant) {
      handleSelectVariant(node.variant.id);
      return;
    }
    if (!node.species) {
      return;
    }
    if (node.species.id === species.id) {
      handleSelectSpecies();
      return;
    }
    navigate(`/builder/species/${node.species.id}`);
  };

  const updateFeatureOptionSelection = (featureId: string, slotIndex: number, optionId: string, chooseCount = 1) => {
    updateBuilderCharacter({
      features: updateFeatureOptionSelections(builderState.character?.features, featureId, slotIndex, optionId, chooseCount)
    });
  };

  const updateSpeciesLanguageSelection = (slotIndex: number, value: string) => {
    if (!isSelected) {
      return;
    }

    const nextSelections = [...selectedSpeciesLanguages];
    if (value === '__none__') {
      nextSelections.splice(slotIndex, 1);
    } else {
      nextSelections[slotIndex] = value;
    }

    updateBuilderCharacter({ speciesLanguageSelections: nextSelections.filter(Boolean) });
  };

  const getSelectedOptionIds = (featureId: string) => {
    return getSelectedFeatureOptionIds(selectedFeatureChoices, featureId);
  };

  const getBlockedOptionIds = (featureId: string) => {
    return getPoolBlockedOptionIds(visibleFeatures, featureId, selectedFeatureChoices);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/builder/species')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
          <h2 className="text-2xl font-bold">{species.name}</h2>
          <p className="text-sm text-muted-foreground">{species.source}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">{getRulesEditionLabel(species.sourceId, species.source)}</Badge>
          </div>
        </div>
        <Button
          onClick={handleSelectSpecies}
          variant={isSelected && !selectedVariant ? 'default' : 'outline'}
        >
          {isSelected && !selectedVariant && <Check className="mr-2 h-4 w-4" />}
          {isSelected && !selectedVariant ? 'Selected' : 'Select Base'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground"><ContentReferenceText text={species.description} /></p>
            </CardContent>
          </Card>

          {visibleAbilityScoreIncreases.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Ability Score Increases</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {visibleAbilityScoreIncreases.map((asi) => (
                  <Badge
                    key={getAsiKey('species', asi.ability, asi.amount, asi.chooseFrom)}
                    variant="secondary"
                  >
                    {asi.ability === 'choose'
                      ? `Choose ${asi.chooseCount} from: ${asi.chooseFrom?.join(', ')} (+${asi.amount})`
                      : `${asi.ability.charAt(0).toUpperCase() + asi.ability.slice(1)} +${asi.amount}`}
                  </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {visibleFeatures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Accordion type="multiple" className="w-full">
                  {visibleFeatures.map((feature) => (
                    <AccordionItem key={feature.id} value={feature.id}>
                      <AccordionTrigger>
                        <div className="flex flex-wrap items-center gap-2 text-left">
                          <span>{feature.name}</span>
                          {feature.requiresChoice && <Badge variant="outline">Requires Choice</Badge>}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <p className="text-sm text-muted-foreground"><ContentReferenceText text={feature.description} /></p>
                        {feature.requiresChoice ? (
                          <FeatureOptionSelector
                            feature={feature}
                            selectedOptionIds={getSelectedOptionIds(feature.id)}
                            onValueChange={(slotIndex, value) => updateFeatureOptionSelection(feature.id, slotIndex, value, feature.chooseCount ?? 1)}
                            selectionContext={featureSelectionContext}
                            blockedOptionIds={getBlockedOptionIds(feature.id)}
                          />
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Traits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                {sizeOptions.length > 1 ? (
                  <Select
                    value={selectedSize}
                    onValueChange={(value) => updateBuilderCharacter({ size: value as typeof selectedSize })}
                    disabled={!isSelected}
                  >
                    <SelectTrigger className="w-36">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {sizeOptions.map((option) => (
                        <SelectItem key={option} value={option}>{option}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="font-medium">{selectedSize}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Speed</span>
                <span className="font-medium">{species.speed} ft.</span>
              </div>
              {visibleLanguages.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground">Languages</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {visibleLanguages.map((lang) => (
                        <Badge key={lang} variant="outline" className="text-xs">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {languageChoiceCount > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <span className="text-muted-foreground">Additional Languages</span>
                    {speciesLanguageSlotIds.map((slotId, index) => {
                      const currentValue = selectedSpeciesLanguages[index];
                      const blockedSelections = new Set(
                        selectedSpeciesLanguages.filter((_, entryIndex) => entryIndex !== index)
                      );

                      return (
                        <div key={slotId} className="flex items-center gap-2">
                          <Select
                            value={currentValue ?? '__none__'}
                            onValueChange={(value) => updateSpeciesLanguageSelection(index, value)}
                            disabled={!isSelected}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Choose language ${index + 1}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {availableLanguageOptions
                                .filter((entry) => !visibleLanguages.includes(entry))
                                .filter((entry) => entry === currentValue || !blockedSelections.has(entry))
                                .map((entry) => (
                                  <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {currentValue && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => updateSpeciesLanguageSelection(index, '__none__')}>
                              Clear
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {!isSelected && (
                      <p className="text-xs text-muted-foreground">Select this species first to lock in its language and size choices.</p>
                    )}
                  </div>
                </>
              )}
              {visibleProficiencies.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground">Proficiencies</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {visibleProficiencies.map((prof) => (
                        <Badge key={`${prof.type}-${prof.name}`} variant="outline" className="text-xs">
                          {prof.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {siblingLineages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{group?.name ?? species.name} Lineages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {unresolvedBranch && (
                  <p className="text-xs text-muted-foreground">
                    This printing is the heading its lineages sit under: {species.name} leaves the choice its
                    features name open, so pick one below instead.
                  </p>
                )}
                <SpeciesLineageList
                  nodes={siblingLineages}
                  selectedSpeciesId={builderState.character?.speciesId}
                  selectedVariantId={selectedVariant}
                  onSelect={selectLineage}
                />
                {group?.base && group.base.id !== species.id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate(`/builder/species/${group.base?.id}`)}
                  >
                    Back to {group.base.name}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {species.variants && species.variants.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {species.variants.map((variant) => (
                  <button
                    type="button"
                    key={variant.id}
                    className={`w-full rounded-lg border p-3 text-left transition-all ${
                      isSelected && selectedVariant === variant.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleSelectVariant(variant.id)}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{variant.name}</h4>
                      {isSelected && selectedVariant === variant.id && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{variant.description}</p>
                    {variant.abilityScoreIncreases && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {variant.abilityScoreIncreases.map((asi) => (
                          <Badge
                            key={getAsiKey(variant.id, asi.ability, asi.amount, asi.chooseFrom)}
                            variant="secondary"
                            className="text-xs"
                          >
                            {asi.ability === 'choose'
                              ? `Choose ${asi.chooseCount ?? 1} (+${asi.amount})`
                              : `${asi.ability.slice(0, 3).toUpperCase()} +${asi.amount}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
