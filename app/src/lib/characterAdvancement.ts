/**
 * Levelling up, and what a level-up leaves for the player to fill in.
 *
 * A level is a number on the document, so the sheet can raise it: `applyLevelUp` is the same write
 * the builder's Class step makes, through `updateCharacterClassEntry` so the first entry keeps its
 * place — it is the one that gets a full hit die at 1st level.
 *
 * What the new level *grants* is another matter. A subclass, an Ability Score Improvement, another
 * cantrip, a second Eldritch Invocation: none of those apply themselves, and before this nothing
 * said so. `deriveAdvancementTasks` reads them off the character's own classes, species and feats
 * and hands back a link to the step that resolves each one, so the same list can be shown on the
 * sheet and at the top of the builder.
 */
import {
  deriveCharacterHitPoints,
  getAdditionalFeatSelectionLimit,
  getSpeciesFeatSelectionSources,
  resolveBackgroundGrantedFeat,
  updateCharacterClassEntry,
  type ResolvedCharacterClass,
  type SpellcastingRulesSummary
} from '@/lib/builderRules';
import { featHasPendingChoices } from '@/lib/featGrants';
import { getChosenFeatureOptions, getSelectedFeatureOptionIds } from '@/lib/featureOptions';
import type {
  Background,
  Character,
  Class,
  Feat,
  Feature,
  Species,
  SpeciesVariant
} from '@/types/dnd';

/** The highest a single character goes in either printing. */
export const MAX_CHARACTER_LEVEL = 20;

/** One thing the character has earned and not yet chosen, and the step that chooses it. */
export interface AdvancementTask {
  id: string;
  /** What is outstanding, in one line. */
  label: string;
  /** Where it came from — the feature or the class that grants it. */
  detail?: string;
  /** The builder route that resolves it. */
  href: string;
  /** How many picks are still outstanding. */
  count: number;
}

export const totalCharacterLevel = (character: Pick<Character, 'classes'>) =>
  character.classes.reduce((sum, entry) => sum + entry.level, 0);

/**
 * Raise one class by a level.
 *
 * Hit points follow, because the maximum is stored: `deriveCharacterHitPoints` carries the current
 * total forward by the same amount the maximum moved, so a wounded character stays wounded.
 */
export function applyLevelUp(
  character: Character,
  classId: string,
  getClassById: (id: string) => Class | undefined
): Partial<Character> {
  const classes = updateCharacterClassEntry(character.classes, classId, getClassById, (entry) => ({
    ...entry,
    level: entry.level + 1
  }));

  return {
    classes,
    hp: deriveCharacterHitPoints({
      classes,
      abilityScores: character.abilityScores,
      previousHp: character.hp,
      getClassById
    })
  };
}

/** Whether another level can be taken at all, and in which class. */
export function canLevelUp(character: Pick<Character, 'classes'>) {
  return totalCharacterLevel(character) < MAX_CHARACTER_LEVEL;
}

/**
 * Drop one class by a level.
 *
 * Levelling is a thing players try out, so it has to be reversible on the sheet that offers it —
 * and hit points move back by exactly what they gained, because `deriveCharacterHitPoints` carries
 * the current total by the difference in the maximum.
 *
 * Nothing the level granted is deleted. A subclass chosen at 3rd level survives a drop to 2nd and
 * takes effect again on the way back up, which is the rule a class entry already follows in the
 * builder; the last level of a class is the floor, because removing the entry would take its
 * choices with it and, for the first entry, move every other class's hit dice.
 */
export function applyLevelDown(
  character: Character,
  classId: string,
  getClassById: (id: string) => Class | undefined
): Partial<Character> {
  const classes = updateCharacterClassEntry(character.classes, classId, getClassById, (entry) => ({
    ...entry,
    level: Math.max(1, entry.level - 1),
    // A hit die that no longer exists cannot stay spent.
    hitDiceUsed: Math.min(entry.hitDiceUsed ?? 0, Math.max(1, entry.level - 1))
  }));

  return {
    classes,
    hp: deriveCharacterHitPoints({
      classes,
      abilityScores: character.abilityScores,
      previousHp: character.hp,
      getClassById
    })
  };
}

/** Which classes still have a level to give back. The last level of a class is the floor. */
export function canLevelDown(character: Pick<Character, 'classes'>) {
  return character.classes.some((entry) => entry.level > 1);
}

/** Only the parts a pending choice is recorded in. The builder holds a partial character. */
export type AdvancementCharacter = Partial<Pick<Character, 'features' | 'feats' | 'featSpellSelections'>>;

export interface AdvancementContext {
  character: AdvancementCharacter;
  resolvedClasses: readonly ResolvedCharacterClass[];
  species?: Species;
  variant?: SpeciesVariant;
  background?: Background;
  /** Every feat in the library, so a background's granted feat can be told from a chosen one. */
  featCatalogue: readonly Feat[];
  /** The feats this character holds, resolved. */
  feats: readonly Feat[];
  spellcastingRules: SpellcastingRulesSummary;
}

const classFeaturesPath = (classId: string) => `/builder/class/${encodeURIComponent(classId)}?tab=features`;
const classSubclassesPath = (classId: string) => `/builder/class/${encodeURIComponent(classId)}?tab=subclasses`;
const speciesPath = (speciesId: string) => `/builder/species/${encodeURIComponent(speciesId)}`;

const outstandingOptionCount = (feature: Feature, character: AdvancementCharacter) =>
  Math.max(0, (feature.chooseCount ?? 0) - getChosenFeatureOptions(feature, character.features).length);

