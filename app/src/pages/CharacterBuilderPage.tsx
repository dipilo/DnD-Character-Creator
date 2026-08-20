import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ChevronLeft, ChevronRight, Swords, X } from 'lucide-react';
import { toast } from 'sonner';
import { getRuntimeClassById, getRuntimeSubclass } from '@/data';
import { updateCharacterClassEntry } from '@/lib/builderRules';

const classDetailTabLabels = {
  features: 'Features',
  subclasses: 'Subclasses',
  proficiencies: 'Proficiencies',
  spellcasting: 'Spellcasting'
} as const;

/**
 * What the Class Levels card says under a class name. A subclass chosen above the class's current
 * level is kept rather than dropped — lowering a level while trying things out should not throw a
 * choice away — so the card says out loud that it is not active yet.
 */
function describeSubclassLine(
  cls: ReturnType<typeof getRuntimeClassById>,
  subclass: ReturnType<typeof getRuntimeSubclass>,
  level: number
) {
  if (!cls) return 'Class not in the current content library';
  if (subclass) {
    return level >= cls.subclassLevel ? subclass.name : `${subclass.name} — unlocks at level ${cls.subclassLevel}`;
  }
  return level >= cls.subclassLevel ? 'No subclass chosen' : `Subclass unlocks at level ${cls.subclassLevel}`;
}

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
  const { resetBuilder, builderState, getCharacter, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const editedCharacter = builderState.editingCharacterId ? getCharacter(builderState.editingCharacterId) : undefined;
  // Someone else's character, opened on a grant: there is no local copy, so leaving goes back to
  // the party sheet it was opened from rather than to My Characters.
  const remoteEditing = builderState.remoteEditing;
  const [classLevelDrafts, setClassLevelDrafts] = useState<Record<string, string>>({});
  const stepRailRef = useRef<HTMLDivElement>(null);
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

  const handleRemoveClass = (classId: string, className?: string) => {
    updateBuilderCharacter({
      classes: updateCharacterClassEntry(builderState.character?.classes, classId, getRuntimeClassById, () => undefined)
    });
    setClassLevelDrafts((current) => {
      if (!(classId in current)) return current;
      const next = { ...current };
      delete next[classId];
      return next;
    });
    toast.success(`${className ?? 'Class'} removed`);
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

  const handleResetBuilder = () => {
    const returnTo = remoteEditing
      ? `/campaign/${remoteEditing.campaignId}/party/${remoteEditing.id}`
      : editedCharacter && `/character/${editedCharacter.id}`;
    resetBuilder();
    if (returnTo) navigate(returnTo);
  };

  // Eight steps do not fit a phone, so the rail scrolls — and a scrolled rail that never follows
  // the wizard leaves the current step off-screen. Scrolling an element is a DOM effect, not
  // component state mirrored from props, so it belongs in an effect.
  useEffect(() => {
    const active = stepRailRef.current?.querySelector('[data-active]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [currentStepIndex]);

  const isFirstStep = currentStepIndex <= 0;
  const isLastStep = currentStepIndex === builderSteps.length - 1;
  const nextButtonLabel = classDetailTabs && currentDetailTabIndex >= 0 && currentDetailTabIndex < classDetailTabs.length - 1
    ? classDetailTabLabels[classDetailTabs[currentDetailTabIndex + 1] as keyof typeof classDetailTabLabels]
    : 'Next';
  const backButtonLabel = classDetailTabs && currentDetailTabIndex > 0
    ? classDetailTabLabels[classDetailTabs[currentDetailTabIndex - 1] as keyof typeof classDetailTabLabels]
    : 'Back';
  const shellClassName = isAbilityScoresRoute ? 'mx-auto w-full max-w-6xl px-4 md:px-6' : '';
  const editingName = editedCharacter?.name ?? (remoteEditing ? builderState.character.name : undefined);
  const builderSubtitle = editingName
    ? `Editing ${editingName}. Changes are saved from the Review step.`
    : 'Create your D&D 5e character step by step';
  const resetButtonLabel = editingName ? 'Discard Changes' : 'Start Over';

  return (
    <div className={isAbilityScoresRoute ? 'flex w-full flex-col space-y-6 py-6' : 'mx-auto flex w-full max-w-6xl flex-col space-y-6'}>
      <div className={shellClassName}>
        <div className="flex flex-col gap-3 short:flex-row short:items-center short:justify-between lg:flex-row lg:items-center lg:justify-between">
          {/* On a landscape phone the title, subtitle and step rail together fill the whole
              viewport, so the step rail — which says the same thing — is the one that stays. */}
          <div className="min-w-0 short:hidden">
            <h1 className="text-2xl font-bold sm:text-3xl">Character Builder</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              {builderSubtitle}
            </p>
          </div>
          <h1 className="hidden text-lg font-bold short:block">Character Builder</h1>
          <Button variant="outline" size="sm" onClick={handleResetBuilder} className="w-fit">
            {resetButtonLabel}
          </Button>
        </div>

        {/* Building for a campaign is a whole different intent from building for yourself, and the
            source filter is already seeded from that campaign — say so rather than let the narrowed
            lists look like missing content (MERGE_PLAN.md Phase 5). */}
        {builderState.forCampaignId ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <Swords className="h-4 w-4 text-muted-foreground" />
            <span>
              Building for <strong>{builderState.forCampaignName ?? 'a campaign'}</strong>
              {builderState.selectedSourceIds.length > 0
                ? `, filtered to its ${builderState.selectedSourceIds.length} allowed sources`
                : ''}
              . It joins the party once you save.
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateBuilderState({ forCampaignId: undefined, forPlayerId: undefined, forCampaignName: undefined })}
            >
              Build it for myself instead
            </Button>
          </div>
        ) : null}
      </div>

      <div className={shellClassName}>
        <div ref={stepRailRef} className="tabs-scrollbar scroll-strip pb-2">
          <div className="flex min-w-max gap-2 sm:gap-3">
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
                  data-active={isActive || undefined}
                  variant={isActive ? 'default' : 'outline'}
                  onClick={() => navigate(step.path)}
                  className="h-auto min-h-12 shrink-0 items-center justify-start gap-2 p-2 text-left short:min-h-11 short:p-2 sm:min-h-20 sm:min-w-36 sm:items-start sm:gap-3 sm:p-3"
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-medium sm:h-8 sm:w-8 ${stepCircleClasses}`}>
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
                const subclass = entry.subclassId ? getRuntimeSubclass(entry.classId, entry.subclassId) : undefined;
                const subclassLine = describeSubclassLine(classData, subclass, entry.level);
                return (
                  <div key={entry.classId} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{classData?.name || entry.classId}</p>
                        {/* The subclass belongs on this card: it is chosen two steps away and there
                            was nothing here that said which one a class was carrying. */}
                        <p className="truncate text-xs text-muted-foreground">{subclassLine}</p>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/builder/class/${entry.classId}`)}>
                          Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${classData?.name || entry.classId}`}
                          onClick={() => handleRemoveClass(entry.classId, classData?.name)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
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
          <CardContent className="p-4 sm:p-6">
            <Outlet />
          </CardContent>
        </Card>
      )}

      {/* Sticky on a phone: the equipment and spell steps are long enough that Next was several
          screens below the fold, and the step rail at the top is the only other way forward. */}
      <div className="pb-safe sticky bottom-0 z-30 border-t bg-background/95 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:border-0 sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
        <div className={shellClassName || 'px-4 sm:px-0'}>
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isFirstStep}
              className="min-h-11 gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="truncate">{backButtonLabel}</span>
            </Button>

            {isLastStep ? (
              <div />
            ) : (
              <Button onClick={handleNext} className="min-h-11 gap-2">
                <span className="truncate">{nextButtonLabel}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
