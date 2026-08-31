import { Dices, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PartyMateField } from '@/components/kob/PartyMateField';
import { kob } from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobRelationshipQuestion } from '@/data/gameSystems/kidsOnBikes/types';
import { useCampaignConnections } from '@/hooks/useCampaignConnections';
import { rollOnScreen } from '@/store/diceTrayStore';
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

/** The list numbers its own entries, so a rolled result selects by that number, not by position. */
function questionForRoll(list: KobRelationshipQuestion[], roll: number): string | undefined {
  return (list.find((entry) => entry.roll === roll) ?? list[roll - 1])?.question;
}

export function RelationshipsEditor({ character, onChange }: Readonly<RelationshipsEditorProps>) {
  const relationships = character.relationships;
  const { connections, campaignId, loading } = useCampaignConnections(character.id);

  const update = (id: string, patch: Partial<KobRelationship>) => {
    onChange({
      relationships: relationships.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    });
  };

  /**
   * The rules pick a question by rolling against the list, so the tray throws the die the list is
   * as long as and the result selects the entry — the number on screen is the one that chose it.
   */
  const rollQuestion = async (entry: KobRelationship) => {
    const list = questionsFor(entry.kind);
    if (list.length === 0) return;

    const outcome = await rollOnScreen({
      notation: `1d${list.length}`,
      label: 'Relationship question',
      detail: QUESTION_KINDS.find((kind) => kind.value === entry.kind)?.label,
      describeOutcome: (settled) => questionForRoll(list, settled.total) ?? null,
    });

    const question = questionForRoll(list, outcome.total);
    if (question) update(entry.id, { question });
  };

  const add = () => {
    const entry: KobRelationship = {
      id: crypto.randomUUID(),
      who: '',
      withCharacterId: null,
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

      {relationships.map((entry) => {
        return (
          <div key={entry.id} className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <PartyMateField
                id={`rel-who-${entry.id}`}
                label="Who"
                connections={connections}
                campaignId={campaignId}
                loading={loading}
                who={entry.who}
                withCharacterId={entry.withCharacterId ?? null}
                onPick={(patch) => update(entry.id, patch)}
                onTypeName={(who) => update(entry.id, { who })}
                placeholder="Oswald"
              />
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
                onClick={() => void rollQuestion(entry)}
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
        );
      })}
    </div>
  );
}
