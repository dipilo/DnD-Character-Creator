import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Group, Player } from '@/lib/api';
import { playerLabel } from '@/pages/campaign/useCampaignData';

interface GroupMembersEditorProps {
  readonly group: Group;
  readonly roster: readonly Player[];
  /** Seats that already sit in another group, so a second placing can be flagged as one. */
  readonly placedElsewhere: ReadonlySet<number>;
  readonly onChange: (memberIds: number[]) => void;
}

/**
 * A group's members as removable chips plus one "Add" menu.
 *
 * The checkbox wall this replaces rendered the whole roster inside every card, so a campaign of
 * twelve drew twelve checkboxes per group and nothing said who was in two tables at once — or in
 * none. It also could not be used with a thumb: the labels wrapped into an unreadable block.
 */
export function GroupMembersEditor({ group, roster, placedElsewhere, onChange }: GroupMembersEditorProps) {
  const memberIds = group.members.map((member) => member.id);
  const inGroup = new Set(memberIds);
  const addable = roster.filter((player) => !inGroup.has(player.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {group.members.map((member) => (
          <Badge key={member.id} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
            {playerLabel(member)}
            {placedElsewhere.has(member.id) ? (
              <span className="text-xs opacity-70" title="Also in another group">
                ×2
              </span>
            ) : null}
            <Button
              size="icon"
              variant="ghost"
              className="size-6 shrink-0"
              aria-label={`Remove ${playerLabel(member)} from ${group.name || 'this group'}`}
              onClick={() => onChange(memberIds.filter((id) => id !== member.id))}
            >
              <X className="size-3" />
            </Button>
          </Badge>
        ))}
        {group.members.length === 0 ? (
          <span className="text-xs text-muted-foreground">Nobody yet.</span>
        ) : null}
      </div>

      {addable.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="min-h-11">
              <Plus className="h-4 w-4" />
              Add a seat
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            {addable.map((player) => (
              <DropdownMenuItem key={player.id} onSelect={() => onChange([...memberIds, player.id])}>
                {playerLabel(player)}
                {placedElsewhere.has(player.id) ? (
                  <span className="ml-2 text-xs text-muted-foreground">already in a group</span>
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
