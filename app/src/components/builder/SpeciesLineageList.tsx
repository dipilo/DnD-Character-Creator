import { Fragment } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, ChevronRight } from 'lucide-react';
import type { SpeciesLineageNode } from '@/lib/speciesGroups';

interface SpeciesLineageListProps {
  nodes: SpeciesLineageNode[];
  selectedSpeciesId?: string;
  selectedVariantId?: string;
  onSelect: (node: SpeciesLineageNode) => void;
  onShowDetails?: (node: SpeciesLineageNode) => void;
}

const isSelected = (node: SpeciesLineageNode, speciesId?: string, variantId?: string) => {
  if (node.variant) return node.owner?.id === speciesId && node.variant.id === variantId;
  return Boolean(node.species) && node.species?.id === speciesId && !variantId;
};

/**
 * A branch is a heading the book prints over its lineages — Fizban's "Chromatic" leaves the damage
 * type unchosen — so it is not offered as a pick; the lineages under it are.
 */
export function SpeciesLineageList({
  nodes,
  selectedSpeciesId,
  selectedVariantId,
  onSelect,
  onShowDetails
}: SpeciesLineageListProps) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => {
        const branch = node.children.length > 0;
        const selected = isSelected(node, selectedSpeciesId, selectedVariantId);

        return (
          <Fragment key={node.key}>
            <li>
              {branch ? (
                <div className="flex items-center gap-2 px-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {node.name}
                  <Badge variant="outline" className="text-[0.65rem]">{node.children.length}</Badge>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant={selected ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 flex-1 justify-start gap-2 px-2 text-left"
                    onClick={() => onSelect(node)}
                  >
                    {selected && <Check className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{node.name}</span>
                  </Button>
                  {onShowDetails && node.species && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-muted-foreground"
                      aria-label={`${node.name} details`}
                      onClick={() => onShowDetails(node)}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </li>
            {branch && (
              <li className="ml-3 border-l pl-2">
                <SpeciesLineageList
                  nodes={node.children}
                  selectedSpeciesId={selectedSpeciesId}
                  selectedVariantId={selectedVariantId}
                  onSelect={onSelect}
                  onShowDetails={onShowDetails}
                />
              </li>
            )}
          </Fragment>
        );
      })}
    </ul>
  );
}
