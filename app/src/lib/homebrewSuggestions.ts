import { useMemo } from 'react';
import { useContentLibrary } from '@/data/runtimeContent';
import { defaultLanguageOptions, skillNames } from '@/lib/builderRules';
import type { Proficiency } from '@/types/dnd';

// Builds autocomplete suggestion pools for the Homebrew Workbench's free-text
// fields entirely from data already loaded into the content library (imported
// sources plus other homebrew entries), so suggestions grow with the library
// instead of duplicating book content as hardcoded strings here.

// Case-insensitive dedupe that keeps the first-seen casing, so "Light Armor"
// and "light armor" from different sources collapse into one suggestion.
function collectDistinct(values: Iterable<string | undefined | null>): string[] {
  const canonicalByKey = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!canonicalByKey.has(key)) canonicalByKey.set(key, trimmed);
  }
  return [...canonicalByKey.values()].sort((a, b) => a.localeCompare(b));
}

// Stricter than collectDistinct: for fields whose real values are short,
// singular nouns (a skill, a tool, a language, an armor/weapon category),
// source data occasionally leaks full sentences instead of a clean item
// name (a "choose one of..." instruction, or a monster's prose language
// note). Those aren't picked items, so they make unusable suggestions -
// drop anything that reads like a sentence fragment rather than a name.
const SENTENCE_FRAGMENT_LEAD = /^(choose|and|or|all|any|as|the|see|another|other)\b/i;
// Trailing "property"/"properties" means the source text was describing a
// rule ("weapons with the Light property"), not naming a pickable item.
const SENTENCE_FRAGMENT_TRAIL = /\bpropert(y|ies)$/i;
const MAX_ITEM_WORDS = 3;

function collectAtomicItems(values: Iterable<string | undefined | null>): string[] {
  const canonicalByKey = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    if (SENTENCE_FRAGMENT_LEAD.test(trimmed) || SENTENCE_FRAGMENT_TRAIL.test(trimmed)) continue;
    if (trimmed.includes('(') || trimmed.includes('"') || trimmed.includes('“')) continue;
    if (trimmed.split(/\s+/).length > MAX_ITEM_WORDS) continue;
    const key = trimmed.toLowerCase();
    if (!canonicalByKey.has(key)) canonicalByKey.set(key, trimmed);
  }
  return [...canonicalByKey.values()].sort((a, b) => a.localeCompare(b));
}

function collectFeatureNames(...featureLists: Array<Array<{ name: string }>>): string[] {
  return collectDistinct(featureLists.flatMap((features) => features.map((feature) => feature.name)));
}

export function useHomebrewSuggestions() {
  const library = useContentLibrary();

  return useMemo(() => {
    const { classes, subclasses, backgrounds, species, monsters, spells, equipment, feats } = library;

    const skills = [...skillNames] as string[];
    const toolProficiencies = collectAtomicItems([
      ...classes.flatMap((entry) => entry.toolProficiencies ?? []),
      ...backgrounds.flatMap((entry) => entry.toolProficiencies ?? []),
      ...equipment.filter((item) => item.type === 'tool').map((item) => item.name)
    ]);
    const armorProficiencies = collectAtomicItems(classes.flatMap((entry) => entry.armorProficiencies));
    const weaponProficiencies = collectAtomicItems(classes.flatMap((entry) => entry.weaponProficiencies));
    // Monster stat blocks' "Languages" line is often free prose ("understands
    // Common but can't speak", or worse, misaligned parser output) rather
    // than a clean language name, so it's excluded as a suggestion source.
    const languages = collectAtomicItems([...defaultLanguageOptions, ...species.flatMap((entry) => entry.languages ?? [])]);

    const proficiencyNames = collectDistinct([...skills, ...toolProficiencies, ...armorProficiencies, ...weaponProficiencies, ...languages]);
    const proficiencyTypeByLowerName = new Map<string, Proficiency['type']>();
    for (const name of skills) proficiencyTypeByLowerName.set(name.toLowerCase(), 'skill');
    for (const name of toolProficiencies) proficiencyTypeByLowerName.set(name.toLowerCase(), 'tool');
    for (const name of armorProficiencies) proficiencyTypeByLowerName.set(name.toLowerCase(), 'armor');
    for (const name of weaponProficiencies) proficiencyTypeByLowerName.set(name.toLowerCase(), 'weapon');
    for (const name of languages) proficiencyTypeByLowerName.set(name.toLowerCase(), 'language');

    return {
      skills,
      languages,
      toolProficiencies,
      armorProficiencies,
      weaponProficiencies,
      proficiencyNames,
      resolveProficiencyType: (name: string): Proficiency['type'] => proficiencyTypeByLowerName.get(name.toLowerCase()) ?? 'skill',
      classNames: collectDistinct(classes.map((entry) => entry.name)),
      classIds: collectDistinct(classes.map((entry) => entry.id)),
      speciesNames: collectDistinct(species.map((entry) => entry.name)),
      equipmentNames: collectDistinct(equipment.map((entry) => entry.name)),
      spellSchools: collectDistinct(spells.map((entry) => entry.school)),
      castingTimes: collectDistinct(spells.map((entry) => entry.castingTime)),
      spellRanges: collectDistinct(spells.map((entry) => entry.range)),
      spellDurations: collectDistinct(spells.map((entry) => entry.duration)),
      monsterTypes: collectDistinct(monsters.map((entry) => entry.type)),
      alignments: collectDistinct(monsters.map((entry) => entry.alignment)),
      monsterSavingThrows: collectAtomicItems(monsters.flatMap((entry) => entry.savingThrows ?? [])),
      monsterSkills: collectAtomicItems(monsters.flatMap((entry) => entry.skills ?? [])),
      damageResistances: collectAtomicItems(monsters.flatMap((entry) => entry.damageResistances ?? [])),
      damageImmunities: collectAtomicItems(monsters.flatMap((entry) => entry.damageImmunities ?? [])),
      conditionImmunities: collectAtomicItems(monsters.flatMap((entry) => entry.conditionImmunities ?? [])),
      senses: collectAtomicItems(monsters.flatMap((entry) => entry.senses ?? [])),
      weaponProperties: collectAtomicItems(equipment.flatMap((entry) => entry.properties ?? [])),
      damageTypes: collectAtomicItems(equipment.map((entry) => entry.damageType)),
      featureNames: collectFeatureNames(
        classes.flatMap((entry) => entry.features),
        subclasses.flatMap((entry) => entry.features),
        species.flatMap((entry) => entry.features),
        feats.flatMap((entry) => entry.features)
      ),
      monsterTraitNames: collectFeatureNames(monsters.flatMap((entry) => entry.traits)),
      monsterActionNames: collectFeatureNames(
        monsters.flatMap((entry) => entry.actions),
        monsters.flatMap((entry) => entry.bonusActions ?? []),
        monsters.flatMap((entry) => entry.reactions ?? []),
        monsters.flatMap((entry) => entry.legendaryActions ?? [])
      )
    };
  }, [library]);
}
