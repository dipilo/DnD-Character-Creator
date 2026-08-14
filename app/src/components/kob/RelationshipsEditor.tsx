import { Dices, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { kob } from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobRelationshipQuestion } from '@/data/gameSystems/kidsOnBikes/types';
import type { KobCharacter, KobRelationship } from '@/types/kob';

interface RelationshipsEditorProps {
  character: KobCharacter;
  onChange: (patch: Partial<KobCharacter>) => void;
}

const QUESTION_KINDS: ReadonlyArray<{ value: KobRelationship['kind']; label: string }> = [
  { value: 'positive', label: 'Someone you know — positive' },
  { value: 'negative', label: 'Someone you know — negative' },
  { value: 'stranger', label: "Someone you don't know" },
];

function questionsFor(kind: KobRelationship['kind']): KobRelationshipQuestion[] {
  return kob.relationshipQuestions[kind];
}

/** The rules select a question by rolling a d20 against the list. */
function rollQuestion(kind: KobRelationship['kind']): string {
  const list = questionsFor(kind);
  if (list.length === 0) return '';
  const roll = Math.floor(Math.random() * list.length);
  return list[roll].question;
}

export function RelationshipsEditor({ character, onChange }: Readonly<RelationshipsEditorProps>) {
  const relationships = character.relationships;

  const update = (id: string, patch: Partial<KobRelationship>) => {
    onChange({
      relationships: relationships.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    });
  };

  const add = () => {
    const entry: KobRelationship = {
      id: crypto.randomUUID(),
      who: '',
      connection: '',
      kind: 'positive',
      question: '',
      answer: '',
    };
    onChange({ relationships: [...relationships, entry] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Relationships</h3>
          <p className="text-sm text-muted-foreground">
            Each character should have a meaningful connection to at least half the table. Roll a
            question about each one, or pick one that fits.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={add}>
          <Plus className="h-4 w-4" />
          Add a relationship
        </Button>
      </div>

      {relationships.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Nothing yet. Add one after the group has introduced their characters.
        </p>
      ) : null}

      {relationships.map((entry) => (
        <div key={entry.id} className="space-y-3 rounded-lg border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`rel-who-${entry.id}`}>Who</Label>
              <Input
                id={`rel-who-${entry.id}`}
                value={entry.who}
                onChange={(event) => update(entry.id, { who: event.target.value })}
                placeholder="Oswald"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`rel-connection-${entry.id}`}>How you know them</Label>
              <Input
                id={`rel-connection-${entry.id}`}
                value={entry.connection}
                onChange={(event) => update(entry.id, { connection: event.target.value })}
                placeholder="Neighbours since forever"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-1.5">
              <Label htmlFor={`rel-kind-${entry.id}`}>Question list</Label>
              <Select
                value={entry.kind}
                onValueChange={(value) =>
                  update(entry.id, { kind: value as KobRelationship['kind'], question: '' })
                }
              >
                <SelectTrigger id={`rel-kind-${entry.id}`} className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_KINDS.map((kind) => (
                    <SelectItem key={kind.value} value={kind.value}>
                      {kind.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              onClick={() => update(entry.id, { question: rollQuestion(entry.kind) })}
            >
              <Dices className="h-4 w-4" />
              Roll a question
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="min-h-11"
              aria-label="Remove this relationship"
              onClick={() =>
                onChange({ relationships: relationships.filter((other) => other.id !== entry.id) })
              }
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`rel-question-${entry.id}`}>Question</Label>
            <Select
              value={entry.question}
              onValueChange={(value) => update(entry.id, { question: value })}
            >
              <SelectTrigger id={`rel-question-${entry.id}`} className="h-auto min-h-11 w-full">
                <SelectValue placeholder="Roll, or choose one" />
              </SelectTrigger>
              <SelectContent>
                {questionsFor(entry.kind).map((question) => (
                  <SelectItem key={question.roll} value={question.question}>
                    {question.roll}. {question.question}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`rel-answer-${entry.id}`}>Your answer</Label>
            <Textarea
              id={`rel-answer-${entry.id}`}
              value={entry.answer}
              onChange={(event) => update(entry.id, { answer: event.target.value })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
