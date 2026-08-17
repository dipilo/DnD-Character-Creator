// Spells, grouped by level, with the prepared toggle a prepared caster actually uses at the table —
// plus adding and removing, so a newly learned spell does not require reopening the builder.
//
// The builder's Spells step still owns the *limits* (how many a class knows or prepares). This panel
// deliberately does not re-check them: a sheet mid-campaign has to be able to record what happened,
// including a spell granted by something the builder does not model.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { SheetCatalogPicker, type CatalogPickerItem } from '@/components/character/SheetCatalogPicker';
import type { Character, Spell } from '@/types/dnd';

interface SheetSpellsPanelProps {
  character: Character;
  /** One entry per stored spell, resolved where the library knows it. */
  spells: Array<{ id: string; name: string; level?: number; school?: string; prepared: boolean; alwaysPrepared?: boolean }>;
  catalogue: Spell[];
  onChange?: (patch: Partial<Character>) => void;
}

const levelLabel = (level: number) => (level === 0 ? 'Cantrips' : `Level ${level}`);

export function SheetSpellsPanel({ character, spells, catalogue, onChange }: Readonly<SheetSpellsPanelProps>) {
  if (spells.length === 0 && !onChange) {
    return null;
  }

  const byLevel = new Map<number, typeof spells>();
  for (const spell of spells) {
    const level = spell.level ?? 0;
    byLevel.set(level, [...(byLevel.get(level) ?? []), spell]);
  }
  const levels = [...byLevel.keys()].sort((left, right) => left - right);

  const chosenIds = new Set(character.spells.map((entry) => entry.spellId));
  const pickerItems: CatalogPickerItem[] = catalogue
    .filter((spell) => !chosenIds.has(spell.id))
    .map((spell) => ({
      id: spell.id,
      name: spell.name,
      detail: `${levelLabel(spell.level)} · ${spell.school} · ${spell.source}`,
      keywords: spell.school
    }));

  const addSpell = (spellId: string) => {
    if (chosenIds.has(spellId)) return;
    onChange?.({ spells: [...character.spells, { spellId, prepared: false }] });
  };

  const togglePrepared = (spellId: string) => {
    onChange?.({
      spells: character.spells.map((entry) =>
        entry.spellId === spellId ? { ...entry, prepared: !entry.prepared } : entry
      )
    });
  };

  const removeSpell = (spellId: string) => {
    onChange?.({ spells: character.spells.filter((entry) => entry.spellId !== spellId) });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Spells</CardTitle>
            {onChange ? <CardDescription>Mark what is prepared today, or add a spell you have just learned.</CardDescription> : null}
          </div>
          {onChange ? (
            <SheetCatalogPicker
              triggerLabel="Add spell"
              title="Add a spell"
              description="Anything from the sources this character can use."
              items={pickerItems}
              onPick={addSpell}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {levels.length === 0 ? <p className="text-sm text-muted-foreground">No spells recorded.</p> : null}
        {levels.map((level) => (
          <div key={level}>
            <h4 className="mb-2 text-sm font-medium text-muted-foreground">{levelLabel(level)}</h4>
            <div className="space-y-2">
              {(byLevel.get(level) ?? []).map((spell) => (
                <div key={spell.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
                  <div className="min-w-0">
                    <span className="break-words font-medium">{spell.name}</span>
                    {spell.school ? <p className="text-xs text-muted-foreground">{spell.school}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {spell.alwaysPrepared ? <Badge variant="secondary">Always prepared</Badge> : null}
                    {onChange ? (
                      <>
                        {level > 0 && !spell.alwaysPrepared ? (
                          <Button
                            type="button"
                            size="sm"
                            variant={spell.prepared ? 'default' : 'outline'}
                            className="min-h-11"
                            aria-pressed={spell.prepared}
                            onClick={() => togglePrepared(spell.id)}
                          >
                            {spell.prepared ? 'Prepared' : 'Prepare'}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11"
                          aria-label={`Remove ${spell.name}`}
                          onClick={() => removeSpell(spell.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      spell.prepared && level > 0 ? <Badge>Prepared</Badge> : null
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
