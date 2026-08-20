import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { KobCallouts } from '@/components/kob/KobCallouts';
import { finishingTouch, getTrope, tropeQuestions } from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobCharacter } from '@/types/kob';

interface FinishingTouchesProps {
  character: KobCharacter;
  onChange: (patch: Partial<KobCharacter>) => void;
}

/** Three at most, per the rules — one at creation, the rest earned in play. */
const MAX_KNACKS = 3;

/** The section's own wording for one field, and whatever tips and examples the book prints under it. */
function TouchNote({ id }: Readonly<{ id: string }>) {
  const touch = finishingTouch(id);
  if (!touch) return null;
  return (
    <div className="space-y-1.5">
      {touch.paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-xs text-muted-foreground">{paragraph}</p>
      ))}
      <KobCallouts callouts={touch.callouts} />
    </div>
  );
}

export function FinishingTouches({ character, onChange }: Readonly<FinishingTouchesProps>) {
  const trope = getTrope(character.tropeId);
  const questions = tropeQuestions(character.tropeId);
  const knacks = character.knacks.length > 0 ? character.knacks : [''];

  const setKnack = (index: number, value: string) => {
    const next = [...knacks];
    next[index] = value;
    onChange({ knacks: next });
  };

  const setAnswer = (index: number, value: string) => {
    const next = [...character.tropeAnswers];
    while (next.length < questions.length) next.push('');
    next[index] = value;
    onChange({ tropeAnswers: next });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="motivation">Motivation</Label>
          <Textarea
            id="motivation"
            value={character.motivation}
            onChange={(event) => onChange({ motivation: event.target.value })}
            placeholder="Find my son no matter what it costs me"
          />
          <TouchNote id="motivation" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fear">Fear</Label>
          <Textarea
            id="fear"
            value={character.fear}
            onChange={(event) => onChange({ fear: event.target.value })}
            placeholder="Suffocation"
          />
          <TouchNote id="fear" />
        </div>

        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="obligations">Obligations</Label>
          <Textarea
            id="obligations"
            value={character.obligations}
            onChange={(event) => onChange({ obligations: event.target.value })}
            placeholder="Walk the dog twice a day; don't embarrass your parents"
          />
          <TouchNote id="obligations" />
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label>Knacks</Label>
            <TouchNote id="knack" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={knacks.length >= MAX_KNACKS}
            onClick={() => onChange({ knacks: [...knacks, ''] })}
          >
            <Plus className="h-4 w-4" />
            Add a Knack
          </Button>
        </div>
        <div className="space-y-2">
          {knacks.map((knack, index) => (
            // Index is the identity here: a knack has no id, and reordering is not offered.
            <div key={`knack-${index}`} className="flex items-start gap-2">
              <Input
                value={knack}
                onChange={(event) => setKnack(index, event.target.value)}
                placeholder="Repairing vehicles"
                aria-label={`Knack ${index + 1}`}
              />
              {knacks.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove knack ${index + 1}`}
                  onClick={() => onChange({ knacks: knacks.filter((_, i) => i !== index) })}
                >
                  <X className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div className="space-y-1.5">
        <Label htmlFor="backpack">Backpack</Label>
        <Textarea
          id="backpack"
          value={character.backpack}
          onChange={(event) => onChange({ backpack: event.target.value })}
          placeholder="A calculator and two books; the advice your grandmother gave you"
        />
        <TouchNote id="backpack" />
      </div>

      {questions.length > 0 ? (
        <section className="space-y-3">
          <div className="space-y-1.5">
            <Label>{trope?.name} questions</Label>
            <TouchNote id="trope-specific-questions" />
          </div>
          {questions.map((question, index) => (
            <div key={question} className="space-y-1.5">
              <Label htmlFor={`trope-question-${index}`} className="font-normal text-muted-foreground">
                {question}
              </Label>
              <Textarea
                id={`trope-question-${index}`}
                value={character.tropeAnswers[index] ?? ''}
                onChange={(event) => setAnswer(index, event.target.value)}
              />
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
