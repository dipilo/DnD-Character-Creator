import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
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
import { ArrowLeft, FileDown, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  applyAbilityScoreBonuses,
  deriveAbilityScoreBonuses,
  deriveArmorClass,
  deriveCharacterHitPoints,
  deriveCharacterProficiencies,
  getActiveFeatures,
  getCharacterProficiencyBonus,
  resolveBackgroundGrantedFeat,
  resolveCharacterClasses,
  resolveCharacterEquipment,
  sortFeaturesByLevel
} from '@/lib/builderRules';
import type { Character } from '@/types/dnd';
import { exportCharacterToFillablePdf } from '@/lib/characterPdf';

const humanizeFallbackId = (value: string) => value.split('-').filter(Boolean).join(' ');
const isDefined = <T,>(value: T | null | undefined): value is T => Boolean(value);
const formatEquipmentOptionLabel = (item: { name: string; count?: number }) => {
  const prefix = item.count ? `${item.count} ` : '';
  return `${prefix}${item.name}`;
};
const formatBackgroundEquipment = (item: { name: string; count?: number; alternatives?: Array<{ name: string; count?: number }> }) => {
  if (item.alternatives?.length) {
    return `${item.name}: ${item.alternatives.map(formatEquipmentOptionLabel).join(' or ')}`;
  }

  return formatEquipmentOptionLabel(item);
};

const formatSelectedEquipmentLabel = (name: string, quantity: number) => {
  return quantity > 1 ? `${name} x${quantity}` : name;
};

const emptyCharacter: Character = {
  id: '',
  name: '',
  speciesId: '',
  backgroundId: '',
  classes: [],
  abilityScores: {
    strength: 10,
    dexterity: 10,
    constitution: 10,
    intelligence: 10,
    wisdom: 10,
    charisma: 10
  },
  abilityScoreBonuses: {},
  abilityScoreChoiceModes: {},
  abilityScoreChoiceSelections: {},
  proficiencies: {
    skills: [],
    tools: [],
    languages: [],
    armor: [],
    weapons: [],
    saves: []
  },
  equipment: [],
  spells: [],
  feats: [],
  features: [],
  hp: {
    current: 0,
    maximum: 0,
    temporary: 0
  },
  createdAt: '',
  updatedAt: ''
};

