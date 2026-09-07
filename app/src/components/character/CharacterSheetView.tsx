// The rendered character sheet (MERGE_PLAN.md Phase 5).
//
// Extracted from `CharacterSheetPage` so the campaign party view can render a *fetched* character
// through exactly the same code as the one in your own cache. That is the point of Phase 5: the
// roster shows real, live sheets — the ones the builder produces — rather than the D&D Beyond blob
// the scheduler used to store on the seat.
//
// It takes a whole `Character` and derives everything else. It reads no store and performs no
// writes, so the owner's page and a campaign-mate's read-only view differ only in the `actions`
// they hand it.
import { useMemo, type ReactNode } from 'react';
import {
  getRuntimeClassById,
  getRuntimeEquipmentById,
  getRuntimeFeatById,
  getRuntimeSpeciesById,
  getRuntimeSpeciesVariant,
  getRuntimeSpellById,
  getRuntimeSubclass,
  useContentLibrary
} from '@/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  applyAbilityScoreBonuses,
  deriveAbilityScoreBonuses,
  deriveArmorClass,
  deriveCharacterHitPoints,
  deriveCharacterProficiencies,
  getActiveFeatures,
  getCharacterProficiencyBonus,
  getSpellcastingRulesSummary,
  resolveBackgroundGrantedFeat,
  resolveCharacterClasses,
  getRulesEdition,
  resolveCharacterEquipment,
  sortFeaturesByLevel
} from '@/lib/builderRules';
import { deriveAttacks, deriveSheetVitals } from '@/lib/sheetDerivations';
import { deriveDefences, deriveTimedFeatures, deriveUnarmedStrike } from '@/lib/sheetCombat';
import { resolveFeatOptionChoicePool, resolveFeatSpellEntries } from '@/lib/featGrants';
import { applyLongRest, applyShortRest, resolveClassResources } from '@/lib/sheetPlayState';
import { SheetAttacksPanel } from '@/components/character/SheetAttacksPanel';
import { SheetDefencesCard, SheetTurnCard } from '@/components/character/SheetCombatPanel';
import { AdvantageToggle } from '@/components/character/AdvantageToggle';
import { SheetEquipmentPanel } from '@/components/character/SheetEquipmentPanel';
import { SheetResourcesPanel, type HitDicePool } from '@/components/character/SheetResourcesPanel';
import { SheetSpellsPanel, type SheetSpellEntry } from '@/components/character/SheetSpellsPanel';
import { SheetFeatureList } from '@/components/character/SheetFeatureList';
import { SheetLevelUpButton } from '@/components/character/SheetLevelUpButton';
import { AdvancementTasks } from '@/components/character/AdvancementTasks';
import { deriveAdvancementTasks } from '@/lib/characterAdvancement';
import { getChosenFeatureOptions } from '@/lib/featureOptions';
import { SheetSpellcastingCard, SheetVitalsPanel } from '@/components/character/SheetVitalsPanel';
import {
  ArmorClassCard,
  ProficiencyBonusCard,
  SheetQuickInfoRail
} from '@/components/character/SheetQuickInfoRail';
import { useSheetLayout } from '@/components/character/useSheetLayout';
import type { AbilityScores, Character, Feature } from '@/types/dnd';

const humanizeFallbackId = (value: string) => value.split('-').filter(Boolean).join(' ');
const isDefined = <T,>(value: T | null | undefined): value is T => Boolean(value);
const calculateModifier = (score: number): number => Math.floor((score - 10) / 2);
const normalizeEquipmentName = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();

interface CharacterSheetViewProps {
  character: Character;
  /** Buttons for the header row. The view itself never writes, so every action comes from here. */
  actions?: ReactNode;
  /** Rendered ahead of the title — a back link, usually. */
  leading?: ReactNode;
  /** Shown under the title. Used to say whose sheet this is when it is not the reader's. */
  note?: ReactNode;
  /**
   * The whole write surface. Omitting it is what makes this read-only, which is how a campaign-mate
   * renders someone else's sheet through the same component. Every tracker and every equipment or
   * spell edit hands back a patch; the page decides what to do with it.
   */
  onChange?: (patch: Partial<Character>) => void;
  /**
   * How an unfinished choice is opened. The sheet cannot navigate into the builder on its own —
   * the character has to be loaded into it first — so the page that owns that does it. Without
   * this the outstanding choices are still listed, and only the links are gone.
   */
  onOpenBuilder?: (path: string) => void;
}

