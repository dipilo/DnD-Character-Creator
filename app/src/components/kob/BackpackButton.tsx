import { readCanvas } from '@/lib/kob/backpackCanvas';
import { cn } from '@/lib/utils';
import type { KobBackpackCanvas } from '@/types/kob';

/**
 * The backpack itself, as the way in.
 *
 * It is a 140 KB traced drawing, so it is served from `public/` and requested by the browser
 * rather than imported — CLAUDE.md's boot-cost rule is about the JS graph, and an `<img>` keeps it
 * out of every chunk.
 */
const BACKPACK_SRC = `${import.meta.env.BASE_URL}assets/kob/backpack.svg`;

interface BackpackButtonProps {
  readonly canvas: KobBackpackCanvas;
  readonly onOpen: () => void;
  readonly className?: string;
}

export function BackpackButton({ canvas, onOpen, className }: BackpackButtonProps) {
  const count = readCanvas(canvas).nodes.length;
  const summary = count === 0 ? 'Empty' : `${count} ${count === 1 ? 'thing' : 'things'} inside`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-center gap-4 rounded-lg border p-3 text-left transition-colors hover:bg-muted',
        className,
      )}
    >
      <img src={BACKPACK_SRC} alt="" aria-hidden className="h-24 w-auto shrink-0" />
      <span className="min-w-0">
        <span className="block font-medium">Open the backpack</span>
        <span className="block text-sm text-muted-foreground">{summary}</span>
      </span>
    </button>
  );
}
