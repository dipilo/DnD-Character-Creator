import { useState } from 'react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type RepeatMode = 'count' | 'until' | 'horizon';

interface RepeatBlockDialogProps {
  /** The block being repeated, or null when the dialog is closed. */
  source: { start: Date; end: Date } | null;
  onOpenChange: (open: boolean) => void;
  /** Week offsets to copy the block to; 1 is the following week. */
  onApply: (weekOffsets: number[]) => void;
}

/** Guards against a typo in the date field materialising ten years of weekly blocks. */
const MAX_WEEKS = 260;

function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function offsetsUntil(start: Date, untilValue: string): number[] {
  if (!untilValue) return [];
  const until = new Date(`${untilValue}T23:59:59`);
  if (Number.isNaN(until.getTime())) return [];
  const offsets: number[] = [];
  for (let week = 1; week <= MAX_WEEKS; week += 1) {
    const occurrence = new Date(start.getTime() + week * 7 * 24 * 60 * 60 * 1000);
    if (occurrence > until) break;
    offsets.push(week);
  }
  return offsets;
}

function countOffsets(raw: string): number[] {
  const count = Math.min(MAX_WEEKS, Math.max(1, Number.parseInt(raw, 10) || 1));
  return Array.from({ length: count }, (_, i) => i + 1);
}

/**
 * Weekly repeats for one availability block. There is no recurrence rule in the schema — a block
 * is a start and an end — so "repeats weekly" is materialised as copies, and the horizon is the
 * player's to choose rather than something the app decides on their behalf.
 */
export function RepeatBlockDialog({ source, onOpenChange, onApply }: Readonly<RepeatBlockDialogProps>) {
  const [mode, setMode] = useState<RepeatMode>('count');
  const [count, setCount] = useState('4');
  const [untilDate, setUntilDate] = useState('');
  const [horizonWeeks, setHorizonWeeks] = useState('52');

  const open = source !== null;
  const defaultUntil = source ? toDateInputValue(new Date(source.start.getTime() + 28 * 24 * 60 * 60 * 1000)) : '';
  const untilValue = untilDate || defaultUntil;

  const offsetsForMode = (): number[] => {
    if (!source) return [];
    if (mode === 'count') return countOffsets(count);
    if (mode === 'until') return offsetsUntil(source.start, untilValue);
    return countOffsets(horizonWeeks);
  };

  const offsets = offsetsForMode();

  const handleApply = () => {
    if (offsets.length === 0) return;
    onApply(offsets);
    setUntilDate('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Repeat this block weekly</DialogTitle>
          <DialogDescription>
            Copies of this block are created at the same time on the same weekday. Editing one
            afterwards does not change the others.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={mode} onValueChange={(value) => setMode(value as RepeatMode)} className="gap-4">
          <div className="flex items-center gap-3">
            <RadioGroupItem value="count" id="repeat-count" />
            <Label htmlFor="repeat-count" className="flex-1 font-normal">
              For this many more weeks
            </Label>
            <Input
              type="number"
              min={1}
              max={MAX_WEEKS}
              className="w-24"
              value={count}
              disabled={mode !== 'count'}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <RadioGroupItem value="until" id="repeat-until" />
            <Label htmlFor="repeat-until" className="flex-1 font-normal">
              Every week until
            </Label>
            <Input
              type="date"
              className="w-44"
              value={untilValue}
              disabled={mode !== 'until'}
              onChange={(e) => setUntilDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <RadioGroupItem value="horizon" id="repeat-horizon" />
            <Label htmlFor="repeat-horizon" className="flex-1 font-normal">
              Ongoing, materialised this many weeks ahead
            </Label>
            <Input
              type="number"
              min={1}
              max={MAX_WEEKS}
              className="w-24"
              value={horizonWeeks}
              disabled={mode !== 'horizon'}
              onChange={(e) => setHorizonWeeks(e.target.value)}
            />
          </div>
        </RadioGroup>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={offsets.length === 0}>
            Create {offsets.length} {offsets.length === 1 ? 'copy' : 'copies'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
