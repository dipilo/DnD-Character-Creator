import type { ImportedContentSourceFile } from "../librarySources";

const sourceModuleEntries: Record<string, Record<string, unknown>> = import.meta.glob(["./*.ts", "!./index.ts", "!./registry.ts"], { eager: true });

type SourceModuleRegistryEntry = {
  path: string;
  source: ImportedContentSourceFile;
};

const isImportedContentSourceFile = (value: unknown): value is ImportedContentSourceFile => {
  if (!value || typeof value !== 'object') return false;
  const maybe = value as Partial<ImportedContentSourceFile>;
  return typeof maybe.sourceId === 'string' && typeof maybe.label === 'string' && !!maybe.content;
};

const extractSourceFile = (moduleExports: Record<string, unknown>): ImportedContentSourceFile | undefined => {
  const candidates = [moduleExports.default, ...Object.values(moduleExports)];
  return candidates.find(isImportedContentSourceFile);
};

const sourceModuleRegistry: SourceModuleRegistryEntry[] = Object.entries(sourceModuleEntries)
  .filter(([path]) => !path.endsWith('/index.ts') && !path.endsWith('/registry.ts'))
  .map(([path, moduleExports]) => {
    const source = extractSourceFile(moduleExports);
    return source ? { path, source } : undefined;
  })
  .filter((entry): entry is SourceModuleRegistryEntry => Boolean(entry))
  .sort((left, right) => left.path.localeCompare(right.path));

const sourceOriginPriority = (source: ImportedContentSourceFile) => {
  switch (source.meta?.origin) {
    case 'manual':
    case 'parsed-html':
    case 'imported-json':
      return 3;
    case 'generated':
      return 1;
    default:
      return 2;
  }
};

const hasEntryId = (entry: unknown): entry is { id: string } => {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  const maybe = entry as { id?: unknown };
  return typeof maybe.id === 'string' && maybe.id.trim().length > 0;
};

const aggregateBucketEntries = <K extends keyof ImportedContentSourceFile['content']>(
  modules: SourceModuleRegistryEntry[],
  bucket: K
) => {
  const passthrough: Array<ImportedContentSourceFile['content'][K][number]> = [];
  const dedupedById = new Map<string, { entry: ImportedContentSourceFile['content'][K][number]; priority: number; order: number }>();
  let order = 0;

  modules.forEach(({ source }) => {
    const priority = sourceOriginPriority(source);
    source.content[bucket].forEach((entry) => {
      if (hasEntryId(entry)) {
        const current = dedupedById.get(entry.id);
        if (!current) {
          dedupedById.set(entry.id, { entry, priority, order: order++ });
          return;
        }

        if (priority >= current.priority) {
          dedupedById.set(entry.id, { entry, priority, order: current.order });
        }
        return;
      }

      passthrough.push(entry);
    });
  });

  const dedupedEntries = Array.from(dedupedById.values())
    .sort((left, right) => left.order - right.order)
    .map((entry) => entry.entry) as ImportedContentSourceFile['content'][K];

  return [...dedupedEntries, ...passthrough] as ImportedContentSourceFile['content'][K];
};

export const sourceFileRegistry: ImportedContentSourceFile[] = sourceModuleRegistry.map((entry) => entry.source);

export const getSourceFilesById = (sourceId: string) => {
  return sourceModuleRegistry
    .filter((entry) => entry.source.sourceId === sourceId)
    .map((entry) => entry.source);
};

export const getSourceFileById = (sourceId: string) => {
  return getSourceFilesById(sourceId)
    .sort((left, right) => sourceOriginPriority(right) - sourceOriginPriority(left))[0];
};

export const getSourceBucketsById = <K extends keyof ImportedContentSourceFile['content']>(sourceId: string, bucket: K) => {
  const matchingModules = sourceModuleRegistry.filter((entry) => entry.source.sourceId === sourceId);
  return aggregateBucketEntries(matchingModules, bucket);
};

export const getSourceEntryCount = (sourceId: string) => {
  const matchingModules = sourceModuleRegistry.filter((entry) => entry.source.sourceId === sourceId);
  if (matchingModules.length === 0) {
    return 0;
  }

  const buckets = Object.keys(matchingModules[0].source.content) as Array<keyof ImportedContentSourceFile['content']>;
  return buckets.reduce((total, bucket) => total + aggregateBucketEntries(matchingModules, bucket).length, 0);
};

export const getSourceBuckets = <K extends keyof ImportedContentSourceFile['content']>(bucket: K) => {
  return aggregateBucketEntries(sourceModuleRegistry, bucket);
};
