/**
 * The two statblock lines the books never print but every table needs: what a spell rolls against,
 * and what it does when it lands.
 *
 * Read from the spell's own sentences, exactly as `detectActionTiming` reads a feature's — nothing
 * here is a per-spell table, so a spell added by an imported pack gets both lines for free. A spell
 * that states neither gets neither: an unstated facet stays unstated rather than being guessed.
 */
import type { AbilityScores, Spell } from '@/types/dnd';

const ABILITY_NAMES: Record<string, keyof AbilityScores> = {
  strength: 'strength',
  dexterity: 'dexterity',
  constitution: 'constitution',
  intelligence: 'intelligence',
  wisdom: 'wisdom',
  charisma: 'charisma'
};

const DAMAGE_TYPES = [
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

/**
 * What the spell rolls: a spell attack, a saving throw, or both — Ice Knife makes an attack and
 * then asks for a Dexterity save.
 */
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

/**
 * Chill Touch says "the target can't regain hit points", which is the opposite of healing — the
 * clause has to be read with whatever negates it or half the necromancy list reports as healing.
 */
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

/**
 * Every damage type the spell names, plus healing when it restores hit points. A type is only read
 * where the text actually says "<type> damage" — "a fire burns" is prose, not a damage line.
 */
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

const DICE_PATTERN = /\b(\d+d\d+)\b/;

/**
 * The first dice expression the spell states, which is what a cast rolls. Anything conditional —
 * the extra beams Eldritch Blast gains, a higher-level upcast — is in the text the player is
 * already reading, so this deliberately reports one throw rather than guessing at scaling.
 */
export function deriveSpellDice(spell: Pick<Spell, 'description'>): string | undefined {
  return DICE_PATTERN.exec(spell.description ?? '')?.[1];
}
