import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Frame,
  Hand,
  Image,
  Link2,
  Maximize,
  MousePointer2,
  Minus,
  Plus,
  Redo2,
  StickyNote,
  Trash2,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { BackpackEdges } from '@/components/kob/BackpackEdges';
import { BackpackNode } from '@/components/kob/BackpackNode';
import { useCanvasHistory } from '@/components/kob/useCanvasHistory';
import { useCanvasViewport } from '@/components/kob/useCanvasViewport';
import { GROUP_COLORS } from '@/lib/groupColors';
import {
  anchorOf,
  boundsOf,
  createEdge,
  createNode,
  edgePath,
  inPaintOrder,
  marqueeBox,
  nodesInGroup,
  nodeAtPoint,
  nodesTouching,
  prepareInlineImage,
  readCanvas,
  sideFacing,
} from '@/lib/kob/backpackCanvas';
import { cn } from '@/lib/utils';
import type {
  KobBackpackCanvas,
  KobBackpackNode,
  KobBackpackNodeKind,
  KobBackpackSide,
} from '@/types/kob';

interface BackpackCanvasDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The document's own field, read and normalised here so the memo below keys on it. */
  readonly canvas: KobBackpackCanvas | undefined;
  readonly onChange: (canvas: KobBackpackCanvas) => void;
  /** The book's own line under Backpack, printed once above the board. */
  readonly prompt?: string;
  readonly readOnly?: boolean;
}

interface Drag {
  kind: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  /** Every card this drag moves, and where each one started. */
  origins: Map<string, { x: number; y: number; width: number; height: number }>;
  resizing: string | null;
}

/** An arrow being pulled out of a card's border, before it has landed on anything. */
interface Connecting {
  pointerId: number;
  from: string;
  fromSide: KobBackpackSide;
  to: { x: number; y: number };
}

interface Marquee {
  pointerId: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** The selection to add to, when the drag started with shift held. */
  base: string[];
}

const ADD_BUTTONS: ReadonlyArray<{ kind: KobBackpackNodeKind; label: string; icon: typeof StickyNote }> = [
  { kind: 'note', label: 'Note', icon: StickyNote },
  { kind: 'link', label: 'Link', icon: Link2 },
  { kind: 'media', label: 'Picture', icon: Image },
  { kind: 'group', label: 'Frame', icon: Frame },
];

/**
 * The backpack as a board rather than a paragraph.
 *
 * "What items are you never without? The backpack is also a good place to list advantages that you
 * have over other people and the more intangible resources you have at your disposal." — a list of
 * things, some of which are pictures, which is what this is for.
 *
 * A picture is either a link or a file re-encoded small enough to hold inline in the character
 * document; the caps live in `lib/kob/backpackCanvas.ts` and the reason they exist is that the
 * document is one JSON blob.
 */
