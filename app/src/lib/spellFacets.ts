// What a spell rolls against and what it does; an unstated facet stays unstated.
import type { AbilityScores, Spell } from '@/types/dnd';

const ABILITY_NAMES: Record<string, keyof AbilityScores> = {
  strength: 'strength',
  dexterity: 'dexterity',
  constitution: 'constitution',
  intelligence: 'intelligence',
  wisdom: 'wisdom',
  charisma: 'charisma'
};

export const DAMAGE_TYPES = [
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder'
] as const;

export type SpellDamageType = (typeof DAMAGE_TYPES)[number];

/** "Ranged", "Melee", "DEX Save" — one entry per thing the spell states. */
export interface SpellAttackOrSave {
  kind: 'attack' | 'save';
  /** What the statblock prints. */
  label: string;
  /** Set for a spell attack, so the sheet can throw it with the caster's attack bonus. */
  reach?: 'melee' | 'ranged';
  /** Set for a saving throw, so the sheet can name the DC's ability. */
  ability?: keyof AbilityScores;
}

const titleCase = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const SPELL_ATTACK_PATTERN = /\b(melee|ranged)\s+spell\s+attack\b/gi;
const BARE_SPELL_ATTACK_PATTERN = /\bspell\s+attack\s+roll\b|\bmake\s+a\s+spell\s+attack\b/i;
const SAVING_THROW_PATTERN =
  /\b(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving\s+throw\b/gi;

/** Or both: Ice Knife makes an attack and then asks for a Dexterity save. */
export function deriveSpellAttackOrSave(spell: Pick<Spell, 'description'>): SpellAttackOrSave[] {
  const text = spell.description ?? '';
  const facets: SpellAttackOrSave[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(SPELL_ATTACK_PATTERN)) {
    const reach = match[1].toLowerCase() === 'melee' ? 'melee' : 'ranged';
    if (seen.has(reach)) continue;
    seen.add(reach);
    facets.push({ kind: 'attack', label: titleCase(reach), reach });
  }

  if (facets.length === 0 && BARE_SPELL_ATTACK_PATTERN.test(text)) {
    facets.push({ kind: 'attack', label: 'Attack' });
  }

  for (const match of text.matchAll(SAVING_THROW_PATTERN)) {
    const ability = ABILITY_NAMES[match[1].toLowerCase()];
    if (!ability || seen.has(ability)) continue;
    seen.add(ability);
    facets.push({ kind: 'save', label: `${ability.slice(0, 3).toUpperCase()} Save`, ability });
  }

  return facets;
}

/** "Force", "Fire", "Healing" — what the spell does, in the words it uses to say so. */
export interface SpellDamageOrEffect {
  kind: 'damage' | 'healing';
  label: string;
  damageType?: SpellDamageType;
}

const HEALING_PATTERN = /\bregains?\s+(?:a\s+number\s+of\s+)?hit\s+points\b/gi;

/** A negated clause must be read with its negation, or necromancy reports as healing. */
const HEALING_NEGATION = /(?:cannot|can't|doesn't|won't|does not|unable to)\s*$/i;

function statesHealing(text: string): boolean {
  const normalized = text.replaceAll('’', "'");
  for (const match of normalized.matchAll(HEALING_PATTERN)) {
    const before = normalized.slice(Math.max(0, (match.index ?? 0) - 24), match.index);
    if (!HEALING_NEGATION.test(before)) return true;
  }
  return false;
}

/** Only where the text says "<type> damage": "a fire burns" is prose, not a damage line. */
const DAMAGE_TYPE_PATTERN =
  /\b(acid|bludgeoning|cold|fire|force|lightning|necrotic|piercing|poison|psychic|radiant|slashing|thunder)\s+damage\b/gi;

/** Only where the text says "<type> damage": "a fire burns" is prose. */
export function deriveSpellDamageOrEffect(
  spell: Pick<Spell, 'description' | 'higherLevels'>
): SpellDamageOrEffect[] {
  const text = [spell.description ?? '', spell.higherLevels ?? ''].join('\n');
  const effects: SpellDamageOrEffect[] = [];

  const named = new Set<string>();
  for (const match of text.matchAll(DAMAGE_TYPE_PATTERN)) {
    named.add(match[1].toLowerCase());
  }
  for (const damageType of DAMAGE_TYPES) {
    if (named.has(damageType)) {
      effects.push({ kind: 'damage', label: titleCase(damageType), damageType });
    }
  }

  if (statesHealing(text)) {
    effects.push({ kind: 'healing', label: 'Healing' });
  }

  return effects;
}

// Shillelagh's table steps through bare dice ("levels 5 (d10), 11 (d12)"), so a count is optional.
const ANY_DICE_PATTERN = /\b(\d*d\d+)\b/;
const DICE_SHAPE = /^(\d*)d(\d+)$/;

/** "d10" and "1d10" are the same throw; the sheet prints the second. */
const normalizeDice = (dice: string) => (dice.startsWith('d') ? `1${dice}` : dice);

/** One step of a cantrip's damage table: the level it starts at and what it rolls from there. */
export interface SpellDamageTier {
  level: number;
  dice: string;
}

/** How much bigger a levelled spell gets per slot level above the one it is written at. */
export interface SpellUpcastStep {
  /** The dice added per slot level, as the text states them. */
  dice: string;
  /** The slot level the spell is written at — "above 3rd" is 3. */
  aboveLevel: number;
}

export interface SpellScaling {
  /** The first dice expression the spell states. */
  base?: string;
  /** A cantrip's steps, in ascending level order. */
  tiers: SpellDamageTier[];
  upcast?: SpellUpcastStep;
}

/** The level is the last number before the bracket, so one pattern covers both wordings. */
// Toll the Dead's brackets carry two dice ("2d8 and 2d12"), one per branch of its own condition, so
// the bracket may say more than the die — the leading one is the throw, and the text has the rest.
const TIER_DICE_PATTERN = /\((\d*d\d+)(?:\s[^)]*)?\)/g;
const TIER_SENTENCE_PATTERN = /\bincreases?\b|\bwhen you reach\b/i;
const isDigit = (value: string, index: number) => value[index] >= '0' && value[index] <= '9';

/** Scanned, not anchored: a `$` pattern over arbitrary prose backtracks (S8786). */
export function trailingLevel(before: string): number | null {
  let end = before.length;
  while (end > 0 && !isDigit(before, end - 1)) end -= 1;
  let start = end;
  while (start > 0 && isDigit(before, start - 1)) start -= 1;
  return start === end ? null : Number.parseInt(before.slice(start, end), 10);
}

const UPCAST_PATTERN =
  /increases?\s+by\s+(\d+d\d+)\s+for\s+each\s+(?:spell\s+)?slot\s+level\s+above\s+(\d+)(?:st|nd|rd|th)?/i;

/** Where the damage table starts, so the die the spell is written at can be read before it. */
function firstTierIndex(description: string): number {
  const match = /\(\d*d\d+(?:\s[^)]*)?\)/.exec(description);
  return match?.index ?? description.length;
}

