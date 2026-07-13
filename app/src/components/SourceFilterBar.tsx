import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { contentSourceManifest, type ContentSourceManifestEntry } from '@/data/librarySources';
import { getSourceBucketsById } from '@/data/sourceHelpers';
import { X } from 'lucide-react';

const builderRelevantBuckets = ['species', 'classes', 'subclasses', 'backgrounds', 'spells', 'equipment', 'feats'] as const;

const defaultBuilderSources = contentSourceManifest.filter((source) => {
  if (source.id === 'homebrew') {
    return true;
  }

  return builderRelevantBuckets.some((bucket) => getSourceBucketsById(source.id, bucket).length > 0);
});

interface SourceFilterBarProps {
  label?: string;
  selectedSourceIds: string[];
  onChange: (next: string[]) => void;
  sources?: ContentSourceManifestEntry[];
}

export function SourceFilterBar({
  label = 'Sources',
  selectedSourceIds,
  onChange,
  sources = defaultBuilderSources
}: Readonly<SourceFilterBarProps>) {
  const toggleSource = (sourceId: string) => {
    onChange(
      selectedSourceIds.includes(sourceId)
        ? selectedSourceIds.filter((id) => id !== sourceId)
        : [...selectedSourceIds, sourceId]
    );
  };

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Filter the list by one or more source books.</p>
        </div>
        {selectedSourceIds.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange([])} className="gap-1">
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {sources.map((source) => {
          const active = selectedSourceIds.includes(source.id);
          return (
            <Button
              key={source.id}
              type="button"
              variant={active ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleSource(source.id)}
              className="h-auto min-w-0 max-w-full flex-col items-start gap-1 px-3 py-2 text-left whitespace-normal break-words"
            >
              <span className="text-xs uppercase tracking-wide opacity-70">{source.category}</span>
              <span className="max-w-full text-sm leading-tight">{source.label}</span>
            </Button>
          );
        })}
      </div>

      {selectedSourceIds.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selectedSourceIds.map((id) => {
            const source = sources.find((entry) => entry.id === id);
            return (
              <Badge key={id} variant="secondary" className="max-w-full gap-1 whitespace-normal break-words text-left">
                <span className="max-w-full">{source?.label || id}</span>
                <button type="button" aria-label={`Remove ${source?.label || id}`} onClick={() => toggleSource(id)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
