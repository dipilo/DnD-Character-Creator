import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CopyPlus, Trash2 } from 'lucide-react';

export interface CalendarBlock {
  start: Date;
  end: Date;
}

interface BlockActionsDialogProps {
  /** The block being acted on, or null when the dialog is closed. */
  block: CalendarBlock | null;
  onOpenChange: (open: boolean) => void;
  onDelete: () => void;
  onRepeat: () => void;
}

const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

function describeBlock(block: CalendarBlock): string {
  return `${dayFormat.format(block.start)}, ${timeFormat.format(block.start)} – ${timeFormat.format(block.end)}`;
}

/**
 * What a tap on an availability block offers.
 *
 * On a mouse the two actions are a click and a ctrl-click; a touch screen has neither a modifier
 * key nor a right button, so the same two actions need somewhere to be named. Buttons are
 * full-width and comfortably tall because this is the one dialog that only ever opens on a phone.
 */
export function BlockActionsDialog({ block, onOpenChange, onDelete, onRepeat }: Readonly<BlockActionsDialogProps>) {
  return (
    <Dialog open={block !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Availability block</DialogTitle>
          <DialogDescription>{block ? describeBlock(block) : ''}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Button variant="outline" className="min-h-11 justify-start gap-3" onClick={onRepeat}>
            <CopyPlus className="h-4 w-4" />
            Repeat weekly
          </Button>
          <Button variant="outline" className="min-h-11 justify-start gap-3 text-destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete this block
          </Button>
          <Button variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
