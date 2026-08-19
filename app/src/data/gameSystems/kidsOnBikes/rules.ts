import { kidsOnBikesContent } from './generated';
import type {
  KobAgeRules,
  KobBikeOption,
  KobDie,
  KobDifficultyBand,
  KobRuleSection,
  KobStatId,
  KobStrength,
  KobTrope,
} from './types';
import type { KobCharacter } from '@/types/kob';

/**
 * Everything the builder and the sheet need to know about Kids on Bikes, derived from the
 * imported content. No rule is written twice: the age bonuses, the free Strengths and the die
 * spreads all come out of `generated.ts`, which comes out of the vault.
 */

export const kob = kidsOnBikesContent;

export const KOB_STAT_IDS: KobStatId[] = ['brains', 'brawn', 'fight', 'flight', 'charm', 'grit'];

/** Die faces, for sorting and for the roller. */
export const DIE_FACES: Record<string, number> = {
  d20: 20,
  d12: 12,
  d10: 10,
  d8: 8,
  d6: 6,
  d4: 4,
};

/** The book's one-word reading of each die, straight from the character-creation table. */
export const DIE_DESCRIPTIONS: Record<string, string> = {
  d20: 'Superb',
  d12: 'Impressive',
  d10: 'Above Average',
  d8: 'Below Average',
  d6: 'Bad',
  d4: 'Terrible',
};

export function getTrope(tropeId: string | null | undefined): KobTrope | null {
  if (!tropeId) return null;
  return kob.tropes.find((trope) => trope.id === tropeId) ?? null;
}

export function getAgeRules(age: string | null | undefined): KobAgeRules | null {
  if (!age) return null;
  return kob.ages.find((entry) => entry.id === age) ?? null;
}

export function getStrength(strengthId: string): KobStrength | null {
  return kob.strengths.find((strength) => strength.id === strengthId) ?? null;
}

export function getBikeColor(colorId: string): KobBikeOption | null {
  return kob.bikes.colors.find((color) => color.id === colorId) ?? null;
}

export function getBikeUpgrade(upgradeId: string): KobBikeOption | null {
  return kob.bikes.upgrades.find((upgrade) => upgrade.id === upgradeId) ?? null;
}

export function getStatName(statId: string): string {
  return kob.stats.find((stat) => stat.id === statId)?.name ?? statId;
}

/** The trope's spread, as a full stat→die record. Missing stats fall back to the lowest die. */
export function statDiceForTrope(trope: KobTrope | null): Record<KobStatId, KobDie> {
  const dice = {} as Record<KobStatId, KobDie>;
  for (const statId of KOB_STAT_IDS) {
    dice[statId] = ((trope?.statDice[statId] as KobDie | undefined) ?? 'd4');
  }
  return dice;
}

/** The +1s an age adds to two stats. Empty when no age is chosen yet. */
export function statBonusesForAge(age: string | null | undefined): Partial<Record<KobStatId, number>> {
  const bonuses: Partial<Record<KobStatId, number>> = {};
  for (const bonus of getAgeRules(age)?.statBonuses ?? []) {
    bonuses[bonus.stat as KobStatId] = (bonuses[bonus.stat as KobStatId] ?? 0) + bonus.amount;
  }
  return bonuses;
}

/**
 * The Strength an age grants for free, which does not count against the two the player picks.
 * Adults get "Skilled at ___", so the sheet has to know to ask what the blank says.
 */
export function freeStrengthForAge(age: string | null | undefined): KobStrength | null {
  const id = getAgeRules(age)?.freeStrength;
  return id ? getStrength(id) : null;
}

/** Strengths this character may choose: everything their age is not forbidden, minus the free one. */
export function selectableStrengths(age: string | null | undefined): KobStrength[] {
  const rules = getAgeRules(age);
  return kob.strengths.filter((strength) => {
    if (rules?.forbiddenStrength === strength.id) return false;
    if (rules && strength.id === rules.freeStrength) return false;
    // A Strength that names the ages allowed to take it excludes every other age.
    if (strength.restrictedTo && age && !strength.restrictedTo.includes(age)) return false;
    return true;
  });
}

/** True when the character's Strengths include one whose text asks for a skill in a blank. */
export function needsSkilledAt(character: Pick<KobCharacter, 'age' | 'strengthIds'>): boolean {
  const free = freeStrengthForAge(character.age);
  if (free?.id === 'skilled-at') return true;
  return character.strengthIds.includes('skilled-at');
}

/** One `#` section of the play rules, by its slug. */
export function getPlayRuleSection(id: string): KobRuleSection | null {
  return kob.playRules.sections.find((section) => section.id === id) ?? null;
}

/**
 * The difficulty band a rolled total lands in, read off the imported table rather than a scale
 * written into the sheet. Null when the total is below the lowest band the table states.
 */
export function difficultyBandFor(total: number): KobDifficultyBand | null {
  return (
    kob.playRules.difficulties.find(
      (band) => total >= band.minimum && (band.maximum === null || total <= band.maximum),
    ) ?? null
  );
}

/** The two questions a trope asks, so the builder can render exactly as many answer fields. */
export function tropeQuestions(tropeId: string | null | undefined): string[] {
  return getTrope(tropeId)?.questions ?? [];
}

/** How the sheet and the character list describe a character in one line. */
export function describeKobCharacter(character: KobCharacter): string {
  const trope = getTrope(character.tropeId);
  const ageName = getAgeRules(character.age)?.name;
  const parts = [ageName, trope?.name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : 'Unfinished character';
}

export function fullName(character: Pick<KobCharacter, 'firstName' | 'lastName'>): string {
  return [character.firstName, character.lastName].filter(Boolean).join(' ').trim();
}

/**
 * What is still missing before the character can be played. The builder shows this rather than
 * blocking navigation — a Kids on Bikes character is finished at the table, not in a form.
 */
export function outstandingChoices(character: KobCharacter): string[] {
  const missing: string[] = [];
  if (!character.firstName.trim()) missing.push('a first name');
  if (!character.tropeId) missing.push('a Trope');
  if (!character.age) missing.push('an age');
  if (character.strengthIds.length < 2) {
    missing.push(`${2 - character.strengthIds.length} more Strength${character.strengthIds.length === 1 ? '' : 's'}`);
  }
  if (!character.flawId && !character.customFlaw.trim()) missing.push('a Flaw');
  if (needsSkilledAt(character) && !character.skilledAt.trim()) missing.push('what you are Skilled at');
  if (!character.motivation.trim()) missing.push('a Motivation');
  if (!character.fear.trim()) missing.push('a Fear');
  if (character.knacks.filter((knack) => knack.trim()).length === 0) missing.push('a Knack');
  if (!character.bike.colorId) missing.push('a bike colour');
  if (!character.bike.upgradeId) missing.push('a bike upgrade');
  return missing;
}
