import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Link2, Maximize, Minus, Plus, StickyNote } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BackpackNode } from '@/components/kob/BackpackNode';
import { useCanvasViewport } from '@/components/kob/useCanvasViewport';
import { GROUP_COLORS } from '@/lib/groupColors';
import {
  boundsOf,
  checkInlineFile,
  createNode,
  readCanvas,
  readFileAsDataUrl,
} from '@/lib/kob/backpackCanvas';
import { cn } from '@/lib/utils';
import type { KobBackpackCanvas, KobBackpackNode, KobBackpackNodeKind } from '@/types/kob';

interface BackpackCanvasDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly canvas: KobBackpackCanvas;
  readonly onChange: (canvas: KobBackpackCanvas) => void;
  /** The book's own line under Backpack, printed once above the board. */
  readonly prompt?: string;
  readonly readOnly?: boolean;
}

interface Drag {
  id: string;
  kind: 'move' | 'resize';
  pointerId: number;
  startX: number;
  startY: number;
  origin: { x: number; y: number; width: number; height: number };
}

const ADD_BUTTONS: ReadonlyArray<{ kind: KobBackpackNodeKind; label: string; icon: typeof StickyNote }> = [
  { kind: 'note', label: 'Note', icon: StickyNote },
  { kind: 'link', label: 'Link', icon: Link2 },
  { kind: 'media', label: 'Picture', icon: Image },
];

/**
 * The backpack as a board rather than a paragraph.
 *
 * "What items are you never without? The backpack is also a good place to list advantages that you
 * have over other people and the more intangible resources you have at your disposal." — a list of
 * things, some of which are pictures, which is what this is for.
 *
 * A picture is either a link or a small file held inline in the character document; the caps live
 * in `lib/kob/backpackCanvas.ts` and the reason they exist is that the document is one JSON blob.
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);

  const nodes = readCanvas(canvas).nodes;
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  // One framing when the board opens. Doing it from a layout effect on every change would fight
  // the player's own panning, which is the whole interaction here.
  const framed = useRef(false);
  useEffect(() => {
    if (framed.current) return;
    framed.current = true;
    frame(boundsOf({ nodes }));
  }, [frame, nodes]);

  const write = useCallback(
    (next: KobBackpackNode[]) => onChange({ nodes: next }),
    [onChange],
  );

  const patchNode = useCallback(
    (id: string, patch: Partial<KobBackpackNode>) =>
      write(nodes.map((node) => (node.id === id ? { ...node, ...patch } : node))),
    [nodes, write],
  );

  const addNode = (kind: KobBackpackNodeKind, at?: { x: number; y: number }) => {
    const rect = surface.current?.getBoundingClientRect();
    const centre = at ?? toBoard(
      (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
      (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
    );
    const node = createNode(kind, centre);
    write([...nodes, node]);
    setSelectedId(node.id);
    return node;
  };

  const addFiles = async (files: FileList | null, at?: { x: number; y: number }) => {
    for (const file of Array.from(files ?? [])) {
      const check = checkInlineFile(file, { nodes });
      if (!check.ok) {
        toast.error(check.reason);
        continue;
      }
      try {
        const src = await readFileAsDataUrl(file);
        const node = createNode('media', at ?? toBoardCentre(surface, toBoard));
        node.src = src;
        node.text = file.name.replace(/\.[^.]+$/, '');
        write([...nodes, node]);
        setSelectedId(node.id);
      } catch (e) {
        toast.error('Could not read that picture', { description: e instanceof Error ? e.message : undefined });
      }
    }
  };

  const startDrag = (node: KobBackpackNode, kind: Drag['kind']) => (event: React.PointerEvent) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(node.id);
    drag.current = {
      id: node.id,
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: node.x, y: node.y, width: node.width, height: node.height },
    };
  };

  const moveDrag = (event: React.PointerEvent) => {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = (event.clientX - current.startX) / viewport.scale;
    const dy = (event.clientY - current.startY) / viewport.scale;
    if (current.kind === 'move') {
      patchNode(current.id, { x: Math.round(current.origin.x + dx), y: Math.round(current.origin.y + dy) });
    } else {
      patchNode(current.id, {
        width: Math.max(120, Math.round(current.origin.width + dx)),
        height: Math.max(80, Math.round(current.origin.height + dy)),
      });
    }
  };

  const endDrag = (event: React.PointerEvent) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  return (
    <>
      <DialogHeader className="shrink-0">
        <DialogTitle>Backpack</DialogTitle>
        {prompt ? <DialogDescription className="max-w-prose">{prompt}</DialogDescription> : null}
      </DialogHeader>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {readOnly
          ? null
          : ADD_BUTTONS.map(({ kind, label, icon: Icon }) => (
              <Button key={kind} size="sm" variant="outline" className="min-h-11" onClick={() => addNode(kind)}>
                <Icon className="size-4" />
                {label}
              </Button>
            ))}
        {readOnly ? null : (
          <>
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

      {selected && !readOnly ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Colour</span>
          <button
            type="button"
            aria-label="No colour"
            className={cn(
              'size-8 rounded-full border-2 bg-muted',
              selected.color === null ? 'border-foreground' : 'border-transparent',
            )}
            onClick={() => patchNode(selected.id, { color: null })}
          />
          {GROUP_COLORS.map((color) => (
            <button
              key={color.key}
              type="button"
              aria-label={color.label}
              className={cn(
                'size-8 rounded-full border-2',
                color.swatch,
                selected.color === color.key ? 'border-foreground' : 'border-transparent',
              )}
              onClick={() => patchNode(selected.id, { color: color.key })}
            />
          ))}
        </div>
      ) : null}

      {/* touch-none: without it a drag across the board scrolls the dialog instead of panning. */}
      <div
        ref={surface}
        className="relative min-h-0 flex-1 touch-none overflow-hidden rounded-lg border bg-muted/20"
        onPointerDown={(event) => {
          setSelectedId(null);
          onPointerDown(event);
        }}
        onPointerMove={(event) => {
          moveDrag(event);
          onPointerMove(event);
        }}
        onPointerUp={(event) => {
          endDrag(event);
          onPointerUp(event);
        }}
        onPointerCancel={(event) => {
          endDrag(event);
          onPointerUp(event);
        }}
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
          {nodes.map((node) => (
            <BackpackNode
              key={node.id}
              node={node}
              selected={node.id === selectedId}
              readOnly={readOnly}
              onSelect={() => setSelectedId(node.id)}
              onChange={(patch) => patchNode(node.id, patch)}
              onRemove={() => write(nodes.filter((other) => other.id !== node.id))}
              onDragStart={startDrag(node, 'move')}
              onResizeStart={startDrag(node, 'resize')}
            />
          ))}
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

function toBoardCentre(
  surface: React.RefObject<HTMLDivElement | null>,
  toBoard: (clientX: number, clientY: number) => { x: number; y: number },
) {
  const rect = surface.current?.getBoundingClientRect();
  return toBoard((rect?.left ?? 0) + (rect?.width ?? 0) / 2, (rect?.top ?? 0) + (rect?.height ?? 0) / 2);
}
