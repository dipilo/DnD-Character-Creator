/**
 * Everything this character can do in a round, as rows of one table.
 *
 * D&D Beyond's Actions tab is a single filtered list — All / Attack / Action / Bonus Action /
 * Reaction / Other / Limited Use — over an attack table with fixed columns, and ours was a card per
 * weapon beside an accordion of features. This module is the row model behind both: a weapon, a
 * spell and a feature all resolve to the same shape, so the table renders one kind of thing.
 *
 * Nothing here is a list of actions written in the app. A weapon's row comes from the equipment, a
 * spell's from the spell's own statblock and sentences, and a feature's from the sentence that says
 * when it is used — `detectActionTiming`, exactly as the turn list already read it. A feature that
 * states no timing and spends no pool appears in no row rather than being guessed into one.
 */
import { detectActionTiming, type ActionTiming } from '@/lib/sheetCombat';
import {
  deriveSpellAttackOrSave,
  deriveSpellDamageOrEffect,
  deriveSpellDice,
  type SpellAttackOrSave
} from '@/lib/spellFacets';
import { ABILITY_ABBREVIATIONS, type DerivedAttack, type DerivedSpellcastingStats } from '@/lib/sheetDerivations';
import type { ResolvedClassResource } from '@/lib/sheetPlayState';
import type { Feature, Spell } from '@/types/dnd';

/** The chips over the list, in D&D Beyond's own order. */
export type SheetActionFilter = 'all' | 'attack' | ActionTiming | 'other' | 'limited-use';

export const SHEET_ACTION_FILTERS: readonly SheetActionFilter[] = [
  'all',
  'attack',
  'action',
  'bonus-action',
  'reaction',
  'other',
  'limited-use'
];

export const SHEET_ACTION_FILTER_LABELS: Record<SheetActionFilter, string> = {
  all: 'All',
  attack: 'Attack',
  action: 'Action',
  'bonus-action': 'Bonus Action',
  reaction: 'Reaction',
  other: 'Other',
  'limited-use': 'Limited Use'
};

/** Where a row is grouped when the list is unfiltered. */
export type SheetActionGroup = ActionTiming | 'other';

export const SHEET_ACTION_GROUP_LABELS: Record<SheetActionGroup, string> = {
  action: 'Actions',
  'bonus-action': 'Bonus Actions',
  reaction: 'Reactions',
  other: 'Other'
};

export const SHEET_ACTION_GROUP_ORDER: readonly SheetActionGroup[] = [
  'action',
  'bonus-action',
  'reaction',
  'other'
];

export interface SheetActionEntry {
  id: string;
  name: string;
  /** The line under the name: "Melee Weapon", "Cantrip · Evocation", the class that grants it. */
  meta?: string;
  kind: 'weapon' | 'spell' | 'feature';
  group: SheetActionGroup;
  /** True for a row the attack table would hold: it rolls to hit, or it is a weapon. */
  isAttack: boolean;
  /** The Time column — the casting time a spell states, or the timing a feature does. */
  time?: string;
  range?: string;
  /** To-hit, when the row rolls one. */
  attackBonus?: number;
  /** "DEX 15" — the save the row calls for, with this character's DC. */
  saveLabel?: string;
  /** What a damage click throws, already scaled to this character's level. */
  damageNotation?: string;
  /** What the Damage column prints: the notation plus the type the text names. */
  damageLabel?: string;
  notes?: string;
  description?: string;
  /** The pool this row spends, when its source states one. */
  resourceKey?: string;
  /** Set for a spell row, so the panel can wire Cast to the spell it came from. */
  spellId?: string;
  spellLevel?: number;
}

/* -------------------------------------------------------------------------- *
 * Weapons
 * -------------------------------------------------------------------------- */

/** A melee weapon states no range band; saying so beats printing an em dash in the Range column. */
const attackRange = (attack: DerivedAttack) =>
  attack.range ?? (attack.kind.startsWith('Melee') ? 'Melee' : undefined);

