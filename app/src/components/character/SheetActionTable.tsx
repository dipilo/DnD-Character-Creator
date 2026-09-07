// The table every action row is printed in: Name, Time, Range, Hit/DC, Damage, Notes.
//
// D&D Beyond's attack table has fixed columns and ours was a card per weapon, so the same six facts
// sat in a different place on every row and a player had to read each card to find one number.
//
// One DOM, two layouts. Above `lg` it is a grid with a header row; below it each cell carries its
// own label and the row stacks. The labels are the only thing a media query hides — rendering the
// row twice would put two of every roll button on the sheet, which is the mistake `useSheetLayout`
// exists to avoid on saves and skills.
import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Name, Time, Range, Hit/DC, Damage, Notes, then whatever the row can be *done* with. */
const GRID_COLUMNS =
  'lg:grid-cols-[minmax(8rem,2.2fr)_5.5rem_5.5rem_5.5rem_minmax(6rem,1.2fr)_minmax(4rem,1fr)_minmax(0,auto)]';

const HEADINGS = ['Name', 'Time', 'Range', 'Hit / DC', 'Damage', 'Notes'] as const;

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

/**
 * One cell, labelled where there are no column headings to label it.
 *
 * A cell with nothing in it is hidden below `lg` — an em dash on its own line is a line of nothing
 * on a phone — but it stays in the grid above it, because the columns are placed in order and a
 * missing child would shift every cell after it one column left.
 */
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
      <span className="min-w-0 break-words">
        {children ?? <span className="text-muted-foreground">&mdash;</span>}
      </span>
    </div>
  );
}

function ActionRow({ row }: Readonly<{ row: SheetActionTableRow }>) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(row.detail);

  const nameBlock = (
    <span className="flex min-w-0 flex-col text-left">
      <span className="break-words font-medium leading-5">{row.name}</span>
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
          GRID_COLUMNS
        )}
      >
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

        <Cell label="Time">{row.time}</Cell>
        <Cell label="Range">{row.range}</Cell>
        <Cell label="Hit / DC">{row.hit}</Cell>
        <Cell label="Damage">{row.damage}</Cell>
        <Cell label="Notes" className="w-full lg:w-auto">
          {row.notes ? <span className="text-xs text-muted-foreground">{row.notes}</span> : undefined}
        </Cell>

        {row.controls ? (
          <div className="flex w-full flex-wrap items-center gap-1 lg:w-auto lg:justify-end">
            {row.controls}
          </div>
        ) : null}
      </div>

      {open && row.detail ? <div className="px-3 pb-3">{row.detail}</div> : null}
    </div>
  );
}

export function SheetActionTable({
  rows,
  emptyMessage
}: Readonly<{ rows: readonly SheetActionTableRow[]; emptyMessage: string }>) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        className={cn(
          'hidden border-b bg-muted/40 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:gap-2',
          GRID_COLUMNS
        )}
      >
        {HEADINGS.map((heading) => (
          <span key={heading}>{heading}</span>
        ))}
      </div>
      {rows.map((row) => (
        <ActionRow key={row.id} row={row} />
      ))}
    </div>
  );
}
