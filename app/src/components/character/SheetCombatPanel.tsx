// Read from the features held, so nothing here names a class, species or feat.
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFENCE_KIND_LABELS, groupDefences, type DerivedDefence } from '@/lib/sheetCombat';

export function SheetDefencesCard({ defences }: Readonly<{ defences: readonly DerivedDefence[] }>) {
  if (defences.length === 0) {
    return null;
  }

  const defenceGroups = groupDefences(defences);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Defenses</CardTitle>
        <CardDescription>
          A defense marked with its feature applies only while that feature does.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {[...defenceGroups.entries()].map(([kind, entries]) => (
          <div key={kind}>
            <h4 className="mb-1 text-sm font-medium text-muted-foreground">{DEFENCE_KIND_LABELS[kind]}</h4>
            <div className="flex flex-wrap gap-2">
              {entries.map((entry) => (
                <Badge key={`${entry.source}-${entry.names.join('-')}`} variant={entry.conditional ? 'outline' : 'secondary'}>
                  {entry.names.join(', ')} · {entry.source}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
