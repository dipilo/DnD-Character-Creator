import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { groupColor } from '@/lib/groupColors';
import { hostOf, isSafeSrc, mediaKindOf } from '@/lib/kob/backpackCanvas';
import { cn } from '@/lib/utils';
import type { KobBackpackNode } from '@/types/kob';

interface BackpackNodeProps {
  readonly node: KobBackpackNode;
  readonly selected: boolean;
  readonly readOnly: boolean;
  readonly onSelect: () => void;
  readonly onChange: (patch: Partial<KobBackpackNode>) => void;
  readonly onRemove: () => void;
  readonly onDragStart: (event: React.PointerEvent) => void;
  readonly onResizeStart: (event: React.PointerEvent) => void;
}

/** A picture or a clip, when the URL can be shown; otherwise the link itself, which always can. */
function Media({ node }: Readonly<{ node: KobBackpackNode }>) {
  if (!node.src || !isSafeSrc(node.src)) {
    return (
      <p className="p-2 text-xs text-muted-foreground">
        Paste a picture, GIF or video link, or drop a picture onto the board.
      </p>
    );
  }
  const kind = mediaKindOf(node.src);
  if (kind === 'image') {
    return <img src={node.src} alt={node.text || 'Something from the backpack'} className="size-full object-cover" />;
  }
  if (kind === 'video') {
    // Muted and looping: a backpack is a collage, and a card that starts talking is not one.
    return <video src={node.src} className="size-full object-cover" controls muted loop playsInline />;
  }
  return (
    <a
      href={node.src}
      target="_blank"
      rel="noreferrer noopener"
      className="block p-2 text-xs text-primary underline"
    >
      {node.text || hostOf(node.src)}
    </a>
  );
}

type BodyProps = Readonly<Pick<BackpackNodeProps, 'node' | 'readOnly' | 'onChange'>>;

function NoteBody({ node, readOnly, onChange }: BodyProps) {
  if (readOnly) return <p className="whitespace-pre-wrap text-sm">{node.text}</p>;
  return (
    <Textarea
      value={node.text}
      placeholder="A calculator and two books"
      className="size-full resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      onChange={(event) => onChange({ text: event.target.value })}
    />
  );
}

function LinkBody({ node, readOnly, onChange }: BodyProps) {
  if (readOnly) {
    return isSafeSrc(node.src) ? (
      <a href={node.src} target="_blank" rel="noreferrer noopener" className="text-sm text-primary underline">
        {node.text || hostOf(node.src)}
      </a>
    ) : (
      <p className="text-sm">{node.text}</p>
    );
  }
  return (
    <>
      <Input
        value={node.text}
        placeholder="What it is"
        className="h-8 text-sm"
        onChange={(event) => onChange({ text: event.target.value })}
      />
      <Input
        value={node.src}
        placeholder="https://"
        inputMode="url"
        className="h-8 text-xs"
        onChange={(event) => onChange({ src: event.target.value })}
      />
    </>
  );
}

/**
 * One card on the backpack board.
 *
 * The whole card is not draggable: the body holds the fields the player types into, so the grip in
 * the header is what moves it. That is also what makes it work with a thumb, where a drag started
 * on a textarea is indistinguishable from a scroll.
 */
export function BackpackNode({
  node,
  selected,
  readOnly,
  onSelect,
  onChange,
  onRemove,
  onDragStart,
  onResizeStart,
}: BackpackNodeProps) {
  const color = groupColor(node.color);

  return (
    <div
      className={cn(
        'absolute flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm',
        selected && 'ring-2 ring-primary',
        color && `border-l-4 ${color.soft}`,
      )}
      style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {readOnly ? null : (
        <div className="flex h-7 shrink-0 items-center justify-between border-b bg-muted/40">
          <button
            type="button"
            className="flex h-full flex-1 cursor-grab touch-none items-center px-1 text-muted-foreground"
            aria-label="Move this card"
            onPointerDown={onDragStart}
          >
            <GripVertical className="size-4" />
          </button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0"
            aria-label="Remove this card"
            onClick={onRemove}
          >
            <Trash2 className="size-3.5 text-destructive" />
          </Button>
        </div>
      )}

      <div className={cn('min-h-0 flex-1', node.kind === 'media' ? 'overflow-hidden' : 'space-y-1 overflow-auto p-2')}>
        {node.kind === 'note' ? <NoteBody node={node} readOnly={readOnly} onChange={onChange} /> : null}
        {node.kind === 'link' ? <LinkBody node={node} readOnly={readOnly} onChange={onChange} /> : null}
        {node.kind === 'media' ? <Media node={node} /> : null}
      </div>

      {node.kind === 'media' && node.text ? (
        <p className="shrink-0 truncate border-t px-2 py-1 text-xs text-muted-foreground">{node.text}</p>
      ) : null}

      {readOnly ? null : (
        <button
          type="button"
          aria-label="Resize this card"
          className="absolute bottom-0 right-0 size-5 cursor-nwse-resize touch-none rounded-tl border-l border-t bg-muted/60"
          onPointerDown={onResizeStart}
        />
      )}
    </div>
  );
}
