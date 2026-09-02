import { anchorOf, edgePath } from '@/lib/kob/backpackCanvas';
import { groupColor } from '@/lib/groupColors';
import type { KobBackpackEdge, KobBackpackNode } from '@/types/kob';

interface BackpackEdgesProps {
  readonly nodes: KobBackpackNode[];
  readonly edges: KobBackpackEdge[];
  readonly selectedId: string | null;
  readonly readOnly: boolean;
  readonly onSelect: (id: string) => void;
  /** The arrow being dragged out of an anchor, before it has landed on anything. */
  readonly pending: { path: string } | null;
}

/**
 * Every arrow on the board, in one SVG behind the cards.
 *
 * It is drawn in board coordinates inside the same transformed layer the cards live in, so the
 * viewport's pan and zoom apply to it for free and no line has to be re-projected on a drag.
 */
export function BackpackEdges({ nodes, edges, selectedId, readOnly, onSelect, pending }: BackpackEdgesProps) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const drawn = edges
    .map((edge) => {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      if (!from || !to) return null;
      return { edge, d: edgePath(anchorOf(from, edge.fromSide), edge.fromSide, anchorOf(to, edge.toSide), edge.toSide) };
    })
    .filter((one): one is { edge: KobBackpackEdge; d: string } => one !== null);

  return (
    <svg className="pointer-events-none absolute overflow-visible" width={1} height={1} aria-hidden="true">
      <defs>
        <marker id="backpack-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      {drawn.map(({ edge, d }) => {
        const color = groupColor(edge.color);
        const selected = edge.id === selectedId;
        return (
          <g key={edge.id} className={color?.text ?? 'text-muted-foreground'}>
            {/* A 2px curve is not a target anyone can hit; this invisible one is 18px wide. */}
            {readOnly ? null : (
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={18}
                className="pointer-events-auto cursor-pointer"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onSelect(edge.id);
                }}
              />
            )}
            <path
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={selected ? 3 : 2}
              strokeLinecap="round"
              markerEnd="url(#backpack-arrow)"
              opacity={selected ? 1 : 0.75}
            />
          </g>
        );
      })}
      {pending ? (
        <path
          d={pending.path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeDasharray="6 4"
          className="text-primary"
          markerEnd="url(#backpack-arrow)"
        />
      ) : null}
    </svg>
  );
}
