// The Consent Sheet (rulebook p. 16–18): what each player is comfortable their character doing
// on the page. It is play state, not a creation-time answer — same posture as `KobSheetView`'s
// Notes card, so it renders read-only when `onChange` is omitted and writes nothing on its own.
import { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { KobAge } from '@/data/gameSystems/kidsOnBikes/types';
import type { KobCharacter, KobConsentSheet } from '@/types/kob';

/**
 * "Children should not engage in sexual intimacy. They've got monsters to fight!" — the one line
 * in the Romance and Intimacy chapter the book calls a non-negotiable hard line rather than a
 * discussion point, so it is the one this sheet actually enforces rather than just displaying.
 */
const CHILD_INTIMACY_HARD_LINE =
  "Children should not engage in sexual intimacy. They've got monsters to fight! " +
  'On-screen and off-screen intimacy are unavailable for a child character.';

const LEVEL_FIELDS: ReadonlyArray<{ key: keyof KobConsentSheet; label: string; description: string }> = [
  { key: 'crush', label: 'Crush', description: 'Relatively harmless: no intimacy. Blushing, small gifts, holding hands, a kiss on the cheek.' },
  { key: 'date', label: 'Date', description: 'Going out together, an emotional bond, minimal or light physical intimacy.' },
  { key: 'partner', label: 'Partner', description: 'A committed relationship — marriage or common-law, often living together.' }
];

const INTIMACY_FIELDS: ReadonlyArray<{ key: keyof KobConsentSheet; label: string; description: string }> = [
  { key: 'onScreenIntimacy', label: 'On-Screen Intimacy', description: "You're okay with physical affection being described at the table." },
  { key: 'offScreenIntimacy', label: 'Off-Screen Intimacy', description: 'It can happen, but never narrated — "we go out for a drive, then come home."' }
];

interface ConsentSheetPanelProps {
  character: KobCharacter;
  onChange?: (patch: Partial<KobCharacter>) => void;
}

export function ConsentSheetPanel({ character, onChange }: Readonly<ConsentSheetPanelProps>) {
  const consent = character.consent;
  const intimacyBlocked = isIntimacyBlockedForAge(character.age);
  const hasBlockedIntimacy = intimacyBlocked && (consent.onScreenIntimacy || consent.offScreenIntimacy);

  const setField = (key: keyof KobConsentSheet, value: boolean | string) => {
    onChange?.({ consent: { ...consent, [key]: value } });
  };

  // The book states this as a non-negotiable hard line, not a preference to hide and leave stored:
  // a character aged down to "child" has the choice actually withdrawn, not just unchecked on screen.
  useEffect(() => {
    if (onChange && hasBlockedIntimacy) {
      onChange({ consent: { ...consent, onScreenIntimacy: false, offScreenIntimacy: false } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, hasBlockedIntimacy]);

  if (!onChange && !hasAnyConsentContent(consent)) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Consent Sheet</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {LEVEL_FIELDS.map((field) => (
            <ConsentCheckbox key={field.key} field={field} consent={consent} onChange={onChange} setField={setField} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {INTIMACY_FIELDS.map((field) => (
            <ConsentCheckbox
              key={field.key}
              field={field}
              consent={consent}
              onChange={onChange}
              setField={setField}
              disabled={intimacyBlocked}
            />
          ))}
        </div>
        {intimacyBlocked ? (
          <p className="text-xs text-muted-foreground">{CHILD_INTIMACY_HARD_LINE}</p>
        ) : null}

        {onChange ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor={`consent-relationship-notes-${character.id}`}>Notes on relationships</Label>
              <Textarea
                id={`consent-relationship-notes-${character.id}`}
                value={consent.relationshipNotes}
                onChange={(event) => setField('relationshipNotes', event.target.value)}
                placeholder="Preferences specific to a relationship — only with NPCs, a long-distance partner you'd rather not dwell on…"
                className="min-h-20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`consent-character-notes-${character.id}`}>Character thoughts &amp; notes</Label>
              <Textarea
                id={`consent-character-notes-${character.id}`}
                value={consent.characterNotes}
                onChange={(event) => setField('characterNotes', event.target.value)}
                className="min-h-20"
              />
            </div>
          </div>
        ) : (
          <>
            {consent.relationshipNotes.trim() ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes on relationships</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{consent.relationshipNotes}</p>
              </div>
            ) : null}
            {consent.characterNotes.trim() ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Character thoughts &amp; notes</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm">{consent.characterNotes}</p>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ConsentCheckbox({
  field,
  consent,
  onChange,
  setField,
  disabled = false
}: Readonly<{
  field: { key: keyof KobConsentSheet; label: string; description: string };
  consent: KobConsentSheet;
  onChange?: (patch: Partial<KobCharacter>) => void;
  setField: (key: keyof KobConsentSheet, value: boolean | string) => void;
  disabled?: boolean;
}>) {
  const checked = Boolean(consent[field.key]) && !disabled;
  const id = `consent-${field.key}`;
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={!onChange || disabled}
        onCheckedChange={(value) => setField(field.key, value === true)}
        className="mt-0.5 h-5 w-5"
      />
      <Label htmlFor={id} className="cursor-pointer font-normal">
        <span className="font-medium">{field.label}</span>
        <span className="block text-xs text-muted-foreground">{field.description}</span>
      </Label>
    </div>
  );
}

/** The book's one non-negotiable hard line: a child character does not consent to intimacy. */
function isIntimacyBlockedForAge(age: KobAge | null): boolean {
  return age === 'child';
}

function hasAnyConsentContent(consent: KobConsentSheet): boolean {
  return (
    consent.crush ||
    consent.date ||
    consent.partner ||
    consent.onScreenIntimacy ||
    consent.offScreenIntimacy ||
    Boolean(consent.relationshipNotes.trim()) ||
    Boolean(consent.characterNotes.trim())
  );
}
