// One DOM, two layouts: only the labels are hidden, or every roll button would double.
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Every track is `minmax(0, ...)`: an intrinsic minimum pushes the grid past its card.
const GRID_WITH_TIME =
  'lg:grid-cols-[minmax(0,10rem)_minmax(0,2.2fr)_minmax(0,5.5rem)_minmax(0,5.5rem)_minmax(0,5.5rem)_minmax(0,1.4fr)_minmax(0,1fr)]';
const GRID_WITHOUT_TIME =
  'lg:grid-cols-[minmax(0,10rem)_minmax(0,2.2fr)_minmax(0,5.5rem)_minmax(0,5.5rem)_minmax(0,1.4fr)_minmax(0,1fr)]';

const HEADINGS_WITH_TIME = ['', 'Time', 'Range', 'Hit / DC', 'Damage', 'Notes'] as const;
const HEADINGS_WITHOUT_TIME = ['', 'Range', 'Hit / DC', 'Damage', 'Notes'] as const;

export interface SheetActionTableRow {
  id: string;
  name: string;
  /** The line under the name — what the row is, and where it came from. */
  meta?: string;
  time?: string;
  range?: string;
  /** The to-hit button, or the save this row calls for. */
  hit?: ReactNode;
  /** The damage button, or what the row does when it lands. */
  damage?: ReactNode;
  notes?: string;
  /** Cast, Use, Enter — whatever changes the document. Absent on a read-only sheet. */
  controls?: ReactNode;
  /** Opened under the row by the name button. */
  detail?: ReactNode;
}

/** An empty cell hides below `lg` but stays in the grid, or every later cell shifts. */
function Cell({
  label,
  children,
  className
}: Readonly<{ label: string; children?: ReactNode; className?: string }>) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-baseline gap-1 text-sm',
        children === undefined && 'hidden lg:flex',
        className
      )}
    >
      <span className="shrink-0 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
        {label}
      </span>
      <span className="min-w-0">
        {children ?? <span className="text-muted-foreground">&mdash;</span>}
      </span>
    </div>
  );
}

function ActionRow({ row, showTime }: Readonly<{ row: SheetActionTableRow; showTime: boolean }>) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(row.detail);

  const nameBlock = (
    <span className="flex min-w-0 flex-col text-left">
      <span className="font-medium leading-5">{row.name}</span>
      {row.meta ? <span className="text-xs leading-4 text-muted-foreground">{row.meta}</span> : null}
    </span>
  );

  return (
    <div className="border-b last:border-b-0">
      {/* Below `lg` the cells wrap into a line of labelled pairs rather than a second grid: four
          half-width cells is four lines of mostly whitespace on a 390px screen. */}
      <div
        className={cn(
          'flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 lg:grid lg:items-center lg:gap-2',
          showTime ? GRID_WITH_TIME : GRID_WITHOUT_TIME
        )}
      >
        {/* Leading, so the row starts with the thing it is *done* with rather than ending on a
            control group that was competing with the name for the same width. */}
        <div
          className={cn(
            'order-first flex w-full min-w-0 flex-wrap items-center gap-1 lg:w-auto',
            // The cell stays in the grid above `lg` — the columns are placed in order, so a missing
            // child shifts every one after it — and costs no line below it.
            row.controls === undefined && 'hidden lg:flex'
          )}
        >
          {row.controls}
        </div>

        <div className="w-full min-w-0 lg:w-auto">
          {expandable ? (
            <button
              type="button"
              aria-expanded={open}
              className="flex min-h-9 w-full items-center gap-1.5 rounded text-left transition-colors hover:text-primary coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              onClick={() => setOpen((value) => !value)}
            >
              {nameBlock}
              <ChevronDown
                className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
              />
            </button>
          ) : (
            nameBlock
          )}
        </div>

        {showTime ? <Cell label="Time">{row.time}</Cell> : null}
        <Cell label="Range">{row.range}</Cell>
        <Cell label="Hit / DC">{row.hit}</Cell>
        <Cell label="Damage" className="items-start">{row.damage}</Cell>
        <Cell label="Notes" className="w-full lg:w-auto">
          {row.notes ? <span className="text-xs text-muted-foreground">{row.notes}</span> : undefined}
        </Cell>
      </div>

      {open && row.detail ? <div className="px-3 pb-3">{row.detail}</div> : null}
    </div>
  );
}

export function SheetActionTable({
  rows,
  emptyMessage,
  showTime = true,
  nameHeading = 'Name'
}: Readonly<{
  rows: readonly SheetActionTableRow[];
  emptyMessage: string;
  showTime?: boolean;
  /** What the name column is called. The attack table calls it Attack, which is what it holds. */
  nameHeading?: string;
}>) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const headings = ['', nameHeading, ...(showTime ? HEADINGS_WITH_TIME : HEADINGS_WITHOUT_TIME).slice(1)];

  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        className={cn(
          'hidden border-b bg-muted/40 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:gap-2',
          showTime ? GRID_WITH_TIME : GRID_WITHOUT_TIME
        )}
      >
        {headings.map((heading, index) => (
          <span key={heading || `column-${index}`}>{heading}</span>
        ))}
      </div>
      {rows.map((row) => (
        <ActionRow key={row.id} row={row} showTime={showTime} />
      ))}
    </div>
  );
}