export function CharacterSheetView({
  character,
  actions,
  leading,
  note,
  onChange,
  onOpenBuilder
}: Readonly<CharacterSheetViewProps>) {
  const { backgrounds, classes: classCatalogue, equipment, feats, spells: spellCatalogue } = useContentLibrary();
  const { railIsColumn, railIsSticky } = useSheetLayout();

  const species = getRuntimeSpeciesById(character.speciesId);
  const variant = character.variantId ? getRuntimeSpeciesVariant(character.speciesId, character.variantId) : undefined;
  const background = character.backgroundId ? backgrounds.find((entry) => entry.id === character.backgroundId) : undefined;

  const resolvedClasses = useMemo(() => {
    return resolveCharacterClasses({
      classes: character.classes,
      getClassById: getRuntimeClassById,
      getSubclassById: getRuntimeSubclass
    });
  }, [character.classes]);

  // Rages, Ki Points, Channel Divinity: whatever this character's class tables state, at the level
  // they hold in each class. The class knows its own pools, so nothing here names one.
  const classResources = useMemo(
    () => resolveClassResources(character, getRuntimeClassById),
    [character],
  );

  const classSpells = useMemo<SheetSpellEntry[]>(() => {
    return character.spells.map((entry) => {
      const spell = getRuntimeSpellById(entry.spellId);
      return {
        id: entry.spellId,
        name: spell?.name ?? humanizeFallbackId(entry.spellId),
        level: spell?.level ?? 0,
        spell,
        prepared: entry.prepared,
        alwaysPrepared: entry.alwaysPrepared
      };
    });
  }, [character.spells]);

  const featData = useMemo(() => {
    return character.feats.map((featId) => getRuntimeFeatById(featId)).filter(isDefined);
  }, [character.feats]);
  const grantedBackgroundFeat = useMemo(() => resolveBackgroundGrantedFeat(background, feats), [background, feats]);
  const backgroundSuggestedCharacteristics = useMemo(() => {
    if (!background) {
      return [];
    }

    return background.suggestedCharacteristics?.length
      ? background.suggestedCharacteristics
      : [
          ...background.personalityTraits,
          ...background.ideals,
          ...background.bonds,
          ...background.flaws
        ];
  }, [background]);
  let hasStructuredBackgroundCharacteristics = false;
  if (background) {
    hasStructuredBackgroundCharacteristics = background.personalityTraits.length > 0
      || background.ideals.length > 0
      || background.bonds.length > 0
      || background.flaws.length > 0;
  }
  let backgroundCharacteristicsContent = null;

  if (hasStructuredBackgroundCharacteristics) {
    backgroundCharacteristicsContent = (
      <>
        <div>
          <h4 className="mb-2 font-medium">Personality Traits</h4>
          <ul className="space-y-1">
            {background?.personalityTraits.slice(0, 3).map((trait) => (
              <li key={trait} className="text-sm text-muted-foreground">• {trait}</li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="mb-2 font-medium">Ideals</h4>
          <ul className="space-y-1">
            {background?.ideals.slice(0, 3).map((ideal) => (
              <li key={ideal} className="text-sm text-muted-foreground">• {ideal}</li>
            ))}
          </ul>
        </div>
      </>
    );
  } else if (backgroundSuggestedCharacteristics.length > 0) {
    backgroundCharacteristicsContent = (
      <div>
        <h4 className="mb-2 font-medium">Suggested Characteristics</h4>
        <ul className="space-y-1">
          {backgroundSuggestedCharacteristics.map((trait) => (
            <li key={trait} className="text-sm text-muted-foreground">• {trait}</li>
          ))}
        </ul>
      </div>
    );
  }
  const allFeatData = useMemo(() => {
    const byId = new Map(featData.map((entry) => [entry.id, entry]));
    if (grantedBackgroundFeat) {
      byId.set(grantedBackgroundFeat.id, grantedBackgroundFeat);
    }

    return Array.from(byId.values());
  }, [featData, grantedBackgroundFeat]);

  // Which printing this character plays, so a feat naming "misty step" resolves to the right one.
  const preferredEdition = useMemo(() => {
    const first = resolvedClasses[0]?.cls;
    return getRulesEdition(first?.sourceId, first?.source);
  }, [resolvedClasses]);

  // A feat's spells are the feat's, not a class's: they never counted against a known or prepared
  // limit, and before this they simply never reached the sheet at all.
  const featSpells = useMemo(() => {
    return resolveFeatSpellEntries(allFeatData, character.featSpellSelections, spellCatalogue, preferredEdition);
  }, [allFeatData, character.featSpellSelections, preferredEdition, spellCatalogue]);

  const selectedSpells = useMemo<SheetSpellEntry[]>(() => {
    const held = new Set(classSpells.map((entry) => entry.id));
    return [
      ...classSpells,
      ...featSpells
        .filter((entry) => !held.has(entry.id))
        .map((entry) => ({
          id: entry.id,
          name: entry.name,
          level: entry.level,
          spell: entry.spell,
          prepared: true,
          grantedBy: entry.featName
        }))
    ];
  }, [classSpells, featSpells]);

  const resolvedEquipment = useMemo(() => {
    return resolveCharacterEquipment({
      equipment: character.equipment,
      getEquipmentById: getRuntimeEquipmentById,
      findEquipmentByName: (equipmentName) => equipment.find((entry) => normalizeEquipmentName(entry.name) === normalizeEquipmentName(equipmentName)),
      getClassById: getRuntimeClassById,
      getBackgroundById: (backgroundId) => backgrounds.find((entry) => entry.id === backgroundId)
    });
  }, [character.equipment, backgrounds, equipment]);

  const derivedProficiencies = useMemo(() => {
    return deriveCharacterProficiencies({
      character,
      resolvedClasses,
      background,
      species,
      variant
    });
  }, [character, background, resolvedClasses, species, variant]);

  const activeFeatures = useMemo(() => {
    return getActiveFeatures({
      species,
      variant,
      resolvedClasses,
      feats: allFeatData,
      selectedFeatures: character.features
    });
  }, [character.features, allFeatData, resolvedClasses, species, variant]);

  const derivedAbilityBonuses = useMemo(() => {
    return deriveAbilityScoreBonuses({
      background,
      species,
      variant,
      feats: allFeatData,
      abilityScoreChoiceModes: character.abilityScoreChoiceModes,
      abilityScoreChoiceSelections: character.abilityScoreChoiceSelections
    });
  }, [character.abilityScoreChoiceModes, character.abilityScoreChoiceSelections, allFeatData, background, species, variant]);

  const displayedAbilityScores = useMemo(() => {
    const storedBonuses = Object.keys(character.abilityScoreBonuses ?? {}).length > 0
      ? character.abilityScoreBonuses
      : derivedAbilityBonuses;
    return applyAbilityScoreBonuses(character.abilityScores, storedBonuses);
  }, [character.abilityScoreBonuses, character.abilityScores, derivedAbilityBonuses]);

  const displayedHp = character.hp.maximum > 0
    ? character.hp
    : deriveCharacterHitPoints({
      classes: character.classes,
      abilityScores: displayedAbilityScores,
      previousHp: character.hp,
      getClassById: getRuntimeClassById
    });
  const characterWithResolvedHp = useMemo(
    () => (character.hp === displayedHp ? character : { ...character, hp: displayedHp }),
    [character, displayedHp]
  );

  const derivedArmor = useMemo(() => {
    return deriveArmorClass({
      abilityScores: displayedAbilityScores,
      proficiencies: derivedProficiencies,
      equipment: resolvedEquipment,
      activeFeatures
    });
  }, [activeFeatures, derivedProficiencies, displayedAbilityScores, resolvedEquipment]);

  const totalLevel = character.classes.reduce((sum, entry) => sum + entry.level, 0) || 1;
  const proficiencyBonus = getCharacterProficiencyBonus(totalLevel);

  const vitals = useMemo(() => {
    return deriveSheetVitals({
      abilityScores: displayedAbilityScores,
      proficiencies: derivedProficiencies,
      resolvedClasses,
      // Species speed is the walking speed; 30 is the default when nothing is chosen yet.
      speed: species?.speed ?? 30,
      totalLevel
    });
  }, [derivedProficiencies, displayedAbilityScores, resolvedClasses, species, totalLevel]);

  const attacks = useMemo(() => {
    return [
      ...deriveAttacks({
        equipment: resolvedEquipment,
        abilityScores: displayedAbilityScores,
        proficiencyBonus: vitals.proficiencyBonus,
        weaponProficiencies: derivedProficiencies.weapons
      }),
      // Nobody has to equip their fists, so the sheet has to know about them itself.
      deriveUnarmedStrike(displayedAbilityScores, vitals.proficiencyBonus)
    ];
  }, [derivedProficiencies.weapons, displayedAbilityScores, resolvedEquipment, vitals.proficiencyBonus]);

  // An option the player chose is a feature in its own right — an Eldritch Invocation that says
  // "as a Bonus Action" belongs in the turn list as much as the class feature that offered it.
  const activeFeaturesWithChoices = useMemo<Feature[]>(() => {
    const chosen = activeFeatures.flatMap((feature) =>
      getChosenFeatureOptions(feature, character.features).map((option) => ({
        id: option.id,
        name: option.name,
        description: option.description,
        level: feature.level,
        source: feature.source
      })));
    return [...activeFeatures, ...chosen];
  }, [activeFeatures, character.features]);

  // When a feature is used and what it protects against, read from the feature's own sentences.
  const timedFeatures = useMemo(() => deriveTimedFeatures(activeFeaturesWithChoices), [activeFeaturesWithChoices]);
  const defences = useMemo(() => deriveDefences(activeFeaturesWithChoices), [activeFeaturesWithChoices]);

  const spellcastingRules = useMemo(() => {
    return getSpellcastingRulesSummary({
      selectedClasses: resolvedClasses.map(({ entry, cls, subclass }) => ({
        cls,
        level: entry.level,
        subclassId: entry.subclassId,
        subclass
      })),
      abilityScores: displayedAbilityScores,
      selectedSpells: character.spells,
      getSpellById: getRuntimeSpellById
    });
  }, [character.spells, displayedAbilityScores, resolvedClasses]);

  const hitDicePools = useMemo<HitDicePool[]>(() => {
    return resolvedClasses
      .filter(({ cls }) => cls.hitDie > 0)
      .map(({ cls, entry }) => ({
        classId: entry.classId,
        className: cls.name,
        die: `d${cls.hitDie}`,
        total: entry.level,
        used: Math.min(entry.hitDiceUsed ?? 0, entry.level)
      }));
  }, [resolvedClasses]);

  const classSummary = resolvedClasses
    .map(({ entry, cls, subclass }) => {
      const label = `${cls.name} ${entry.level}`;
      return subclass ? `${label} (${subclass.name})` : label;
    })
    .join(' / ');
  // A feat reads as one entry with its benefits under it, which is what the books print. Its own
  // borrowed-option picks (Eldritch Adept's invocation) are features in their own right.
  const featCards = useMemo<Feature[]>(() => {
    return allFeatData.flatMap((feat) => [
      {
        id: feat.id,
        name: feat.name,
        level: 1,
        source: feat.source,
        description: [
          feat.description,
          ...feat.features.map((benefit) => (benefit.name ? `${benefit.name}. ${benefit.description}` : benefit.description))
        ].filter(Boolean).join('\n\n')
      },
      ...(feat.optionChoices ?? []).map((choice) => ({
        id: choice.id,
        name: `${feat.name}: ${choice.featureName}`,
        level: 1,
        source: feat.source,
        description: choice.label,
        chooseCount: choice.count,
        options: resolveFeatOptionChoicePool(choice, classCatalogue, preferredEdition)
      }))
    ]);
  }, [allFeatData, classCatalogue, preferredEdition]);

  // Everything this character has earned from its levels and not yet chosen. Derived from the same
  // classes, species and feats the rest of the sheet reads, so nothing here names a class feature.
  const advancementTasks = useMemo(() => {
    return deriveAdvancementTasks({
      character,
      resolvedClasses,
      species,
      variant,
      background,
      featCatalogue: feats,
      feats: allFeatData,
      spellcastingRules
    });
  }, [allFeatData, background, character, feats, resolvedClasses, species, spellcastingRules, variant]);

  const hasSpellcasting = selectedSpells.length > 0
    || vitals.spellcasting.length > 0
    || spellcastingRules.slotsByLevel.some((count) => count > 0)
    || spellcastingRules.pactSlotsByLevel.some((count) => count > 0);
  const abilityBonusFor = (ability: keyof AbilityScores) =>
    character.abilityScoreBonuses?.[ability] ?? derivedAbilityBonuses[ability] ?? 0;

  return (
    // `sheet-dense` tightens every Card inside the sheet (index.css). A play sheet is a document a
    // player reads at speed, and shadcn's default card chrome is most of a laptop screen.
    <div className="sheet-dense space-y-4 sm:space-y-6">
      {/* The header is not sticky. In landscape there are ~390px of height, and a pinned header on
          top of a pinned rail leaves no room for the thing being read. */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold sm:text-3xl short:text-xl">{character.name}</h1>
          <p className="text-muted-foreground short:hidden">
            Level {totalLevel} {species?.name ?? 'Unknown Species'} {classSummary}
          </p>
          {note}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onChange ? (
            <>
              <SheetLevelUpButton
                character={character}
                resolvedClasses={resolvedClasses}
                onChange={onChange}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() => onChange(applyShortRest(character, classResources))}
              >
                Short Rest
              </Button>
              <Button
                type="button"
                size="sm"
                className="min-h-11"
                onClick={() => onChange(applyLongRest(character, classResources))}
              >
                Long Rest
              </Button>
            </>
          ) : null}
          {actions}
        </div>
      </div>

      <AdvantageToggle />

      <AdvancementTasks tasks={advancementTasks} onOpen={onOpenBuilder} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-6">
        <div
          className={
            railIsSticky
              ? 'lg:sticky lg:top-16 lg:max-h-[calc(100dvh-5rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1'
              : undefined
          }
        >
          <SheetQuickInfoRail
            character={characterWithResolvedHp}
            abilityScores={displayedAbilityScores}
            baseAbilityScores={character.abilityScores}
            abilityBonusFor={abilityBonusFor}
            armor={derivedArmor}
            proficiencyBonus={proficiencyBonus}
            totalLevel={totalLevel}
            vitals={vitals}
            railIsColumn={railIsColumn}
            onChange={onChange}
          />
        </div>

        <Tabs defaultValue="actions" className="min-w-0">
          {/* Six labels never fit 390px, so the strip scrolls at each label's natural width rather
              than clipping every one of them at both ends. */}
          <TabsList className="w-full justify-start overscroll-x-contain [&>*]:flex-none coarse:h-auto coarse:[&>*]:min-h-11">
            {railIsColumn ? null : <TabsTrigger value="stats">Stats</TabsTrigger>}
            <TabsTrigger value="actions">Actions</TabsTrigger>
            {hasSpellcasting ? <TabsTrigger value="spells">Spells</TabsTrigger> : null}
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="description">Description</TabsTrigger>
          </TabsList>

          {/* Saves, skills and the passives live in the rail wherever there is a column for them.
              Below that they are here instead, so nothing on the sheet renders twice. */}
          {railIsColumn ? null : (
            <TabsContent value="stats" className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <ArmorClassCard armor={derivedArmor} />
                <ProficiencyBonusCard proficiencyBonus={proficiencyBonus} totalLevel={totalLevel} />
              </div>
              <SheetVitalsPanel vitals={vitals} />
            </TabsContent>
          )}

          {/* Two columns from xl: the rail is a tall column and the content beside it was mostly
              empty, so what a player uses in a fight fits on one screen instead of scrolling. */}
          <TabsContent
            value="actions"
            className="space-y-4 xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0"
          >
            <SheetAttacksPanel attacks={attacks} />

            <div className="space-y-4">
              <SheetResourcesPanel
                character={character}
                hitDice={hitDicePools}
                slotsByLevel={spellcastingRules.slotsByLevel}
                pactSlotsByLevel={spellcastingRules.pactSlotsByLevel}
                classResources={classResources}
                constitutionModifier={calculateModifier(displayedAbilityScores.constitution)}
                onChange={onChange}
              />

              <SheetTurnCard timedFeatures={timedFeatures} />
            </div>
          </TabsContent>

          {hasSpellcasting ? (
            <TabsContent value="spells" className="space-y-4">
              <SheetSpellcastingCard vitals={vitals} />
              <SheetSpellsPanel
                character={character}
                spells={selectedSpells}
                catalogue={spellCatalogue}
                castingStats={vitals.spellcasting}
                slotsByLevel={spellcastingRules.slotsByLevel}
                pactSlotsByLevel={spellcastingRules.pactSlotsByLevel}
                onChange={onChange}
              />
            </TabsContent>
          ) : null}

          <TabsContent value="equipment" className="space-y-4">
            <SheetEquipmentPanel
              character={character}
              selections={resolvedEquipment}
              catalogue={equipment}
              onChange={onChange}
            />
          </TabsContent>

          <TabsContent value="features" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Species Features: {species?.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <SheetFeatureList
                  features={[...(species?.features ?? []), ...(variant?.features ?? [])]}
                  selections={character.features}
                  idPrefix="species"
                  emptyMessage="No species features are recorded for this character."
                />
              </CardContent>
            </Card>

            {resolvedClasses.map(({ entry, cls, subclass }) => (
              <Card key={cls.id}>
                <CardHeader>
                  <CardTitle>{cls.name} Features</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SheetFeatureList
                    features={sortFeaturesByLevel(cls.features.filter((feature) => feature.level <= entry.level))}
                    selections={character.features}
                    idPrefix={cls.id}
                  />
                  {subclass && subclass.features.some((feature) => feature.level <= entry.level) && (
                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{subclass.name}</h4>
                        <Badge variant="outline">Subclass</Badge>
                      </div>
                      <SheetFeatureList
                        features={sortFeaturesByLevel(subclass.features.filter((feature) => feature.level <= entry.level))}
                        selections={character.features}
                        idPrefix={subclass.id}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {featCards.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Feats</CardTitle>
                </CardHeader>
                <CardContent>
                  <SheetFeatureList
                    features={featCards}
                    selections={character.features}
                    idPrefix="feat"
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* More than the background now: what this character is proficient in and what they
              shrug off are read here too, which is where a reader looks for them. */}
          <TabsContent value="description" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Background: {background?.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{background?.description}</p>

                <Separator />

                <div>
                  <h4 className="font-medium">Feature: {background?.feature.name}</h4>
                  <p className="text-sm text-muted-foreground">{background?.feature.description}</p>
                </div>

                <Separator />

                {backgroundCharacteristicsContent}
              </CardContent>
            </Card>

            <SheetDefencesCard defences={defences} />

            <Card>
              <CardHeader>
                <CardTitle>Proficiencies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <span className="font-medium">Saving Throws: </span>
                  <span className="text-muted-foreground">
                    {derivedProficiencies.saves.map((entry) => entry.charAt(0).toUpperCase() + entry.slice(1)).join(', ') || 'None'}
                  </span>
                </div>
                <Separator />
                <div>
                  <span className="font-medium">Skills: </span>
                  <span className="text-muted-foreground">{derivedProficiencies.skills.join(', ') || 'None'}</span>
                </div>
                <Separator />
                <div>
                  <span className="font-medium">Tools: </span>
                  <span className="text-muted-foreground">{derivedProficiencies.tools.join(', ') || 'None'}</span>
                </div>
                <Separator />
                <div>
                  <span className="font-medium">Languages: </span>
                  <span className="text-muted-foreground">{derivedProficiencies.languages.join(', ') || 'None'}</span>
                </div>
                <Separator />
                <div>
                  <span className="font-medium">Armor: </span>
                  <span className="text-muted-foreground">{derivedProficiencies.armor.join(', ') || 'None'}</span>
                </div>
                <Separator />
                <div>
                  <span className="font-medium">Weapons: </span>
                  <span className="text-muted-foreground">{derivedProficiencies.weapons.join(', ') || 'None'}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
