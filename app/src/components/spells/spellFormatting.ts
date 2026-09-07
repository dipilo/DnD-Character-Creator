// Spell labels and the route to a spell's own page. Separate from the components that use them so
// each of those files exports components only (react-refresh/only-export-components).
import type { Spell } from '@/types/dnd';

export const formatSpellLevel = (level: number) => {
  if (level === 0) return 'Cantrip';
  if (level === 1) return '1st Level';
  if (level === 2) return '2nd Level';
  if (level === 3) return '3rd Level';
  return `${level}th Level`;
};

/** "Cantrip · Evocation", or "2nd Level · Illusion" — the line under a spell's name. */
export const formatSpellSubtitle = (spell: Pick<Spell, 'level' | 'school'>) =>
  `${formatSpellLevel(spell.level)} · ${spell.school}`;

export function spellReferencePath(spellId: string) {
  return `/spells/${encodeURIComponent(spellId)}`;
}
