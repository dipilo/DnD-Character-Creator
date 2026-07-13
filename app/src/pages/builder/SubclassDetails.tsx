import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getContentSourceLabel, getRuntimeClassById, getRuntimeSubclass } from '@/data';
import { useCharacterStore } from '@/store/characterStore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FeatureOptionSelector } from '@/components/builder/FeatureOptionSelector';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { ArrowLeft, Check } from 'lucide-react';
import { toast } from 'sonner';
import { sortFeaturesByLevel } from '@/lib/builderRules';
import { getSelectedFeatureOptionIds, updateFeatureOptionSelections } from '@/lib/featureOptions';

const getSourceLabel = (sourceId?: string, sourceText?: string) => {
  if (sourceText?.trim()) {
    return sourceText;
  }

  return sourceId ? getContentSourceLabel(sourceId) : 'Unknown Source';
};

export function SubclassDetails() {
  const params = useParams();
  const classId = params.classId;
  const subclassId = params.subclassId;
  const navigate = useNavigate();
  const { builderState, updateBuilderCharacter } = useCharacterStore();

  const cls = classId ? getRuntimeClassById(classId) : undefined;
  const subclass = classId && subclassId ? getRuntimeSubclass(classId, subclassId) : undefined;
  const classEntry = builderState.character?.classes?.find((entry) => entry.classId === classId);
  const selectedFeatureChoices = builderState.character?.features || [];
  const unlocked = Boolean(cls && classEntry && classEntry.level >= cls.subclassLevel);
  const isSelected = classEntry?.subclassId === subclass?.id;
  const featureSelectionContext = {
    level: classEntry?.level,
    selectedFeatureChoices,
    selectedSpellIds: (builderState.character?.spells ?? []).map((entry) => entry.spellId)
  };

  const sortedFeatures = useMemo(() => {
    return subclass ? sortFeaturesByLevel(subclass.features) : [];
  }, [subclass]);

  if (!cls || !subclass) {
    return (
      <div className="py-8 text-center">
        <p className="text-muted-foreground">Subclass not found.</p>
        <Button onClick={() => navigate('/builder/subclass')} className="mt-4">
          Back to Subclasses
        </Button>
      </div>
    );
  }

  const handleSelectSubclass = () => {
    if (!classEntry) {
      navigate(`/builder/class/${cls.id}`);
      return;
    }

    if (isSelected) {
      return;
    }

    updateBuilderCharacter({
      classes: (builderState.character?.classes ?? []).map((entry) => {
        if (entry.classId !== cls.id) {
          return entry;
        }

        return {
          ...entry,
          subclassId: subclass.id
        };
      })
    });

    toast.success(`${subclass.name} selected`);
  };

  const updateFeatureOptionSelection = (featureId: string, slotIndex: number, optionId: string, chooseCount = 1) => {
    updateBuilderCharacter({
      features: updateFeatureOptionSelections(builderState.character?.features, featureId, slotIndex, optionId, chooseCount)
    });
  };

  const getSelectedOptionIds = (featureId: string) => {
    return getSelectedFeatureOptionIds(selectedFeatureChoices, featureId);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(`/builder/class/${cls.id}?tab=subclasses&subclass=${subclass.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Class
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/builder/subclass')}>
          Back to Subclasses
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{cls.name}</Badge>
            <Badge variant="secondary">{getSourceLabel(subclass.sourceId ?? cls.sourceId, subclass.source ?? cls.source)}</Badge>
            <Badge variant="outline">Unlocks at level {cls.subclassLevel}</Badge>
          </div>
          <div>
            <h2 className="text-2xl font-bold">{subclass.name}</h2>
            <p className="text-sm text-muted-foreground">{getSourceLabel(subclass.sourceId ?? cls.sourceId, subclass.source ?? cls.source)}</p>
          </div>
          {!classEntry && (
            <p className="text-sm text-muted-foreground">Select {cls.name} first to attach this subclass to your character.</p>
          )}
          {classEntry && !unlocked && (
            <p className="text-sm text-muted-foreground">This subclass unlocks for your character at {cls.name} level {cls.subclassLevel}.</p>
          )}
        </div>
        <Button
          onClick={handleSelectSubclass}
          disabled={!classEntry || !unlocked}
          variant={isSelected ? 'default' : 'outline'}
        >
          {isSelected && <Check className="mr-2 h-4 w-4" />}
          {isSelected ? 'Selected' : 'Select Subclass'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground"><ContentReferenceText text={subclass.description} /></p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedFeatures.length > 0 ? (
                <Accordion type="multiple" className="w-full">
                  {sortedFeatures.map((feature) => (
                    <AccordionItem key={feature.id} value={feature.id}>
                      <AccordionTrigger>
                        <div className="flex flex-wrap items-center gap-2 text-left">
                          <span className="font-medium">{feature.name}</span>
                          <Badge variant="outline">Level {feature.level}</Badge>
                          {feature.optional && <Badge variant="outline">Optional</Badge>}
                          {feature.requiresChoice && <Badge variant="outline">Requires Choice</Badge>}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="space-y-3">
                        <p className="text-sm text-muted-foreground"><ContentReferenceText text={feature.description} /></p>
                        <FeatureOptionSelector
                          feature={feature}
                          selectedOptionIds={getSelectedOptionIds(feature.id)}
                          onValueChange={(slotIndex, value) => updateFeatureOptionSelection(feature.id, slotIndex, value, feature.chooseCount ?? 1)}
                          selectionContext={featureSelectionContext}
                          showDescriptions={false}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-sm text-muted-foreground">No subclass features are defined for this subclass yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Class Context</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Class</span>
                <span className="font-medium">{cls.name}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Subclass Level</span>
                <span className="font-medium">{cls.subclassLevel}</span>
              </div>
              {classEntry && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Current Class Level</span>
                  <span className="font-medium">{classEntry.level}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}