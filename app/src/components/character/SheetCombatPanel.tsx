// What this character can do on their turn, and what they shrug off.
//
// Both lists come from the character's own features: a feature states when it is used and what it
// protects against, so a sheet that never grouped them was hiding what a player most needs in a
// fight. Nothing here is a fixed list of actions — a feature whose text says nothing about timing
// simply does not appear.
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import {
  ACTION_TIMING_LABELS,
  DEFENCE_KIND_LABELS,
  groupDefences,
  type ActionTiming,
  type DerivedDefence,
  type TimedFeature
} from '@/lib/sheetCombat';

const TIMING_ORDER: ActionTiming[] = ['action', 'bonus-action', 'reaction'];

interface SheetCombatPanelProps {
  readonly timedFeatures: readonly TimedFeature[];
  readonly defences: readonly DerivedDefence[];
}

export function SheetCombatPanel({ timedFeatures, defences }: SheetCombatPanelProps) {
  const byTiming = new Map<ActionTiming, TimedFeature[]>();
  for (const feature of timedFeatures) {
    byTiming.set(feature.timing, [...(byTiming.get(feature.timing) ?? []), feature]);
  }
  const defenceGroups = groupDefences(defences);

  if (timedFeatures.length === 0 && defences.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {timedFeatures.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Your Turn</CardTitle>
            <CardDescription>Features grouped by when their own text says you use them.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {TIMING_ORDER.map((timing) => {
              const entries = byTiming.get(timing) ?? [];
              if (entries.length === 0) return null;

              return (
                <div key={timing}>
                  <h4 className="mb-1 text-sm font-medium text-muted-foreground">{ACTION_TIMING_LABELS[timing]}</h4>
                  <Accordion type="multiple" className="w-full">
                    {entries.map((entry) => (
                      <AccordionItem key={entry.id} value={entry.id}>
                        <AccordionTrigger className="py-2 text-left">{entry.name}</AccordionTrigger>
                        <AccordionContent>
                          <p className="text-sm text-muted-foreground">
                            <ContentReferenceText text={entry.description} />
                          </p>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {defences.length > 0 ? (
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
      ) : null}
    </div>
  );
}
