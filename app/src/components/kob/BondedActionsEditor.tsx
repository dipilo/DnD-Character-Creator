import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PartyMateField } from '@/components/kob/PartyMateField';
import { getBondedAction, kob } from '@/data/gameSystems/kidsOnBikes/rules';
import { useCampaignConnections } from '@/hooks/useCampaignConnections';
import type { KobBondedActionEntry, KobCharacter } from '@/types/kob';

interface BondedActionsEditorProps {
  character: KobCharacter;
  onChange: (patch: Partial<KobCharacter>) => void;
}

/** The book's own out: a pair who see nothing that fits may invent one. */
const INVENTED_VALUE = 'invented';

export function BondedActionsEditor({ character, onChange }: Readonly<BondedActionsEditorProps>) {
  const entries = character.bondedActions;
  const { connections, campaignId, loading } = useCampaignConnections(character.id);
  const { intro, actions } = kob.bondedActions;

  const update = (id: string, patch: Partial<KobBondedActionEntry>) => {
    onChange({
      bondedActions: entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    });
  };

  const add = () => {
    const entry: KobBondedActionEntry = {
      id: crypto.randomUUID(),
      actionId: '',
      customName: '',
      withCharacter: '',
      withCharacterId: null,
      backstory: '',
    };
    onChange({ bondedActions: [...entries, entry] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-prose space-y-2">
          <h3 className="text-base font-semibold">Bonded Actions</h3>
          {intro.map((paragraph) => (
            <p key={paragraph} className="text-sm text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={add}>
          <Plus className="h-4 w-4" />
          Add a Bonded Action
        </Button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          None yet. A Bonded Action is agreed with one other player, so it is worth waiting until the
          relationships are written.
        </p>
      ) : null}

      {entries.map((entry) => {
        const invented = entry.actionId === '';
        const chosen = getBondedAction(entry.actionId);

        return (
          <div key={entry.id} className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <PartyMateField
                id={`bond-who-${entry.id}`}
                label="With"
                connections={connections}
                campaignId={campaignId}
                loading={loading}
                who={entry.withCharacter}
                withCharacterId={entry.withCharacterId}
                onPick={(patch) =>
                  update(entry.id, {
                    withCharacterId: patch.withCharacterId,
                    ...(patch.who === undefined ? {} : { withCharacter: patch.who }),
                  })
                }
                onTypeName={(withCharacter) => update(entry.id, { withCharacter })}
                placeholder="Oswald"
              />

              <div className="space-y-1.5">
                <Label htmlFor={`bond-action-${entry.id}`}>Bonded Action</Label>
                <Select
                  value={invented ? INVENTED_VALUE : entry.actionId}
                  onValueChange={(value) =>
                    update(entry.id, { actionId: value === INVENTED_VALUE ? '' : value })
                  }
                >
                  <SelectTrigger id={`bond-action-${entry.id}`} className="h-11 w-full">
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    {actions.map((action) => (
                      <SelectItem key={action.id} value={action.id}>
                        {action.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={INVENTED_VALUE}>One you made up</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {invented ? (
              <div className="space-y-1.5">
                <Label htmlFor={`bond-name-${entry.id}`}>What you call it</Label>
                <Input
                  id={`bond-name-${entry.id}`}
                  value={entry.customName}
                  onChange={(event) => update(entry.id, { customName: event.target.value })}
                  placeholder="Fence Hop"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{chosen?.description}</p>
            )}

            <div className="space-y-1.5">
              <Label htmlFor={`bond-backstory-${entry.id}`}>Three things you have done together</Label>
              <Textarea
                id={`bond-backstory-${entry.id}`}
                value={entry.backstory}
                onChange={(event) => update(entry.id, { backstory: event.target.value })}
                className="min-h-24"
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              onClick={() =>
                onChange({ bondedActions: entries.filter((other) => other.id !== entry.id) })
              }
            >
              <Trash2 className="h-4 w-4 text-destructive" />
              Remove
            </Button>
          </div>
        );
      })}
    </div>
  );
}
