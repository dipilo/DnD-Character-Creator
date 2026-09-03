import { useState } from 'react';
import { Eye, EyeOff, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { DIE_DESCRIPTIONS, KOB_STAT_IDS, getStatName, kob } from '@/data/gameSystems/kidsOnBikes/rules';
import type { PoweredCharacterAspect, PoweredCharacterData, PoweredCharacterFear } from '@/lib/api';
import { AspectRoller } from './PoweredCharacterCard';

interface PoweredCharacterEditorProps {
  initial: PoweredCharacterData;
  saving: boolean;
  onSave: (data: PoweredCharacterData) => void;
  onCancel: () => void;
}

const NO_DIE = 'unset';

function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * The GM's side of the card: everything the chapter says they establish, including the parts they
 * establish secretly.
 *
 * An Aspect or a Fear marked face down is not sent to any player until the GM turns it over, so
 * this editor is the only screen either text ever appears on before then.
 */
export function PoweredCharacterEditor({ initial, saving, onSave, onCancel }: Readonly<PoweredCharacterEditorProps>) {
  const [draft, setDraft] = useState<PoweredCharacterData>(initial);

  const patch = (change: Partial<PoweredCharacterData>) => setDraft((current) => ({ ...current, ...change }));

  const setAspect = (id: string, change: Partial<PoweredCharacterAspect>) => {
    patch({ aspects: draft.aspects.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)) });
  };
  const setFear = (id: string, change: Partial<PoweredCharacterFear>) => {
    patch({ fears: draft.fears.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)) });
  };

  const addAspect = (text = '') => {
    patch({ aspects: [...draft.aspects, { id: newId(), text, holder: null, active: false, hidden: false }] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{kob.poweredCharacter.title || 'Powered Character'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="pc-name">Name</Label>
            <Input
              id="pc-name"
              value={draft.name}
              className="coarse:min-h-11"
              onChange={(event) => patch({ name: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pc-pool">Power Tokens</Label>
            <Input
              id="pc-pool"
              type="number"
              min={0}
              value={draft.powerTokens.pool}
              className="coarse:min-h-11"
              onChange={(event) =>
                patch({ powerTokens: { ...draft.powerTokens, pool: Math.max(0, Number(event.target.value) || 0) } })
              }
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="pc-concept">Concept</Label>
          <Textarea
            id="pc-concept"
            value={draft.concept}
            rows={2}
            onChange={(event) => patch({ concept: event.target.value })}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">Stats</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {KOB_STAT_IDS.map((statId) => (
              <div key={statId} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-sm text-muted-foreground">{getStatName(statId)}</span>
                <Select
                  value={draft.stats[statId] || NO_DIE}
                  onValueChange={(value) =>
                    patch({ stats: { ...draft.stats, [statId]: value === NO_DIE ? '' : value } })
                  }
                >
                  <SelectTrigger className="h-9 min-h-11 coarse:min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_DIE}>Not set</SelectItem>
                    {kob.diceOrder.map((die) => (
                      <SelectItem key={die} value={die}>
                        {die} · {DIE_DESCRIPTIONS[die]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Aspects</p>
            <Button type="button" variant="outline" size="sm" className="min-h-11 coarse:min-h-11" onClick={() => addAspect()}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <AspectRoller onRolled={(text) => addAspect(text)} />
          {draft.aspects.map((aspect) => (
            <div key={aspect.id} className="flex items-start gap-2">
              <Input
                value={aspect.text}
                placeholder="An Aspect"
                className="coarse:min-h-11"
                onChange={(event) => setAspect(aspect.id, { text: event.target.value })}
              />
              <FaceDownToggle
                hidden={aspect.hidden}
                label="Aspect"
                onToggle={() => setAspect(aspect.id, { hidden: !aspect.hidden })}
              />
              <RemoveButton
                label={`Remove ${aspect.text || 'this Aspect'}`}
                onRemove={() => patch({ aspects: draft.aspects.filter((entry) => entry.id !== aspect.id) })}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Fears</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 coarse:min-h-11"
              onClick={() => patch({ fears: [...draft.fears, { id: newId(), text: '', revealed: false }] })}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {draft.fears.map((fear) => (
            <div key={fear.id} className="flex items-start gap-2">
              <Input
                value={fear.text}
                placeholder="A Fear"
                className="coarse:min-h-11"
                onChange={(event) => setFear(fear.id, { text: event.target.value })}
              />
              <FaceDownToggle
                hidden={!fear.revealed}
                label="Fear"
                onToggle={() => setFear(fear.id, { revealed: !fear.revealed })}
              />
              <RemoveButton
                label={`Remove ${fear.text || 'this Fear'}`}
                onRemove={() => patch({ fears: draft.fears.filter((entry) => entry.id !== fear.id) })}
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" className="min-h-11 coarse:min-h-11" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" disabled={saving} className="min-h-11 coarse:min-h-11" onClick={() => onSave(draft)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface FaceDownToggleProps {
  hidden: boolean;
  label: string;
  onToggle: () => void;
}

function FaceDownToggle({ hidden, label, onToggle }: Readonly<FaceDownToggleProps>) {
  const Icon = hidden ? EyeOff : Eye;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={hidden ? `Turn this ${label} face up` : `Turn this ${label} face down`}
      title={hidden ? 'Face down' : 'Face up'}
      className="min-h-11 min-w-11 shrink-0 coarse:min-h-11"
      onClick={onToggle}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

function RemoveButton({ label, onRemove }: Readonly<{ label: string; onRemove: () => void }>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      className="min-h-11 min-w-11 shrink-0 coarse:min-h-11"
      onClick={onRemove}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}
