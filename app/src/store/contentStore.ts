import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ImportedContentBucket } from '@/data/librarySources';
import {
  canonicalSourcePackageSchema,
  createEmptyImportedContentBucket,
  createHomebrewSourcePackage,
  type CanonicalSourcePackage,
  type ContentBucketKey
} from '@/lib/canonicalContent';

type BucketEntry<K extends ContentBucketKey> = ImportedContentBucket[K][number];

interface ContentState {
  importedPacks: CanonicalSourcePackage[];
  homebrewLibrary: ImportedContentBucket;
  importCanonicalPack: (pack: CanonicalSourcePackage) => void;
  removeImportedPack: (sourceId: string) => void;
  clearImportedPacks: () => void;
  upsertHomebrewEntry: <K extends ContentBucketKey>(bucket: K, entry: BucketEntry<K>) => void;
  removeHomebrewEntry: <K extends ContentBucketKey>(bucket: K, entryId: string) => void;
  exportHomebrewPack: (label?: string) => CanonicalSourcePackage;
}

const upsertEntriesById = <T extends { id: string }>(entries: T[], nextEntry: T) => {
  const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);
  if (existingIndex === -1) {
    return [...entries, nextEntry];
  }

  return entries.map((entry, index) => (index === existingIndex ? nextEntry : entry));
};

export const useContentStore = create<ContentState>()(
  persist(
    (set, get) => ({
      importedPacks: [],
      homebrewLibrary: createEmptyImportedContentBucket(),

      importCanonicalPack: (pack) => {
        const parsed = canonicalSourcePackageSchema.parse(pack);
        set((state) => ({
          importedPacks: [
            ...state.importedPacks.filter((entry) => entry.source.sourceId !== parsed.source.sourceId),
            parsed
          ]
        }));
      },

      removeImportedPack: (sourceId) => {
        set((state) => ({
          importedPacks: state.importedPacks.filter((pack) => pack.source.sourceId !== sourceId)
        }));
      },

      clearImportedPacks: () => {
        set({ importedPacks: [] });
      },

      upsertHomebrewEntry: (bucket, entry) => {
        set((state) => ({
          homebrewLibrary: {
            ...state.homebrewLibrary,
            [bucket]: upsertEntriesById(
              state.homebrewLibrary[bucket] as Array<{ id: string }>,
              entry as { id: string }
            )
          } as ImportedContentBucket
        }));
      },

      removeHomebrewEntry: (bucket, entryId) => {
        set((state) => ({
          homebrewLibrary: {
            ...state.homebrewLibrary,
            [bucket]: state.homebrewLibrary[bucket].filter((entry) => {
              return typeof entry === 'object' && entry !== null && 'id' in entry
                ? entry.id !== entryId
                : true;
            })
          } as ImportedContentBucket
        }));
      },

      exportHomebrewPack: (label = 'Homebrew Library') => {
        const state = get();
        const pack = createHomebrewSourcePackage(label, {
          importedAt: new Date().toISOString()
        });

        return {
          ...pack,
          content: state.homebrewLibrary,
          notes: ['Generated from the in-app homebrew editor.']
        };
      }
    }),
    {
      name: 'dnd-content-library'
    }
  )
);