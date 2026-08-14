import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  freeStrengthForAge,
  getTrope,
  kob,
  needsSkilledAt,
  selectableStrengths,
} from '@/data/gameSystems/kidsOnBikes/rules';
import type { KobCharacter } from '@/types/kob';
import { cn } from '@/lib/utils';

interface StrengthsAndFlawProps {
  character: KobCharacter;
  onChange: (patch: Partial<KobCharacter>) => void;
}

/** A trope's suggestions are written loosely ("Skilled at..."), so match on the stem. */
function isSuggested(suggestions: string[], strengthName: string): boolean {
  const stem = strengthName.toLowerCase().slice(0, 9);
  return suggestions.some((suggestion) => suggestion.toLowerCase().startsWith(stem));
}

export function StrengthsAndFlaw({ character, onChange }: Readonly<StrengthsAndFlawProps>) {
  const trope = getTrope(character.tropeId);
  const free = freeStrengthForAge(character.age);
  const options = selectableStrengths(character.age);
  const chosen = character.strengthIds;
  const atLimit = chosen.length >= 2;
  const showSkilledAt = needsSkilledAt(character);

  const toggle = (strengthId: string, checked: boolean) => {
    if (checked) {
      if (chosen.includes(strengthId) || atLimit) return;
      onChange({ strengthIds: [...chosen, strengthId] });
      return;
    }
    onChange({ strengthIds: chosen.filter((id) => id !== strengthId) });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Strengths</h3>
          <p className="text-sm text-muted-foreground">
            Choose two. {trope ? `Highlighted ones are suggested for a ${trope.name}.` : 'Pick a Trope to see its suggestions.'}
          </p>
        </div>

        {free ? (
          <div className="rounded-lg border border-primary/40 bg-accent/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Free for your age</Badge>
              <span className="font-medium">{free.name}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{free.description}</p>
          </div>
        ) : null}

        <div className="grid gap-2 md:grid-cols-2">
          {options.map((strength) => {
            const checked = chosen.includes(strength.id);
            const suggested = trope ? isSuggested(trope.suggestedStrengths, strength.name) : false;
            return (
              <label
                key={strength.id}
                htmlFor={`strength-${strength.id}`}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                  checked && 'border-primary bg-accent',
                  !checked && suggested && 'border-primary/40',
                  !checked && atLimit && 'opacity-60',
                )}
              >
                <Checkbox
                  id={`strength-${strength.id}`}
                  checked={checked}
                  disabled={!checked && atLimit}
                  onCheckedChange={(value) => toggle(strength.id, value === true)}
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 font-medium">
                    {strength.name}
                    {suggested ? <Badge variant="secondary">Suggested</Badge> : null}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{strength.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {showSkilledAt ? (
        <section className="space-y-2">
          <Label htmlFor="skilled-at">Skilled at…</Label>
          <Input
            id="skilled-at"
            value={character.skilledAt}
            onChange={(event) => onChange({ skilledAt: event.target.value })}
            placeholder="Car repair, first aid, playing piano…"
          />
          <p className="text-xs text-muted-foreground">
            The skill fills the blank in the Strength. You succeed at moderate checks involving it,
            and add up to +3 on harder ones.
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Flaw</h3>
          <p className="text-sm text-muted-foreground">
            One Flaw. Failing a roll because you acted on it earns an extra Adversity Token.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="flaw-select">From the list</Label>
            <Select
              value={character.flawId ?? ''}
              onValueChange={(value) => onChange({ flawId: value, customFlaw: '' })}
            >
              <SelectTrigger id="flaw-select" className="h-11 w-full">
                <SelectValue placeholder="Choose a Flaw" />
              </SelectTrigger>
              <SelectContent>
                {kob.flaws.map((flaw) => (
                  <SelectItem key={flaw.id} value={flaw.id}>
                    {flaw.name}
                    {trope && isSuggested(trope.suggestedFlaws, flaw.name) ? ' ·  suggested' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="flaw-custom">Or one you agreed with the GM</Label>
            <Input
              id="flaw-custom"
              value={character.customFlaw}
              onChange={(event) => onChange({ customFlaw: event.target.value, flawId: null })}
              placeholder="Overprotective"
            />
          </div>
        </div>

        {trope && trope.suggestedFlaws.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Suggested for a {trope.name}: {trope.suggestedFlaws.join(', ')}.
          </p>
        ) : null}
      </section>
    </div>
  );
}
