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
  resolveCharacterEquipment,
  sortFeaturesByLevel
} from '@/lib/builderRules';
import { deriveAttacks, deriveSheetVitals } from '@/lib/sheetDerivations';
import { modifierNotation } from '@/lib/diceNotation';
import { rollOnScreen } from '@/store/diceTrayStore';
import { SheetAttacksPanel } from '@/components/character/SheetAttacksPanel';
import { SheetEquipmentPanel } from '@/components/character/SheetEquipmentPanel';
import { SheetHitPointsPanel } from '@/components/character/SheetHitPointsPanel';
import { SheetResourcesPanel, type HitDicePool } from '@/components/character/SheetResourcesPanel';
import { SheetSpellsPanel } from '@/components/character/SheetSpellsPanel';
import { SheetVitalsPanel } from '@/components/character/SheetVitalsPanel';
import type { AbilityScores, Character } from '@/types/dnd';

const humanizeFallbackId = (value: string) => value.split('-').filter(Boolean).join(' ');
const isDefined = <T,>(value: T | null | undefined): value is T => Boolean(value);
const formatEquipmentOptionLabel = (item: { name: string; count?: number }) => {
  const prefix = item.count ? `${item.count} ` : '';
  return `${prefix}${item.name}`;
};
const formatBackgroundEquipment = (item: { name: string; count?: number; alternatives?: Array<{ name: string; count?: number }> }) => {
  if (item.alternatives?.length) {
    return `${item.name}: ${item.alternatives.map((alternative) => formatEquipmentOptionLabel(alternative)).join(' or ')}`;
  }

  return formatEquipmentOptionLabel(item);
};

const formatSelectedEquipmentLabel = (name: string, quantity: number) => {
  return quantity > 1 ? `${name} x${quantity}` : name;
};

const calculateModifier = (score: number): number => Math.floor((score - 10) / 2);
const formatModifier = (mod: number): string => (mod >= 0 ? `+${mod}` : `${mod}`);
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
}

