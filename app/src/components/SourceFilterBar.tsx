import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { contentSourceManifest, type ContentSourceCategory, type ContentSourceManifestEntry } from '@/data/librarySources';
import { getSourceBucketsById, getSourceEntryCount } from '@/data/sourceHelpers';
import { useSourcePreferencesStore } from '@/store/sourcePreferencesStore';
import { ChevronDown, Search, X } from 'lucide-react';

const builderRelevantBuckets = ['species', 'classes', 'subclasses', 'backgrounds', 'spells', 'equipment', 'feats'] as const;

const defaultBuilderSources = contentSourceManifest.filter((source) => {
  if (source.id === 'homebrew') {
    return true;
  }

  return builderRelevantBuckets.some((bucket) => getSourceBucketsById(source.id, bucket).length > 0);
});

// Printed order, not the manifest's: a player looks for the core books first and the playtest last.
const categoryOrder: ContentSourceCategory[] = ['core', 'basic', 'supplement', 'expansion', 'ua', 'homebrew'];

const categoryLabels: Record<ContentSourceCategory, string> = {
  core: 'Core',
  basic: 'Basic Rules',
  supplement: 'Supplements',
  expansion: 'Expansions',
  ua: 'Unearthed Arcana',
  homebrew: 'Homebrew'
};

const normalize = (value: string) => value.toLowerCase();

const matchesQuery = (source: ContentSourceManifestEntry, query: string) => {
  if (!query) return true;
  const needle = normalize(query);
  return [source.label, source.id, ...(source.aliases ?? [])].some((candidate) => normalize(candidate).includes(needle));
};

const sameSelection = (left: string[], right: string[]) => left.length === right.length
  && [...left].sort().join('\u0000') === [...right].sort().join('\u0000');

interface SourceFilterBarProps {
  label?: string;
  selectedSourceIds: string[];
  onChange: (next: string[]) => void;
  sources?: ContentSourceManifestEntry[];
  /** Off for a list that belongs to something other than the player, such as a campaign's. */
  defaultActions?: boolean;
}

export function SourceFilterBar({
  label = 'Sources',
  selectedSourceIds,
  onChange,
  sources = defaultBuilderSources,
  defaultActions = true
}: Readonly<SourceFilterBarProps>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const defaultSourceIds = useSourcePreferencesStore((state) => state.defaultSourceIds);
  const setDefaultSourceIds = useSourcePreferencesStore((state) => state.setDefaultSourceIds);

  const entryCounts = useMemo(
    () => new Map(sources.map((source) => [source.id, getSourceEntryCount(source.id)])),
    [sources]
  );

  const groups = useMemo(() => {
    const visible = sources.filter((source) => matchesQuery(source, query));
    return categoryOrder
      .map((category) => ({
        category,
        all: sources.filter((source) => source.category === category),
        shown: visible.filter((source) => source.category === category)
      }))
      .filter((group) => group.shown.length > 0);
  }, [query, sources]);

  const toggleSource = (sourceId: string) => {
    onChange(
      selectedSourceIds.includes(sourceId)
        ? selectedSourceIds.filter((id) => id !== sourceId)
        : [...selectedSourceIds, sourceId]
    );
  };

  const setCategory = (ids: string[], include: boolean) => {
    const others = selectedSourceIds.filter((id) => !ids.includes(id));
    onChange(include ? [...others, ...ids] : others);
  };

  const matchesDefault = sameSelection(selectedSourceIds, defaultSourceIds);
  const summary = selectedSourceIds.length === 0
    ? `All ${sources.length} books`
    : `${selectedSourceIds.length} of ${sources.length} books`;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{summary}</p>
        </div>
        <div className="flex items-center gap-1">
          {selectedSourceIds.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => onChange([])} className="gap-1 coarse:min-h-11">
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 coarse:min-h-11">
              {open ? 'Done' : 'Change'}
              <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      {selectedSourceIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSourceIds.map((id) => {
            const source = sources.find((entry) => entry.id === id);
            return (
              <Badge key={id} variant="secondary" className="max-w-full gap-1 whitespace-normal text-left">
                <span className="max-w-full">{source?.label || id}</span>
                <button type="button" aria-label={`Remove ${source?.label || id}`} onClick={() => toggleSource(id)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      <CollapsibleContent className="space-y-3 pt-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search books"
            aria-label="Search books"
            className="pl-8 coarse:min-h-11"
          />
        </div>

        <div className="max-h-[50dvh] touch-pan-y space-y-3 overflow-y-auto overscroll-contain pr-1">
          {groups.map((group) => {
            const ids = group.all.map((source) => source.id);
            const chosen = ids.filter((id) => selectedSourceIds.includes(id)).length;
            return (
              <div key={group.category} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {categoryLabels[group.category]} · {chosen}/{ids.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs coarse:min-h-11"
                      disabled={chosen === ids.length}
                      onClick={() => setCategory(ids, true)}
                    >
                      All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs coarse:min-h-11"
                      disabled={chosen === 0}
                      onClick={() => setCategory(ids, false)}
                    >
                      None
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.shown.map((source) => {
                    const active = selectedSourceIds.includes(source.id);
                    const count = entryCounts.get(source.id) ?? 0;
                    return (
                      <Button
                        key={source.id}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        size="sm"
                        aria-pressed={active}
                        onClick={() => toggleSource(source.id)}
                        className="h-auto min-h-11 min-w-0 max-w-full flex-col items-start gap-0.5 px-3 py-2 text-left whitespace-normal"
                      >
                        <span className="max-w-full text-sm leading-tight">{source.label}</span>
                        <span className="text-xs tabular-nums opacity-70">
                          {count > 0 ? `${count} entries` : 'No entries bundled'}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {groups.length === 0 && <p className="text-sm text-muted-foreground">No book matches that search.</p>}
        </div>

        {defaultActions && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-2">
            <Button
              variant="secondary"
              size="sm"
              className="coarse:min-h-11"
              disabled={matchesDefault}
              onClick={() => setDefaultSourceIds(selectedSourceIds)}
            >
              Save as my default
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="coarse:min-h-11"
              disabled={matchesDefault}
              onClick={() => onChange(defaultSourceIds)}
            >
              Use my default
            </Button>
            <p className="text-xs text-muted-foreground">
              {defaultSourceIds.length === 0
                ? 'Your default is every book. New characters start unfiltered.'
                : `Your default is ${defaultSourceIds.length} book${defaultSourceIds.length === 1 ? '' : 's'}. New characters start there.`}
            </p>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
