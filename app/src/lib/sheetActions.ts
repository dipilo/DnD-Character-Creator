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
 * states no timing and spends no pool appears in no row rather than being guessed into one. Even
 * Dodge and Disengage are imported: each printing labels its own list, and `combatActions` carries
 * it.
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
import type { CombatAction, Feature, Spell } from '@/types/dnd';

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

/**
 * One line of the Damage column.
 *
 * A weapon with Versatile states two of them, and which one is thrown is the player's choice as
 * they swing — so they are two buttons, not one label reading "1d6+1 (1d8+1)".
 */
export interface SheetActionDamage {
  /** What a click throws. Absent where the row states an effect rather than dice. */
  notation?: string;
  label: string;
}

export interface SheetActionEntry {
  id: string;
  name: string;
  /** The line under the name: "Melee Weapon", "Cantrip · Evocation", the class that grants it. */
  meta?: string;
  kind: 'weapon' | 'spell' | 'feature' | 'combat-action';
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
  /** The Damage column, already scaled to this character's level. One line per choice. */
  damages: SheetActionDamage[];
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
    damages: [
      { notation: attack.damage, label: attack.damage },
      ...(attack.versatileDamage
        ? [{ notation: attack.versatileDamage, label: `${attack.versatileDamage} (two-handed)` }]
        : [])
    ],
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
 * A spell's row, for the spells this character attacks with. The bonus is the caster's and the save
 * is the caster's, both read from the spell's own sentences.
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

    // This table is the attack table. A spell that rolls no attack is read and cast on the Spells
    // tab, which prints the same columns plus Time — listing it here as well made the Actions tab a
    // second copy of that tab, under a heading that says these are the things you attack with.
    if (!makesAttack) continue;

    const damageLabel = [dice, effects.join(', ')].filter(Boolean).join(' ');

    rows.push({
      id: `spell-${entry.id}`,
      name: entry.name,
      meta: spellMeta(spell, entry.level, entry.grantedBy),
      kind: 'spell',
      group: castingTimeGroup(spell.castingTime),
      isAttack: true,
      time: spell.castingTime || undefined,
      range: spell.range || undefined,
      attackBonus: castingStat?.attackBonus,
      saveLabel: saveLabel(save, castingStat),
      damages: damageLabel ? [{ notation: dice, label: damageLabel }] : [],
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
      damages: dice ? [{ notation: dice, label: dice }] : [],
      notes: resource?.resetsOn ? `Recharges on a ${resource.resetsOn} rest` : undefined,
      description: feature.description,
      resourceKey: resource?.key
    });
  }

  return rows;
}

/* -------------------------------------------------------------------------- *
 * Actions in Combat
 * -------------------------------------------------------------------------- */

/**
 * The actions everybody has, in the group the book's own label puts them in. They are the same row
 * shape as everything else — a name, and the rule behind it — so they print in the same table.
 */
function combatActionRows(actions: readonly CombatAction[]): SheetActionEntry[] {
  return actions.map((action) => ({
    id: `combat-action-${action.id}`,
    name: action.name,
    meta: action.source,
    kind: 'combat-action' as const,
    group: (SHEET_ACTION_GROUP_ORDER as readonly string[]).includes(action.timing)
      ? (action.timing as SheetActionGroup)
      : 'other',
    isAttack: false,
    damages: [],
    description: action.description
  }));
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
  /** What every character can do, from the printing this character plays. */
  combatActions?: readonly CombatAction[];
}

export function deriveSheetActions({
  attacks,
  spells,
  features,
  classResources,
  castingStat,
  characterLevel,
  combatActions = []
}: SheetActionsInput): SheetActionEntry[] {
  return [
    ...weaponRows(attacks),
    ...spellRows(spells, castingStat, characterLevel),
    ...featureRows(features, classResources),
    ...combatActionRows(combatActions)
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
