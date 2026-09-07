// Everything a feat still asks the player for, on the step where the feat was taken.
//
// A feat's benefits are prose in the source, so what it grants is read out of that text by the
// importer (`scripts/lib/featBenefits.mjs`) and resolved here: the ability score it raises, the
// spells it names, the spells it leaves open, and the option pool it borrows from another class.
// The ability score choices also appear on the Ability Scores step, which is where they are
// applied; they are repeated here because that is where the feat was chosen.
import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { FeatureOptionSelector } from '@/components/builder/FeatureOptionSelector';
import { SheetCatalogPicker } from '@/components/character/SheetCatalogPicker';
import {
  getAbilityScoreChoiceConfigs,
  getFeatAbilityScoreModeKey,
  type AbilityScoreChoiceConfig,
  type RulesEdition
} from '@/lib/builderRules';
import {
  resolveFeatOptionChoicePool,
  resolveFeatSpellChoiceCandidates,
  resolveGrantedFeatSpells,
  updateFeatSpellSelection
} from '@/lib/featGrants';
import { getSelectedFeatureOptionIds, updateFeatureOptionSelections } from '@/lib/featureOptions';
import { X } from 'lucide-react';
import type { AbilityScores, Character, Class, Feat, Spell } from '@/types/dnd';

const NONE = '__none__';
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
const spellLevelLabel = (level: number) => (level === 0 ? 'Cantrip' : `Level ${level}`);

interface FeatChoicesPanelProps {
  readonly feat: Feat;
  readonly character: Partial<Character>;
  readonly spells: readonly Spell[];
  readonly classes: readonly Class[];
  readonly preferredEdition: RulesEdition;
  readonly onChange: (patch: Partial<Character>) => void;
}