export function CharacterSheetView({ character, actions, leading, note, onChange }: Readonly<CharacterSheetViewProps>) {
  const { backgrounds, equipment, feats, spells: spellCatalogue } = useContentLibrary();

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

  const selectedSpells = useMemo(() => {
    return character.spells.map((entry) => {
      const spell = getRuntimeSpellById(entry.spellId);
      return {
        id: entry.spellId,
        name: spell?.name ?? humanizeFallbackId(entry.spellId),
        level: spell?.level,
        school: spell?.school,
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

  const selectedFeats = useMemo(() => {
    const featIds = Array.from(new Set([
      ...(grantedBackgroundFeat ? [grantedBackgroundFeat.id] : []),
      ...character.feats
    ]));

    return featIds.map((featId) => getRuntimeFeatById(featId) ?? { id: featId, name: humanizeFallbackId(featId) });
  }, [character.feats, grantedBackgroundFeat]);

  const resolvedEquipment = useMemo(() => {
    return resolveCharacterEquipment({
      equipment: character.equipment,
      getEquipmentById: getRuntimeEquipmentById,
      findEquipmentByName: (equipmentName) => equipment.find((entry) => normalizeEquipmentName(entry.name) === normalizeEquipmentName(equipmentName)),
      getClassById: getRuntimeClassById,
      getBackgroundById: (backgroundId) => backgrounds.find((entry) => entry.id === backgroundId)
    });
  }, [character.equipment, backgrounds, equipment]);
  const selectedBackgroundEquipment = useMemo(() => {
    return resolvedEquipment.filter((entry) => entry.sourceLabel.includes('Background Equipment'));
  }, [resolvedEquipment]);

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
    return deriveAttacks({
      equipment: resolvedEquipment,
      abilityScores: displayedAbilityScores,
      proficiencyBonus: vitals.proficiencyBonus,
      weaponProficiencies: derivedProficiencies.weapons
    });
  }, [derivedProficiencies.weapons, displayedAbilityScores, resolvedEquipment, vitals.proficiencyBonus]);

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
  const abilityBonusFor = (ability: keyof AbilityScores) =>
    character.abilityScoreBonuses?.[ability] ?? derivedAbilityBonuses[ability] ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold sm:text-3xl">{character.name}</h1>
          <p className="text-muted-foreground">
            Level {totalLevel} {species?.name ?? 'Unknown Species'} {classSummary}
          </p>
          {note}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>

      <Tabs defaultValue="stats" className="w-full">
        {/* Four equal columns on a phone truncate to "Proficienc…". Below sm the strip scrolls at
            each label's natural width instead; the grid returns once there is room for it. */}
        <TabsList className="w-full justify-start [&>*]:flex-none sm:grid sm:grid-cols-4 sm:[&>*]:flex-1">
          <TabsTrigger value="stats">Stats</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="background">Background</TabsTrigger>
        </TabsList>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ability Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-6">
                {Object.entries(displayedAbilityScores).map(([ability, score]) => {
                  const mod = calculateModifier(score);
                  const bonus = abilityBonusFor(ability as keyof AbilityScores);
                  const abilityLabel = ability.charAt(0).toUpperCase() + ability.slice(1);
                  return (
                    <button
                      key={ability}
                      type="button"
                      className="rounded-lg border p-2 text-center transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:p-4"
                      onClick={() =>
                        void rollOnScreen({
                          notation: modifierNotation(20, mod),
                          label: `${abilityLabel} check`,
                          detail: 'd20 check',
                        })
                      }
                    >
                      <p className="mb-1 text-xs uppercase text-muted-foreground">{ability}</p>
                      <p className="text-2xl font-bold sm:text-3xl">{score}</p>
                      <Badge variant={mod >= 0 ? 'default' : 'secondary'} className="mt-1">
                        {formatModifier(mod)}
                      </Badge>
                      {bonus !== 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Base {character.abilityScores[ability as keyof AbilityScores]}, bonus {formatModifier(bonus)}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <SheetHitPointsPanel character={characterWithResolvedHp} onChange={onChange} />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Armor Class</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{derivedArmor.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{derivedArmor.source}</p>
                  {!derivedArmor.proficient && (
                    <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                      Current armor is equipped without matching proficiency.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Proficiency Bonus</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">+{proficiencyBonus}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Level {totalLevel}</p>
                </CardContent>
              </Card>
            </div>
          </div>

          <SheetResourcesPanel
            character={character}
            hitDice={hitDicePools}
            slotsByLevel={spellcastingRules.slotsByLevel}
            pactSlotsByLevel={spellcastingRules.pactSlotsByLevel}
            constitutionModifier={calculateModifier(displayedAbilityScores.constitution)}
            onChange={onChange}
          />

          <SheetVitalsPanel vitals={vitals} />

          <SheetAttacksPanel attacks={attacks} />

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

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Species Features: {species?.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {species?.features.map((feature) => (
                <div key={feature.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <h4 className="font-medium">{feature.name}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
              {variant?.features.map((feature) => (
                <div key={feature.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <h4 className="font-medium">{feature.name}</h4>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {resolvedClasses.map(({ entry, cls, subclass }) => (
            <Card key={cls.id}>
              <CardHeader>
                <CardTitle>{cls.name} Features</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sortFeaturesByLevel(cls.features.filter((feature) => feature.level <= entry.level)).map((feature) => (
                  <div key={feature.id} className="border-b pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{feature.name}</h4>
                      <Badge variant="secondary">Level {feature.level}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                ))}
                {subclass && subclass.features.some((feature) => feature.level <= entry.level) && (
                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{subclass.name}</h4>
                      <Badge variant="outline">Subclass</Badge>
                    </div>
                    {sortFeaturesByLevel(subclass.features.filter((feature) => feature.level <= entry.level)).map((feature) => (
                      <div key={feature.id} className="border-b pb-4 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-medium">{feature.name}</h5>
                          <Badge variant="secondary">Level {feature.level}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {selectedFeats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Feats</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {selectedFeats.map((feat) => (
                  <Badge key={feat.id} variant="secondary">{feat.name}</Badge>
                ))}
              </CardContent>
            </Card>
          )}

          <SheetSpellsPanel
            character={character}
            spells={selectedSpells}
            catalogue={spellCatalogue}
            onChange={onChange}
          />
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          <SheetEquipmentPanel
            character={character}
            selections={resolvedEquipment}
            catalogue={equipment}
            onChange={onChange}
          />

          {background && (
            <Card>
              <CardHeader>
                <CardTitle>Background Equipment</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {(selectedBackgroundEquipment.length > 0
                    ? selectedBackgroundEquipment.map((item) => ({ key: item.equipmentId, label: formatSelectedEquipmentLabel(item.name, item.quantity) }))
                    : background.equipment.map((item) => ({ key: `${item.name}-${item.type}`, label: formatBackgroundEquipment(item) }))
                  ).map((item) => (
                    <li key={item.key} className="text-sm text-muted-foreground">• {item.label}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="background" className="space-y-4">
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
