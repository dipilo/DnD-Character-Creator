import { type ChangeEvent, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '@/store/characterStore';
import {
  getRuntimeClassById,
  getRuntimeEquipmentById,
  getRuntimeFeatById,
  getRuntimeSpeciesById,
  getRuntimeSubclass,
  getRuntimeSpellById,
  getRuntimeSpeciesVariant,
  useContentLibrary
} from '@/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import type { Character, CharacterClass, AbilityScores } from '@/types/dnd';
import {
  applyAbilityScoreBonuses,
  deriveCharacterHitPoints,
  deriveCharacterProficiencies,
  getAdditionalFeatSelectionLimit,
  getSpeciesFeatSelectionSources,
  resolveBackgroundGrantedFeat,
  resolveCharacterEquipment,
  type SelectedClassWithLevel
} from '@/lib/builderRules';
import { exportCharacterToFillablePdf } from '@/lib/characterPdf';

function humanizeFallbackId(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatEquipmentOptionLabel(item: { name: string; count?: number }) {
  const prefix = item.count ? `${item.count} ` : '';
  return `${prefix}${item.name}`;
}

function formatBackgroundEquipment(item: { name: string; count?: number; alternatives?: Array<{ name: string; count?: number }> }) {
  if (item.alternatives?.length) {
    return `${item.name}: ${item.alternatives.map(formatEquipmentOptionLabel).join(' or ')}`;
  }

  return formatEquipmentOptionLabel(item);
}

function formatSelectedEquipmentLabel(name: string, quantity: number) {
  return quantity > 1 ? `${name} x${quantity}` : name;
}

export function ReviewPage() {
  const navigate = useNavigate();
  const { builderState, addCharacter, getCharacter, resetBuilder, setPendingSeat, updateBuilderCharacter, updateCharacter } = useCharacterStore();
  const { backgrounds, equipment, feats } = useContentLibrary();

  const character = builderState.character;
  const editedCharacter = builderState.editingCharacterId ? getCharacter(builderState.editingCharacterId) : undefined;
  const isEditing = Boolean(editedCharacter);
  const characterName = character.name || '';
  const species = character?.speciesId ? getRuntimeSpeciesById(character.speciesId) : undefined;
  const variant = character?.speciesId && character?.variantId
    ? getRuntimeSpeciesVariant(character.speciesId, character.variantId)
    : undefined;
  const background = character?.backgroundId ? backgrounds.find((entry) => entry.id === character.backgroundId) : undefined;

  const selectedClasses = useMemo(() => {
    return (character.classes || [])
      .map((entry) => ({ entry, cls: getRuntimeClassById(entry.classId) }))
      .filter((item): item is { entry: CharacterClass; cls: NonNullable<ReturnType<typeof getRuntimeClassById>> } => Boolean(item.cls));
  }, [character.classes]);

  const selectedClassesWithLevels = useMemo<SelectedClassWithLevel[]>(() => {
    return selectedClasses.map(({ entry, cls }) => ({ cls, level: entry.level }));
  }, [selectedClasses]);

  const selectedSpells = useMemo(() => {
    return (character.spells || []).map((entry) => ({
      entry,
      spell: getRuntimeSpellById(entry.spellId)
    }));
  }, [character.spells]);

  const grantedBackgroundFeat = useMemo(() => resolveBackgroundGrantedFeat(background, feats), [background, feats]);
  const selectedFeats = useMemo(() => {
    const featIds = Array.from(new Set([
      ...(grantedBackgroundFeat ? [grantedBackgroundFeat.id] : []),
      ...(character.feats || [])
    ]));

    return featIds.map((featId) => ({
      featId,
      feat: getRuntimeFeatById(featId)
    }));
  }, [character.feats, grantedBackgroundFeat]);
  const featSelectionLimit = useMemo(() => getAdditionalFeatSelectionLimit(selectedClassesWithLevels), [selectedClassesWithLevels]);
  const speciesFeatSelectionLimit = useMemo(() => {
    return getSpeciesFeatSelectionSources({ species, variant }).reduce((total, entry) => total + entry.count, 0);
  }, [species, variant]);
  const displayedAbilityScores = useMemo(() => {
    return applyAbilityScoreBonuses(character.abilityScores, character.abilityScoreBonuses);
  }, [character.abilityScoreBonuses, character.abilityScores]);

  const selectedEquipment = useMemo(() => {
    return resolveCharacterEquipment({
      equipment: character.equipment || [],
      getEquipmentById: getRuntimeEquipmentById,
      findEquipmentByName: (equipmentName) => equipment.find((entry) => entry.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim() === equipmentName.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim()),
      getClassById: getRuntimeClassById,
      getBackgroundById: (backgroundId) => backgrounds.find((entry) => entry.id === backgroundId)
    }).map((entry) => ({
      ...entry,
      label: entry.name
    }));
  }, [backgrounds, character.equipment, equipment]);
  const selectedBackgroundEquipment = useMemo(() => {
    return selectedEquipment.filter((entry) => entry.sourceLabel.includes('Background Equipment'));
  }, [selectedEquipment]);

  const primaryClass = selectedClasses[0]?.cls;

  const calculateModifier = (score: number): string => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const totalLevel = selectedClasses.reduce((sum, item) => sum + item.entry.level, 0) || 1;
  const rolledComplete = builderState.abilityScoreMethod !== 'rolled' || ((builderState.rolledScoreAssignments && Object.keys(builderState.rolledScoreAssignments).length === 6));

  const resolvedClasses = useMemo(() => {
    return selectedClasses.map(({ entry, cls }) => ({
      entry,
      cls,
      subclass: entry.subclassId ? getRuntimeSubclass(cls.id, entry.subclassId) : undefined
    }));
  }, [selectedClasses]);

  const persistedClasses = useMemo(() => {
    return character.classes || (primaryClass ? [{ classId: primaryClass.id, level: 1, hitDiceUsed: 0 }] : []);
  }, [character.classes, primaryClass]);

  const derivedHp = useMemo(() => {
    return deriveCharacterHitPoints({
      classes: persistedClasses,
      abilityScores: displayedAbilityScores,
      previousHp: character.hp,
      getClassById: getRuntimeClassById
    });
  }, [character.hp, displayedAbilityScores, persistedClasses]);

  const derivedProficiencies = useMemo(() => {
    return deriveCharacterProficiencies({
      character,
      resolvedClasses,
      background,
      species,
      variant
    });
  }, [background, character, resolvedClasses, species, variant]);

  const updateIdentityField = (updates: Partial<Character>) => {
    updateBuilderCharacter(updates);
  };

  const readFileAsDataUrl = async (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    target: 'portrait' | 'faction'
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      if (target === 'portrait') {
        updateIdentityField({
          portrait: { ...character.portrait, imageDataUrl },
          avatar: imageDataUrl
        });
      } else {
        updateIdentityField({
          faction: { ...character.faction, symbolImageDataUrl: imageDataUrl }
        });
      }
      toast.success('Image attached');
    } catch (error) {
      console.error(error);
      toast.error('Unable to read the selected image');
    } finally {
      event.target.value = '';
    }
  };

  const handleSaveCharacter = () => {
    const nextCharacter = buildReviewCharacter();
    if (!nextCharacter) {
      return;
    }

    if (isEditing) {
      updateCharacter(nextCharacter);
      toast.success(`Character "${characterName}" updated`);
      resetBuilder();
      navigate(`/character/${nextCharacter.id}`);
      return;
    }

    addCharacter(nextCharacter);

    // Started from a campaign, so it takes that seat as soon as the server has it. The seat is
    // recorded as an intent rather than written now: the character has only just been created
    // locally and may not have synced yet, and the builder has to work signed out (Phase 5).
    const { forCampaignId, forPlayerId, forCampaignName } = builderState;
    if (forCampaignId) {
      setPendingSeat(nextCharacter.id, { campaignId: forCampaignId, playerId: forPlayerId ?? null });
    }

    toast.success(`Character "${characterName}" created successfully!`);
    resetBuilder();
    navigate(forCampaignId ? `/campaign/${forCampaignId}/party` : '/characters');
    if (forCampaignName) {
      toast.message(`${characterName} joins ${forCampaignName}`, {
        description: 'It appears in the party view once it syncs.',
      });
    }
  };

  const isComplete = !!species && !!primaryClass && !!background && characterName.trim() && rolledComplete;

  const handleExportPDF = async () => {
    try {
      const reviewCharacter = buildReviewCharacter();
      if (!reviewCharacter) {
        return;
      }

      await exportCharacterToFillablePdf(reviewCharacter);
      toast.success('PDF exported');
    } catch (error) {
      console.error(error);
      toast.error('PDF export failed');
    }
  };

  const buildReviewCharacter = (): Character | null => {
    if (!characterName.trim()) {
      toast.error('Please enter a character name');
      return null;
    }
    if (!species || !primaryClass || !background) {
      toast.error('Please complete all required selections');
      return null;
    }
    if (!rolledComplete) {
      toast.error('Assign all rolled ability scores before saving');
      return null;
    }

    const now = new Date().toISOString();

    return {
      id: editedCharacter?.id ?? crypto.randomUUID(),
      name: characterName,
      avatar: character.portrait?.imageDataUrl || character.avatar,
      speciesId: species.id,
      variantId: variant?.id,
      size: character.size,
      backgroundId: background.id,
      classes: persistedClasses,
      abilityScores: character.abilityScores || {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
      },
      abilityScoreBonuses: character.abilityScoreBonuses || {},
      abilityScoreChoiceModes: character.abilityScoreChoiceModes,
      abilityScoreChoiceSelections: character.abilityScoreChoiceSelections,
      backgroundLanguageSelections: character.backgroundLanguageSelections,
      speciesLanguageSelections: character.speciesLanguageSelections,
      toolProficiencySelections: character.toolProficiencySelections,
      abilityScoreMethod: builderState.abilityScoreMethod,
      rolledScores: builderState.rolledScores,
      rolledScoreAssignments: builderState.rolledScoreAssignments,
      proficiencies: {
        skills: derivedProficiencies.skills,
        tools: derivedProficiencies.tools,
        languages: derivedProficiencies.languages,
        armor: derivedProficiencies.armor,
        weapons: derivedProficiencies.weapons,
        saves: derivedProficiencies.saves
      },
      equipment: character.equipment || [],
      spells: character.spells || [],
      feats: Array.from(new Set([...(grantedBackgroundFeat ? [grantedBackgroundFeat.id] : []), ...(character.feats || [])])),
      features: character.features || [],
      hp: derivedHp,
      // Play state is the character's, not the builder's. Rebuilding the document without it would
      // clear a party's death saves and spent slots the moment somebody opened the Review step.
      deathSaves: character.deathSaves,
      inspiration: character.inspiration,
      exhaustion: character.exhaustion,
      conditions: character.conditions,
      spellSlotsUsed: character.spellSlotsUsed,
      pactSlotsUsed: character.pactSlotsUsed,
      personality: character.personality,
      appearance: character.appearance,
      faction: character.faction,
      portrait: character.portrait,
      notes: character.notes,
      createdAt: editedCharacter?.createdAt ?? now,
      updatedAt: now
    };
  };

  const reviewHeading = isEditing ? `Edit ${editedCharacter?.name || 'Character'}` : 'Review Your Character';
  const reviewDescription = isEditing
    ? 'Change any step, then save your updates back to this character.'
    : 'Review your choices and give your character a name before saving.';
  const saveButtonLabel = isEditing ? 'Save Changes' : 'Create Character';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold">{reviewHeading}</h2>
          <p className="text-muted-foreground">
            {reviewDescription}
          </p>
        </div>
        <Button variant="outline" onClick={handleExportPDF} disabled={!species || !primaryClass || !background}>
          Export PDF
        </Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Character Name</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Enter your character's name"
                value={characterName}
                onChange={(e) => updateIdentityField({ name: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Faction & Portrait</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="faction-name">Faction Name</Label>
                <Input
                  id="faction-name"
                  placeholder="Harpers, Emerald Enclave, your adventuring company..."
                  value={character.faction?.name || ''}
                  onChange={(event) => updateIdentityField({ faction: { ...character.faction, name: event.target.value } })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="faction-symbol">Faction Symbol</Label>
                <Input id="faction-symbol" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleImageUpload(event, 'faction')} />
                {character.faction?.symbolImageDataUrl ? (
                  <img
                    src={character.faction.symbolImageDataUrl}
                    alt="Faction symbol preview"
                    className="h-24 w-24 rounded-lg border object-cover"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Upload an emblem to fill the faction symbol field on the PDF.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="portrait-image">Character Portrait</Label>
                <Input id="portrait-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleImageUpload(event, 'portrait')} />
                {character.portrait?.imageDataUrl ? (
                  <img
                    src={character.portrait.imageDataUrl}
                    alt="Character portrait preview"
                    className="h-40 w-full rounded-lg border object-cover"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Upload art to fill the portrait field on the PDF and use it as the character avatar.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Species</CardTitle>
            </CardHeader>
            <CardContent>
              {species ? (
                <div className="space-y-2">
                  <p className="font-medium">{species.name}{variant && ` (${variant.name})`}</p>
                  <p className="text-sm text-muted-foreground">{species.source}</p>
                  <p className="text-sm text-muted-foreground">{species.description}</p>
                </div>
              ) : (
                <p className="text-muted-foreground">No species selected</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Background</CardTitle>
            </CardHeader>
            <CardContent>
              {background ? (
                <div className="space-y-2">
                  <p className="font-medium">{background.name}</p>
                  <p className="text-sm text-muted-foreground">{background.source}</p>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Skills: </span>
                    {background.skillProficiencies.join(', ')}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No background selected</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedClasses.length > 0 ? (
              selectedClasses.map(({ entry, cls }) => {
                const subclass = entry.subclassId ? getRuntimeSubclass(cls.id, entry.subclassId) : undefined;
                return (
                  <div key={entry.classId} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{cls?.name}</p>
                        <p className="text-sm text-muted-foreground">d{cls?.hitDie} • Level {entry.level}</p>
                        {subclass && <p className="text-sm text-muted-foreground">Subclass: {subclass.name}</p>}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/builder/class/${entry.classId}`)}>
                        Edit
                      </Button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {cls?.savingThrows.map((save) => (
                        <Badge key={save} variant="secondary">{save.charAt(0).toUpperCase() + save.slice(1)}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-muted-foreground">No classes selected</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Ability Scores</CardTitle>
            </CardHeader>
            <CardContent>
              {character?.abilityScores ? (
                <div className="grid grid-cols-3 gap-3 text-center md:grid-cols-6">
                  {Object.entries(displayedAbilityScores).map(([ability, score]) => {
                    const abilityKey = ability as keyof AbilityScores;
                    const bonus = character.abilityScoreBonuses?.[abilityKey] ?? 0;

                    return (
                      <div key={ability}>
                        <p className="text-xs uppercase text-muted-foreground">{ability.slice(0, 3)}</p>
                        <p className="text-lg font-bold">{score}</p>
                        <Badge variant="outline" className="text-xs">{calculateModifier(score)}</Badge>
                        {bonus !== 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Base {character.abilityScores?.[abilityKey] ?? 10}, bonus {bonus > 0 ? '+' : ''}{bonus}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground">No ability scores set</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proficiencies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div><span className="font-medium">Skills: </span><span className="text-muted-foreground">{derivedProficiencies.skills.join(', ') || 'None'}</span></div>
              <div><span className="font-medium">Armor: </span><span className="text-muted-foreground">{derivedProficiencies.armor.join(', ') || 'None'}</span></div>
              <div><span className="font-medium">Weapons: </span><span className="text-muted-foreground">{derivedProficiencies.weapons.join(', ') || 'None'}</span></div>
              <div><span className="font-medium">Tools: </span><span className="text-muted-foreground">{derivedProficiencies.tools.join(', ') || 'None'}</span></div>
              <div><span className="font-medium">Languages: </span><span className="text-muted-foreground">{derivedProficiencies.languages.join(', ') || 'None'}</span></div>
              <div><span className="font-medium">Saving Throws: </span><span className="text-muted-foreground">{derivedProficiencies.saves.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(', ') || 'None'}</span></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Equipment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedEquipment.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedEquipment.map((item) => (
                  <Badge key={item.equipmentId} variant="secondary">
                    {item.label}{item.quantity > 1 ? ` x${item.quantity}` : ''}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No equipment selected yet.</p>
            )}

            <Separator />

            <div>
              <h4 className="mb-2 font-medium">Background Equipment</h4>
              {background ? (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {(selectedBackgroundEquipment.length > 0
                    ? selectedBackgroundEquipment.map((item) => ({ key: item.equipmentId, label: formatSelectedEquipmentLabel(item.label, item.quantity) }))
                    : background.equipment.map((item) => ({ key: `${item.name}-${item.type}`, label: formatBackgroundEquipment(item) }))
                  ).map((item) => (
                    <li key={item.key}>• {item.label}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Select a background to see equipment.</p>
              )}
            </div>

            <Button variant="outline" size="sm" onClick={() => navigate('/builder/equipment')}>
              Edit Equipment
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spells</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedSpells.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedSpells.map(({ entry, spell }) => (
                  <Badge key={entry.spellId} variant="secondary">
                    {spell?.name || humanizeFallbackId(entry.spellId)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No spells selected yet.</p>
            )}

            <Button variant="outline" size="sm" onClick={() => navigate('/builder/spells')}>
              Edit Spells
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedFeats.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {selectedFeats.map(({ featId, feat }) => (
                  <Badge key={featId} variant="secondary">
                    {feat?.name || humanizeFallbackId(featId)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No feats selected yet.</p>
            )}

            <div className="text-sm text-muted-foreground">
              Class feat picks available: {featSelectionLimit}
              {speciesFeatSelectionLimit > 0 ? ` • Species feat picks available: ${speciesFeatSelectionLimit}` : ''}
              {grantedBackgroundFeat ? ` • Background feat: ${grantedBackgroundFeat.name}` : ''}
            </div>

            <Button variant="outline" size="sm" onClick={() => navigate('/builder/advancements')}>
              Edit Feats
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Character Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Species</p>
                <p className="font-medium">{species?.name || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Total Level</p>
                <p className="font-medium">{totalLevel}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Hit Points</p>
                <p className="font-medium">{derivedHp.maximum}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={handleSaveCharacter} disabled={!isComplete}>
          {saveButtonLabel}
        </Button>
      </div>

      {!isComplete && (
        <p className="text-center text-sm text-muted-foreground">
          Please complete all required fields before saving.
        </p>
      )}
    </div>
  );
}
