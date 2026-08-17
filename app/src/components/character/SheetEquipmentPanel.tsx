// The loadout, editable in place: equip and unequip, change a quantity, drop an item, add one from
// the library. Before this the only way to unequip a shield was to reopen the builder and walk back
// to the Equipment step.
//
// Starting-equipment selections keep their compound ids (`class::group::option::…`), so removing one
// removes that grant from the character — which is what a player who sold it means. Adding an item
// stores a plain equipment id, exactly as the builder's "extra equipment" list does.
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { SheetCatalogPicker, type CatalogPickerItem } from '@/components/character/SheetCatalogPicker';
import { canEquipSelection, type ResolvedEquipmentSelection } from '@/lib/builderRules';
import type { Character, Equipment } from '@/types/dnd';

interface SheetEquipmentPanelProps {
  character: Character;
  selections: ResolvedEquipmentSelection[];
  /** The catalogue to add from; already filtered to the sources the character was built with. */
  catalogue: Equipment[];
  onChange?: (patch: Partial<Character>) => void;
}

const describeItem = (item?: Equipment) => {
  if (!item) return undefined;
  const parts = [item.source];
  if (item.damage) parts.push(`${item.damage}${item.damageType ? ` ${item.damageType.toLowerCase()}` : ''}`);
  if (item.ac) parts.push(`AC ${item.ac}`);
  return parts.filter(Boolean).join(' · ');
};

function EquipmentRow({
  entry,
  onChange,
  character
}: Readonly<{ entry: ResolvedEquipmentSelection; character: Character; onChange?: (patch: Partial<Character>) => void }>) {
  const setQuantity = (quantity: number) => {
    onChange?.({
      equipment: character.equipment.map((item) =>
        item.equipmentId === entry.equipmentId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    });
  };

  const toggleEquipped = () => {
    onChange?.({
      equipment: character.equipment.map((item) =>
        item.equipmentId === entry.equipmentId ? { ...item, equipped: !item.equipped } : item
      )
    });
  };

  const remove = () => {
    onChange?.({ equipment: character.equipment.filter((item) => item.equipmentId !== entry.equipmentId) });
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
      <div className="min-w-0">
        <span className="break-words font-medium">{entry.name}</span>
        {entry.quantity > 1 ? <span className="ml-2 text-sm text-muted-foreground">×{entry.quantity}</span> : null}
        <p className="text-xs text-muted-foreground">{describeItem(entry.item) ?? entry.sourceLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={entry.equipped ? 'default' : 'outline'}>{entry.equipped ? 'Equipped' : 'Carried'}</Badge>
        {onChange ? (
          <>
            <div className="flex items-center">
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="Fewer" onClick={() => setQuantity(entry.quantity - 1)}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center text-sm tabular-nums">{entry.quantity}</span>
              <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label="More" onClick={() => setQuantity(entry.quantity + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {canEquipSelection(entry) ? (
              <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={toggleEquipped}>
                {entry.equipped ? 'Unequip' : 'Equip'}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remove ${entry.name}`} onClick={remove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function SheetEquipmentPanel({ character, selections, catalogue, onChange }: Readonly<SheetEquipmentPanelProps>) {
  const equipped = selections.filter((entry) => entry.equipped);
  const carried = selections.filter((entry) => !entry.equipped);

  const pickerItems: CatalogPickerItem[] = catalogue.map((item) => ({
    id: item.id,
    name: item.name,
    detail: describeItem(item),
    keywords: item.type
  }));

  const addItem = (equipmentId: string) => {
    const existing = character.equipment.find((entry) => entry.equipmentId === equipmentId);
    onChange?.({
      equipment: existing
        ? character.equipment.map((entry) =>
            entry.equipmentId === equipmentId ? { ...entry, quantity: entry.quantity + 1 } : entry
          )
        : [...character.equipment, { equipmentId, quantity: 1, equipped: false }]
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Current Loadout</CardTitle>
            {onChange ? (
              <CardDescription>
                Equip armour, shields and weapons to have them count towards armour class and attacks.
              </CardDescription>
            ) : null}
          </div>
          {onChange ? (
            <SheetCatalogPicker
              triggerLabel="Add item"
              title="Add equipment"
              description="Anything from the sources this character can use."
              items={pickerItems}
              onPick={addItem}
            />
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-2 font-medium">Equipped</h4>
          {equipped.length > 0 ? (
            <div className="space-y-2">
              {equipped.map((entry) => (
                <EquipmentRow key={entry.equipmentId} entry={entry} character={character} onChange={onChange} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing equipped.</p>
          )}
        </div>
        <Separator />
        <div>
          <h4 className="mb-2 font-medium">Carried</h4>
          {carried.length > 0 ? (
            <div className="space-y-2">
              {carried.map((entry) => (
                <EquipmentRow key={entry.equipmentId} entry={entry} character={character} onChange={onChange} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No extra carried equipment.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
