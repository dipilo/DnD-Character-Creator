// The Consent Sheet (rulebook p. 16–18): what each player is comfortable their character doing
// on the page. It is play state, not a creation-time answer — same posture as `KobSheetView`'s
// Notes card, so it renders read-only when `onChange` is omitted and writes nothing on its own.
import { useEffect, useState } from 'react';
import { ChevronDown, TriangleAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  KOB_CHILD_INTIMACY_HARD_LINE,
  KOB_INTIMACY_LEVELS,
  KOB_RELATIONSHIP_NOTES_PROMPT,
  KOB_ROMANCE_LEVELS,
  type KobConsentField,
} from '@/data/gameSystems/kidsOnBikes/consentSheet';
import type { KobAge } from '@/data/gameSystems/kidsOnBikes/types';
import { cn } from '@/lib/utils';
import type { KobCharacter, KobConsentSheet } from '@/types/kob';

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
        <p className="text-xs text-muted-foreground short:hidden">
          Where your character is willing to go, revisited whenever that changes. Open a row for the book’s
          definition.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 md:items-start">
          <ConsentGroup
            title="Romance"
            fields={KOB_ROMANCE_LEVELS}
            consent={consent}
            editable={Boolean(onChange)}
            setField={setField}
          />
          <ConsentGroup
            title="Intimacy"
            fields={KOB_INTIMACY_LEVELS}
            consent={consent}
            editable={Boolean(onChange)}
            setField={setField}
            disabled={intimacyBlocked}
            note={intimacyBlocked ? KOB_CHILD_INTIMACY_HARD_LINE : null}
          />
        </div>

        {onChange ? (
          <div className="grid gap-3 md:grid-cols-2">
            <ConsentNoteField
              id={`consent-relationship-notes-${character.id}`}
              label="Notes on relationships"
              value={consent.relationshipNotes}
              placeholder={KOB_RELATIONSHIP_NOTES_PROMPT}
              onValueChange={(value) => setField('relationshipNotes', value)}
            />
            <ConsentNoteField
              id={`consent-character-notes-${character.id}`}
              label="Character thoughts & notes"
              value={consent.characterNotes}
              onValueChange={(value) => setField('characterNotes', value)}
            />
          </div>
        ) : (
          <ConsentNotesReadOnly consent={consent} />
        )}
      </CardContent>
    </Card>
  );
}

function ConsentGroup({
  title,
  fields,
  consent,
  editable,
  setField,
  disabled = false,
  note = null,
}: Readonly<{
  title: string;
  fields: readonly KobConsentField[];
  consent: KobConsentSheet;
  editable: boolean;
  setField: (key: keyof KobConsentSheet, value: boolean | string) => void;
  disabled?: boolean;
  note?: string | null;
}>) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="divide-y rounded-md border">
        {fields.map((field) => (
          <ConsentRow
            key={field.key}
            field={field}
            consent={consent}
            editable={editable}
            setField={setField}
            disabled={disabled}
          />
        ))}
      </div>
      {note ? (
        <p className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{note}</span>
        </p>
      ) : null}
    </section>
  );
}

function ConsentRow({
  field,
  consent,
  editable,
  setField,
  disabled,
}: Readonly<{
  field: KobConsentField;
  consent: KobConsentSheet;
  editable: boolean;
  setField: (key: keyof KobConsentSheet, value: boolean | string) => void;
  disabled: boolean;
}>) {
  const [open, setOpen] = useState(false);
  const checked = Boolean(consent[field.key]) && !disabled;
  const id = `consent-${field.key}`;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="flex min-h-11 items-center gap-3 pl-3 pr-1">
        <Checkbox
          id={id}
          checked={checked}
          disabled={!editable || disabled}
          onCheckedChange={(value) => setField(field.key, value === true)}
          className="size-5"
        />
        <Label
          htmlFor={id}
          className={cn('flex-1 cursor-pointer py-2 text-sm font-medium', disabled && 'text-muted-foreground')}
        >
          {field.label}
        </Label>
        <CollapsibleTrigger
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          aria-label={`What “${field.label}” means`}
        >
          <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <p className="pb-3 pl-11 pr-3 text-xs leading-relaxed text-muted-foreground">{field.description}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ConsentNoteField({
  id,
  label,
  value,
  placeholder,
  onValueChange,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
}>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-20"
      />
    </div>
  );
}

function ConsentNotesReadOnly({ consent }: Readonly<{ consent: KobConsentSheet }>) {
  const notes = [
    { label: 'Notes on relationships', value: consent.relationshipNotes },
    { label: 'Character thoughts & notes', value: consent.characterNotes },
  ].filter((note) => note.value.trim());
  if (notes.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {notes.map((note) => (
        <div key={note.label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{note.label}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{note.value}</p>
        </div>
      ))}
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
