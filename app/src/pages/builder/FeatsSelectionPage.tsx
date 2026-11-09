import { useMemo, useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { resolveClassById, useContentLibrary } from '@/data';
import { getSourceFileById } from '@/data/sourceFiles';
import { SourceFilterBar } from '@/components/SourceFilterBar';
import { sourceMatchesSelection } from '@/data/librarySources';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { ChevronDown, Search, Shield } from 'lucide-react';
import { toast } from 'sonner';
import type { Feat, FeatCategory, Feature } from '@/types/dnd';
import {
  applyAbilityScoreBonuses,
  getClassFeatSelectionSources,
  getAdditionalFeatSelectionLimit,
  getCharacterFeatureNames,
  getMagicFeatureFlags,
  getSelectedClassEdition,
  getSpeciesFeatSelectionSources,
  isOriginFeat,
  resolveBackgroundGrantedFeat,
  type SelectedClassWithLevel
} from '@/lib/builderRules';
import { evaluateFeatPrerequisites, formatContentName, type FeatPrerequisiteContext } from '@/lib/featPrerequisites';
import { dedupeByNamePreferringEdition } from '@/lib/contentSelection';
import { FeatChoicesPanel } from '@/components/builder/FeatChoicesPanel';
import { featHasPendingChoices } from '@/lib/featGrants';
import { getSelectedFeatureOptionIds } from '@/lib/featureOptions';

const featCategoryLabels: Record<FeatCategory, string> = {
  origin: 'Origin',
  general: 'General',
  'fighting-style': 'Fighting Style',
  'epic-boon': 'Epic Boon'
};

const normalizeText = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();

const featCategorySections: Record<string, FeatCategory> = {
  'origin feats': 'origin',
  'general feats': 'general',
  'fighting style feats': 'fighting-style',
  'epic boon feats': 'epic-boon'
};

const fightingStyleFeatNames = new Set([
  'archery',
  'defense',
  'dueling',
  'great weapon fighting',
  'interception',
  'protection',
  'thrown weapon fighting',
  'two weapon fighting',
  'unarmed fighting'
]);

const getFeatCategoryFromSource = (feat: { name: string; sourceId?: string }) => {
  if (!feat.sourceId) {
    return undefined;
  }

  const sourceFile = getSourceFileById(feat.sourceId);
  const sections = sourceFile?.sections ?? [];
  if (sections.length === 0) {
    return undefined;
  }

  const featIndex = sections.findIndex((section) => normalizeText(section.title) === normalizeText(feat.name));
  if (featIndex === -1) {
    return undefined;
  }

  for (let index = featIndex - 1; index >= 0; index -= 1) {
    const category = featCategorySections[normalizeText(sections[index].title)];
    if (category) {
      return category;
    }
  }

  return undefined;
};

const getFeatCategory = (feat: {
  name: string;
  sourceId?: string;
  category?: FeatCategory;
  features?: Array<{ name: string }>;
}) => {
  // The source's own label, where it prints one, over every guess below it.
  if (feat.category) {
    return feat.category;
  }

  const sourceCategory = getFeatCategoryFromSource(feat);
  if (sourceCategory) {
    return sourceCategory;
  }

  if (isOriginFeat(feat as Parameters<typeof isOriginFeat>[0])) {
    return 'origin';
  }

  if (/^boon of /i.test(feat.name) || feat.features?.some((feature) => /epic boon/i.test(feature.name))) {
    return 'epic-boon';
  }

  if (fightingStyleFeatNames.has(normalizeText(feat.name))) {
    return 'fighting-style';
  }

  return 'general';
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

// One chip per requirement, so a feat asking three things does not read as one sentence the eye
// skips. The source's own sentence is read first, because extraction lands only half of "Dwarf or
// a Small race" and chips built from the fields alone would print the dwarf and drop the rest.
const formatFeatPrerequisites = (feat: Feat): string[] => {
  const prerequisites = feat.prerequisites;
  if (!prerequisites) {
    return [];
  }

  const printed = prerequisites.text?.split(';').map((part) => part.trim()).filter(Boolean) ?? [];
  if (printed.length > 0) {
    return printed;
  }

  const parts: string[] = [];
  if (prerequisites.level) {
    parts.push(`Level ${prerequisites.level}+`);
  }
  Object.entries(prerequisites.ability ?? {}).forEach(([ability, score]) => {
    parts.push(`${capitalize(ability)} ${score}+`);
  });
  prerequisites.abilityAlternatives?.forEach((block) => {
    parts.push(Object.entries(block).map(([ability, score]) => `${capitalize(ability)} ${score}+`).join(' and '));
  });
  if (prerequisites.race?.length) {
    parts.push(prerequisites.race.map(formatContentName).join(' or '));
  }
  if (prerequisites.class?.length) {
    parts.push(prerequisites.class.map(formatContentName).join(' or '));
  }
  if (prerequisites.spellcasting) {
    parts.push('Spellcasting feature');
  }
  if (prerequisites.pactMagic) {
    parts.push('Pact Magic feature');
  }
  prerequisites.features?.forEach((feature) => {
    parts.push(`${feature} feature`);
  });
  prerequisites.feats?.forEach((entry) => {
    parts.push(`${formatContentName(entry)} feat`);
  });

  return parts;
};

const VISIBLE_BENEFITS = 2;

const BenefitLine = ({ feature }: Readonly<{ feature: Feature }>) => (
  <li>
    • {feature.name ? <span className="font-medium text-foreground">{feature.name}: </span> : null}
    <ContentReferenceText text={feature.description} />
  </li>
);

// A feat printing six benefits made one card as tall as the whole grid row, so the rest fold away.
// The card itself is the select control, hence the stopPropagation on the trigger.
function FeatBenefitList({ features }: Readonly<{ features: Feature[] }>) {
  const [open, setOpen] = useState(false);

  if (features.length === 0) {
    return null;
  }

  const shown = features.slice(0, VISIBLE_BENEFITS);
  const hidden = features.slice(VISIBLE_BENEFITS);

  return (
    <div className="space-y-1">
      <ul className="space-y-1 text-sm text-muted-foreground">
        {shown.map((feature) => <BenefitLine key={feature.id} feature={feature} />)}
      </ul>
      {hidden.length > 0 && (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleContent>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {hidden.map((feature) => <BenefitLine key={feature.id} feature={feature} />)}
            </ul>
          </CollapsibleContent>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full justify-between px-2 text-xs"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {open ? 'Show less' : `${hidden.length} more ${hidden.length === 1 ? 'benefit' : 'benefits'}`}
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
      )}
    </div>
  );
}

const EMPTY_SOURCE_IDS: string[] = [];

export function FeatsSelectionPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | FeatCategory>('all');
  const [hideUnqualified, setHideUnqualified] = useState(true);
  const { builderState, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const selectedSourceIds = builderState.selectedSourceIds ?? EMPTY_SOURCE_IDS;
  const { backgrounds, classes, feats, spells, species } = useContentLibrary();

  const selectedClasses = useMemo<SelectedClassWithLevel[]>(() => {
    return (builderState.character?.classes || [])
      .map((entry) => {
        const cls = resolveClassById(classes, entry.classId);
        return cls ? { cls, level: entry.level } : undefined;
      })
      .filter((entry): entry is SelectedClassWithLevel => Boolean(entry));
  }, [builderState.character?.classes, classes]);

  const background = builderState.character?.backgroundId
    ? backgrounds.find((entry) => entry.id === builderState.character?.backgroundId)
    : undefined;
  const selectedSpecies = builderState.character?.speciesId
    ? species.find((entry) => entry.id === builderState.character?.speciesId)
    : undefined;
  const selectedVariant = selectedSpecies && builderState.character?.variantId
    ? selectedSpecies.variants?.find((entry) => entry.id === builderState.character?.variantId)
    : undefined;

  const grantedBackgroundFeat = useMemo(() => resolveBackgroundGrantedFeat(background, feats), [background, feats]);
  const classFeatSelectionLimit = useMemo(() => getAdditionalFeatSelectionLimit(selectedClasses), [selectedClasses]);
  const featSelectionSources = useMemo(() => {
    return selectedClasses.flatMap((entry) => getClassFeatSelectionSources(entry));
  }, [selectedClasses]);
  const speciesFeatSelectionSources = useMemo(() => {
    return getSpeciesFeatSelectionSources({ species: selectedSpecies, variant: selectedVariant });
  }, [selectedSpecies, selectedVariant]);
  const featSelectionLimit = classFeatSelectionLimit + speciesFeatSelectionSources.reduce((total, entry) => total + entry.count, 0);
  const manualSelectedFeatIds = useMemo(() => {
    return (builderState.character?.feats || []).filter((featId) => featId !== grantedBackgroundFeat?.id);
  }, [builderState.character?.feats, grantedBackgroundFeat?.id]);

  const remainingFeatSelections = Math.max(0, featSelectionLimit - manualSelectedFeatIds.length);
  const originOnlySelections = speciesFeatSelectionSources.every((entry) => entry.featType === 'origin') && speciesFeatSelectionSources.length > 0;
  const featCategories = useMemo(() => {
    return feats.reduce<Record<string, FeatCategory>>((categories, feat) => {
      categories[feat.id] = getFeatCategory(feat);
      return categories;
    }, {});
  }, [feats]);

  const selectedClassEdition = useMemo(() => getSelectedClassEdition(selectedClasses), [selectedClasses]);

  // By name, not by id: a prerequisite points at a feat the way a book does, and a stored id goes
  // stale as packs improve. Taking Strike of the Giants is what opens the six giant feats.
  const chosenFeatNames = useMemo(() => {
    const ids = new Set([...(grantedBackgroundFeat ? [grantedBackgroundFeat.id] : []), ...manualSelectedFeatIds]);
    return feats.filter((entry) => ids.has(entry.id)).map((entry) => entry.name);
  }, [feats, grantedBackgroundFeat, manualSelectedFeatIds]);

  const prerequisiteContext = useMemo<FeatPrerequisiteContext>(() => {
    const magic = getMagicFeatureFlags(selectedClasses);
    return {
      abilityScores: applyAbilityScoreBonuses(
        builderState.character?.abilityScores,
        builderState.character?.abilityScoreBonuses
      ),
      totalLevel: selectedClasses.reduce((total, entry) => total + entry.level, 0),
      classNames: selectedClasses.map((entry) => entry.cls.name),
      featureNames: getCharacterFeatureNames({ selectedClasses, species: selectedSpecies, variant: selectedVariant }),
      featNames: chosenFeatNames,
      species: selectedSpecies,
      variant: selectedVariant,
      ...magic
    };
  }, [
    builderState.character?.abilityScoreBonuses,
    builderState.character?.abilityScores,
    chosenFeatNames,
    selectedClasses,
    selectedSpecies,
    selectedVariant
  ]);

  const prerequisiteResults = useMemo(() => {
    return new Map(feats.map((feat) => [feat.id, evaluateFeatPrerequisites(feat, prerequisiteContext)]));
  }, [feats, prerequisiteContext]);

  // The background's feat is one the character has too, so its own choices belong here as well.
  const chosenFeats = useMemo(() => {
    const ids = Array.from(new Set([
      ...(grantedBackgroundFeat ? [grantedBackgroundFeat.id] : []),
      ...manualSelectedFeatIds
    ]));
    return ids.map((featId) => feats.find((entry) => entry.id === featId)).filter((entry): entry is Feat => Boolean(entry));
  }, [feats, grantedBackgroundFeat, manualSelectedFeatIds]);

  const pendingChoiceFeatIds = useMemo(() => {
    const selections = {
      featSpellSelections: builderState.character?.featSpellSelections,
      selectedOptionIdsFor: (choiceId: string) =>
        getSelectedFeatureOptionIds(builderState.character?.features, choiceId)
    };
    return new Set(chosenFeats.filter((feat) => featHasPendingChoices(feat, selections)).map((feat) => feat.id));
  }, [builderState.character?.featSpellSelections, builderState.character?.features, chosenFeats]);

  // Everything the search and the book filter leave, before the category tabs narrow it: the tab
  // counts have to say how many each tab would show, not how many the current one holds.
  const searchedFeats = useMemo(() => {
    const matchingFeats = feats.filter((feat) => {
      const needle = searchQuery.toLowerCase();
      const matchesSearch =
        feat.name.toLowerCase().includes(needle) ||
        feat.source.toLowerCase().includes(needle) ||
        feat.description.toLowerCase().includes(needle);

      return matchesSearch
        && sourceMatchesSelection(feat.source, feat.sourceId, selectedSourceIds)
        && feat.id !== grantedBackgroundFeat?.id;
    });

    // Both editions of the same feat (e.g. Grappler) can pass the filters; show one card,
    // preferring the printing that matches the selected class's rules edition.
    return dedupeByNamePreferringEdition(matchingFeats, selectedClassEdition);
  }, [feats, grantedBackgroundFeat?.id, searchQuery, selectedClassEdition, selectedSourceIds]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<'all' | FeatCategory, number>();
    const countable = hideUnqualified
      ? searchedFeats.filter((feat) => prerequisiteResults.get(feat.id)?.met !== false)
      : searchedFeats;
    counts.set('all', countable.length);
    countable.forEach((feat) => {
      const category = featCategories[feat.id];
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });
    return counts;
  }, [featCategories, hideUnqualified, prerequisiteResults, searchedFeats]);

  const filteredFeats = useMemo(() => {
    const inCategory = categoryFilter === 'all'
      ? searchedFeats
      : searchedFeats.filter((feat) => featCategories[feat.id] === categoryFilter);
    const qualifying = inCategory.filter((feat) => prerequisiteResults.get(feat.id)?.met !== false);

    if (hideUnqualified) {
      return qualifying;
    }

    // A feat the character cannot take still reads as an offer while it sits among the ones they
    // can, so the ones they qualify for come first.
    return [...qualifying, ...inCategory.filter((feat) => prerequisiteResults.get(feat.id)?.met === false)];
  }, [categoryFilter, featCategories, hideUnqualified, prerequisiteResults, searchedFeats]);

  const isSelected = (featId: string) => manualSelectedFeatIds.includes(featId);

  const getOriginRestriction = (feat: Feat) =>
    originOnlySelections && !isOriginFeat(feat) ? 'This feat pick is restricted to Origin feats.' : null;

  const getFeatDisabledReason = (featId: string) => {
    const feat = feats.find((entry) => entry.id === featId);
    if (!feat) {
      return null;
    }

    const restriction = getOriginRestriction(feat);
    if (restriction) {
      return restriction;
    }

    const prerequisites = prerequisiteResults.get(featId);
    if (prerequisites && !prerequisites.met) {
      return prerequisites.unmet.join('. ');
    }

    return null;
  };

  const toggleFeat = (featId: string) => {
    const currentFeats = builderState.character?.feats || [];
    const selected = manualSelectedFeatIds.includes(featId);
    const disabledReason = getFeatDisabledReason(featId);

    if (!selected && disabledReason) {
      toast.error(disabledReason);
      return;
    }

    if (!selected && featSelectionLimit <= manualSelectedFeatIds.length) {
      toast.error('You have filled all currently available feat selections for this character.');
      return;
    }

    updateBuilderCharacter({
      feats: selected ? currentFeats.filter((entry) => entry !== featId) : [...currentFeats, featId]
    });

    toast.success(selected ? 'Feat removed' : 'Feat added');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Feats</h2>
        <p className="text-muted-foreground">
          Feats are handled here in context: background-granted feats are applied automatically, and additional feat picks come from class advancement levels plus any species or lineage features that grant a feat choice.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Feat Sources</CardTitle>
          <CardDescription>
            The builder now treats feats as part of your character progression instead of an unrestricted add-on list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="max-w-full whitespace-normal text-left">Background feat: {grantedBackgroundFeat ? grantedBackgroundFeat.name : 'None'}</Badge>
            <Badge variant="secondary" className="max-w-full whitespace-normal text-left">Class feat picks available: {classFeatSelectionLimit}</Badge>
            <Badge variant="secondary" className="max-w-full whitespace-normal text-left">Species feat picks available: {speciesFeatSelectionSources.reduce((total, entry) => total + entry.count, 0)}</Badge>
            <Badge variant={remainingFeatSelections > 0 ? 'default' : 'outline'} className="max-w-full whitespace-normal text-left">
              Remaining picks: {remainingFeatSelections}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {grantedBackgroundFeat && background ? (
              <Badge variant="outline" className="max-w-full whitespace-normal text-left">
                {background.name}: {grantedBackgroundFeat.name}
              </Badge>
            ) : null}
            {featSelectionSources.map((entry) => (
              <Badge key={`${entry.classId}-${entry.level}-${entry.featureName}`} variant="outline" className="max-w-full whitespace-normal text-left">
                {entry.className} {entry.level}: {entry.featureName}
              </Badge>
            ))}
            {speciesFeatSelectionSources.map((entry) => (
              <Badge key={`${entry.sourceName}-${entry.featureId}`} variant="outline" className="max-w-full whitespace-normal text-left">
                {entry.sourceName}: {entry.featureName}{entry.featType === 'origin' ? ' (Origin feat)' : ''}
              </Badge>
            ))}
          </div>
          {selectedClasses.length > 0 ? (
            <div className="text-sm text-muted-foreground">
              Advancement classes: {selectedClasses.map((entry) => `${entry.cls.name} ${entry.level}`).join(', ')}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select a class and set its level to unlock class-based feat selections.</p>
          )}
          {grantedBackgroundFeat && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Granted by Background</p>
                  <p className="text-sm text-muted-foreground">{grantedBackgroundFeat.name}</p>
                </div>
                <Badge>Auto Applied</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{grantedBackgroundFeat.description || background?.feature.description || 'This feat is granted by the selected background.'}</p>
            </div>
          )}
          {originOnlySelections && (
            <p className="text-sm text-muted-foreground">
              The current species choice only grants Origin feat picks, so non-Origin feats stay visible here but cannot be selected for that slot.
            </p>
          )}
        </CardContent>
      </Card>

      {chosenFeats.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Feats</CardTitle>
            <CardDescription>
              Anything a feat still asks you to choose is here, next to the feat that asks for it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {chosenFeats.map((feat) => (
              <div key={feat.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">{feat.name}</h4>
                  <Badge variant="outline">{feat.source}</Badge>
                  {feat.id === grantedBackgroundFeat?.id ? <Badge variant="secondary">From your background</Badge> : null}
                  {pendingChoiceFeatIds.has(feat.id) ? <Badge>Choices to make</Badge> : null}
                </div>
                <FeatChoicesPanel
                  feat={feat}
                  character={builderState.character ?? {}}
                  spells={spells}
                  classes={classes}
                  preferredEdition={selectedClassEdition}
                  onChange={updateBuilderCharacter}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search advancement feats..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={categoryFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          aria-pressed={categoryFilter === 'all'}
          onClick={() => setCategoryFilter('all')}
        >
          All <span className="ml-1.5 tabular-nums opacity-70">{categoryCounts.get('all') ?? 0}</span>
        </Button>
        {(Object.entries(featCategoryLabels) as Array<[FeatCategory, string]>).map(([category, label]) => (
          <Button
            key={category}
            variant={categoryFilter === category ? 'default' : 'outline'}
            size="sm"
            aria-pressed={categoryFilter === category}
            disabled={(categoryCounts.get(category) ?? 0) === 0 && categoryFilter !== category}
            onClick={() => setCategoryFilter(category)}
          >
            {label} <span className="ml-1.5 tabular-nums opacity-70">{categoryCounts.get(category) ?? 0}</span>
          </Button>
        ))}
        <Button
          variant={hideUnqualified ? 'default' : 'outline'}
          size="sm"
          aria-pressed={hideUnqualified}
          onClick={() => setHideUnqualified((current) => !current)}
        >
          Only feats you qualify for
        </Button>
      </div>

      <SourceFilterBar selectedSourceIds={selectedSourceIds} onChange={(next) => updateBuilderState({ selectedSourceIds: next })} />

      <ScrollArea className="h-[32rem] rounded-lg border">
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFeats.map((feat) => {
            const selected = isSelected(feat.id);
            const restriction = getOriginRestriction(feat);
            const unmetPrerequisites = restriction ? [] : prerequisiteResults.get(feat.id)?.unmet ?? [];
            const disabledReason = restriction ?? (unmetPrerequisites.length > 0 ? unmetPrerequisites.join('. ') : null);
            const prerequisiteLabels = formatFeatPrerequisites(feat);
            const featCategory = featCategories[feat.id];
            const hasRemainingFeatSelections = remainingFeatSelections > 0;
            const canAddFeat = selected || hasRemainingFeatSelections;
            const hasDisabledReason = Boolean(disabledReason);
            const disabled = hasDisabledReason;
            const shouldShowNoPicksNotice = selected === false && hasDisabledReason === false && hasRemainingFeatSelections === false;
            let buttonLabel = 'Add Feat';
            if (selected) {
              buttonLabel = 'Selected';
            } else if (hasDisabledReason) {
              buttonLabel = 'Unavailable';
            } else if (hasRemainingFeatSelections === false) {
              buttonLabel = 'No Picks Left';
            }

            return (
              <Card
                key={feat.id}
                className={`transition-all ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:border-primary'} ${selected ? 'border-primary ring-1 ring-primary' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!disabled) {
                    toggleFeat(feat.id);
                  }
                }}
                onKeyDown={(event) => {
                  if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    toggleFeat(feat.id);
                  }
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base">{feat.name}</CardTitle>
                        <CardDescription className="break-words text-xs">{feat.source}</CardDescription>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant="outline">{featCategoryLabels[featCategory]}</Badge>
                      {feat.repeatable ? <Badge variant="secondary">Repeatable</Badge> : null}
                      {selected ? <Badge>Selected</Badge> : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  {feat.description ? (
                    <p className="text-sm text-muted-foreground"><ContentReferenceText text={feat.description} /></p>
                  ) : null}
                  {/* Most feats print a preamble ("You gain the following benefits:") and put the
                      actual benefits in a bullet list, which the card used to drop entirely. */}
                  <FeatBenefitList features={feat.features} />
                  {feat.abilityScoreIncreases?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {feat.abilityScoreIncreases.map((increase) => (
                        <Badge key={`${feat.id}-${increase.ability}-${increase.amount}`} variant="secondary">
                          {increase.ability === 'choose'
                            ? `+${increase.amount} to ${increase.chooseCount ?? 1} of your choice`
                            : `${capitalize(increase.ability)} +${increase.amount}`}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {feat.description || feat.features.length > 0 ? null : (
                    <p className="text-sm text-muted-foreground">No description was extracted for this feat from its source.</p>
                  )}
                  {prerequisiteLabels.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-xs text-muted-foreground">Requires</span>
                      {prerequisiteLabels.map((label) => (
                        <Badge key={label} variant="secondary" className="max-w-full whitespace-normal text-left font-normal">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  {/* The chips say what the book asks; these say what this character is short of. */}
                  {unmetPrerequisites.map((reason) => (
                    <div key={reason} className="text-xs text-amber-600">{reason}</div>
                  ))}
                  {restriction ? <div className="text-xs text-amber-600">{restriction}</div> : null}
                  {shouldShowNoPicksNotice ? (
                    <div className="text-xs text-muted-foreground">No remaining feat picks available.</div>
                  ) : null}
                  <Button variant={selected ? 'default' : 'outline'} size="sm" className="w-full" disabled={disabled || (!selected && !canAddFeat)}>
                    {buttonLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>

      {filteredFeats.length === 0 && (
        <div className="py-8 text-center text-muted-foreground">
          No feats found matching the current filters.
        </div>
      )}
    </div>
  );
}