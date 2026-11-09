// What Wild Shape allows and what it replaces, read from the feature's own text. Nothing here
// names a beast, a level or a challenge rating: the Beast Shapes table the books print is the
// source, and a printing that states no table grants no forms rather than a guessed set.
import { getRulesEdition, type RulesEdition } from '@/lib/builderRules';
import type { DerivedAttack } from '@/lib/sheetMath';
import type { AbilityScores, Character, Feature, Monster, WildShapeState } from '@/types/dnd';

/** One row of the Beast Shapes table, as the book prints it. */
export interface BeastShapeRow {
  /** The Druid level the row applies from. */
  level: number;
  maxChallengeRating: number;
  /** The Known Forms column, where the printing has one. 2014 states no limit on how many. */
  knownForms?: number;
  flySpeed: boolean;
  swimSpeed: boolean;
}

export interface WildShapeLimits extends BeastShapeRow {
  /** The feature the row was read from, so the picker can cite it. */
  source: string;
}

const TABLE_ROW = / \| /;
const FRACTION = /^(\d+)\s*\/\s*(\d+)$/;

/** "1/4", "0.25" and "1" all reach the sheet; a rating it cannot read is not a rating. */
export function parseChallengeRating(value: string | number | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  const text = String(value ?? '').trim();
  if (!text) return undefined;

  const fraction = FRACTION.exec(text);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);

  const plain = Number.parseFloat(text);
  return Number.isFinite(plain) ? plain : undefined;
}

/**
 * A rating is printed as a fraction wherever it is below 1. The 2014 pack stores "0.5" and the
 * 2024 pack "1/2" for the same beast, and the books print only the fraction.
 */
export function formatChallengeRating(value: string | number | undefined): string {
  const rating = parseChallengeRating(value);
  if (rating === undefined) return '—';
  if (rating > 0 && rating < 1) return `1/${Math.round(1 / rating)}`;
  return String(rating);
}

/** "2nd" and "2" are the same row; both printings use one of the two. */
const parseLevel = (value: string): number | undefined => {
  const match = /(\d+)/.exec(value);
  return match ? Number.parseInt(match[1], 10) : undefined;
};

const headerIndex = (header: readonly string[], pattern: RegExp) =>
  header.findIndex((cell) => pattern.test(cell));

/** Every run of two or more pipe-separated lines: the shape both importers write a table in. */
function tablesIn(description: string): string[][][] {
  const tables: string[][][] = [];
  let current: string[][] | null = null;

  for (const line of description.split('\n')) {
    if (!TABLE_ROW.test(line)) {
      current = null;
      continue;
    }

    const cells = line.split('|').map((cell) => cell.trim());
    if (current) {
      current.push(cells);
    } else {
      current = [cells];
      tables.push(current);
    }
  }

  return tables.filter((table) => table.length > 1);
}

/**
 * The Beast Shapes table, read by its own column headings rather than by position: 2024 prints
 * "Druid Level | Known Forms | Max CR | Fly Speed" and 2014 "Level | Max. CR | Limitations |
 * Example", and a column either printing omits simply states no limit.
 */
export function readBeastShapeTable(description: string): BeastShapeRow[] {
  for (const table of tablesIn(description)) {
    const [header, ...body] = table;
    const levelAt = headerIndex(header, /\blevel\b/i);
    const crAt = headerIndex(header, /\bcr\b|challenge/i);
    if (levelAt === -1 || crAt === -1) continue;

    const knownAt = headerIndex(header, /\bknown\b/i);
    const flyAt = headerIndex(header, /\bfly\b/i);
    const limitsAt = headerIndex(header, /\blimitation/i);

    const rows: BeastShapeRow[] = [];
    for (const cells of body) {
      const level = parseLevel(cells[levelAt] ?? '');
      const maxChallengeRating = parseChallengeRating(cells[crAt]);
      if (level === undefined || maxChallengeRating === undefined) continue;

      // A Fly Speed column answers it outright; a Limitations column answers it by naming what the
      // row rules out, and a printing with neither rules nothing out.
      const limits = limitsAt === -1 ? '' : (cells[limitsAt] ?? '');
      const flyStated = flyAt === -1 ? undefined : /\byes\b/i.test(cells[flyAt] ?? '');
      const knownForms = knownAt === -1 ? undefined : parseLevel(cells[knownAt] ?? '');

      rows.push({
        level,
        maxChallengeRating,
        knownForms,
        flySpeed: flyStated ?? !/\bfly(?:ing)?\b/i.test(limits),
        swimSpeed: !/\bswim(?:ming)?\b/i.test(limits)
      });
    }

    if (rows.length > 0) return rows.sort((left, right) => left.level - right.level);
  }

  return [];
}

