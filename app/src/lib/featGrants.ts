/**
 * What a feat actually gives the character, resolved against the content library.
 *
 * The importer reads a feat's benefit lines into structure (`scripts/lib/featBenefits.mjs`); this
 * turns that structure into the things the builder and the sheet need — the spells the feat names,
 * the candidates for the spells it leaves open, and the option pool it borrows from another class.
 * Nothing here names a feat: every restriction comes from the line the source printed.
 */
import type {
  Class,
  Feat,
  FeatOptionChoice,
  FeatSpellChoice,
  FeatureOption,
  Spell
} from '@/types/dnd';
import { getRulesEdition, type RulesEdition } from '@/lib/builderRules';
import { dedupeByNamePreferringEdition } from '@/lib/contentSelection';

const normalize = (value: string) => value.toLowerCase().replaceAll(/[^a-z0-9]+/g, ' ').trim();

/** A feature name matches the feat's phrase whether the source pluralised it or not. */
const featureNameMatches = (featureName: string, wanted: string) => {
  const left = normalize(featureName);
  const right = normalize(wanted);
  return left === right || left === `${right}s` || `${left}s` === right;
};

/**
 * The spell a feat names, resolved by name in the edition the character is playing. Names rather
 * than ids because a feat printed in one book grants a spell printed in another, and the id it
 * would have to point at differs per pack.
 */
export function findSpellByName(
  spells: readonly Spell[],
  name: string,
  preferredEdition: RulesEdition
): Spell | undefined {
  const wanted = normalize(name);
  const matches = spells.filter((spell) => normalize(spell.name) === wanted);
  if (matches.length <= 1) {
    return matches[0];
  }

  return dedupeByNamePreferringEdition(matches, preferredEdition)[0] ?? matches[0];
}

/** Every spell the feat's own lines name outright, in the order the source states them. */
export function resolveGrantedFeatSpells(
  feat: Feat,
  spells: readonly Spell[],
  preferredEdition: RulesEdition
): Array<{ name: string; spell?: Spell }> {
  return (feat.grantedSpells ?? []).map((name) => ({
    name,
    spell: findSpellByName(spells, name, preferredEdition)
  }));
}

/**
 * The spells a choice may be filled with. A line that states no class list and no school leaves
 * every spell of that level open, which is what "one 1st-level spell of your choice" means when
 * the next sentence does not narrow it.
 */
export function resolveFeatSpellChoiceCandidates(
  choice: FeatSpellChoice,
  spells: readonly Spell[],
  preferredEdition: RulesEdition
): Spell[] {
  const classes = choice.classes?.map((entry) => normalize(entry));
  const schools = choice.schools?.map((entry) => normalize(entry));

  const matching = spells.filter((spell) => {
    if (spell.level !== choice.level) return false;
    if (schools?.length && !schools.includes(normalize(spell.school))) return false;
    if (classes?.length) {
      const spellClasses = new Set(spell.classes.map((entry) => normalize(entry)));
      if (!classes.some((entry) => spellClasses.has(entry))) return false;
    }
    return true;
  });

  return dedupeByNamePreferringEdition(matching, preferredEdition)
    .sort((left, right) => left.name.localeCompare(right.name));
}

/**
 * The options a borrowed pool offers, taken from the class's own feature. The class knows its own
 * invocations, fighting styles and metamagic, so the feat needs no copy of the list — the same
 * rule as `resolveOpenSkillChoices` for a class's skill list.
 */
export function resolveFeatOptionChoicePool(
  choice: FeatOptionChoice,
  classes: readonly Class[],
  preferredEdition: RulesEdition
): FeatureOption[] {
  const wantedClass = normalize(choice.className);
  const candidates = classes.filter((cls) => normalize(cls.name) === wantedClass);
  if (candidates.length === 0) {
    return [];
  }

  // The 2014 and 2024 warlocks both print invocations; take the printing this character plays.
  const ranked = [...candidates].sort((left, right) => {
    const rank = (cls: Class) => (getRulesEdition(cls.sourceId, cls.source) === preferredEdition ? 1 : 0);
    return rank(right) - rank(left);
  });

  for (const cls of ranked) {
    const feature = cls.features.find((entry) => featureNameMatches(entry.name, choice.featureName));
    if (feature?.options?.length) {
      return feature.options;
    }
  }

  return [];
}

export interface FeatSpellEntry {
  /** The spell id where the library knows it, else the name the source printed. */
  id: string;
  name: string;
  level: number;
  spell?: Spell;
  /** The feat that gave it, which is what the sheet labels the row with. */
  featName: string;
}

/**
 * Every spell a character has from its feats — the ones the feat names outright and the ones the
 * player picked for its own lines. These are not class spells: they do not count against a known
 * or prepared limit, which is why they live outside `character.spells`.
 */
export function resolveFeatSpellEntries(
  feats: readonly Feat[],
  featSpellSelections: Record<string, string[]> | undefined,
  spells: readonly Spell[],
  preferredEdition: RulesEdition
): FeatSpellEntry[] {
  const entries: FeatSpellEntry[] = [];
  const seen = new Set<string>();

  const add = (entry: FeatSpellEntry) => {
    const key = entry.spell?.id ?? normalize(entry.name);
    if (seen.has(key)) return;
    seen.add(key);
    entries.push(entry);
  };

  for (const feat of feats) {
    resolveGrantedFeatSpells(feat, spells, preferredEdition).forEach(({ name, spell }) => {
      add({ id: spell?.id ?? `${feat.id}::${normalize(name)}`, name, level: spell?.level ?? 0, spell, featName: feat.name });
    });

    for (const choice of feat.spellChoices ?? []) {
      for (const spellId of featSpellSelections?.[choice.id] ?? []) {
        const spell = spells.find((entry) => entry.id === spellId);
        add({ id: spellId, name: spell?.name ?? spellId, level: spell?.level ?? choice.level, spell, featName: feat.name });
      }
    }
  }

  return entries;
}

/** Whether a feat leaves anything for the player to fill in. */
export function featHasPendingChoices(
  feat: Feat,
  selections: {
    featSpellSelections?: Record<string, string[]>;
    selectedOptionIdsFor: (choiceId: string) => string[];
  }
): boolean {
  const spellsOutstanding = (feat.spellChoices ?? []).some(
    (choice) => (selections.featSpellSelections?.[choice.id] ?? []).length < choice.count
  );
  if (spellsOutstanding) return true;

  return (feat.optionChoices ?? []).some(
    (choice) => selections.selectedOptionIdsFor(choice.id).length < choice.count
  );
}

/** Add or remove one spell on a feat's own line, capped at the count the line states. */
export function updateFeatSpellSelection(
  current: Record<string, string[]> | undefined,
  choice: FeatSpellChoice,
  spellId: string
): Record<string, string[]> {
  const existing = current?.[choice.id] ?? [];
  const next = existing.includes(spellId)
    ? existing.filter((entry) => entry !== spellId)
    : [...existing, spellId].slice(-choice.count);

  const updated = { ...current };
  if (next.length === 0) delete updated[choice.id];
  else updated[choice.id] = next;
  return updated;
}
