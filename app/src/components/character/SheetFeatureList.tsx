// Features as a player reads them at the table: the name and level in the row, the text behind a
// disclosure, and — the part that used to be missing entirely — the options this character chose.
//
// A feature that offers options is only a sentence about a list until the picks are shown beside
// it, which is why the two Eldritch Invocations a warlock chose appear as their own entries here
// rather than being buried in the builder.
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { getChosenFeatureOptions } from '@/lib/featureOptions';
import type { CharacterFeatureSelection, Feature } from '@/types/dnd';

interface SheetFeatureListProps {
  readonly features: readonly Feature[];
  readonly selections: CharacterFeatureSelection[] | undefined;
  /** Distinguishes the accordion values when a sheet renders several of these lists. */
  readonly idPrefix: string;
  readonly emptyMessage?: string;
}

export function SheetFeatureList({ features, selections, idPrefix, emptyMessage }: SheetFeatureListProps) {
  if (features.length === 0) {
    return emptyMessage ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null;
  }

  return (
    <Accordion type="multiple" className="w-full">
      {features.map((feature) => {
        const chosen = getChosenFeatureOptions(feature, selections);
        const outstanding = Math.max(0, (feature.chooseCount ?? 0) - chosen.length);

        return (
          <AccordionItem key={feature.id} value={`${idPrefix}-${feature.id}`}>
            <AccordionTrigger>
              <div className="flex flex-wrap items-center gap-2 pr-2 text-left">
                <span className="font-medium">{feature.name}</span>
                <Badge variant="secondary">Level {feature.level}</Badge>
                {chosen.map((option) => (
                  <Badge key={option.id} variant="outline">{option.name}</Badge>
                ))}
                {outstanding > 0 ? <Badge>{outstanding} to choose</Badge> : null}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                <ContentReferenceText text={feature.description} />
              </p>
              {chosen.map((option) => (
                <div key={option.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">{option.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <ContentReferenceText text={option.description} />
                  </p>
                </div>
              ))}
              {outstanding > 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  {outstanding === 1
                    ? 'One option for this feature has not been chosen yet.'
                    : `${outstanding} options for this feature have not been chosen yet.`}
                </p>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