/** The row in force at the level held — the last one the table states at or below it. */
export function wildShapeLimits(feature: Feature, druidLevel: number): WildShapeLimits | undefined {
  const reached = readBeastShapeTable(feature.description).filter((row) => row.level <= druidLevel);
  const row = reached.at(-1);
  return row ? { ...row, source: feature.name } : undefined;
}

const SPEED_FLY = /\bfly\b/i;
const SPEED_SWIM = /\bswim\b/i;
const TYPE_BEAST = /\bbeast\b/i;

/** Whether one stat block is a form these limits allow. */
export function isEligibleForm(monster: Monster, limits: WildShapeLimits): boolean {
  if (!TYPE_BEAST.test(monster.type)) return false;

  // A summon's or companion's template states no hit points and no rating because the feature that
  // calls it sizes both ("Beast of the Land", "Bestial Spirit", "Giant Insect"). It is not a beast
  // anyone can turn into.
  if (monster.hp.average <= 0) return false;

  const rating = parseChallengeRating(monster.challengeRating);
  if (rating === undefined || rating > limits.maxChallengeRating) return false;
  if (!limits.flySpeed && SPEED_FLY.test(monster.speed)) return false;
  if (!limits.swimSpeed && SPEED_SWIM.test(monster.speed)) return false;

  return true;
}

/** "Sea Horse" and "Seahorse" are one beast, so the key keeps only the letters and digits. */
const formNameKey = (monster: Monster) => monster.name.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

/**
 * Both printings stat the same 70-odd animals, so the library holds a Wolf twice with different
 * ids and the picker listed every one of them twice. One row per animal, taking the printing the
 * character plays wherever that book has it.
 */
function collapsePrintings(forms: readonly Monster[], edition: RulesEdition | undefined): Monster[] {
  const best = new Map<string, Monster>();
  for (const form of forms) {
    const key = formNameKey(form);
    const current = best.get(key);
    if (!current) {
      best.set(key, form);
      continue;
    }

    if (edition && getRulesEdition(form.sourceId, form.source) === edition
      && getRulesEdition(current.sourceId, current.source) !== edition) {
      best.set(key, form);
    }
  }

  return [...best.values()];
}

/** Every form the limits allow, in the order a picker should list them. */
export function eligibleForms(
  monsters: readonly Monster[],
  limits: WildShapeLimits,
  edition?: RulesEdition
): Monster[] {
  return collapsePrintings(monsters.filter((monster) => isEligibleForm(monster, limits)), edition)
    .sort((left, right) => {
      const byRating = (parseChallengeRating(left.challengeRating) ?? 0)
        - (parseChallengeRating(right.challengeRating) ?? 0);
      return byRating !== 0 ? byRating : left.name.localeCompare(right.name);
    });
}

/** Which of the character's own scores the form does not touch, in the feature's own words. */
const RETAINED_ABILITIES = /\bIntelligence,\s*Wisdom,?\s*and\s*Charisma\b/i;

/** "you gain a number of Temporary Hit Points equal to your Druid level" — 2024 only. */
const GRANTS_TEMPORARY_HP = /\bTemporary Hit Points equal to your (\w+) level\b/i;

