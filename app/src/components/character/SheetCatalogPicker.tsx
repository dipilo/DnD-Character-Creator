// "Add something from the library" — the one control the sheet needs so equipment and spells can
// be changed without reopening the builder. A search box over a list, in a dialog, because the
// catalogues run to hundreds of entries.
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';

export interface CatalogPickerItem {
  id: string;
  name: string;
  /** The line under the name — a source, a spell level, a weapon's damage. */
  detail?: string;
  /** Extra text the search should match, e.g. a type or a school. */
  keywords?: string;
}

interface SheetCatalogPickerProps {
  triggerLabel: string;
  title: string;
  description: string;
  items: CatalogPickerItem[];
  onPick: (id: string) => void;
}

const MAX_VISIBLE = 60;

export function SheetCatalogPicker({ triggerLabel, title, description, items, onPick }: Readonly<SheetCatalogPickerProps>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? items.filter((item) => `${item.name} ${item.detail ?? ''} ${item.keywords ?? ''}`.toLowerCase().includes(needle))
      : items;
    return filtered.slice(0, MAX_VISIBLE);
  }, [items, query]);

  const handlePick = (id: string) => {
    onPick(id);
    setOpen(false);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="min-h-11">
          <Plus className="mr-2 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search…"
          aria-label={`Search ${title.toLowerCase()}`}
        />
        <ScrollArea className="h-72 rounded-md border">
          <div className="divide-y">
            {matches.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handlePick(item.id)}
                className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left hover:bg-accent"
              >
                <span className="text-sm font-medium">{item.name}</span>
                {item.detail ? <span className="text-xs text-muted-foreground">{item.detail}</span> : null}
              </button>
            ))}
            {matches.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches that search.</p>
            ) : null}
          </div>
        </ScrollArea>
        {matches.length === MAX_VISIBLE ? (
          <p className="text-xs text-muted-foreground">Showing the first {MAX_VISIBLE} matches. Narrow the search to see more.</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
