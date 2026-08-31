import { useState } from 'react';
import { toast } from 'sonner';
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
import { Textarea } from '@/components/ui/textarea';
import { GROUP_COLORS } from '@/lib/groupColors';
import { createGroup, updateGroup, type Group } from '@/lib/api';
import { cn } from '@/lib/utils';

interface GroupEditorDialogProps {
  readonly campaignId: number;
  /** Null creates a new group. */
  readonly group: Group | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: (group: Group) => void;
}

interface GroupForm {
  name: string;
  color: string | null;
  targetSize: string;
  notes: string;
}

function initialForm(group: Group | null): GroupForm {
  return {
    name: group?.name ?? '',
    color: group?.color ?? null,
    targetSize: group?.target_size == null ? '' : String(group.target_size),
    notes: group?.notes ?? '',
  };
}

function EditorForm({ campaignId, group, onOpenChange, onSaved }: Readonly<Omit<GroupEditorDialogProps, 'open'>>) {
  const [form, setForm] = useState<GroupForm>(() => initialForm(group));
  const [busy, setBusy] = useState(false);

  const patch = (changes: Partial<GroupForm>) => setForm((current) => ({ ...current, ...changes }));

  const save = () => {
    const name = form.name.trim();
    if (!name || busy) return;
    setBusy(true);
    const targetSize = form.targetSize.trim() === '' ? null : Number.parseInt(form.targetSize, 10);
    const changes = {
      name,
      color: form.color,
      target_size: Number.isFinite(targetSize) ? targetSize : null,
      notes: form.notes,
    };
    const write = group
      ? updateGroup(group.id, changes)
      : createGroup(campaignId, name, [], form.color ?? undefined).then((created) =>
          updateGroup(created.id, changes),
        );
    write
      .then((saved) => {
        onSaved(saved);
        onOpenChange(false);
      })
      .catch((e: unknown) => {
        toast.error('Could not save that group', { description: e instanceof Error ? e.message : undefined });
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{group ? 'Edit group' : 'New group'}</DialogTitle>
        <DialogDescription>A group is one table inside this campaign.</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="group-name">Name</Label>
          <Input
            id="group-name"
            value={form.name}
            placeholder="Thursday table"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </div>

        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Colour</legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-label="No colour"
              aria-pressed={form.color === null}
              onClick={() => patch({ color: null })}
              className={cn(
                'size-11 rounded-full border-2 bg-muted',
                form.color === null ? 'border-foreground' : 'border-transparent',
              )}
            />
            {GROUP_COLORS.map((color) => (
              <button
                key={color.key}
                type="button"
                aria-label={color.label}
                aria-pressed={form.color === color.key}
                onClick={() => patch({ color: color.key })}
                className={cn(
                  'size-11 rounded-full border-2',
                  color.swatch,
                  form.color === color.key ? 'border-foreground' : 'border-transparent',
                )}
              />
            ))}
          </div>
        </fieldset>

        <div className="space-y-1.5">
          <Label htmlFor="group-target">Table size</Label>
          <Input
            id="group-target"
            type="number"
            inputMode="numeric"
            min={1}
            max={64}
            className="w-32"
            value={form.targetSize}
            placeholder="Any"
            onChange={(event) => patch({ targetSize: event.target.value })}
          />
          <p className="text-xs text-muted-foreground">How many seats this table is meant to hold.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="group-notes">Notes</Label>
          <Textarea
            id="group-notes"
            value={form.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button className="min-h-11" disabled={busy || form.name.trim().length === 0} onClick={save}>
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

/**
 * Everything about a group that is not its member list. Keyed on the group being edited so opening
 * it on another one remounts the form, rather than seeding fields from an effect.
 */
export function GroupEditorDialog({ open, group, ...rest }: Readonly<GroupEditorDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={rest.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? <EditorForm key={group?.id ?? 'new'} group={group} {...rest} /> : null}
      </DialogContent>
    </Dialog>
  );
}
