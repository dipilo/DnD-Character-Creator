// The purse and what it all weighs.
//
// Both halves are read from the loadout the Equipment tab already resolves: a catalogue entry
// carries its own weight, and the coins weigh a fiftieth of a pound each. The only thing a player
// types here is how many coins they have, which is the one part of an inventory no book derives.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { COIN_LABELS, COIN_UNITS, getCoins, setCoins } from '@/lib/sheetPlayState';
import { ENCUMBRANCE_LABELS, purseInGold, type DerivedEncumbrance } from '@/lib/sheetInventory';
import type { Character } from '@/types/dnd';

interface SheetPursePanelProps {
  character: Character;
  encumbrance: DerivedEncumbrance;
  onChange?: (patch: Partial<Character>) => void;
}

export function SheetPursePanel({ character, encumbrance, onChange }: Readonly<SheetPursePanelProps>) {
  const overloaded = encumbrance.level !== 'unencumbered';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          Purse and Carrying
          <Badge variant={overloaded ? 'destructive' : 'secondary'}>
            {ENCUMBRANCE_LABELS[encumbrance.level]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {COIN_UNITS.map((unit) => (
            <div key={unit}>
              <Label htmlFor={`coins-${unit}`} className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                {COIN_LABELS[unit]}
              </Label>
              {onChange ? (
                <Input
                  id={`coins-${unit}`}
                  inputMode="numeric"
                  className="mt-1 h-11 text-center tabular-nums"
                  value={String(getCoins(character, unit))}
                  onChange={(event) =>
                    onChange(setCoins(character, unit, Number.parseInt(event.target.value.replaceAll(/\D/g, ''), 10) || 0))
                  }
                />
              ) : (
                <p className="mt-1 text-lg font-semibold tabular-nums">{getCoins(character, unit)}</p>
              )}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="tabular-nums">
            Carrying <span className="font-semibold text-foreground">{encumbrance.totalWeight} lb</span> of{' '}
            {encumbrance.capacity} lb
          </span>
          <span className="tabular-nums">
            Gear {encumbrance.gearWeight} lb · coins {encumbrance.coinWeight} lb · worth{' '}
            {purseInGold(character)} gp
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
