import type { KobCharacter } from '@/types/kob';
import type { KobDie, KobStatId, KobTrope } from './types';

/** Apart from `rules.ts`, whose static `generated.ts` import would enter the boot graph. */

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

/** A trope's spread, or a d4 in everything when there is no trope yet. */
export function statDiceForTrope(trope: KobTrope | null): Record<KobStatId, KobDie> {
  const dice = {} as Record<KobStatId, KobDie>;
  for (const statId of KOB_STAT_IDS) {
    dice[statId] = ((trope?.statDice[statId] as KobDie | undefined) ?? 'd4');
  }
  return dice;
}

export function fullName(character: Pick<KobCharacter, 'firstName' | 'lastName'>): string {
  return [character.firstName, character.lastName].filter(Boolean).join(' ').trim();
}