function weaponRows(attacks: readonly DerivedAttack[]): SheetActionEntry[] {
  return attacks.map((attack) => ({
    id: `weapon-${attack.name}`,
    name: attack.name,
    meta: attack.kind,
    kind: 'weapon' as const,
    group: 'action' as const,
    isAttack: true,
    time: 'Action',
    range: attackRange(attack),
    attackBonus: attack.attackBonus,
    damageNotation: attack.damage,
    damageLabel: attack.versatileDamage ? `${attack.damage} (${attack.versatileDamage})` : attack.damage,
    notes: [attack.proficient ? '' : 'Not proficient', ...attack.properties].filter(Boolean).join(', ') || undefined
  }));
}

/* -------------------------------------------------------------------------- *
 * Spells
 * -------------------------------------------------------------------------- */

/** One spell as the sheet holds it. The panel's own entry shape is a superset of this. */
export interface SpellActionSource {
  id: string;
  name: string;
  level: number;
  spell?: Spell;
  /** The feat that granted it, when one did. */
  grantedBy?: string;
}

const CASTING_TIME_GROUPS: ReadonlyArray<{ pattern: RegExp; group: SheetActionGroup }> = [
  { pattern: /\bbonus\s+action\b/i, group: 'bonus-action' },
  { pattern: /\breaction\b/i, group: 'reaction' },
  { pattern: /\baction\b/i, group: 'action' }
];

/** Which group a spell falls in, read from the casting time it prints. */
function castingTimeGroup(castingTime: string): SheetActionGroup {
  return CASTING_TIME_GROUPS.find((entry) => entry.pattern.test(castingTime))?.group ?? 'other';
}

/** "DC 15 DEX" — the save the spell calls for, at this character's own DC. */
const saveLabel = (
  save: SpellAttackOrSave | undefined,
  castingStat: DerivedSpellcastingStats | undefined
) =>
  save?.ability && castingStat ? `DC ${castingStat.saveDc} ${ABILITY_ABBREVIATIONS[save.ability]}` : undefined;

/** The letters, not the shopping list: the material's parenthetical belongs to the statblock. */
const spellNotes = (spell: Spell) =>
  [
    spell.components.map((component) => component.split(' ')[0]).join('/'),
    spell.concentration ? 'Concentration' : '',
    spell.ritual ? 'Ritual' : ''
  ]
    .filter(Boolean)
    .join(', ') || undefined;

function spellMeta(spell: Spell, level: number, grantedBy?: string): string {
  const printed = level === 0 ? 'Cantrip' : `Level ${level}`;
  return [printed, spell.school, grantedBy].filter(Boolean).join(' · ');
}

/**
 * A spell's row. Both halves of Hit/DC come from the spell's own sentences and this character's own
 * casting stats: the attack bonus is the caster's, and the DC is the caster's, so a spell that
 * states neither prints neither.
 */
function spellRows(
  spells: readonly SpellActionSource[],
  castingStat: DerivedSpellcastingStats | undefined,
  characterLevel: number
): SheetActionEntry[] {
  const rows: SheetActionEntry[] = [];

  for (const entry of spells) {
    const spell = entry.spell;
    if (!spell) continue;

    const facets = deriveSpellAttackOrSave(spell);
    const makesAttack = facets.some((facet) => facet.kind === 'attack');
    const save = facets.find((facet) => facet.kind === 'save');
    const dice = deriveSpellDice(spell, { characterLevel, slotLevel: spell.level });
    const effects = deriveSpellDamageOrEffect(spell).map((effect) => effect.label);

    // A spell earns a row by having something to put in Hit/DC or Damage. Detect Magic and Mage
    // Hand are spells a player reads on the Spells tab, not things they do in a round, and listing
    // every prepared spell here would make the Actions tab a second copy of that tab.
    if (!makesAttack && !save && effects.length === 0) continue;

    rows.push({
      id: `spell-${entry.id}`,
      name: entry.name,
      meta: spellMeta(spell, entry.level, entry.grantedBy),
      kind: 'spell',
      group: castingTimeGroup(spell.castingTime),
      isAttack: makesAttack,
      time: spell.castingTime || undefined,
      range: spell.range || undefined,
      attackBonus: makesAttack ? castingStat?.attackBonus : undefined,
      saveLabel: saveLabel(save, castingStat),
      damageNotation: dice,
      damageLabel: [dice, effects.join(', ')].filter(Boolean).join(' ') || undefined,
      notes: spellNotes(spell),
      description: spell.description,
      spellId: entry.id,
      spellLevel: entry.level
    });
  }

  return rows;
}

