import { useMemo, useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { useContentLibrary } from '@/data';
import { getSourceFileById } from '@/data/sourceFiles';
import { SourceFilterBar } from '@/components/SourceFilterBar';
import { sourceMatchesSelection } from '@/data/librarySources';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { Search, Shield } from 'lucide-react';
import { toast } from 'sonner';
import type { Feat } from '@/types/dnd';
import {
  getClassFeatSelectionSources,
  getAdditionalFeatSelectionLimit,
  getSelectedClassEdition,
  getSpeciesFeatSelectionSources,
  isOriginFeat,
  resolveBackgroundGrantedFeat,
  type SelectedClassWithLevel
} from '@/lib/builderRules';
import { dedupeByNamePreferringEdition } from '@/lib/contentSelection';

type FeatCategory = 'origin' | 'general' | 'fighting-style' | 'epic-boon';

const featCategoryLabels: Record<FeatCategory, string> = {
  origin: 'Origin Feats',
  general: 'General Feats',
  'fighting-style': 'Fighting Style Feats',
  'epic-boon': 'Epic Boon Feats'
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

const getFeatCategory = (feat: { name: string; sourceId?: string; features?: Array<{ name: string }> }) => {
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

// The structured fields only ever capture part of a prerequisite line (Grappler's "Strength 13
// or higher" lands in `ability`, Eldritch Adept's "Spellcasting or Pact Magic feature" in
// `pactMagic`), so every populated field is reported, and the source's own text is the fallback.
const formatFeatPrerequisites = (feat: Feat) => {
  const prerequisites = feat.prerequisites;
  if (!prerequisites) {
    return 'No prerequisites listed';
  }

  const parts: string[] = [];
  Object.entries(prerequisites.ability ?? {}).forEach(([ability, score]) => {
    parts.push(`${capitalize(ability)} ${score}+`);
  });
  if (prerequisites.race?.length) {
    parts.push(`Race: ${prerequisites.race.join(', ')}`);
  }
  if (prerequisites.class?.length) {
    parts.push(`Class: ${prerequisites.class.join(', ')}`);
  }
  if (prerequisites.level) {
    parts.push(`Level ${prerequisites.level}+`);
  }
  if (prerequisites.spellcasting) {
    parts.push('Spellcasting feature');
  }
  if (prerequisites.pactMagic) {
    parts.push('Pact Magic feature');
  }

  if (parts.length > 0) {
    return `Prerequisite: ${parts.join(' • ')}`;
  }

  return prerequisites.text ? `Prerequisite: ${prerequisites.text}` : 'No prerequisites listed';
};

const EMPTY_SOURCE_IDS: string[] = [];

export function FeatsSelectionPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | FeatCategory>('all');
  const { builderState, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const selectedSourceIds = builderState.selectedSourceIds ?? EMPTY_SOURCE_IDS;
  const { backgrounds, classes, feats, species } = useContentLibrary();

  const selectedClasses = useMemo<SelectedClassWithLevel[]>(() => {
    return (builderState.character?.classes || [])
      .map((entry) => {
        const cls = classes.find((candidate) => candidate.id === entry.classId);
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

  const filteredFeats = useMemo(() => {
    const matchingFeats = feats.filter((feat) => {
      const matchesSearch =
        feat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feat.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
        feat.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || featCategories[feat.id] === categoryFilter;

      return matchesSearch
        && matchesCategory
        && sourceMatchesSelection(feat.source, feat.sourceId, selectedSourceIds)
        && feat.id !== grantedBackgroundFeat?.id;
    });

    // Both editions of the same feat (e.g. Grappler) can pass the filters; show one card,
    // preferring the printing that matches the selected class's rules edition.
    return dedupeByNamePreferringEdition(matchingFeats, selectedClassEdition);
  }, [categoryFilter, featCategories, feats, grantedBackgroundFeat?.id, searchQuery, selectedClassEdition, selectedSourceIds]);

  const isSelected = (featId: string) => manualSelectedFeatIds.includes(featId);

  const getFeatDisabledReason = (featId: string) => {
    const feat = feats.find((entry) => entry.id === featId);
    if (!feat) {
      return null;
    }

    if (originOnlySelections && !isOriginFeat(feat)) {
      return 'This feat pick is currently restricted to Origin feats.';
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
            <Badge variant="secondary">Background feat: {grantedBackgroundFeat ? grantedBackgroundFeat.name : 'None'}</Badge>
            <Badge variant="secondary">Class feat picks available: {classFeatSelectionLimit}</Badge>
            <Badge variant="secondary">Species feat picks available: {speciesFeatSelectionSources.reduce((total, entry) => total + entry.count, 0)}</Badge>
            <Badge variant={remainingFeatSelections > 0 ? 'default' : 'outline'}>
              Remaining picks: {remainingFeatSelections}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            {grantedBackgroundFeat && background ? (
              <Badge variant="outline">
                {background.name}: {grantedBackgroundFeat.name}
              </Badge>
            ) : null}
            {featSelectionSources.map((entry) => (
              <Badge key={`${entry.classId}-${entry.level}-${entry.featureName}`} variant="outline">
                {entry.className} {entry.level}: {entry.featureName}
              </Badge>
            ))}
            {speciesFeatSelectionSources.map((entry) => (
              <Badge key={`${entry.sourceName}-${entry.featureId}`} variant="outline">
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
        <Button variant={categoryFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setCategoryFilter('all')}>
          All Feats
        </Button>
        {(Object.entries(featCategoryLabels) as Array<[FeatCategory, string]>).map(([category, label]) => (
          <Button
            key={category}
            variant={categoryFilter === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter(category)}
          >
            {label}
          </Button>
        ))}
      </div>

      <SourceFilterBar selectedSourceIds={selectedSourceIds} onChange={(next) => updateBuilderState({ selectedSourceIds: next })} />

      <ScrollArea className="h-[32rem] rounded-lg border">
        <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredFeats.map((feat) => {
            const selected = isSelected(feat.id);
            const disabledReason = getFeatDisabledReason(feat.id);
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
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Shield className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{feat.name}</CardTitle>
                        <CardDescription className="text-xs">{feat.source}</CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline">{featCategoryLabels[featCategory]}</Badge>
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
                  {feat.features.length > 0 ? (
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {feat.features.map((feature) => (
                        <li key={feature.id}>
                          • {feature.name ? <span className="font-medium text-foreground">{feature.name}: </span> : null}
                          <ContentReferenceText text={feature.description} />
                        </li>
                      ))}
                    </ul>
                  ) : null}
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
                  <div className="text-xs text-muted-foreground">{formatFeatPrerequisites(feat)}</div>
                  {disabledReason ? <div className="text-xs text-amber-600">{disabledReason}</div> : null}
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