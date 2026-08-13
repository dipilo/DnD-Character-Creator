import { useState } from 'react';
import { toast } from 'sonner';
import { saveSuggestedGroups, suggestGroups } from '@/lib/api';
import type { GroupSuggestion } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SuggestGroupsDialogProps {
  campaignId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Propose a split of the roster across a date window.
 *
 * The server's algorithm is a greedy round-robin over how much availability each player has in the
 * window — good enough to start from, not good enough to apply unseen. So the proposal is shown
 * first and only written when it is accepted, and players with no availability at all in the
 * window are called out, because they are the ones the algorithm places arbitrarily.
 */
export function SuggestGroupsDialog({ campaignId, open, onOpenChange, onSaved }: Readonly<SuggestGroupsDialogProps>) {
  const today = new Date();
  const [numGroups, setNumGroups] = useState('2');
  const [start, setStart] = useState(toDateInputValue(today));
  const [end, setEnd] = useState(toDateInputValue(new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)));
  const [suggestions, setSuggestions] = useState<GroupSuggestion[] | null>(null);
  const [busy, setBusy] = useState(false);

  const runSuggestion = async () => {
    setBusy(true);
    try {
      const result = await suggestGroups(campaignId, Math.max(1, Number.parseInt(numGroups, 10) || 1), {
        start: new Date(`${start}T00:00:00`).toISOString(),
        end: new Date(`${end}T23:59:59`).toISOString(),
      });
      setSuggestions(result.groups);
      if (result.groups.every((group) => group.members.length === 0)) {
        toast.info('There is nobody in this campaign to group yet');
      }
    } catch (e) {
      toast.error('Could not build a suggestion', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const acceptSuggestion = async () => {
    if (!suggestions) return;
    setBusy(true);
    try {
      await saveSuggestedGroups(
        campaignId,
        suggestions
          .filter((group) => group.members.length > 0)
          .map((group, index) => ({
            name: `Suggested group ${index + 1}`,
            member_ids: group.members.map((member) => member.id),
          })),
      );
      setSuggestions(null);
      toast.success('Saved the suggested groups');
      onSaved();
    } catch (e) {
      toast.error('Could not save those groups', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Suggest a split</DialogTitle>
          <DialogDescription>
            Players are ranked by how much they are free inside the window, then dealt round-robin.
            Nothing is saved until you accept it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="suggest-count">Groups</Label>
            <Input
              id="suggest-count"
              type="number"
              min={1}
              max={12}
              value={numGroups}
              onChange={(e) => setNumGroups(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suggest-start">From</Label>
            <Input id="suggest-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="suggest-end">To</Label>
            <Input id="suggest-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        {suggestions ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((group, index) => (
              <div key={`suggested-${index}`} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Group {index + 1}</p>
                  <span className="text-xs text-muted-foreground">{group.score}h combined</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {group.members.length === 0 ? (
                    <span className="text-xs text-muted-foreground">Empty</span>
                  ) : null}
                  {group.members.map((member) => (
                    <Badge key={member.id} variant={member.zero_availability ? 'outline' : 'secondary'}>
                      {member.name || `#${member.id}`}
                      {member.zero_availability ? ' · no availability' : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="secondary" onClick={runSuggestion} disabled={busy}>
            {suggestions ? 'Suggest again' : 'Suggest'}
          </Button>
          <Button onClick={acceptSuggestion} disabled={busy || !suggestions}>
            Save these groups
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
