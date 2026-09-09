// Who the character is, editable where the player reads it.
//
// The background prints suggestions; these are the lines the player actually wrote, and until now
// they could only be changed by reopening the builder and walking back to the Description step.
// Same posture as every other sheet panel: it holds no state and hands a patch back through the one
// optional `onChange`, so a campaign-mate reading a shared sheet gets the text and no fields.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Character } from '@/types/dnd';

type PersonalityField = keyof NonNullable<Character['personality']>;

/** The four the books print, then the two longer ones the sheet keeps beside them. */
const FIELDS: ReadonlyArray<{ field: PersonalityField; label: string }> = [
  { field: 'traits', label: 'Personality Traits' },
  { field: 'ideals', label: 'Ideals' },
  { field: 'bonds', label: 'Bonds' },
  { field: 'flaws', label: 'Flaws' },
  { field: 'appearance', label: 'Appearance' },
  { field: 'backstory', label: 'Backstory' },
];

const EMPTY = { traits: '', ideals: '', bonds: '', flaws: '' };

export function SheetIdentityPanel({
  character,
  onChange,
}: Readonly<{ character: Character; onChange?: (patch: Partial<Character>) => void }>) {
  const personality = character.personality;
  const written = FIELDS.filter(({ field }) => (personality?.[field] ?? '').trim().length > 0);

  if (!onChange && written.length === 0 && !character.notes) {
    return null;
  }

  const setField = (field: PersonalityField, value: string) => {
    onChange?.({ personality: { ...EMPTY, ...personality, [field]: value } });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Character</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {(onChange ? FIELDS : written).map(({ field, label }) => (
          <div key={field}>
            <Label htmlFor={`identity-${field}`} className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </Label>
            {onChange ? (
              <Textarea
                id={`identity-${field}`}
                rows={2}
                className="mt-1"
                value={personality?.[field] ?? ''}
                onChange={(event) => setField(field, event.target.value)}
              />
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-sm">{personality?.[field]}</p>
            )}
          </div>
        ))}

        {onChange || character.notes ? (
        <div>
          <Label htmlFor="identity-notes" className="text-xs uppercase tracking-wide text-muted-foreground">
            Notes
          </Label>
          {onChange ? (
            <Textarea
              id="identity-notes"
              rows={3}
              className="mt-1"
              value={character.notes ?? ''}
              onChange={(event) => onChange({ notes: event.target.value })}
            />
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-sm">{character.notes}</p>
          )}
        </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
