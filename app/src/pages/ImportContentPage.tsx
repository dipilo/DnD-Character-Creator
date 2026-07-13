import { useState } from 'react';
import { canonicalSourcePackageSchema, countCanonicalPackEntries, summarizeCanonicalPack } from '@/lib/canonicalContent';
import { useContentStore } from '@/store/contentStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { contentSourceManifest, getBundledSourceEntryCount, getStaticSourceEntryCount, sourceFileRegistry } from '@/data';
import type { CanonicalSourcePackage } from '@/lib/canonicalContent';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';

export function ImportContentPage() {
  const importedPacks = useContentStore((state) => state.importedPacks);
  const importCanonicalPack = useContentStore((state) => state.importCanonicalPack);
  const removeImportedPack = useContentStore((state) => state.removeImportedPack);
  const clearImportedPacks = useContentStore((state) => state.clearImportedPacks);
  const registeredSourceCount = sourceFileRegistry.length;
  const [importError, setImportError] = useState<string | null>(null);

  const downloadCanonicalJson = (pack: CanonicalSourcePackage) => {
    const blob = new Blob([`${JSON.stringify(pack, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${pack.source.sourceId}.canonical.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setImportError(null);

    for (const file of files) {
      try {
        const text = await file.text();
        const parsedJson = JSON.parse(text);
        const result = canonicalSourcePackageSchema.safeParse(parsedJson);
        if (!result.success) {
          throw new Error(result.error.issues[0]?.message ?? 'Invalid canonical JSON package.');
        }

        importCanonicalPack(result.data);
        toast.success(`Imported ${result.data.source.label}.`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to import JSON package.';
        setImportError(message);
        toast.error(message);
      }
    }

    event.target.value = '';
  };

  return (
    <div className="space-y-8">
      <section className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Import Content</h1>
        <p className="text-muted-foreground">
          Load source books into your library from canonical JSON, or generate bundled modules with the workspace CLI.
        </p>
      </section>

      <Card>
        <CardHeader>
          <Upload className="mb-2 h-7 w-7 text-primary" />
          <CardTitle>Import canonical JSON</CardTitle>
          <CardDescription>Imported packs persist in this browser and merge into the builder&apos;s content library.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <Input type="file" accept=".json,application/json" multiple onChange={handleImportFiles} />
          {importError && <p className="text-sm text-destructive">{importError}</p>}
          <div className="space-y-2">
            <p>Or convert a raw source document to canonical JSON from the command line:</p>
            <div className="overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs text-foreground">
              npm run import:source -- --document ./XantharsGuideToEverything.txt --id xanathars --label &quot;Xanathar&apos;s Guide to Everything&quot; --category supplement
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Imported Packs</h2>
            <p className="text-sm text-muted-foreground">
              {importedPacks.length} {importedPacks.length === 1 ? 'pack' : 'packs'} persisted in browser storage.
            </p>
          </div>
          {importedPacks.length > 0 && (
            <Button variant="outline" onClick={clearImportedPacks}>Clear All</Button>
          )}
        </div>

        {importedPacks.length > 0 ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {importedPacks.map((pack) => (
              <Card key={pack.source.sourceId}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{pack.source.label}</CardTitle>
                      <CardDescription>
                        {countCanonicalPackEntries(pack)} entries, {pack.sections.length} sections, {pack.documents.length} documents
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{pack.source.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex flex-wrap gap-2">
                    {summarizeCanonicalPack(pack).map(({ bucket, count }) => (
                      <Badge key={bucket} variant="secondary">{bucket}: {count}</Badge>
                    ))}
                  </div>
                  {pack.notes.length > 0 && <p>{pack.notes[0]}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => downloadCanonicalJson(pack)}>Export JSON</Button>
                    <Button size="sm" variant="destructive" onClick={() => removeImportedPack(pack.source.sourceId)}>Remove</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No imported packs yet. Drop a canonical JSON file above to add one.
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Bundled Sources</h2>
          <p className="text-sm text-muted-foreground">
            {registeredSourceCount} source modules are compiled into this build.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contentSourceManifest.map((source) => {
            const entryCount = getBundledSourceEntryCount(source.id);
            const staticCount = getStaticSourceEntryCount(source.id);
            const staticCountNote = staticCount > 0 ? `${staticCount} built-in` : undefined;

            return (
              <Card key={source.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">{source.label}</CardTitle>
                      {source.description && <CardDescription>{source.description}</CardDescription>}
                    </div>
                    <Badge variant="outline">{source.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Source ID</span>
                    <span className="font-mono text-xs text-foreground">{source.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Bundled entries</span>
                    <span className="flex items-center gap-2">
                      {staticCountNote && <span className="text-xs">{staticCountNote}</span>}
                      <Badge variant={entryCount > 0 ? 'default' : 'secondary'}>
                        {entryCount > 0 ? entryCount : 'None'}
                      </Badge>
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