export function CharacterSheetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getCharacter, deleteCharacter, loadCharacterIntoBuilder } = useCharacterStore();
  const { backgrounds, equipment, feats } = useContentLibrary();

  const character = id ? getCharacter(id) : undefined;
  const activeCharacter = character ?? emptyCharacter;
  const species = getRuntimeSpeciesById(activeCharacter.speciesId);
  const variant = activeCharacter.variantId ? getRuntimeSpeciesVariant(activeCharacter.speciesId, activeCharacter.variantId) : undefined;
  const background = activeCharacter.backgroundId ? backgrounds.find((entry) => entry.id === activeCharacter.backgroundId) : undefined;

  const resolvedClasses = useMemo(() => {
    return resolveCharacterClasses({
      classes: activeCharacter.classes,
      getClassById: getRuntimeClassById,
      getSubclassById: getRuntimeSubclass
    });
  }, [activeCharacter.classes]);

  const selectedSpells = useMemo(() => {
    return activeCharacter.spells.map((entry) => getRuntimeSpellById(entry.spellId) ?? { id: entry.spellId, name: humanizeFallbackId(entry.spellId) });
  }, [activeCharacter.spells]);

  const featData = useMemo(() => {
    return activeCharacter.feats.map((featId) => getRuntimeFeatById(featId)).filter(isDefined);
  }, [activeCharacter.feats]);
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
      ...activeCharacter.feats
    ]));

    return featIds.map((featId) => getRuntimeFeatById(featId) ?? { id: featId, name: humanizeFallbackId(featId) });
  }, [activeCharacter.feats, grantedBackgroundFeat]);

  const resolvedEquipment = useMemo(() => {
    return resolveCharacterEquipment({
      equipment: activeCharacter.equipment,
      getEquipmentById: getRuntimeEquipmentById,
      findEquipmentByName: (equipmentName) => equipment.find((entry) => entry.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim() === equipmentName.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim()),
      getClassById: getRuntimeClassById,
      getBackgroundById: (backgroundId) => backgrounds.find((entry) => entry.id === backgroundId)
    });
  }, [activeCharacter.equipment, backgrounds, equipment]);
  const selectedBackgroundEquipment = useMemo(() => {
    return resolvedEquipment.filter((entry) => entry.sourceLabel.includes('Background Equipment'));
  }, [resolvedEquipment]);

  const derivedProficiencies = useMemo(() => {
    return deriveCharacterProficiencies({
      character: activeCharacter,
      resolvedClasses,
      background,
      species,
      variant
    });
  }, [activeCharacter, background, resolvedClasses, species, variant]);

  const activeFeatures = useMemo(() => {
    return getActiveFeatures({
      species,
      variant,
      resolvedClasses,
      feats: allFeatData,
      selectedFeatures: activeCharacter.features
    });
  }, [activeCharacter.features, allFeatData, resolvedClasses, species, variant]);

  const derivedAbilityBonuses = useMemo(() => {
    return deriveAbilityScoreBonuses({
      background,
      species,
      variant,
      feats: allFeatData,
      abilityScoreChoiceModes: activeCharacter.abilityScoreChoiceModes,
      abilityScoreChoiceSelections: activeCharacter.abilityScoreChoiceSelections
    });
  }, [activeCharacter.abilityScoreChoiceModes, activeCharacter.abilityScoreChoiceSelections, allFeatData, background, species, variant]);

  const displayedAbilityScores = useMemo(() => {
    const storedBonuses = Object.keys(activeCharacter.abilityScoreBonuses ?? {}).length > 0
      ? activeCharacter.abilityScoreBonuses
      : derivedAbilityBonuses;
    return applyAbilityScoreBonuses(activeCharacter.abilityScores, storedBonuses);
  }, [activeCharacter.abilityScoreBonuses, activeCharacter.abilityScores, derivedAbilityBonuses]);

  const displayedHp = activeCharacter.hp.maximum > 0
    ? activeCharacter.hp
    : deriveCharacterHitPoints({
      classes: activeCharacter.classes,
      abilityScores: displayedAbilityScores,
      previousHp: activeCharacter.hp,
      getClassById: getRuntimeClassById
    });

  const derivedArmor = useMemo(() => {
    return deriveArmorClass({
      abilityScores: displayedAbilityScores,
      proficiencies: derivedProficiencies,
      equipment: resolvedEquipment,
      activeFeatures
    });
  }, [activeFeatures, derivedProficiencies, displayedAbilityScores, resolvedEquipment]);

  const totalLevel = activeCharacter.classes.reduce((sum, entry) => sum + entry.level, 0) || 1;
  const proficiencyBonus = getCharacterProficiencyBonus(totalLevel);
  const classSummary = resolvedClasses
    .map(({ entry, cls, subclass }) => {
      const label = `${cls.name} ${entry.level}`;
      return subclass ? `${label} (${subclass.name})` : label;
    })
    .join(' / ');
  const equippedSelections = resolvedEquipment.filter((entry) => entry.equipped);
  const carriedSelections = resolvedEquipment.filter((entry) => !entry.equipped);

  if (!character) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Character not found.</p>
        <Button onClick={() => navigate('/characters')} className="mt-4">
          Back to My Characters
        </Button>
      </div>
    );
  }

  const calculateModifier = (score: number): number => {
    return Math.floor((score - 10) / 2);
  };

  const formatModifier = (mod: number): string => {
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const handleEdit = () => {
    if (!loadCharacterIntoBuilder(character.id)) {
      toast.error('Character could not be opened in the builder');
      return;
    }

    navigate('/builder/review');
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${character.name}?`)) {
      deleteCharacter(character.id);
      toast.success('Character deleted');
      navigate('/characters');
    }
  };

  const handleExportPDF = async () => {
    try {
      await exportCharacterToFillablePdf(character);
      toast.success('PDF exported');
    } catch (error) {
      console.error(error);
      toast.error('PDF export failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/characters')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{character.name}</h1>
          <p className="text-muted-foreground">
            Level {totalLevel} {species?.name ?? 'Unknown Species'} {classSummary}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" onClick={handleExportPDF}>
            <FileDown className="mr-2 h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
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
              <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
                {Object.entries(displayedAbilityScores).map(([ability, score]) => {
                  const mod = calculateModifier(score);
                  return (
                    <div key={ability} className="rounded-lg border p-4 text-center">
                      <p className="mb-1 text-xs uppercase text-muted-foreground">{ability}</p>
                      <p className="text-3xl font-bold">{score}</p>
                      <Badge variant={mod >= 0 ? 'default' : 'secondary'} className="mt-1">
                        {formatModifier(mod)}
                      </Badge>
                      {(activeCharacter.abilityScoreBonuses?.[ability as keyof Character['abilityScores']] ?? derivedAbilityBonuses[ability as keyof Character['abilityScores']] ?? 0) !== 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Base {activeCharacter.abilityScores[ability as keyof Character['abilityScores']]}, bonus {(activeCharacter.abilityScoreBonuses?.[ability as keyof Character['abilityScores']] ?? derivedAbilityBonuses[ability as keyof Character['abilityScores']] ?? 0) > 0 ? '+' : ''}{activeCharacter.abilityScoreBonuses?.[ability as keyof Character['abilityScores']] ?? derivedAbilityBonuses[ability as keyof Character['abilityScores']] ?? 0}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Hit Points</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{displayedHp.current}/{displayedHp.maximum}</p>
                {displayedHp.temporary > 0 && (
                  <Badge variant="outline" className="mt-1">+{displayedHp.temporary} temp</Badge>
                )}
              </CardContent>
            </Card>

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

          {selectedSpells.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Spells</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {selectedSpells.map((spell) => (
                  <Badge key={spell.id} variant="secondary">{spell.name}</Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="equipment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Loadout</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="mb-2 font-medium">Equipped</h4>
                {equippedSelections.length > 0 ? (
                  <div className="space-y-2">
                    {equippedSelections.map((entry) => (
                      <div key={entry.equipmentId} className="flex items-center justify-between rounded border p-2">
                        <span>{entry.name}</span>
                        <Badge>Equipped</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing equipped.</p>
                )}
              </div>
              <Separator />
              <div>
                <h4 className="mb-2 font-medium">Carried</h4>
                {carriedSelections.length > 0 ? (
                  <div className="space-y-2">
                    {carriedSelections.map((entry) => (
                      <div key={entry.equipmentId} className="flex items-center justify-between rounded border p-2">
                        <span>{entry.name}</span>
                        <Badge variant="outline">Carried</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No extra carried equipment.</p>
                )}
              </div>
            </CardContent>
          </Card>

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