/** A feature that offers options and has not been given them all. */
function collectFeatureTasks(
  features: readonly Feature[],
  character: AdvancementCharacter,
  href: string,
  idPrefix: string,
  ownerName: string
): AdvancementTask[] {
  const tasks: AdvancementTask[] = [];
  for (const feature of features) {
    const outstanding = outstandingOptionCount(feature, character);
    if (outstanding <= 0) continue;
    tasks.push({
      id: `${idPrefix}:${feature.id}`,
      label: outstanding === 1 ? `Choose an option for ${feature.name}` : `Choose ${outstanding} options for ${feature.name}`,
      detail: `${ownerName} · level ${feature.level}`,
      href,
      count: outstanding
    });
  }
  return tasks;
}

function collectClassTasks(context: AdvancementContext): AdvancementTask[] {
  const { character, resolvedClasses } = context;
  const tasks: AdvancementTask[] = [];

  for (const { entry, cls, subclass } of resolvedClasses) {
    if (!entry.subclassId && entry.level >= cls.subclassLevel) {
      tasks.push({
        id: `subclass:${cls.id}`,
        label: `Choose a subclass for ${cls.name}`,
        detail: `Unlocks at level ${cls.subclassLevel}`,
        href: classSubclassesPath(cls.id),
        count: 1
      });
    }

    tasks.push(
      ...collectFeatureTasks(
        cls.features.filter((feature) => feature.level <= entry.level),
        character,
        classFeaturesPath(cls.id),
        `class:${cls.id}`,
        cls.name
      )
    );

    if (subclass) {
      tasks.push(
        ...collectFeatureTasks(
          subclass.features.filter((feature) => feature.level <= entry.level),
          character,
          classSubclassesPath(cls.id),
          `subclass:${subclass.id}`,
          subclass.name
        )
      );
    }
  }

  return tasks;
}

function collectFeatTasks(context: AdvancementContext): AdvancementTask[] {
  const { character, resolvedClasses, species, variant, background, featCatalogue, feats } = context;
  const tasks: AdvancementTask[] = [];

  const grantedBackgroundFeat = resolveBackgroundGrantedFeat(background, [...featCatalogue]);
  const selectedClasses = resolvedClasses.map(({ cls, entry, subclass }) => ({
    cls,
    level: entry.level,
    subclassId: entry.subclassId,
    subclass
  }));
  const limit =
    getAdditionalFeatSelectionLimit(selectedClasses) +
    getSpeciesFeatSelectionSources({ species, variant }).reduce((total, source) => total + source.count, 0);
  const chosen = (character.feats ?? []).filter((featId) => featId !== grantedBackgroundFeat?.id).length;
  const outstanding = Math.max(0, limit - chosen);

  if (outstanding > 0) {
    tasks.push({
      id: 'feats:remaining',
      label: outstanding === 1 ? 'Take a feat or ability score increase' : `Take ${outstanding} feats or ability score increases`,
      detail: 'Earned from your class levels',
      href: '/builder/advancements',
      count: outstanding
    });
  }

  for (const feat of feats) {
    const pending = featHasPendingChoices(feat, {
      featSpellSelections: character.featSpellSelections,
      selectedOptionIdsFor: (choiceId) => getSelectedFeatureOptionIds(character.features, choiceId)
    });
    if (!pending) continue;
    tasks.push({
      id: `feat:${feat.id}`,
      label: `Finish the choices ${feat.name} offers`,
      detail: 'Feat',
      href: '/builder/advancements',
      count: 1
    });
  }

  return tasks;
}

function collectSpellTasks(context: AdvancementContext): AdvancementTask[] {
  const { spellcastingRules } = context;
  const tasks: AdvancementTask[] = [];

  if (spellcastingRules.remainingCantrips > 0) {
    tasks.push({
      id: 'spells:cantrips',
      label:
        spellcastingRules.remainingCantrips === 1
          ? 'Learn one more cantrip'
          : `Learn ${spellcastingRules.remainingCantrips} more cantrips`,
      detail: `${spellcastingRules.selectedCantrips} of ${spellcastingRules.cantripLimit} chosen`,
      href: '/builder/spells',
      count: spellcastingRules.remainingCantrips
    });
  }

  const remainingSpells = spellcastingRules.remainingLeveledSpells ?? 0;
  if (remainingSpells > 0) {
    tasks.push({
      id: 'spells:leveled',
      label: remainingSpells === 1 ? 'Learn one more spell' : `Learn ${remainingSpells} more spells`,
      detail:
        spellcastingRules.leveledSpellLimit === undefined
          ? undefined
          : `${spellcastingRules.selectedLeveledSpells} of ${spellcastingRules.leveledSpellLimit} chosen`,
      href: '/builder/spells',
      count: remainingSpells
    });
  }

  return tasks;
}

function collectSpeciesTasks(context: AdvancementContext): AdvancementTask[] {
  const { character, species, variant } = context;
  if (!species) return [];

  return collectFeatureTasks(
    [...species.features, ...(variant?.features ?? [])],
    character,
    speciesPath(species.id),
    `species:${species.id}`,
    variant?.name ?? species.name
  );
}

/**
 * Everything this character has earned and not chosen, in the order a player would work through it:
 * the class first, because a subclass changes what the rest of the list says.
 */
export function deriveAdvancementTasks(context: AdvancementContext): AdvancementTask[] {
  return [
    ...collectClassTasks(context),
    ...collectSpeciesTasks(context),
    ...collectFeatTasks(context),
    ...collectSpellTasks(context)
  ];
}
