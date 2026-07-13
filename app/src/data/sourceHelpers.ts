import { getSourceBuckets } from '@/data/sourceFiles/registry';

export { contentSourceManifest, sourceMatchesSelection } from '@/data/librarySources';
export { getSourceBuckets, getSourceBucketsById, getSourceEntryCount, getSourceFilesById, sourceFileRegistry } from '@/data/sourceFiles/registry';

export const mergeCollectionsById = <T extends { id: string }>(baseEntries: T[], importedEntries: T[]) => {
  const merged = new Map<string, T>();
  for (const entry of baseEntries) merged.set(entry.id, entry);
  for (const entry of importedEntries) merged.set(entry.id, entry);
  return [...merged.values()];
};

export const getImportedBucket = <K extends Parameters<typeof getSourceBuckets>[0]>(bucket: K) => {
  return getSourceBuckets(bucket) as unknown[];
};
