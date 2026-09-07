// Features as a player reads them at the table: the name and level in the row, the text behind a
// disclosure, the options this character chose — and, where the feature can actually be used, the
// control that uses it.
//
// A feature that offers options is only a sentence about a list until the picks are shown beside
// it, which is why the two Eldritch Invocations a warlock chose appear as their own entries here
// rather than being buried in the builder. The same argument applies to a feature that spends a
// pool or throws dice: reading "you can expend one use" beside a counter you have to find on
// another tab is the thing this list used to make a player do.
//
// Nothing here decides *what* a feature does. The pool is the class table's (`ResolvedClassResource`)
// and the dice are the feature's own sentence, so a feature that states neither simply reads.
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { ContentReferenceText } from '@/components/ContentReferenceText';
import { SheetResourceControl } from '@/components/character/SheetResourceControl';
import { getChosenFeatureOptions } from '@/lib/featureOptions';
import { setClassResourceUsed, toggleResourceActive, type ResolvedClassResource } from '@/lib/sheetPlayState';
import { rollOnScreen } from '@/store/diceTrayStore';
import type { Character, CharacterFeatureSelection, Feature } from '@/types/dnd';

const FEATURE_DICE_PATTERN = /\b(\d+d\d+)\b/;

interface SheetFeatureListProps {
  readonly features: readonly Feature[];
  readonly selections: CharacterFeatureSelection[] | undefined;
  /** Distinguishes the accordion values when a sheet renders several of these lists. */
  readonly idPrefix: string;
  readonly emptyMessage?: string;
  /**
   * What this character can spend, so a feature that owns a pool gets its counter here. Omitted
   * where the list is not about a character — the builder's previews, for instance.
   */
  readonly character?: Character;
  readonly classResources?: readonly ResolvedClassResource[];
  /** Absent on a read-only sheet, which is what leaves the counts and takes the buttons. */
  readonly onChange?: (patch: Partial<Character>) => void;
}

export function SheetFeatureList({
  features,
  selections,
  idPrefix,
  emptyMessage,
  character,
  classResources,
  onChange
}: SheetFeatureListProps) {
  if (features.length === 0) {
    return emptyMessage ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : null;
  }

  return (
    <Accordion type="multiple" className="w-full">
      {features.map((feature) => {
        const chosen = getChosenFeatureOptions(feature, selections);
        const outstanding = Math.max(0, (feature.chooseCount ?? 0) - chosen.length);
        const resource = classResources?.find((entry) => entry.featureName === feature.name);
        const dice = FEATURE_DICE_PATTERN.exec(feature.description)?.[1];

        return (
          <AccordionItem key={feature.id} value={`${idPrefix}-${feature.id}`}>
            {/* The controls sit beside the trigger rather than inside it: a press on Enter Rage
                must not also open the feature it is on. */}
            <div className="flex flex-wrap items-center gap-x-3">
              <AccordionTrigger className="min-w-[11rem] flex-1">
                <div className="flex flex-wrap items-center gap-2 pr-2 text-left">
                  <span className="font-medium">{feature.name}</span>
                  <Badge variant="secondary">Level {feature.level}</Badge>
                  {chosen.map((option) => (
                    <Badge key={option.id} variant="outline">{option.name}</Badge>
                  ))}
                  {outstanding > 0 ? <Badge>{outstanding} to choose</Badge> : null}
                </div>
              </AccordionTrigger>
              <div className="flex shrink-0 flex-wrap items-center gap-2 py-2">
                {/* Rolling changes nothing about the character, so a shared sheet keeps this. */}
                {dice ? (
                  <button
                    type="button"
                    className="min-h-9 rounded px-2 text-sm font-semibold tabular-nums transition-colors hover:bg-accent coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    onClick={() => void rollOnScreen({ notation: dice, label: feature.name, detail: dice })}
                  >
                    {dice}
                  </button>
                ) : null}
                {resource && character ? (
                  <SheetResourceControl
                    resource={resource}
                    onSetUsed={onChange ? (next) => onChange(setClassResourceUsed(character, resource, next)) : undefined}
                    onToggleActive={onChange ? () => onChange(toggleResourceActive(character, resource)) : undefined}
                  />
                ) : null}
              </div>
            </div>
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
