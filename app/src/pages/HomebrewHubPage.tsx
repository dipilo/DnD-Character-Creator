import { Link } from 'react-router-dom';
import { contentBucketKeys } from '@/lib/canonicalContent';
import { useContentStore } from '@/store/contentStore';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HomebrewWorkbench } from '@/components/homebrew/HomebrewWorkbench';
import { Download, Sword } from 'lucide-react';

export function HomebrewHubPage() {
  const homebrewLibrary = useContentStore((state) => state.homebrewLibrary);
  const exportHomebrewPack = useContentStore((state) => state.exportHomebrewPack);

  const totalHomebrewEntries = contentBucketKeys.reduce((total, bucket) => {
    return total + homebrewLibrary[bucket].length;
  }, 0);

  const downloadHomebrewPack = () => {
    const pack = exportHomebrewPack('Homebrew Library');
    const blob = new Blob([`${JSON.stringify(pack, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'homebrew-library.canonical.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Homebrew</h1>
          <p className="text-muted-foreground">
            Make your own content. Everything you save here is available to the character builder.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/builder">
            <Button variant="outline" className="gap-2">
              <Sword className="h-4 w-4" />
              Open Builder
            </Button>
          </Link>
          <Button variant="outline" className="gap-2" onClick={downloadHomebrewPack} disabled={totalHomebrewEntries === 0}>
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
        </div>
      </section>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Library</CardTitle>
          <CardDescription>
            {totalHomebrewEntries === 0
              ? 'No homebrew entries yet. Create one below to add it to your library.'
              : `${totalHomebrewEntries} homebrew ${totalHomebrewEntries === 1 ? 'entry' : 'entries'} in your library.`}
          </CardDescription>
        </CardHeader>
      </Card>

      <HomebrewWorkbench />
    </div>
  );
}