/* -------------------------------------------------------------------------- *
 * Features
 * -------------------------------------------------------------------------- */

const FEATURE_DICE_PATTERN = /\b(\d+d\d+)\b/;

const TIMING_TIME_LABELS: Record<ActionTiming, string> = {
  action: 'Action',
  'bonus-action': 'Bonus Action',
  reaction: 'Reaction'
};

/**
 * A feature's row.
 *
 * A feature earns one by saying when it is used, or by owning a pool — a Lay on Hands with 20
 * points in it is something a player uses in a fight whether or not the sentence names an action.
 * Everything else stays in the Features tab.
 */
function featureRows(
  features: readonly Feature[],
  resources: readonly ResolvedClassResource[]
): SheetActionEntry[] {
  const rows: SheetActionEntry[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    if (seen.has(feature.id)) continue;
    const timing = detectActionTiming(feature.description);
    const resource = resources.find((entry) => entry.featureName === feature.name);
    if (!timing && !resource) continue;
    seen.add(feature.id);

    const dice = FEATURE_DICE_PATTERN.exec(feature.description)?.[1];
    rows.push({
      id: `feature-${feature.id}`,
      name: feature.name,
      meta: [feature.source, `Level ${feature.level}`].filter(Boolean).join(' · '),
      kind: 'feature',
      group: timing ?? 'other',
      isAttack: false,
      time: timing ? TIMING_TIME_LABELS[timing] : undefined,
      damageNotation: dice,
      damageLabel: dice,
      notes: resource?.resetsOn ? `Recharges on a ${resource.resetsOn} rest` : undefined,
      description: feature.description,
      resourceKey: resource?.key
    });
  }

  return rows;
}

/* -------------------------------------------------------------------------- *
 * The list
 * -------------------------------------------------------------------------- */

export interface SheetActionsInput {
  attacks: readonly DerivedAttack[];
  spells: readonly SpellActionSource[];
  features: readonly Feature[];
  classResources: readonly ResolvedClassResource[];
  /** The class a spell is cast as, already chosen by the caller the way the Spells tab chooses it. */
  castingStat?: DerivedSpellcastingStats;
  /** Total level, which is what a cantrip's damage table keys off. */
  characterLevel: number;
}

export function deriveSheetActions({
  attacks,
  spells,
  features,
  classResources,
  castingStat,
  characterLevel
}: SheetActionsInput): SheetActionEntry[] {
  return [
    ...weaponRows(attacks),
    ...spellRows(spells, castingStat, characterLevel),
    ...featureRows(features, classResources)
  ];
}

/** Whether a row survives a chip. `all` keeps everything; the rest read one field each. */
export function matchesActionFilter(entry: SheetActionEntry, filter: SheetActionFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'attack') return entry.isAttack;
  if (filter === 'limited-use') return Boolean(entry.resourceKey);
  return entry.group === filter;
}

/** The rows a chip leaves, grouped for the headings the unfiltered list prints. */
export function groupSheetActions(
  entries: readonly SheetActionEntry[]
): Array<{ group: SheetActionGroup; entries: SheetActionEntry[] }> {
  return SHEET_ACTION_GROUP_ORDER.map((group) => ({
    group,
    entries: entries.filter((entry) => entry.group === group)
  })).filter((section) => section.entries.length > 0);
}
