import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { KobCallouts } from '@/components/kob/KobCallouts';
import { getBondedAction, kob } from '@/data/gameSystems/kidsOnBikes/rules';
import { useCharacterPartyMates, type PartyMate } from '@/hooks/useCharacterPartyMates';
import type { KobBondedActionEntry, KobCharacter } from '@/types/kob';

interface BondedActionsEditorProps {
  character: KobCharacter;
  onChange: (patch: Partial<KobCharacter>) => void;
}

/** The option value that means "not one of the party's characters". */
const FREE_TEXT_VALUE = 'free-text';
/** The book's own out: a pair who see nothing that fits may invent one. */
const INVENTED_VALUE = 'invented';

function describeMate(mate: PartyMate): string {
  const played = mate.playerName ?? mate.ownerName;
  return played ? `${mate.name} — ${played}` : mate.name;
}

export function BondedActionsEditor({ character, onChange }: Readonly<BondedActionsEditorProps>) {
  const entries = character.bondedActions;
  const { mates } = useCharacterPartyMates(character.id);
  const { intro, callouts, actions } = kob.bondedActions;

  const update = (id: string, patch: Partial<KobBondedActionEntry>) => {
    onChange({
      bondedActions: entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    });
  };

  /** Picking a party-mate fills the name and keeps the pointer; going back to free text drops it. */
  const selectMate = (entry: KobBondedActionEntry, value: string) => {
    if (value === FREE_TEXT_VALUE) {
      update(entry.id, { withCharacterId: null });
      return;
    }
    const mate = mates.find((candidate) => candidate.id === value);
    if (mate) update(entry.id, { withCharacterId: mate.id, withCharacter: mate.name });
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

      <KobCallouts callouts={callouts} />

      {entries.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          None yet. A Bonded Action is agreed with one other player, so it is worth waiting until the
          relationships are written.
        </p>
      ) : null}

      {entries.map((entry) => {
        const invented = entry.actionId === '';
        const chosen = getBondedAction(entry.actionId);
        const linkedMate = entry.withCharacterId
          ? mates.find((mate) => mate.id === entry.withCharacterId)
          : undefined;

        return (
          <div key={entry.id} className="space-y-3 rounded-lg border p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`bond-who-${entry.id}`}>With</Label>
                {mates.length > 0 ? (
                  <Select
                    value={entry.withCharacterId ?? FREE_TEXT_VALUE}
                    onValueChange={(value) => selectMate(entry, value)}
                  >
                    <SelectTrigger id={`bond-mate-${entry.id}`} className="h-11 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={FREE_TEXT_VALUE}>Someone else — type a name</SelectItem>
                      {mates.map((mate) => (
                        <SelectItem key={mate.id} value={mate.id}>
                          {describeMate(mate)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                {entry.withCharacterId ? (
                  <p className="text-xs text-muted-foreground">
                    {linkedMate
                      ? `Bonded with ${linkedMate.name}`
                      : `Bonded with ${entry.withCharacter || 'a character'}, who is no longer at this table.`}
                  </p>
                ) : (
                  <Input
                    id={`bond-who-${entry.id}`}
                    value={entry.withCharacter}
                    onChange={(event) => update(entry.id, { withCharacter: event.target.value })}
                    placeholder="Oswald"
                  />
                )}
              </div>

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