/** "you assume the beast's hit points and Hit Dice" — 2014 only. */
const ASSUMES_BEAST_HP = /\bassume the beast['’]s hit points\b/i;

/** "You can't cast spells" — both printings state it, and the sheet has to say so. */
const NO_SPELLCASTING = /\byou can['’]t cast spells\b/i;

export interface WildShapeRules {
  /** The three scores the form leaves alone, where the feature names them. */
  retainsMentalAbilities: boolean;
  /** Set where the feature grants temporary hit points sized by the class's level. */
  temporaryHitPoints: boolean;
  /** Set where the character takes on the beast's hit points instead. */
  assumesBeastHitPoints: boolean;
  /** Set where the feature says the form cannot cast. A spell already cast is unaffected. */
  forbidsSpellcasting: boolean;
}

/** What the feature says happens to the character, read from its own sentences. */
export function readWildShapeRules(feature: Feature): WildShapeRules {
  const text = feature.description;
  return {
    retainsMentalAbilities: RETAINED_ABILITIES.test(text),
    temporaryHitPoints: GRANTS_TEMPORARY_HP.test(text),
    assumesBeastHitPoints: ASSUMES_BEAST_HP.test(text),
    forbidsSpellcasting: NO_SPELLCASTING.test(text)
  };
}

/** The scores the sheet shows while shape-shifted. */
export function shiftedAbilityScores(
  own: AbilityScores,
  form: Monster,
  rules: WildShapeRules
): AbilityScores {
  if (!rules.retainsMentalAbilities) return form.abilityScores;
  return {
    ...form.abilityScores,
    intelligence: own.intelligence,
    wisdom: own.wisdom,
    charisma: own.charisma
  };
}

/** The hit points a transformation writes, and what reverting has to put back. */
export interface ShiftedHitPoints {
  hp: Character['hp'];
  /** What the character had before, so reverting restores it rather than guessing. */
  restore: Character['hp'];
}

export function shiftHitPoints(
  own: Character['hp'],
  form: Monster,
  rules: WildShapeRules,
  classLevel: number
): ShiftedHitPoints {
  if (rules.assumesBeastHitPoints) {
    return {
      hp: { current: form.hp.average, maximum: form.hp.average, temporary: 0 },
      restore: own
    };
  }

  if (rules.temporaryHitPoints) {
    // Temporary hit points never stack, so the larger of the two stands — the general rule, not
    // something Wild Shape states.
    return { hp: { ...own, temporary: Math.max(own.temporary, classLevel) }, restore: own };
  }

  return { hp: own, restore: own };
}

/** The feature's own name for a form the character no longer knows: dropped, never granted. */
export function knownForms(state: WildShapeState | undefined, limits: WildShapeLimits | undefined, monsters: readonly Monster[]): Monster[] {
  if (!limits) return [];
  const byId = new Map(monsters.map((monster) => [monster.id, monster]));
  return (state?.knownFormIds ?? [])
    .map((id) => byId.get(id))
    .filter((monster): monster is Monster => monster !== undefined && isEligibleForm(monster, limits));
}

/** The form being worn, or undefined where the id no longer resolves. */
export function activeForm(state: WildShapeState | undefined, monsters: readonly Monster[]): Monster | undefined {
  if (!state?.activeFormId) return undefined;
  return monsters.find((monster) => monster.id === state.activeFormId);
}

/** Choosing or dropping a known form. The limit is the table's, so nothing else enforces it. */
export function setKnownFormsPatch(
  character: Character,
  formIds: readonly string[],
  limits: WildShapeLimits | undefined
): Partial<Character> {
  const capped = limits?.knownForms === undefined ? formIds : formIds.slice(0, limits.knownForms);
  return { wildShape: { ...character.wildShape, knownFormIds: [...capped] } };
}

/** Assuming a form: the statistics are derived, but the hit points are a write. */
export function assumeFormPatch(
  character: Character,
  form: Monster,
  rules: WildShapeRules,
  classLevel: number
): Partial<Character> {
  // Already shifted: the hit points to put back are the ones from before the *first* shift, or
  // using Wild Shape again would record the beast's own as the character's.
  const restore = character.wildShape?.restoreHp ?? character.hp;
  const { hp } = shiftHitPoints(restore, form, rules, classLevel);
  return {
    hp,
    wildShape: { ...character.wildShape, activeFormId: form.id, restoreHp: restore }
  };
}

/** Reverting. 2014 puts the remembered hit points back; 2024 only drops the form. */
export function revertFormPatch(character: Character, rules: WildShapeRules): Partial<Character> {
  const { restoreHp, ...rest } = character.wildShape ?? {};
  const wildShape = { ...rest, activeFormId: undefined };

  if (!rules.assumesBeastHitPoints || !restoreHp) {
    return { wildShape };
  }

  // "any excess damage carries over to your normal form": the beast's pool is spent, so what is
  // left of the remembered total is what the character comes back with.
  const carriedOver = Math.max(0, -character.hp.current);
  return {
    hp: { ...restoreHp, current: Math.max(0, restoreHp.current - carriedOver) },
    wildShape
  };
}

/** Both printings' opening sentence. The feature is found by what it says, never by its name. */
const SHAPE_SHIFT_SENTENCE =
  /\bassume the (?:shape|form) of (?:a|an)\b|\bshape-shift into a\b|\bassume the form of an animal\b/i;

/** A beast's walking speed, which is the first distance its stat block states. */
export function formWalkingSpeed(form: Monster): number {
  const match = /(\d+)\s*ft/i.exec(form.speed);
  return match ? Number.parseInt(match[1], 10) : 0;
}

/** The stat block's own attacks, in the one row shape the Actions table prints. */
export function formAttacks(form: Monster): DerivedAttack[] {
  return form.actions
    .filter((action) => action.attackBonus !== undefined || action.damage)
    .map((action) => ({
      name: action.name,
      kind: /\branged\b/i.test(action.description) ? 'Ranged Weapon Attack' : 'Melee Weapon Attack',
      attackBonus: action.attackBonus ?? 0,
      damage: action.damage ?? '—',
      // The stat block's numbers are the beast's own, already including its ability modifier.
      ability: 'strength',
      proficient: true,
      properties: [form.name]
    }));
}

export interface ResolvedWildShape {
  /** The feature that offers forms, and the class level its table is read at. */
  feature: Feature;
  classLevel: number;
  limits: WildShapeLimits;
  rules: WildShapeRules;
  /** The printing this character plays, so the picker lists one row per animal. */
  edition?: RulesEdition;
  /** Every form this character knows that the table still allows. */
  known: Monster[];
  /** The form being worn, if any. */
  form?: Monster;
}

export interface WildShapeInput {
  character: Pick<Character, 'wildShape'>;
  /** Each class with the level held in it, so a clause counts the right one. */
  classFeatures: ReadonlyArray<{ features: readonly Feature[]; level: number }>;
  monsters: readonly Monster[];
  /** The printing the character plays, resolved by the caller from its first class. */
  edition?: RulesEdition;
}

/**
 * The shape-shifting feature this character holds, or nothing. A feature earns this by printing a
 * Beast Shapes table *and* saying it assumes a form, so a homebrew class writing the same two
 * things gets the same screen and nothing in the app names the Druid.
 */
export function resolveWildShape({ character, classFeatures, monsters, edition }: WildShapeInput): ResolvedWildShape | undefined {
  for (const { features, level } of classFeatures) {
    for (const feature of features) {
      if (feature.level > level) continue;
      if (!SHAPE_SHIFT_SENTENCE.test(feature.description)) continue;

      const limits = wildShapeLimits(feature, level);
      if (!limits) continue;

      const rules = readWildShapeRules(feature);
      return {
        feature,
        classLevel: level,
        limits,
        rules,
        edition,
        known: knownForms(character.wildShape, limits, monsters),
        form: activeForm(character.wildShape, monsters)
      };
    }
  }

  return undefined;
}