export function FeatChoicesPanel({
  feat,
  character,
  spells,
  classes,
  preferredEdition,
  onChange
}: FeatChoicesPanelProps) {
  const abilityModes = character.abilityScoreChoiceModes;
  const abilitySelections = character.abilityScoreChoiceSelections;
  const featureSelections = character.features ?? [];

  const abilityConfigs = useMemo(
    () => getAbilityScoreChoiceConfigs({ feats: [feat], abilityScoreChoiceModes: abilityModes }),
    [abilityModes, feat]
  );

  const grantedSpells = useMemo(
    () => resolveGrantedFeatSpells(feat, spells, preferredEdition),
    [feat, preferredEdition, spells]
  );

  const alternatives = feat.abilityScoreIncreaseAlternatives ?? [];
  const modeKey = getFeatAbilityScoreModeKey(feat);
  const activeAlternative = abilityModes?.[modeKey] ?? '0';

  const setAbilitySelection = (config: AbilityScoreChoiceConfig, slotIndex: number, value: string) => {
    const current: Array<keyof AbilityScores | undefined> = [...(abilitySelections?.[config.id] ?? [])];
    while (current.length <= slotIndex) current.push(undefined);
    current[slotIndex] = value === NONE ? undefined : (value as keyof AbilityScores);

    onChange({
      abilityScoreChoiceSelections: {
        ...abilitySelections,
        [config.id]: current
          .filter((entry): entry is keyof AbilityScores => Boolean(entry))
          .slice(0, config.chooseCount)
      }
    });
  };

  const setSpellSelection = (choiceId: string, spellId: string) => {
    const choice = feat.spellChoices?.find((entry) => entry.id === choiceId);
    if (!choice) return;
    onChange({ featSpellSelections: updateFeatSpellSelection(character.featSpellSelections, choice, spellId) });
  };

  const setOptionSelection = (choiceId: string, slotIndex: number, optionId: string, chooseCount: number) => {
    onChange({
      features: updateFeatureOptionSelections(featureSelections, choiceId, slotIndex, optionId, chooseCount)
    });
  };

  const hasAnything = abilityConfigs.length > 0
    || grantedSpells.length > 0
    || (feat.spellChoices?.length ?? 0) > 0
    || (feat.optionChoices?.length ?? 0) > 0;

  if (!hasAnything) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      {alternatives.length > 1 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">How this feat raises your scores</p>
          <Select value={activeAlternative} onValueChange={(value) => onChange({
            abilityScoreChoiceModes: { ...abilityModes, [modeKey]: value }
          })}>
            <SelectTrigger className="min-h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {alternatives.map((entries, index) => {
                const entry = entries[0];
                const label = `${entry.chooseCount ?? 1} ability score${(entry.chooseCount ?? 1) > 1 ? 's' : ''} by +${entry.amount}`;
                return <SelectItem key={label} value={String(index)}>{label}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {abilityConfigs.map((config) => (
        <div key={config.id} className="space-y-2">
          <p className="text-sm font-medium">{config.label}</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: config.chooseCount }).map((_, slotIndex) => {
              const picked = abilitySelections?.[config.id]?.[slotIndex] ?? '';
              const takenElsewhere = new Set(
                (abilitySelections?.[config.id] ?? []).filter((_, index) => index !== slotIndex)
              );

              return (
                <Select
                  key={`${config.id}-${slotIndex}`}
                  value={picked || NONE}
                  onValueChange={(value) => setAbilitySelection(config, slotIndex, value)}
                >
                  <SelectTrigger className="min-h-11 w-48">
                    <SelectValue placeholder="Choose an ability" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Not chosen</SelectItem>
                    {config.options.map((ability) => (
                      <SelectItem key={ability} value={ability} disabled={takenElsewhere.has(ability)}>
                        {capitalize(ability)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })}
          </div>
        </div>
      ))}

      {grantedSpells.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Spells this feat gives you</p>
          <div className="flex flex-wrap gap-2">
            {grantedSpells.map((entry) => (
              <Badge key={entry.name} variant="secondary">
                {entry.spell ? `${entry.spell.name} · ${spellLevelLabel(entry.spell.level)}` : entry.name}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {(feat.spellChoices ?? []).map((choice) => (
        <FeatSpellChoiceRow
          key={choice.id}
          choice={choice}
          selected={character.featSpellSelections?.[choice.id] ?? []}
          spells={spells}
          preferredEdition={preferredEdition}
          onToggle={(spellId) => setSpellSelection(choice.id, spellId)}
        />
      ))}

      {(feat.optionChoices ?? []).map((choice) => {
        const options = resolveFeatOptionChoicePool(choice, classes, preferredEdition);
        return (
          <div key={choice.id} className="space-y-2">
            <Separator />
            <p className="text-sm font-medium">{capitalize(choice.label)}</p>
            {options.length > 0 ? (
              <FeatureOptionSelector
                feature={{ id: choice.id, options, chooseCount: choice.count }}
                selectedOptionIds={getSelectedFeatureOptionIds(featureSelections, choice.id)}
                onValueChange={(slotIndex, value) => setOptionSelection(choice.id, slotIndex, value, choice.count)}
                showDescriptions={false}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                The {choice.className} options are not in the sources this character has enabled.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface FeatSpellChoiceRowProps {
  readonly choice: NonNullable<Feat['spellChoices']>[number];
  readonly selected: string[];
  readonly spells: readonly Spell[];
  readonly preferredEdition: RulesEdition;
  readonly onToggle: (spellId: string) => void;
}

function FeatSpellChoiceRow({ choice, selected, spells, preferredEdition, onToggle }: FeatSpellChoiceRowProps) {
  const candidates = useMemo(
    () => resolveFeatSpellChoiceCandidates(choice, spells, preferredEdition),
    [choice, preferredEdition, spells]
  );
  const chosen = new Set(selected);
  const remaining = Math.max(0, choice.count - selected.length);
  const pickLabel = remaining === 1 ? 'a spell' : `${remaining} spells`;

  return (
    <div className="space-y-2">
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{capitalize(choice.label)}</p>
        {remaining > 0 ? (
          <SheetCatalogPicker
            triggerLabel={`Choose ${pickLabel}`}
            title="Choose a spell"
            description={choice.label}
            items={candidates
              .filter((spell) => !chosen.has(spell.id))
              .map((spell) => ({
                id: spell.id,
                name: spell.name,
                detail: `${spellLevelLabel(spell.level)} · ${spell.school} · ${spell.source}`,
                keywords: spell.school
              }))}
            onPick={onToggle}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {selected.map((spellId) => {
          const spell = candidates.find((entry) => entry.id === spellId)
            ?? spells.find((entry) => entry.id === spellId);
          return (
            <Button
              key={spellId}
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11"
              onClick={() => onToggle(spellId)}
            >
              {spell?.name ?? spellId}
              <X className="ml-2 h-3 w-3" />
            </Button>
          );
        })}
        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {candidates.length === 0
              ? 'No spells in the enabled sources match this line.'
              : 'Nothing chosen yet.'}
          </p>
        ) : null}
      </div>
    </div>
  );
}
