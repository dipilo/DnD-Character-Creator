import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { getRuntimeClassById } from '@/data';

const classDetailTabLabels = {
  features: 'Features',
  subclasses: 'Subclasses',
  proficiencies: 'Proficiencies',
  spellcasting: 'Spellcasting'
} as const;

const builderSteps = [
  { id: 'species', name: 'Species', path: '/builder/species' },
  { id: 'class', name: 'Class', path: '/builder/class' },
  { id: 'background', name: 'Background', path: '/builder/background' },
  { id: 'ability-scores', name: 'Ability Scores', path: '/builder/ability-scores' },
  { id: 'advancements', name: 'Feats', path: '/builder/advancements' },
  { id: 'spells', name: 'Spells', path: '/builder/spells' },
  { id: 'equipment', name: 'Equipment', path: '/builder/equipment' },
  { id: 'review', name: 'Review', path: '/builder/review' }
];

export function CharacterBuilderPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { resetBuilder, builderState, updateBuilderCharacter } = useCharacterStore();
  const [classLevelDrafts, setClassLevelDrafts] = useState<Record<string, string>>({});
  const isAbilityScoresRoute = location.pathname.startsWith('/builder/ability-scores');
  const isSubclassRoute = location.pathname.startsWith('/builder/subclass');
  const subclassRouteParts = isSubclassRoute ? location.pathname.split('/') : [];
  const currentSubclassClassId = subclassRouteParts[3];

  const currentStepIndex = isSubclassRoute
    ? builderSteps.findIndex((step) => step.id === 'class')
    : builderSteps.findIndex((step) => location.pathname.startsWith(step.path));

  const detailSearchParams = new URLSearchParams(location.search);
  const currentClassId = location.pathname.startsWith('/builder/class/')
    ? location.pathname.split('/')[3]
    : undefined;
  const currentClass = currentClassId ? getRuntimeClassById(currentClassId) : undefined;
  let classDetailTabs: string[] | null = null;
  if (currentClass) {
    classDetailTabs = ['features', 'subclasses', 'proficiencies'];
    if (currentClass.spellcasting) {
      classDetailTabs.push('spellcasting');
    }
  }
  const currentDetailTab = classDetailTabs?.includes(detailSearchParams.get('tab') ?? '')
    ? (detailSearchParams.get('tab') as (typeof classDetailTabs)[number])
    : classDetailTabs?.[0];
  const currentDetailTabIndex = currentDetailTab && classDetailTabs
    ? classDetailTabs.indexOf(currentDetailTab)
    : -1;

  const navigateToDetailTab = (tab: string) => {
    const nextSearchParams = new URLSearchParams(location.search);
    nextSearchParams.set('tab', tab);
    navigate(`${location.pathname}?${nextSearchParams.toString()}`);
  };

  const handleNext = () => {
    if (classDetailTabs && currentDetailTabIndex >= 0 && currentDetailTabIndex < classDetailTabs.length - 1) {
      navigateToDetailTab(classDetailTabs[currentDetailTabIndex + 1]);
      return;
    }

    if (location.pathname.startsWith('/builder/ability-scores') && builderState.abilityScoreMethod === 'rolled') {
      const assignments = builderState.rolledScoreAssignments || {};
      const assignedCount = Object.keys(assignments).length;
      if (assignedCount < 6) {
        toast.error('Assign all six rolled scores before continuing.');
        return;
      }
    }

    const nextStep = builderSteps[currentStepIndex + 1];
    if (nextStep) {
      navigate(nextStep.path);
    }
  };

  const handleBack = () => {
    if (classDetailTabs && currentDetailTabIndex > 0) {
      navigateToDetailTab(classDetailTabs[currentDetailTabIndex - 1]);
      return;
    }

    if (isSubclassRoute) {
      if (currentSubclassClassId) {
        navigate(`/builder/class/${currentSubclassClassId}?tab=subclasses`);
        return;
      }

      navigate('/builder/class');
      return;
    }

    const prevStep = builderSteps[currentStepIndex - 1];
    if (prevStep) {
      navigate(prevStep.path);
    }
  };

  const handleClassLevelChange = (classId: string, level: number) => {
    const currentClasses = builderState.character?.classes || [];
    const updatedClasses = currentClasses.map((entry) =>
      entry.classId === classId ? { ...entry, level: Math.max(1, Math.min(20, level)) } : entry
    );
    updateBuilderCharacter({ classes: updatedClasses });
  };

  const commitClassLevelChange = (classId: string) => {
    const draftValue = classLevelDrafts[classId];
    const parsedLevel = Number.parseInt(draftValue || '1', 10);
    handleClassLevelChange(classId, Number.isNaN(parsedLevel) ? 1 : parsedLevel);
    // Clear the draft so the input falls back to the committed level from the store.
    setClassLevelDrafts((current) => {
      if (!(classId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[classId];
      return next;
    });
  };

  const isFirstStep = currentStepIndex <= 0;
  const isLastStep = currentStepIndex === builderSteps.length - 1;
  const nextButtonLabel = classDetailTabs && currentDetailTabIndex >= 0 && currentDetailTabIndex < classDetailTabs.length - 1
    ? classDetailTabLabels[classDetailTabs[currentDetailTabIndex + 1] as keyof typeof classDetailTabLabels]
    : 'Next';
  const backButtonLabel = classDetailTabs && currentDetailTabIndex > 0
    ? classDetailTabLabels[classDetailTabs[currentDetailTabIndex - 1] as keyof typeof classDetailTabLabels]
    : 'Back';
  const shellClassName = isAbilityScoresRoute ? 'mx-auto w-full max-w-6xl px-4 md:px-6' : '';

  return (
    <div className={isAbilityScoresRoute ? 'flex w-full flex-col space-y-6 py-6' : 'mx-auto flex w-full max-w-6xl flex-col space-y-6'}>
      <div className={shellClassName}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Character Builder</h1>
            <p className="text-muted-foreground">
              Create your D&D 5e character step by step
            </p>
          </div>
          <Button variant="outline" onClick={resetBuilder} className="w-fit">
            Start Over
          </Button>
        </div>
      </div>

      <div className={shellClassName}>
        <div className="tabs-scrollbar overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {builderSteps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              let stepCircleClasses = 'bg-muted text-muted-foreground';

              if (isActive) {
                stepCircleClasses = 'bg-primary-foreground text-primary';
              } else if (isCompleted) {
                stepCircleClasses = 'bg-primary/20 text-primary';
              }

              return (
                <Button
                  key={step.id}
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => navigate(step.path)}
                  className="h-auto min-h-20 min-w-36 shrink-0 items-start justify-start gap-3 p-3 text-left"
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium ${stepCircleClasses}`}>
                    {isCompleted ? '✓' : index + 1}
                  </div>
                  <span className="min-w-0 whitespace-nowrap text-sm font-medium leading-tight">{step.name}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {(builderState.character?.classes?.length || 0) > 0 && (
        <div className={shellClassName}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Class Levels</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(builderState.character?.classes || []).map((entry) => {
                const classData = getRuntimeClassById(entry.classId);
                return (
                  <div key={entry.classId} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{classData?.name || entry.classId}</span>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/builder/class/${entry.classId}`)}>
                        Details
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Level</span>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        value={classLevelDrafts[entry.classId] ?? String(entry.level)}
                        onChange={(e) => setClassLevelDrafts((current) => ({
                          ...current,
                          [entry.classId]: e.target.value
                        }))}
                        onBlur={() => commitClassLevelChange(entry.classId)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.currentTarget.blur();
                          }
                        }}
                        className="w-24"
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {isAbilityScoresRoute ? (
        <Outlet />
      ) : (
        <Card className="mx-auto w-full max-w-6xl">
          <CardContent className="p-6">
            <Outlet />
          </CardContent>
        </Card>
      )}

      <div className={shellClassName}>
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isFirstStep}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            {backButtonLabel}
          </Button>

          {isLastStep ? (
            <div />
          ) : (
            <Button onClick={handleNext} className="gap-2">
              {nextButtonLabel}
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
