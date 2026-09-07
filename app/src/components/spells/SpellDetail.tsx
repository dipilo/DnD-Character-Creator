// One spell, in full: the statblock the books print above the description, then the description.
//
// Shared by every screen that shows a spell — the builder's Spells step, the sheet's spell list and
// the spell's own page — so a spell reads the same wherever it is opened, and nothing has to
// truncate it to fit a card.
import { Badge } from '@/components/ui/badge';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { formatSpellLevel } from '@/components/spells/spellFormatting';
import type { Spell } from '@/types/dnd';

interface StatProps {
  readonly label: string;
  readonly value: string;
}

function Stat({ label, value }: StatProps) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-sm font-medium">{value}</p>
    </div>
  );
}

/** The duration line says whether the spell needs concentration, as the books print it. */
const durationLine = (spell: Spell) =>
  spell.concentration && !/concentration/i.test(spell.duration)
    ? `Concentration, ${spell.duration}`
    : spell.duration;

export function SpellDetail({ spell }: Readonly<{ spell: Spell }>) {
  const components = spell.components.length > 0 ? spell.components.join(', ') : '—';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">{formatSpellLevel(spell.level)}</Badge>
        <Badge variant="outline">{spell.school}</Badge>
        {spell.ritual ? <Badge variant="outline">Ritual</Badge> : null}
        {spell.concentration ? <Badge variant="outline">Concentration</Badge> : null}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 sm:grid-cols-4">
        <Stat label="Casting Time" value={spell.castingTime || '—'} />
        <Stat label="Range/Area" value={spell.range || '—'} />
        <Stat label="Components" value={components} />
        <Stat label="Duration" value={durationLine(spell) || '—'} />
      </div>

      <div className="space-y-2 text-sm leading-relaxed">
        {spell.description
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph) => (
            <p key={paragraph.slice(0, 60)}>
              <ContentReferenceText text={paragraph} />
            </p>
          ))}
      </div>

      {spell.higherLevels ? (
        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
          <p className="mb-1 font-medium">At Higher Levels</p>
          <ContentReferenceText text={spell.higherLevels} />
        </div>
      ) : null}

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>Classes: {spell.classes.length > 0 ? spell.classes.join(', ') : 'None listed'}</p>
        <p>Source: {spell.source}</p>
      </div>
    </div>
  );
}
