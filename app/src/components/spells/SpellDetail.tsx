// One spell, in full: the statblock the books print above the description, then the description.
//
// Shared by every screen that shows a spell — the builder's Spells step, the sheet's spell list and
// the spell's own page — so a spell reads the same wherever it is opened, and nothing has to
// truncate it to fit a card.
//
// The statblock is the whole shape, level and school included: they are statblock items rather than
// badges above it, so a caller that already names the spell's level in its own row is the only
// place that says so twice.
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { formatSpellLevel } from '@/components/spells/spellFormatting';
import { deriveSpellAttackOrSave, deriveSpellDamageOrEffect } from '@/lib/spellFacets';
import type { Spell } from '@/types/dnd';

interface StatProps {
  readonly label: string;
  readonly value: string;
}

/**
 * One statblock cell. The label sits on a fixed line of its own above the value, so eight cells of
 * wildly different lengths still line their labels up across the grid.
 */
function Stat({ label, value }: StatProps) {
  return (
    <div className="min-w-0">
      <p className="text-[0.6875rem] font-semibold uppercase leading-4 tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="break-words text-sm font-medium leading-5">{value}</p>
    </div>
  );
}

/** The duration line says whether the spell needs concentration, as the books print it. */
const durationLine = (spell: Spell) =>
  spell.concentration && !/concentration/i.test(spell.duration)
    ? `Concentration, ${spell.duration}`
    : spell.duration;

/** A ritual is a way of casting, so it belongs on the casting time rather than on a badge. */
const castingTimeLine = (spell: Spell) => {
  const base = spell.castingTime || '—';
  return spell.ritual ? `${base} (Ritual)` : base;
};

export function SpellDetail({ spell }: Readonly<{ spell: Spell }>) {
  const components = spell.components.length > 0 ? spell.components.join(', ') : '—';
  const attackOrSave = deriveSpellAttackOrSave(spell);
  const damageOrEffect = deriveSpellDamageOrEffect(spell);

  return (
    <div className="space-y-4">
      {/* Tracks follow the container, not the viewport: `lg:grid-cols-4` fired on a desktop while
          this sat in a 320px builder card, so four 80px columns ran their labels together. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-4 gap-y-3 rounded-lg border p-3">
        <Stat label="Level" value={formatSpellLevel(spell.level)} />
        <Stat label="Casting Time" value={castingTimeLine(spell)} />
        <Stat label="Range/Area" value={spell.range || '—'} />
        <Stat label="Components" value={components} />
        <Stat label="Duration" value={durationLine(spell) || '—'} />
        <Stat label="School" value={spell.school || '—'} />
        <Stat
          label="Attack/Save"
          value={attackOrSave.length > 0 ? attackOrSave.map((facet) => facet.label).join(', ') : 'None'}
        />
        <Stat
          label="Damage/Effect"
          value={damageOrEffect.length > 0 ? damageOrEffect.map((effect) => effect.label).join(', ') : 'None'}
        />
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
        <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
          <p className="mb-1 font-medium">At Higher Levels</p>
          <ContentReferenceText text={spell.higherLevels} />
        </div>
      ) : null}

      <div className="space-y-1 text-xs leading-5 text-muted-foreground">
        <p>Classes: {spell.classes.length > 0 ? spell.classes.join(', ') : 'None listed'}</p>
        <p>Source: {spell.source}</p>
      </div>
    </div>
  );
}
