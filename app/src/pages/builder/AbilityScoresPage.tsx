import { useMemo, useRef, useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { useContentLibrary } from '@/data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { DiceScene, type DiceSceneHandle, type DiceSceneResult } from '@/components/dice/DiceScene';
import { toast } from 'sonner';
import type { AbilityScores, BuilderState } from '@/types/dnd';
import {
  applyAbilityScoreBonuses,
  deriveAbilityScoreBonuses,
  getAbilityScoreChoiceConfigs,
  getBackgroundAbilityScoreModeKey,
  getRulesEdition,
  isPointBuyAllocation,
  isStandardArrayAllocation,
  pointBuyCosts,
  pointBuyTotal,
  resolveBackgroundGrantedFeat,
  standardArrayScores,
  type AbilityScoreChoiceConfig,
  type AbilityScoreChoiceMode
} from '@/lib/builderRules';

const ABILITY_NAMES: (keyof AbilityScores)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const nativeSelectClassName = 'surface-select h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none transition-colors hover:border-ring focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 dark:bg-input/80';
type AbilityScoreMethod = 'standard' | 'point-buy' | 'rolled';
type StoredAbilityScoreMethod = AbilityScoreMethod | 'manual';

const defaultScores = (value = 10): AbilityScores => ({
  strength: value,
  dexterity: value,
  constitution: value,
  intelligence: value,
  wisdom: value,
  charisma: value
});

const getInitialScores = (method: StoredAbilityScoreMethod, storedScores?: AbilityScores): AbilityScores => {
  if (method === 'standard') {
    return storedScores && isStandardArrayAllocation(storedScores)
      ? storedScores
      : {
          strength: 15,
          dexterity: 14,
          constitution: 13,
          intelligence: 12,
          wisdom: 10,
          charisma: 8
        };
  }

  if (method === 'point-buy') {
    return storedScores && isPointBuyAllocation(storedScores) ? storedScores : defaultScores(8);
  }

  return storedScores || defaultScores();
};

const buildAbilityRollGroups = (diceResults: number[]) => {
  const groups: number[][] = [];
  for (let index = 0; index < 6; index += 1) {
    const nextGroup = diceResults.slice(index * 4, index * 4 + 4).sort((left, right) => right - left);
    if (nextGroup.length === 4) {
      groups.push(nextGroup);
    }
  }

  return groups;
};

const summarizeAbilityRollGroups = (groups: number[][]) => {
  return groups
    .map((group) => group[0] + group[1] + group[2])
    .sort((left, right) => right - left);
};

export function AbilityScoresPage() {
  const { builderState, updateBuilderCharacter, updateBuilderState } = useCharacterStore();
  const { backgrounds, feats, species: speciesEntries } = useContentLibrary();
  const [method, setMethod] = useState<AbilityScoreMethod>(
    builderState.abilityScoreMethod === 'point-buy' || builderState.abilityScoreMethod === 'rolled'
      ? builderState.abilityScoreMethod
      : 'standard'
  );
  const [scores, setScores] = useState<AbilityScores>(() => getInitialScores(builderState.abilityScoreMethod, builderState.character?.abilityScores));
  const [rolledValues, setRolledValues] = useState<number[]>(builderState.rolledScores || []);
  const [rolledAssignments, setRolledAssignments] = useState<Partial<Record<keyof AbilityScores, number>>>(
    builderState.rolledScoreAssignments || {}
  );
  const [rolledDiceGroups, setRolledDiceGroups] = useState<number[][]>([]);
  const [diceReady, setDiceReady] = useState(false);
  const [diceError, setDiceError] = useState<string | null>(null);
  const [diceSoundEnabled, setDiceSoundEnabled] = useState(true);
  const [rollingDice, setRollingDice] = useState(false);
  const diceSceneRef = useRef<DiceSceneHandle | null>(null);
  const diceClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const species = useMemo(() => {
    return builderState.character?.speciesId
      ? speciesEntries.find((entry) => entry.id === builderState.character?.speciesId)
      : undefined;
  }, [builderState.character?.speciesId, speciesEntries]);
  const variant = useMemo(() => {
    return species?.variants?.find((entry) => entry.id === builderState.character?.variantId);
  }, [builderState.character?.variantId, species]);
  const background = useMemo(() => {
    return builderState.character?.backgroundId
      ? backgrounds.find((entry) => entry.id === builderState.character?.backgroundId)
      : undefined;
  }, [backgrounds, builderState.character?.backgroundId]);
  const grantedBackgroundFeat = useMemo(() => resolveBackgroundGrantedFeat(background, feats), [background, feats]);
  const selectedFeats = useMemo(() => {
    const featIds = Array.from(new Set([
      ...(grantedBackgroundFeat ? [grantedBackgroundFeat.id] : []),
      ...(builderState.character?.feats ?? [])
    ]));

    return featIds
      .map((featId) => feats.find((entry) => entry.id === featId))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  }, [builderState.character?.feats, feats, grantedBackgroundFeat]);
  const abilityScoreChoiceConfigs = useMemo(() => {
    return getAbilityScoreChoiceConfigs({
      background,
      species,
      variant,
      feats: selectedFeats,
      abilityScoreChoiceModes: builderState.character?.abilityScoreChoiceModes
    });
  }, [background, builderState.character?.abilityScoreChoiceModes, selectedFeats, species, variant]);
  const derivedAbilityScoreBonuses = useMemo(() => {
    return deriveAbilityScoreBonuses({
      background,
      species,
      variant,
      feats: selectedFeats,
      abilityScoreChoiceModes: builderState.character?.abilityScoreChoiceModes,
      abilityScoreChoiceSelections: builderState.character?.abilityScoreChoiceSelections
    });
  }, [background, builderState.character?.abilityScoreChoiceModes, builderState.character?.abilityScoreChoiceSelections, selectedFeats, species, variant]);
  const totalScores = useMemo(() => applyAbilityScoreBonuses(scores, derivedAbilityScoreBonuses), [derivedAbilityScoreBonuses, scores]);
  const backgroundSupportsOriginBonuses = background
    && !background.abilityScoreIncreases?.length
    && getRulesEdition(background.sourceId, background.source) === '2024';
  const backgroundAbilityModeKey = background ? getBackgroundAbilityScoreModeKey(background) : undefined;
  const backgroundAbilityMode = backgroundAbilityModeKey && builderState.character?.abilityScoreChoiceModes?.[backgroundAbilityModeKey] === 'background-balanced'
    ? 'background-balanced'
    : 'background-specialized';
  const groupedAbilityChoices = useMemo(() => {
    return abilityScoreChoiceConfigs.reduce<Record<string, AbilityScoreChoiceConfig[]>>((groups, config) => {
      if (!groups[config.sourceLabel]) {
        groups[config.sourceLabel] = [];
      }

      groups[config.sourceLabel].push(config);
      return groups;
    }, {});
  }, [abilityScoreChoiceConfigs]);
  const appliedBonusSummary = useMemo(() => {
    return ABILITY_NAMES
      .filter((ability) => (derivedAbilityScoreBonuses[ability] ?? 0) !== 0)
      .map((ability) => `${ability.slice(0, 3).toUpperCase()} ${derivedAbilityScoreBonuses[ability]! > 0 ? '+' : ''}${derivedAbilityScoreBonuses[ability]}`);
  }, [derivedAbilityScoreBonuses]);

  const calculateModifier = (score: number): string => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const calculatePointBuyUsed = (): number => {
    return Object.values(scores).reduce((total, score) => total + (pointBuyCosts[score] || 0), 0);
  };

  const pointBuyRemaining = pointBuyTotal - calculatePointBuyUsed();
  const isRolledMode = method === 'rolled';

  const rolledComplete = useMemo(
    () => rolledValues.length === 6 && ABILITY_NAMES.every((ability) => rolledAssignments[ability] !== undefined),
    [rolledAssignments, rolledValues.length]
  );
  const rolledAssignmentPending = rolledValues.length > 0 && !rolledComplete;
  let rollButtonLabel = 'Roll 4d6 (Drop Lowest)';
  if (rollingDice) {
    rollButtonLabel = 'Rolling 24d6...';
  } else if (rolledValues.length > 0) {
    rollButtonLabel = 'Roll Again';
  }

  const syncBuilder = (
    nextScores: AbilityScores,
    extras?: Partial<BuilderState> & { abilityScoreMethod?: StoredAbilityScoreMethod }
  ) => {
    updateBuilderCharacter({ abilityScores: nextScores });
    if (extras) {
      updateBuilderState(extras);
    }
  };

  const handleScoreChange = (ability: keyof AbilityScores, value: number) => {
    const nextScores = { ...scores, [ability]: value };
    setScores(nextScores);
    syncBuilder(nextScores);
  };

  const handleRoll = async () => {
    setRollingDice(true);

    // Sweep any dice still resting on screen from a previous throw before rolling again.
    if (diceClearTimeoutRef.current) {
      clearTimeout(diceClearTimeoutRef.current);
      diceClearTimeoutRef.current = null;
    }
    diceSceneRef.current?.clear();

    let groups: number[][] = [];
    try {
      if (diceSceneRef.current?.isReady()) {
        const results = await diceSceneRef.current.roll('24d6');
        const diceValues = results
          .map((entry: DiceSceneResult) => entry.value)
          .filter((value): value is number => typeof value === 'number')
          .slice(0, 24);

        groups = buildAbilityRollGroups(diceValues);
      }
    } catch (error) {
      setDiceError(error instanceof Error ? error.message : 'The dice scene could not complete the roll.');
    }

    if (groups.length !== 6) {
      groups = Array.from({ length: 6 }, () => {
        const nextGroup = new Array(4).fill(0).map(() => Math.floor(Math.random() * 6) + 1);
        return nextGroup.sort((left, right) => right - left);
      });
    }

    const rolls = summarizeAbilityRollGroups(groups);
    const resetScores = defaultScores();
    setRolledDiceGroups(groups);
    setRolledValues(rolls);
    setRolledAssignments({});
    setScores(resetScores);
    syncBuilder(resetScores, {
      abilityScoreMethod: 'rolled',
      rolledScores: rolls,
      rolledScoreAssignments: {}
    });
    setRollingDice(false);
    toast.success('Dice rolled! Assign your scores.');

    // Let the settled dice linger briefly, then sweep them so they don't cover the sheet.
    diceClearTimeoutRef.current = setTimeout(() => {
      diceSceneRef.current?.clear();
      diceClearTimeoutRef.current = null;
    }, 4000);
  };

  const handleMethodChange = (newMethod: AbilityScoreMethod) => {
    setMethod(newMethod);
    if (newMethod === 'standard') {
      const nextScores: AbilityScores = {
        strength: 15,
        dexterity: 14,
        constitution: 13,
        intelligence: 12,
        wisdom: 10,
        charisma: 8
      };
      setScores(nextScores);
      setRolledValues([]);
      setRolledAssignments({});
      syncBuilder(nextScores, {
        abilityScoreMethod: 'standard',
        rolledScores: [],
        rolledScoreAssignments: {}
      });
      return;
    }

    if (newMethod === 'point-buy') {
      const nextScores = defaultScores(8);
      setScores(nextScores);
      setRolledValues([]);
      setRolledAssignments({});
      syncBuilder(nextScores, {
        abilityScoreMethod: 'point-buy',
        rolledScores: [],
        rolledScoreAssignments: {}
      });
      return;
    }

    const nextScores = defaultScores();
    setScores(nextScores);
    setRolledAssignments({});
    syncBuilder(nextScores, {
      abilityScoreMethod: 'rolled',
      rolledScores: rolledValues,
      rolledScoreAssignments: {}
    });
  };

  const handleRolledScoreChange = (ability: keyof AbilityScores, value: string) => {
    const nextAssignments = { ...rolledAssignments };
    const nextScores = { ...scores };

    if (value) {
      const numericValue = Number.parseInt(value, 10);
      nextAssignments[ability] = numericValue;
      nextScores[ability] = numericValue;
    } else {
      delete nextAssignments[ability];
      nextScores[ability] = 10;
    }

    setRolledAssignments(nextAssignments);
    setScores(nextScores);
    syncBuilder(nextScores, {
      abilityScoreMethod: 'rolled',
      rolledScores: rolledValues,
      rolledScoreAssignments: nextAssignments
    });
  };

  const updateAbilityChoiceSelection = (config: AbilityScoreChoiceConfig, slotIndex: number, value: string) => {
    const currentSelections = builderState.character?.abilityScoreChoiceSelections ?? {};
    const nextSlots = Array.from({ length: config.chooseCount }, (_, index) => {
      if (index === slotIndex) {
        return value;
      }

      return currentSelections[config.id]?.[index] ?? '';
    });
    const cleanedSelections = nextSlots.filter((entry): entry is keyof AbilityScores => Boolean(entry));

    updateBuilderCharacter({
      abilityScoreChoiceSelections: {
        ...currentSelections,
        [config.id]: cleanedSelections
      }
    });
  };

  const handleBackgroundAbilityModeChange = (mode: AbilityScoreChoiceMode) => {
    if (!background || !backgroundAbilityModeKey) {
      return;
    }

    const prefix = `background:${background.id}:origin-asi:`;
    const nextSelections = Object.fromEntries(
      Object.entries(builderState.character?.abilityScoreChoiceSelections ?? {}).filter(([key]) => !key.startsWith(prefix))
    );

    updateBuilderCharacter({
      abilityScoreChoiceModes: {
        ...builderState.character?.abilityScoreChoiceModes,
        [backgroundAbilityModeKey]: mode
      },
      abilityScoreChoiceSelections: nextSelections
    });
  };

  const getBlockedAbilities = (config: AbilityScoreChoiceConfig, slotIndex: number) => {
    const blockedAbilities = new Set<keyof AbilityScores>();
    const currentSelections = builderState.character?.abilityScoreChoiceSelections?.[config.id] ?? [];

    currentSelections.forEach((ability, index) => {
      if (index !== slotIndex) {
        blockedAbilities.add(ability);
      }
    });

    if (config.exclusiveGroupId) {
      abilityScoreChoiceConfigs
        .filter((entry) => entry.exclusiveGroupId === config.exclusiveGroupId && entry.id !== config.id)
        .forEach((entry) => {
          (builderState.character?.abilityScoreChoiceSelections?.[entry.id] ?? []).forEach((ability) => blockedAbilities.add(ability));
        });
    }

    return blockedAbilities;
  };

  const formatSignedValue = (value: number) => (value > 0 ? `+${value}` : String(value));

  const getAbilityBonusNote = (ability: keyof AbilityScores) => {
    const bonus = derivedAbilityScoreBonuses[ability] ?? 0;
    if (bonus === 0) {
      return `Base ${scores[ability]}`;
    }

    return `Base ${scores[ability]}, bonus ${formatSignedValue(bonus)}`;
  };

  const renderAbilityChoiceSlot = (config: AbilityScoreChoiceConfig, slotIndex: number) => {
    const currentValue = builderState.character?.abilityScoreChoiceSelections?.[config.id]?.[slotIndex] ?? '';
    const blockedAbilities = getBlockedAbilities(config, slotIndex);

    return (
      <select
        key={`${config.id}-${slotIndex}`}
        value={currentValue}
        onChange={(event) => updateAbilityChoiceSelection(config, slotIndex, event.target.value)}
        className={nativeSelectClassName}
      >
        <option value="">Select an ability...</option>
        {config.options.map((ability) => (
          <option
            key={`${config.id}-${ability}`}
            value={ability}
            disabled={blockedAbilities.has(ability) && currentValue !== ability}
          >
            {ability.charAt(0).toUpperCase() + ability.slice(1)}
            {blockedAbilities.has(ability) && currentValue !== ability ? ' (already used)' : ''}
          </option>
        ))}
      </select>
    );
  };

  const renderAbilityChoiceConfig = (config: AbilityScoreChoiceConfig) => {
    return (
      <div key={config.id} className="space-y-2">
        <Label>{config.label}</Label>
        {Array.from({ length: config.chooseCount }, (_, slotIndex) => renderAbilityChoiceSlot(config, slotIndex))}
      </div>
    );
  };

  return (
    <div className={isRolledMode ? 'space-y-6 pb-6' : 'space-y-6'}>
      {isRolledMode && (
        <>
          <div
            aria-hidden
            className={`pointer-events-none fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] transition-opacity duration-300 ${rollingDice ? 'opacity-100' : 'opacity-0'}`}
          />
          {/* The dice roll across the entire viewport rather than inside a small tray. The overlay
              stays mounted while in rolled mode so the physics engine keeps its context, and
              pointer-events-none lets the controls underneath stay interactive. */}
          <div className="pointer-events-none fixed inset-0 z-50">
            <DiceScene
              ref={diceSceneRef}
              soundEnabled={diceSoundEnabled}
              theme="default"
              scale={7}
              throwForce={7}
              spinForce={7}
              onError={setDiceError}
              onReadyChange={setDiceReady}
              className="h-full w-full"
            />
          </div>
        </>
      )}

      <div>
        <h2 className="text-2xl font-bold">Ability Scores</h2>
        <p className="text-muted-foreground">
          Choose how to generate your character's ability scores.
        </p>
      </div>

      <RadioGroup
        value={method}
        onValueChange={(v) => handleMethodChange(v as AbilityScoreMethod)}
        className="grid gap-4 md:grid-cols-3"
      >
        <div>
          <RadioGroupItem value="standard" id="standard" className="peer sr-only" />
          <Label
            htmlFor="standard"
            className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
          >
            <span className="font-semibold">Standard Array</span>
            <span className="text-xs text-muted-foreground">15, 14, 13, 12, 10, 8</span>
          </Label>
        </div>
        <div>
          <RadioGroupItem value="point-buy" id="point-buy" className="peer sr-only" />
          <Label
            htmlFor="point-buy"
            className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
          >
            <span className="font-semibold">Point Buy</span>
            <span className="text-xs text-muted-foreground">27 points to distribute</span>
          </Label>
        </div>
        <div>
          <RadioGroupItem value="rolled" id="rolled" className="peer sr-only" />
          <Label
            htmlFor="rolled"
            className="flex cursor-pointer flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
          >
            <span className="font-semibold">Roll Dice</span>
            <span className="text-xs text-muted-foreground">4d6 drop lowest</span>
          </Label>
        </div>
      </RadioGroup>

      {method === 'standard' && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Standard Array</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Each number may be used once: {standardArrayScores.join(', ')}
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ABILITY_NAMES.map((ability) => {
                const assignedValues = new Set(
                  Object.entries(scores)
                    .filter(([otherAbility]) => otherAbility !== ability)
                    .map(([, value]) => value)
                );
                return (
                  <div key={ability} className="space-y-2">
                    <Label className="capitalize">{ability}</Label>
                    <select
                      value={scores[ability]}
                      onChange={(e) => handleScoreChange(ability, Number.parseInt(e.target.value, 10))}
                      className={nativeSelectClassName}
                    >
                      {standardArrayScores.map((val) => (
                        <option
                          key={val}
                          value={val}
                          disabled={assignedValues.has(val) && scores[ability] !== val}
                        >
                          {val} ({calculateModifier(val)})
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {method === 'point-buy' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>Point Buy</span>
              <Badge variant={pointBuyRemaining >= 0 ? 'default' : 'destructive'}>
                {pointBuyRemaining} points remaining
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ABILITY_NAMES.map((ability) => (
                <div key={ability} className="space-y-2">
                  <Label className="capitalize">{ability}</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScoreChange(ability, Math.max(8, scores[ability] - 1))}
                      disabled={scores[ability] <= 8}
                    >
                      -
                    </Button>
                    <span className="w-12 text-center font-mono">{scores[ability]}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScoreChange(ability, Math.min(15, scores[ability] + 1))}
                      disabled={scores[ability] >= 15 || pointBuyRemaining < (pointBuyCosts[scores[ability] + 1] - pointBuyCosts[scores[ability]])}
                    >
                      +
                    </Button>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">Modifier: {calculateModifier(scores[ability])}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {method === 'rolled' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(19rem,0.95fr)]">
          <Card className="overflow-hidden">
            <CardHeader className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">4d6 Drop Lowest</Badge>
                <Badge variant="outline">{diceReady ? 'Dice ready' : 'Initializing dice'}</Badge>
                <Badge variant="outline">{Object.keys(rolledAssignments).length}/6 assigned</Badge>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <CardTitle>Roll Your Scores</CardTitle>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Roll directly inside the builder, keep the best three dice from each quartet, and assign the six totals without dropping into a separate tray region.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void handleRoll()} disabled={rollingDice}>
                    {rollButtonLabel}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setDiceSoundEnabled((current) => !current)}>
                    {diceSoundEnabled ? 'Sound On' : 'Sound Off'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {diceError ? (
                <Alert variant="destructive">
                  <AlertTitle>Dice Scene Error</AlertTitle>
                  <AlertDescription>{diceError}</AlertDescription>
                </Alert>
              ) : null}

              {rolledValues.length === 0 ? (
                <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                  Roll when you are ready. The dice stay embedded here while you review the results and assign them.
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Rolled Totals</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rolledValues.map((val, i) => (
                        <Badge key={`${val}-${i}`} className="px-3 py-1 text-base">
                          {val}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {rolledDiceGroups.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {rolledDiceGroups.map((group, index) => {
                        const keptTotal = group[0] + group[1] + group[2];
                        const droppedValue = group[3];

                        return (
                          <div key={`${group.join('-')}-${index}`} className="rounded-xl border bg-muted/20 p-4 text-sm">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Roll {index + 1}</p>
                            <p className="mt-2 font-mono text-base">{group.join(' • ')}</p>
                            <p className="mt-2 text-muted-foreground">Keep {group[0]}, {group[1]}, and {group[2]} for {keptTotal}. Drop {droppedValue}.</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Assign Rolled Scores</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Match each rolled total to one ability score.</p>
                </div>
                {rolledAssignmentPending ? <Badge variant="outline">Pending</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {rolledValues.length === 0 ? (
                <p className="text-sm text-muted-foreground">Roll the dice first to unlock score assignment.</p>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                    {ABILITY_NAMES.map((ability) => {
                      const currentValue = rolledAssignments[ability]?.toString() || '';
                      const assignedCountByValue = Object.entries(rolledAssignments)
                        .filter(([otherAbility]) => otherAbility !== ability)
                        .reduce<Record<number, number>>((counts, [, value]) => {
                          counts[value] = (counts[value] || 0) + 1;
                          return counts;
                        }, {});
                      const availableCountByValue = rolledValues.reduce<Record<number, number>>((counts, value) => {
                        counts[value] = (counts[value] || 0) + 1;
                        return counts;
                      }, {});

                      return (
                        <div key={ability} className="space-y-2">
                          <Label className="capitalize">{ability}</Label>
                          <select
                            value={currentValue}
                            onChange={(event) => handleRolledScoreChange(ability, event.target.value)}
                            className={nativeSelectClassName}
                          >
                            <option value="">Select...</option>
                            {rolledValues.map((val, index) => {
                              const disabled = (assignedCountByValue[val] || 0) >= (availableCountByValue[val] || 0) && currentValue !== val.toString();

                              return (
                                <option
                                  key={`${val}-${index}`}
                                  value={val}
                                  disabled={disabled}
                                >
                                  {val} ({calculateModifier(val)}){disabled ? ' - already assigned' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {rolledAssignmentPending ? <p className="text-sm text-muted-foreground">Assign all six rolls before continuing.</p> : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {(backgroundSupportsOriginBonuses || abilityScoreChoiceConfigs.length > 0 || appliedBonusSummary.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Ability Score Bonuses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {backgroundSupportsOriginBonuses && (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                <div>
                  <p className="font-medium">{background?.name} origin bonuses</p>
                  <p className="text-sm text-muted-foreground">
                    2024 backgrounds grant either +2 to one ability and +1 to a different ability, or +1 to three different abilities.
                  </p>
                </div>
                <RadioGroup
                  value={backgroundAbilityMode}
                  onValueChange={(value) => handleBackgroundAbilityModeChange(value as AbilityScoreChoiceMode)}
                  className="grid gap-3 md:grid-cols-2"
                >
                  <div>
                    <RadioGroupItem value="background-specialized" id="background-specialized" className="peer sr-only" />
                    <Label
                      htmlFor="background-specialized"
                      className="flex cursor-pointer flex-col rounded-md border-2 border-muted bg-background p-3 text-sm peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <span className="font-medium">Specialized</span>
                      <span className="text-muted-foreground">+2 to one ability and +1 to a different ability</span>
                    </Label>
                  </div>
                  <div>
                    <RadioGroupItem value="background-balanced" id="background-balanced" className="peer sr-only" />
                    <Label
                      htmlFor="background-balanced"
                      className="flex cursor-pointer flex-col rounded-md border-2 border-muted bg-background p-3 text-sm peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                    >
                      <span className="font-medium">Balanced</span>
                      <span className="text-muted-foreground">+1 to three different abilities</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {Object.entries(groupedAbilityChoices).map(([sourceLabel, configs]) => (
              <div key={sourceLabel} className="space-y-3 rounded-lg border p-4">
                <div>
                  <p className="font-medium">{sourceLabel}</p>
                  <p className="text-sm text-muted-foreground">Choose how this source adjusts your final scores.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {configs.map(renderAbilityChoiceConfig)}
                </div>
              </div>
            ))}

            {appliedBonusSummary.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {appliedBonusSummary.map((entry) => (
                  <Badge key={entry} variant="secondary">{entry}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ability Score Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
            {ABILITY_NAMES.map((ability) => (
              <div key={ability} className="text-center">
                <p className="text-xs uppercase text-muted-foreground">{ability.slice(0, 3)}</p>
                <p className="text-2xl font-bold">{totalScores[ability]}</p>
                <Badge variant="outline">{calculateModifier(totalScores[ability])}</Badge>
                <p className="mt-2 text-xs text-muted-foreground">{getAbilityBonusNote(ability)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
