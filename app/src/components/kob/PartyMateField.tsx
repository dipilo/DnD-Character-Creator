import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CampaignConnection } from '@/hooks/useCampaignConnections';

/** The option value that means "not somebody at this table". */
export const FREE_TEXT_VALUE = 'free-text';

interface PartyMateFieldProps {
  readonly id: string;
  readonly label: string;
  readonly connections: readonly CampaignConnection[];
  /** Null when this character sits at no campaign, which is why the list is empty. */
  readonly campaignId: number | null;
  /** While the table is still being read, "no campaign" is not yet the answer. */
  readonly loading?: boolean;
  readonly who: string;
  readonly withCharacterId: string | null;
  readonly onPick: (patch: { who?: string; withCharacterId: string | null }) => void;
  readonly onTypeName: (who: string) => void;
  readonly placeholder?: string;
}

function describe(connection: CampaignConnection): string {
  return connection.detail ? `${connection.name} — ${connection.detail}` : connection.name;
}

/**
 * Who a relationship or a bonded action is with, picked from the table rather than typed.
 *
 * A character is stored as a pointer plus its name; a seat nobody has built a character for is
 * stored as the name alone, because there is nothing to point at. Either way `who` is what
 * survives when that person leaves the table, which is the rule this field exists to keep.
 */
export function PartyMateField({
  id,
  label,
  connections,
  campaignId,
  loading = false,
  who,
  withCharacterId,
  onPick,
  onTypeName,
  placeholder,
}: PartyMateFieldProps) {
  const shared = connections.filter((entry) => entry.shared);
  const rest = connections.filter((entry) => !entry.shared);
  const linked = withCharacterId ? connections.find((entry) => entry.characterId === withCharacterId) : undefined;

  const select = (value: string) => {
    if (value === FREE_TEXT_VALUE) {
      onPick({ withCharacterId: null });
      return;
    }
    const connection = connections.find((entry) => entry.key === value);
    if (connection) onPick({ who: connection.name, withCharacterId: connection.characterId });
  };

  const renderGroup = (heading: string, entries: CampaignConnection[]) =>
    entries.length === 0 ? null : (
      <SelectGroup>
        <SelectLabel>{heading}</SelectLabel>
        {entries.map((entry) => (
          <SelectItem key={entry.key} value={entry.key}>
            {describe(entry)}
          </SelectItem>
        ))}
      </SelectGroup>
    );

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {connections.length > 0 ? (
        <Select value={withCharacterId ?? FREE_TEXT_VALUE} onValueChange={select}>
          <SelectTrigger id={`${id}-pick`} className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={FREE_TEXT_VALUE}>Someone else — type a name</SelectItem>
            {renderGroup('Your group', shared)}
            {renderGroup(shared.length > 0 ? 'Elsewhere at this table' : 'At this table', rest)}
          </SelectContent>
        </Select>
      ) : null}

      {withCharacterId ? (
        <p className="text-xs text-muted-foreground">
          {linked
            ? `Linked to ${linked.name}${linked.detail ? ` · ${linked.detail}` : ''}`
            : `Linked to ${who || 'a character'}, who is no longer at this table.`}
        </p>
      ) : (
        <Input id={id} value={who} onChange={(event) => onTypeName(event.target.value)} placeholder={placeholder} />
      )}

      {campaignId === null && !loading ? (
        <p className="text-xs text-muted-foreground">
          <Link className="underline" to="/campaigns">
            Seat this character at a campaign
          </Link>{' '}
          to pick from the table instead of typing.
        </p>
      ) : null}
    </div>
  );
}
