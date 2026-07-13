import { useParams, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { useContentLibrary } from '@/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { defaultLanguageOptions, getRulesEdition, resolveBackgroundGrantedFeat } from '@/lib/builderRules';

const formatEquipmentOptionLabel = (item: { name: string; count?: number }) => {
  const prefix = item.count ? `${item.count} ` : '';
  return `${prefix}${item.name}`;
};

const formatBackgroundEquipment = (item: { name: string; type: string; count?: number; alternatives?: Array<{ name: string; count?: number }> }) => {
  if (item.alternatives?.length) {
    return `${item.name}: ${item.alternatives.map(formatEquipmentOptionLabel).join(' or ')}`;
  }

  return formatEquipmentOptionLabel(item);
};

export function BackgroundDetails() {
  const { backgroundId } = useParams<{ backgroundId: string }>();
  const navigate = useNavigate();
  const { builderState, updateBuilderCharacter } = useCharacterStore();
  const { backgrounds, feats, species } = useContentLibrary();

  const background = backgroundId ? backgrounds.find((entry) => entry.id === backgroundId) : undefined;

  if (!background) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Background not found.</p>
        <Button onClick={() => navigate('/builder/background')} className="mt-4">
          Back to Backgrounds
        </Button>
      </div>
    );
  }

  const isSelected = builderState.character?.backgroundId === background.id;
  const selectedBackgroundLanguages = builderState.character?.backgroundLanguageSelections ?? [];
  const grantedFeat = resolveBackgroundGrantedFeat(background, feats);
  const uses2024OriginBonuses = !background.abilityScoreIncreases?.length && getRulesEdition(background.sourceId, background.source) === '2024';
  const suggestedCharacteristics = background.suggestedCharacteristics?.length
    ? background.suggestedCharacteristics
    : [
        ...background.personalityTraits,
        ...background.ideals,
        ...background.bonds,
        ...background.flaws
      ];
  const hasStructuredSuggestedCharacteristics = background.personalityTraits.length > 0
    || background.ideals.length > 0
    || background.bonds.length > 0
    || background.flaws.length > 0;
  let suggestedCharacteristicsContent = (
    <p className="text-sm text-muted-foreground">
      This source does not include suggested personality traits, ideals, bonds, or flaws for this background.
    </p>
  );

  if (suggestedCharacteristics.length > 0) {
    if (hasStructuredSuggestedCharacteristics) {
      suggestedCharacteristicsContent = (
        <>
          {background.personalityTraits.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">Personality Traits</h4>
              <ul className="space-y-1">
                {background.personalityTraits.slice(0, 4).map((trait) => (
                  <li key={trait} className="text-sm text-muted-foreground">• {trait}</li>
                ))}
              </ul>
            </div>
          )}
          {background.personalityTraits.length > 0 && (background.ideals.length > 0 || background.bonds.length > 0 || background.flaws.length > 0) && <Separator />}
          {background.ideals.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">Ideals</h4>
              <ul className="space-y-1">
                {background.ideals.slice(0, 3).map((ideal) => (
                  <li key={ideal} className="text-sm text-muted-foreground">• {ideal}</li>
                ))}
              </ul>
            </div>
          )}
          {background.ideals.length > 0 && (background.bonds.length > 0 || background.flaws.length > 0) && <Separator />}
          {background.bonds.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">Bonds</h4>
              <ul className="space-y-1">
                {background.bonds.slice(0, 3).map((bond) => (
                  <li key={bond} className="text-sm text-muted-foreground">• {bond}</li>
                ))}
              </ul>
            </div>
          )}
          {background.bonds.length > 0 && background.flaws.length > 0 && <Separator />}
          {background.flaws.length > 0 && (
            <div>
              <h4 className="mb-2 font-medium">Flaws</h4>
              <ul className="space-y-1">
                {background.flaws.slice(0, 3).map((flaw) => (
                  <li key={flaw} className="text-sm text-muted-foreground">• {flaw}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      );
    } else {
      suggestedCharacteristicsContent = (
        <div>
          <h4 className="mb-2 font-medium">Alignment-Based Traits</h4>
          <ul className="space-y-1">
            {suggestedCharacteristics.map((trait) => (
              <li key={trait} className="text-sm text-muted-foreground">• {trait}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            This 2024 source provides general alignment and personality prompts rather than background-specific personality tables.
          </p>
        </div>
      );
    }
  }
  const availableLanguageOptions = Array.from(
    new Set([
      ...defaultLanguageOptions,
      ...species.flatMap((entry) => [
        ...entry.languages,
        ...(entry.proficiencies ?? []).filter((prof) => prof.type === 'language').map((prof) => prof.name)
      ]).filter((entry) => entry && !/your choice/i.test(entry))
    ])
  ).sort((left, right) => left.localeCompare(right));
  const backgroundLanguageSlotIds = Array.from(
    { length: background?.languageCount ?? 0 },
    (_, slotNumber) => `${background?.id ?? 'background'}-language-slot-${slotNumber + 1}`
  );

  const handleSelectBackground = () => {
    if (isSelected) {
      updateBuilderCharacter({ backgroundId: undefined, backgroundLanguageSelections: [] });
      toast.success(`${background.name} deselected`);
      return;
    }
    updateBuilderCharacter({ backgroundId: background.id, backgroundLanguageSelections: [] });
    toast.success(`${background.name} selected`);
  };

  const updateBackgroundLanguageSelection = (slotIndex: number, value: string) => {
    if (!isSelected) {
      return;
    }

    const nextSelections = [...selectedBackgroundLanguages];
    if (value === '__none__') {
      nextSelections.splice(slotIndex, 1);
    } else {
      nextSelections[slotIndex] = value;
    }

    updateBuilderCharacter({
      backgroundLanguageSelections: nextSelections.filter(Boolean)
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/builder/background')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{background.name}</h2>
          <p className="text-sm text-muted-foreground">{background.source}</p>
        </div>
        <Button onClick={handleSelectBackground} variant={isSelected ? 'default' : 'outline'}>
          {isSelected && <Check className="mr-2 h-4 w-4" />}
          {isSelected ? 'Selected' : 'Select'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground"><ContentReferenceText text={background.description} /></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Background Feature: {background.feature.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground"><ContentReferenceText text={background.feature.description} /></p>
              {grantedFeat && (
                <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium">Granted Feat</p>
                    <Badge>Auto Applied</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{grantedFeat.name}</p>
                </div>
              )}
              {uses2024OriginBonuses && (
                <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="font-medium">Origin Ability Scores</p>
                    <Badge variant="outline">2024 Rules</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This background grants either +2 to one ability and +1 to a different ability, or +1 to three different abilities. Make those selections on the Ability Scores step.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Suggested Characteristics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {suggestedCharacteristicsContent}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Proficiencies & Equipment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <span className="text-muted-foreground">Skill Proficiencies</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {background.skillProficiencies.map((skill) => (
                    <Badge key={skill} variant="secondary">{skill}</Badge>
                  ))}
                </div>
              </div>

              {background.toolProficiencies && background.toolProficiencies.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground">Tool Proficiencies</span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {background.toolProficiencies.map((tool) => (
                        <Badge key={tool} variant="outline"><ContentReferenceText text={tool} /></Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {background.languageCount && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <span className="text-muted-foreground">Languages</span>
                    <p className="text-sm">Any {background.languageCount} of your choice</p>
                    {backgroundLanguageSlotIds.map((slotId, index) => {
                      const currentValue = selectedBackgroundLanguages[index];
                      const blockedSelections = new Set(
                        selectedBackgroundLanguages.filter((_, entryIndex) => entryIndex !== index)
                      );

                      return (
                        <div key={slotId} className="flex items-center gap-2">
                          <Select
                            value={currentValue ?? '__none__'}
                            onValueChange={(value) => updateBackgroundLanguageSelection(index, value)}
                            disabled={!isSelected}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Choose language ${index + 1}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">None</SelectItem>
                              {availableLanguageOptions
                                .filter((entry) => entry === currentValue || !blockedSelections.has(entry))
                                .map((entry) => (
                                  <SelectItem key={entry} value={entry}>{entry}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {currentValue && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => updateBackgroundLanguageSelection(index, '__none__')}>
                              Clear
                            </Button>
                          )}
                        </div>
                      );
                    })}
                    {!isSelected && (
                      <p className="text-xs text-muted-foreground">Select this background first to lock in its language choices.</p>
                    )}
                  </div>
                </>
              )}

              <Separator />
              <div>
                <span className="text-muted-foreground">Equipment</span>
                <ul className="mt-1 space-y-1">
                  {background.equipment.map((item) => (
                    <li key={`${item.name}-${item.type}`} className="text-sm text-muted-foreground">• <ContentReferenceText text={formatBackgroundEquipment(item)} /></li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