const firstDice = (text: string) => {
  const dice = ANY_DICE_PATTERN.exec(text)?.[1];
  return dice ? normalizeDice(dice) : undefined;
};

/** Read from the spell's sentences, so a pack's spell scales for free. */
export function deriveSpellScaling(spell: Pick<Spell, 'description' | 'higherLevels'>): SpellScaling {
  const description = spell.description ?? '';
  const tiers: SpellDamageTier[] = [];

  // Only where the text states a table at all. A bracketed die in ordinary prose is not a tier,
  // and the number in front of it would be whatever the sentence happened to say.
  if (TIER_SENTENCE_PATTERN.test(description)) {
    for (const match of description.matchAll(TIER_DICE_PATTERN)) {
      const level = trailingLevel(description.slice(Math.max(0, (match.index ?? 0) - 24), match.index));
      if (level === null || level < 1 || level > 20) continue;
      tiers.push({ level, dice: normalizeDice(match[1]) });
    }
  }
  tiers.sort((left, right) => left.level - right.level);

  const upcastMatch = UPCAST_PATTERN.exec([description, spell.higherLevels ?? ''].join('\n'));

  return {
    // The die the spell is written at is the one stated *before* the table, or Shillelagh's own
    // first step ("2d6", from the 17th-level bracket) reads as what a 1st-level druid rolls.
    base: firstDice(tiers.length > 0 ? description.slice(0, firstTierIndex(description)) : description),
    tiers,
    upcast: upcastMatch
      ? { dice: upcastMatch[1], aboveLevel: Number.parseInt(upcastMatch[2], 10) }
      : undefined
  };
}

/** `4d6` plus two more `1d6` is `6d6`; a step in a different die is not one this can add. */
function addDice(base: string, step: string, times: number): string | undefined {
  const baseShape = DICE_SHAPE.exec(base);
  const stepShape = DICE_SHAPE.exec(step);
  if (!baseShape || !stepShape || baseShape[2] !== stepShape[2] || times <= 0) return undefined;
  return `${Number(baseShape[1]) + Number(stepShape[1]) * times}d${baseShape[2]}`;
}

export interface SpellDiceContext {
  /** Total character level, which is what a cantrip's table keys off. */
  characterLevel?: number;
  /** The slot the spell is being cast from, when it is being cast from one. */
  slotLevel?: number;
}

/** Both the cantrip table and the upcast line apply; what is not in dice stays in the text. */
export function deriveSpellDice(
  spell: Pick<Spell, 'description' | 'higherLevels' | 'level'>,
  context: SpellDiceContext = {}
): string | undefined {
  const scaling = deriveSpellScaling(spell);
  if (!scaling.base) return undefined;

  if (spell.level === 0) {
    const reached = scaling.tiers.filter((tier) => tier.level <= (context.characterLevel ?? 1));
    return reached.at(-1)?.dice ?? scaling.base;
  }

  const { upcast } = scaling;
  const slotLevel = context.slotLevel;
  if (!upcast || !slotLevel || slotLevel <= upcast.aboveLevel) return scaling.base;

  return addDice(scaling.base, upcast.dice, slotLevel - upcast.aboveLevel) ?? scaling.base;
}
