// One row model for weapons, spells and features; a feature stating no timing has no row.
import {
  deriveFeatureSaves,
  deriveFeatureThrows,
  describeFeatureSave,
  type FeatureContext,
  type FeatureSave
} from '@/lib/featureFacets';
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

/** Versatile states two, and the choice is made as you swing, so they are two buttons. */
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
  /** The book's own one-line summary of a combat action, printed above its rule. */
  summary?: string;
  description?: string;
  /** The pool this row spends, when its source states one. */
  resourceKey?: string;
  /** Set for a spell row, so the panel can wire Cast to the spell it came from. */
  spellId?: string;
  spellLevel?: number;
  /** Whether casting it takes up concentration, which is the spell's own field. */
  spellName?: string;
  concentration?: boolean;
}

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

/** Only V, S and M: a material list is prose, and Animate Dead arrived as five components. */
const componentLetters = (components: readonly string[]) =>
  [...new Set(components.map((component) => component.split(' ')[0]))]
    .filter((letter) => letter === 'V' || letter === 'S' || letter === 'M')
    .join('/');

const spellNotes = (spell: Spell) =>
  [
    componentLetters(spell.components),
    spell.concentration ? 'Concentration' : '',
    spell.ritual ? 'Ritual' : ''
  ]
    .filter(Boolean)
    .join(', ') || undefined;

function spellMeta(spell: Spell, level: number, grantedBy?: string): string {
  const printed = level === 0 ? 'Cantrip' : `Level ${level}`;
  return [printed, spell.school, grantedBy].filter(Boolean).join(' · ');
}

/** Bonus and save are the caster's, read from the spell's own sentences. */
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

    // A spell that rolls no attack is cast on the Spells tab, not listed here twice.
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
      spellLevel: entry.level,
      spellName: spell.name,
      concentration: spell.concentration
    });
  }

  return rows;
}

const TIMING_TIME_LABELS: Record<ActionTiming, string> = {
  action: 'Action',
  'bonus-action': 'Bonus Action',
  reaction: 'Reaction'
};

/** Earned by stating a timing or owning a pool; everything else stays in Features. */
/** What the Notes column carries for a feature row: what a failed save does, then the recharge. */
function featureNotes(
  save: FeatureSave | undefined,
  resource: ResolvedClassResource | undefined
): string | undefined {
  const parts = [
    save?.effect ? `Failed save: ${save.effect}` : undefined,
    resource?.resetsOn ? `Recharges on a ${resource.resetsOn} rest` : undefined
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function featureRows(
  features: readonly Feature[],
  resources: readonly ResolvedClassResource[],
  featureContext: FeatureContext
): SheetActionEntry[] {
  const rows: SheetActionEntry[] = [];
  const seen = new Set<string>();

  for (const feature of features) {
    if (seen.has(feature.id)) continue;
    const timing = detectActionTiming(feature.description);
    const resource = resources.find((entry) => entry.featureName === feature.name);
    if (!timing && !resource) continue;
    seen.add(feature.id);

    const throws = deriveFeatureThrows(feature, featureContext);
    // The DC is the feature's own, read from its sentences: a feature that states none prints none
    // rather than borrowing the caster's.
    const save = deriveFeatureSaves(feature, featureContext).at(0);
    rows.push({
      id: `feature-${feature.id}`,
      name: feature.name,
      meta: [feature.source, `Level ${feature.level}`].filter(Boolean).join(' · '),
      kind: 'feature',
      group: timing ?? 'other',
      isAttack: false,
      time: timing ? TIMING_TIME_LABELS[timing] : undefined,
      saveLabel: save ? describeFeatureSave(save) : undefined,
      damages: throws.map((entry) => ({ notation: entry.notation, label: entry.label })),
      notes: featureNotes(save, resource),
      description: feature.description,
      resourceKey: resource?.key
    });
  }

  return rows;
}

/** The same row shape as everything else, so they print in the same table. */
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
    summary: action.summary,
    description: action.description
  }));
}

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
  /** What a feature's own sentences add to its dice: ability modifiers, class levels, the bonus. */
  featureContext?: FeatureContext;
}

export function deriveSheetActions({
  attacks,
  spells,
  features,
  classResources,
  castingStat,
  characterLevel,
  combatActions = [],
  featureContext
}: SheetActionsInput): SheetActionEntry[] {
  return [
    ...weaponRows(attacks),
    ...spellRows(spells, castingStat, characterLevel),
    ...featureRows(features, classResources, { level: characterLevel, ...featureContext }),
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
