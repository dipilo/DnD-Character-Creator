// Where a derived number came from. A Popover rather than a `title`: touch has no hover, and a
// number nobody can ask about is a number the player has to recompute by hand.
import type { ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface DerivationLine {
  /** What contributed, in the book's own words where there are any. */
  label: string;
  /** Its size, where the contribution is a number. */
  value?: string;
}

interface DerivationHintProps {
  /** The heading of the popover — the name of the figure being explained. */
  title: string;
  lines: readonly DerivationLine[];
  /** The book's own sentence, printed under the lines. */
  detail?: string;
  /** What the reader sees and presses: the number itself, usually. */
  children: ReactNode;
  className?: string;
}

export function DerivationHint({ title, lines, detail, children, className }: Readonly<DerivationHintProps>) {
  if (lines.length === 0 && !detail) {
    return <>{children}</>;
  }

  return (
    <Popover>
      {/* `coarse:min-h-11`: a thumb cannot hit a line of 16px text, and this is the only way to
          ask where the number came from. */}
      <PopoverTrigger
        className={cn(
          'inline-flex items-center rounded underline decoration-dotted decoration-muted-foreground/60 underline-offset-2 transition-colors coarse:min-h-11 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          className
        )}
        aria-label={`Where ${title} comes from`}
      >
        {children}
      </PopoverTrigger>
      {/* Verbose on purpose: a popover costs no screen space until it is asked for. */}
      <PopoverContent align="start" className="w-72 space-y-2 text-sm">
        <p className="font-medium">{title}</p>
        {lines.length > 0 ? (
          <ul className="space-y-1">
            {lines.map((line) => (
              <li key={`${line.label}-${line.value ?? ''}`} className="flex justify-between gap-3">
                <span className="text-muted-foreground">{line.label}</span>
                {line.value ? <span className="shrink-0 font-medium tabular-nums">{line.value}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {detail ? <p className="border-t pt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p> : null}
      </PopoverContent>
    </Popover>
  );
}