export function BackpackCanvasDialog(props: Readonly<BackpackCanvasDialogProps>) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-3 overflow-hidden">
        {props.open ? <Board {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function Board({ canvas, onChange, prompt, readOnly = false }: Readonly<BackpackCanvasDialogProps>) {
  const surface = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const { viewport, toBoard, onPointerDown, onPointerMove, onPointerUp, onWheel, zoomBy, frame } =
    useCanvasViewport(surface);

  // Memoized on the document's own value: `readCanvas` rebuilds both arrays, and everything below
  // keys its memoization on the board's identity.
  const board = useMemo(() => readCanvas(canvas), [canvas]);
  const nodes = board.nodes;
  const edges = board.edges ?? [];
  const history = useCanvasHistory(board, onChange);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  /** Pan is the default so a one-finger drag still moves the board, as it always has. */
  const [tool, setTool] = useState<'pan' | 'select'>('pan');
  const [connecting, setConnecting] = useState<Connecting | null>(null);
  const [marquee, setMarquee] = useState<Marquee | null>(null);

  const drag = useRef<Drag | null>(null);

  const selected = nodes.filter((node) => selectedIds.includes(node.id));
  const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId) ?? null;

  // One framing when the board opens. Doing it from a layout effect on every change would fight
  // the player's own panning, which is the whole interaction here.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current) return;
    framed.current = true;
    frame(boundsOf({ nodes }));
  }, [frame, nodes]);

  const commit = useCallback(
    (next: Partial<KobBackpackCanvas>, coalesceKey?: string) =>
      history.commit({ nodes: board.nodes, edges: board.edges ?? [], ...next }, coalesceKey),
    [board, history],
  );

  const patchNode = useCallback(
    (id: string, patch: Partial<KobBackpackNode>) =>
      commit(
        { nodes: board.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)) },
        `node:${id}`,
      ),
    [board, commit],
  );

  const removeSelection = useCallback(() => {
    if (selectedEdgeId) {
      commit({ edges: (board.edges ?? []).filter((edge) => edge.id !== selectedEdgeId) });
      setSelectedEdgeId(null);
      return;
    }
    if (selectedIds.length === 0) return;
    const gone = new Set(selectedIds);
    commit({
      nodes: board.nodes.filter((node) => !gone.has(node.id)),
      edges: (board.edges ?? []).filter((edge) => !gone.has(edge.from) && !gone.has(edge.to)),
    });
    setSelectedIds([]);
  }, [board, commit, selectedEdgeId, selectedIds]);

  useCanvasShortcuts({ readOnly, history, onDelete: removeSelection });

  const addNode = (kind: KobBackpackNodeKind, at?: { x: number; y: number }) => {
    const centre = at ?? centreOf(surface, toBoard);
    const node = createNode(kind, centre);
    commit({ nodes: [...board.nodes, node] });
    setSelectedIds([node.id]);
    setSelectedEdgeId(null);
  };

  const addFiles = async (files: FileList | null, at?: { x: number; y: number }) => {
    for (const file of Array.from(files ?? [])) {
      const prepared = await prepareInlineImage(file, board);
      if (!prepared.ok) {
        toast.error(prepared.reason);
        continue;
      }
      const node = createNode('media', at ?? centreOf(surface, toBoard));
      node.src = prepared.src;
      node.text = file.name.replace(/\.[^.]+$/, '');
      commit({ nodes: [...board.nodes, node] });
      setSelectedIds([node.id]);
    }
  };

  /**
   * Select a card, or add it to the selection when shift is held. A drag then moves everything
   * selected, which is what makes a marquee worth having.
   */
  const selectNode = (node: KobBackpackNode) => (event: React.PointerEvent) => {
    setSelectedEdgeId(null);
    setSelectedIds((current) => {
      if (!event.shiftKey) return current.includes(node.id) ? current : [node.id];
      return current.includes(node.id) ? current.filter((id) => id !== node.id) : [...current, node.id];
    });
  };

  const startDrag = (node: KobBackpackNode, kind: Drag['kind']) => (event: React.PointerEvent) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedEdgeId(null);

    const moving = movingWith(node, selectedIds, board.nodes, kind);
    if (kind === 'move') setSelectedIds((current) => (current.includes(node.id) ? current : [node.id]));

    const origins = new Map(
      board.nodes
        .filter((one) => moving.has(one.id))
        .map((one) => [one.id, { x: one.x, y: one.y, width: one.width, height: one.height }]),
    );
    drag.current = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origins,
      resizing: kind === 'resize' ? node.id : null,
    };
    // One history entry for the whole gesture: the canvas as it was before the first frame.
    history.commit(board);
    history.seal();
  };

  const moveDrag = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = (event.clientX - current.startX) / viewport.scale;
    const dy = (event.clientY - current.startY) / viewport.scale;

    history.replace({
      nodes: board.nodes.map((node) => {
        const origin = current.origins.get(node.id);
        if (!origin) return node;
        if (current.kind === 'move' || node.id !== current.resizing) {
          return { ...node, x: Math.round(origin.x + dx), y: Math.round(origin.y + dy) };
        }
        return {
          ...node,
          width: Math.max(120, Math.round(origin.width + dx)),
          height: Math.max(80, Math.round(origin.height + dy)),
        };
      }),
      edges: board.edges ?? [],
    });
  };

  const startConnect = (node: KobBackpackNode) => (side: KobBackpackSide, event: React.PointerEvent) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setConnecting({ pointerId: event.pointerId, from: node.id, fromSide: side, to: anchorOf(node, side) });
  };

  const moveConnect = (event: React.PointerEvent) => {
    setConnecting((current) => {
      if (!current || current.pointerId !== event.pointerId) return current;
      return { ...current, to: toBoard(event.clientX, event.clientY) };
    });
  };

  /** An arrow lands on whatever card is under the finger when it lifts, not on a drop target. */
  const endConnect = (event: React.PointerEvent) => {
    const current = connecting;
    if (!current || current.pointerId !== event.pointerId) return;
    setConnecting(null);

    const to = nodeAtPoint(toBoard(event.clientX, event.clientY), board.nodes);
    const from = board.nodes.find((node) => node.id === current.from);
    if (!to || !from || to.id === from.id) return;

    const toSide = sideFacing(to, anchorOf(from, current.fromSide));
    commit({ edges: [...(board.edges ?? []), createEdge(from.id, to.id, current.fromSide, toSide)] });
  };

  const surfacePointerDown = (event: React.PointerEvent) => {
    setSelectedEdgeId(null);
    // Shift-drag marquees whatever the tool is, because that is the mouse shorthand for it; the
    // toggle is how the same thing is reached with a thumb, which has no shift key.
    if (!readOnly && (tool === 'select' || event.shiftKey) && event.isPrimary) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const at = toBoard(event.clientX, event.clientY);
      setMarquee({ pointerId: event.pointerId, from: at, to: at, base: event.shiftKey ? selectedIds : [] });
      return;
    }
    setSelectedIds([]);
    onPointerDown(event);
  };

  const surfacePointerMove = (event: React.PointerEvent) => {
    if (marquee?.pointerId === event.pointerId) {
      setMarquee({ ...marquee, to: toBoard(event.clientX, event.clientY) });
      return;
    }
    moveDrag(event);
    moveConnect(event);
    onPointerMove(event);
  };

  const surfacePointerUp = (event: React.PointerEvent) => {
    if (marquee?.pointerId === event.pointerId) {
      const box = marqueeBox(marquee.from, marquee.to);
      const hit = nodesTouching(box, board.nodes);
      setSelectedIds([...new Set([...marquee.base, ...hit])]);
      setMarquee(null);
      return;
    }
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
    endConnect(event);
    onPointerUp(event);
  };

  const pending = connecting
    ? {
        path: pendingPath(board.nodes, connecting),
      }
    : null;
  const box = marquee ? marqueeBox(marquee.from, marquee.to) : null;

  return (
    <>
      <DialogHeader className="shrink-0">
        <DialogTitle>Backpack</DialogTitle>
        {prompt ? <DialogDescription className="max-w-prose">{prompt}</DialogDescription> : null}
      </DialogHeader>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {readOnly ? null : (
          <>
            {ADD_BUTTONS.map(({ kind, label, icon: Icon }) => (
              <Button key={kind} size="sm" variant="outline" className="min-h-11" onClick={() => addNode(kind)}>
                <Icon className="size-4" />
                {label}
              </Button>
            ))}
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => fileInput.current?.click()}>
              <Image className="size-4" />
              Upload
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              <ToolButton active={tool === 'pan'} label="Drag to move the board" onClick={() => setTool('pan')}>
                <Hand className="size-4" />
              </ToolButton>
              <ToolButton active={tool === 'select'} label="Drag to select cards" onClick={() => setTool('select')}>
                <MousePointer2 className="size-4" />
              </ToolButton>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Undo"
              disabled={!history.canUndo}
              onClick={history.undo}
            >
              <Undo2 className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Redo"
              disabled={!history.canRedo}
              onClick={history.redo}
            >
              <Redo2 className="size-4" />
            </Button>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
            <Minus className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs text-muted-foreground">
            {Math.round(viewport.scale * 100)}%
          </span>
          <Button size="icon" variant="ghost" aria-label="Zoom in" onClick={() => zoomBy(1.2)}>
            <Plus className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Fit the board"
            onClick={() => frame(boundsOf({ nodes }))}
          >
            <Maximize className="size-4" />
          </Button>
        </div>
      </div>

      {readOnly ? null : (
        <SelectionBar
          selected={selected}
          edge={selectedEdge}
          onColour={(color) => {
            if (selectedEdge) {
              commit({ edges: (board.edges ?? []).map((one) => (one.id === selectedEdge.id ? { ...one, color } : one)) });
              return;
            }
            const ids = new Set(selectedIds);
            commit({ nodes: board.nodes.map((node) => (ids.has(node.id) ? { ...node, color } : node)) });
          }}
          onLabel={(label) => {
            if (!selectedEdge) return;
            commit(
              { edges: (board.edges ?? []).map((one) => (one.id === selectedEdge.id ? { ...one, label } : one)) },
              `edge:${selectedEdge.id}`,
            );
          }}
          onDelete={removeSelection}
        />
      )}

      {/* touch-none: without it a drag across the board scrolls the dialog instead of panning. */}
      <div
        ref={surface}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden rounded-lg border bg-muted/20',
          tool === 'select' && !readOnly && 'cursor-crosshair',
        )}
        onPointerDown={surfacePointerDown}
        onPointerMove={surfacePointerMove}
        onPointerUp={surfacePointerUp}
        onPointerCancel={surfacePointerUp}
        onWheel={onWheel}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (readOnly) return;
          void addFiles(event.dataTransfer.files, toBoard(event.clientX, event.clientY));
        }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})` }}
        >
          <BackpackEdges
            nodes={nodes}
            edges={edges}
            selectedId={selectedEdgeId}
            readOnly={readOnly}
            pending={pending}
            onSelect={(id) => {
              setSelectedEdgeId(id);
              setSelectedIds([]);
            }}
          />
          {inPaintOrder(nodes).map((node) => (
            <BackpackNode
              key={node.id}
              node={node}
              selected={selectedIds.includes(node.id)}
              readOnly={readOnly}
              onSelect={selectNode(node)}
              onChange={(patch) => patchNode(node.id, patch)}
              onRemove={() => {
                setSelectedIds([node.id]);
                commit({
                  nodes: board.nodes.filter((other) => other.id !== node.id),
                  edges: (board.edges ?? []).filter((edge) => edge.from !== node.id && edge.to !== node.id),
                });
                setSelectedIds([]);
              }}
              onDragStart={startDrag(node, 'move')}
              onResizeStart={startDrag(node, 'resize')}
              onConnectStart={startConnect(node)}
            />
          ))}
          {box ? (
            <div
              className="pointer-events-none absolute border-2 border-primary bg-primary/10"
              style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
            />
          ) : null}
        </div>

        {nodes.length === 0 ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
            {readOnly ? 'Nothing in the backpack yet.' : 'Add a note, a link or a picture. Drag a picture onto the board to drop it in.'}
          </p>
        ) : null}
      </div>
    </>
  );
}

function ToolButton({
  active,
  label,
  onClick,
  children,
}: Readonly<{ active: boolean; label: string; onClick: () => void; children: React.ReactNode }>) {
  return (
    <Button
      size="icon"
      variant={active ? 'secondary' : 'ghost'}
      className="size-9"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

interface SelectionBarProps {
  readonly selected: KobBackpackNode[];
  readonly edge: { id: string; label: string; color: string | null } | null;
  readonly onColour: (color: string | null) => void;
  readonly onLabel: (label: string) => void;
  readonly onDelete: () => void;
}

/** What can be done to whatever is selected: the colour, an arrow's caption, and Delete. */
function SelectionBar({ selected, edge, onColour, onLabel, onDelete }: SelectionBarProps) {
  if (selected.length === 0 && !edge) return null;
  const colour = edge ? edge.color : selected[0]?.color ?? null;
  const count = selected.length;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {edge ? 'Arrow' : `${count} selected`}
      </span>
      {edge ? (
        <Input
          value={edge.label}
          placeholder="Say what this arrow means"
          className="h-9 w-56 text-sm"
          onChange={(event) => onLabel(event.target.value)}
        />
      ) : null}
      <button
        type="button"
        aria-label="No colour"
        className={cn('size-8 rounded-full border-2 bg-muted', colour === null ? 'border-foreground' : 'border-transparent')}
        onClick={() => onColour(null)}
      />
      {GROUP_COLORS.map((color) => (
        <button
          key={color.key}
          type="button"
          aria-label={color.label}
          className={cn('size-8 rounded-full border-2', color.swatch, colour === color.key ? 'border-foreground' : 'border-transparent')}
          onClick={() => onColour(color.key)}
        />
      ))}
      <Button size="sm" variant="ghost" className="ml-auto min-h-11" onClick={onDelete}>
        <Trash2 className="size-4 text-destructive" />
        Delete
      </Button>
    </div>
  );
}

/**
 * Ctrl+Z, Ctrl+Shift+Z and Delete, ignored while a field has focus so undoing a typo in a note
 * stays the textarea's own job.
 */
function useCanvasShortcuts({
  readOnly,
  history,
  onDelete,
}: Readonly<{ readOnly: boolean; history: { undo: () => void; redo: () => void }; onDelete: () => void }>) {
  useEffect(() => {
    if (readOnly) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (typing) return;
        event.preventDefault();
        onDelete();
        return;
      }
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      if (typing) return;
      event.preventDefault();
      if (event.shiftKey) history.redo();
      else history.undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history, onDelete, readOnly]);
}

/**
 * The cards one drag moves: the whole selection when the grabbed card is part of it, a frame's
 * contents when a frame is grabbed, and otherwise just the card itself. A resize never moves more
 * than the one card it was started on.
 */
function movingWith(
  node: KobBackpackNode,
  selectedIds: string[],
  nodes: KobBackpackNode[],
  kind: Drag['kind'],
): Set<string> {
  if (kind === 'resize') return new Set([node.id]);
  const moving = new Set(selectedIds.includes(node.id) ? selectedIds : [node.id]);
  for (const id of [...moving]) {
    const one = nodes.find((candidate) => candidate.id === id);
    if (one?.kind === 'group') for (const inside of nodesInGroup(one, nodes)) moving.add(inside);
  }
  return moving;
}

function pendingPath(nodes: KobBackpackNode[], connecting: Connecting): string {
  const from = nodes.find((node) => node.id === connecting.from);
  if (!from) return '';
  const start = anchorOf(from, connecting.fromSide);
  return edgePath(start, connecting.fromSide, connecting.to, sideFacing(from, connecting.to) === 'right' ? 'left' : 'right');
}

function centreOf(
  surface: React.RefObject<HTMLDivElement | null>,
  toBoard: (clientX: number, clientY: number) => { x: number; y: number },
) {
  const rect = surface.current?.getBoundingClientRect();
  return toBoard((rect?.left ?? 0) + (rect?.width ?? 0) / 2, (rect?.top ?? 0) + (rect?.height ?? 0) / 2);
}
