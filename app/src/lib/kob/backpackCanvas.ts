import { prepareImage } from '@/lib/kob/imageDownscale';
import type {
  KobBackpackCanvas,
  KobBackpackEdge,
  KobBackpackNode,
  KobBackpackNodeKind,
  KobBackpackSide,
} from '@/types/kob';

/**
 * The backpack board: what a node may hold, and how big a dropped picture may be.
 *
 * A character is one JSON document in `characters.data`, so an image dropped onto the board is
 * part of that document. These caps are what keep a photo off a phone camera from making the
 * document too large to save — a link has no size at all, which is why anything bigger is asked
 * for as one.
 */
export const MAX_INLINE_IMAGE_BYTES = 512 * 1024;
export const MAX_CANVAS_INLINE_BYTES = 4 * 1024 * 1024;

/** A data URL is base64, so it is about a third larger than the file it came from. */
const BASE64_OVERHEAD = 4 / 3;

export const INLINE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

export const DEFAULT_NODE_SIZE: Record<KobBackpackNodeKind, { width: number; height: number }> = {
  note: { width: 220, height: 140 },
  link: { width: 240, height: 96 },
  media: { width: 260, height: 200 },
  group: { width: 420, height: 300 },
};

const NODE_KINDS: KobBackpackNodeKind[] = ['note', 'link', 'media', 'group'];
const SIDES: KobBackpackSide[] = ['top', 'right', 'bottom', 'left'];

export const EMPTY_CANVAS: KobBackpackCanvas = { nodes: [], edges: [] };

function isNode(value: unknown): value is KobBackpackNode {
  if (!value || typeof value !== 'object') return false;
  const node = value as Partial<KobBackpackNode>;
  return typeof node.id === 'string' && typeof node.x === 'number' && typeof node.y === 'number';
}

/**
 * Read a canvas off a document that may predate it, or have been written by another version. A
 * missing field and a wrong-shaped one both read as an empty board rather than throwing in a
 * render — the same guard CLAUDE.md asks for on `character.proficiencies`.
 */
export function readCanvas(canvas: KobBackpackCanvas | undefined | null): KobBackpackCanvas {
  if (!canvas || typeof canvas !== 'object' || !Array.isArray(canvas.nodes)) return EMPTY_CANVAS;
  const nodes = canvas.nodes.filter(isNode).map(normaliseNode);
  const ids = new Set(nodes.map((node) => node.id));
  // An edge whose end has been deleted is not a line to nowhere, it is nothing at all.
  const edges = (Array.isArray(canvas.edges) ? canvas.edges : [])
    .filter(isEdge)
    .map(normaliseEdge)
    .filter((edge) => ids.has(edge.from) && ids.has(edge.to));
  return { nodes, edges };
}

function isEdge(value: unknown): value is KobBackpackEdge {
  if (!value || typeof value !== 'object') return false;
  const edge = value as Partial<KobBackpackEdge>;
  return typeof edge.id === 'string' && typeof edge.from === 'string' && typeof edge.to === 'string';
}

function normaliseEdge(edge: KobBackpackEdge): KobBackpackEdge {
  return {
    id: edge.id,
    from: edge.from,
    to: edge.to,
    fromSide: SIDES.includes(edge.fromSide) ? edge.fromSide : 'right',
    toSide: SIDES.includes(edge.toSide) ? edge.toSide : 'left',
    label: typeof edge.label === 'string' ? edge.label : '',
    color: typeof edge.color === 'string' ? edge.color : null,
  };
}

function normaliseNode(node: KobBackpackNode): KobBackpackNode {
  const size = DEFAULT_NODE_SIZE[node.kind] ?? DEFAULT_NODE_SIZE.note;
  return {
    id: node.id,
    kind: NODE_KINDS.includes(node.kind) ? node.kind : 'note',
    x: node.x,
    y: node.y,
    width: typeof node.width === 'number' && node.width > 0 ? node.width : size.width,
    height: typeof node.height === 'number' && node.height > 0 ? node.height : size.height,
    text: typeof node.text === 'string' ? node.text : '',
    src: typeof node.src === 'string' ? node.src : '',
    color: typeof node.color === 'string' ? node.color : null,
  };
}

export function createNode(kind: KobBackpackNodeKind, at: { x: number; y: number }): KobBackpackNode {
  const size = DEFAULT_NODE_SIZE[kind];
  return {
    id: crypto.randomUUID(),
    kind,
    x: Math.round(at.x - size.width / 2),
    y: Math.round(at.y - size.height / 2),
    width: size.width,
    height: size.height,
    text: '',
    src: '',
    color: null,
  };
}

/** How much of the document the inlined pictures already take. */
export function inlineBytes(canvas: KobBackpackCanvas): number {
  return canvas.nodes.reduce((total, node) => total + (node.src.startsWith('data:') ? node.src.length : 0), 0);
}

/**
 * A picture ready to put on the board, or the reason to show the player.
 *
 * The size is checked *after* the re-encode, not before: a photo straight off a phone is several
 * megabytes and every one of them used to be refused, although the version a card displays is a
 * fraction of that. The caps are unchanged — what changed is what is measured against them.
 */
export async function prepareInlineImage(
  file: File,
  canvas: KobBackpackCanvas,
): Promise<{ ok: true; src: string } | { ok: false; reason: string }> {
  if (!INLINE_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, reason: 'Pictures can be dropped in; for video, paste a link instead.' };
  }

  const prepared = await prepareImage(file);
  if (prepared.bytes * BASE64_OVERHEAD > MAX_INLINE_IMAGE_BYTES) {
    return { ok: false, reason: 'That picture is still over 512 KB once shrunk. Paste a link to it instead.' };
  }
  if (inlineBytes(canvas) + prepared.dataUrl.length > MAX_CANVAS_INLINE_BYTES) {
    return { ok: false, reason: 'This backpack already holds 4 MB of pictures. Use links from here on.' };
  }
  return { ok: true, src: prepared.dataUrl };
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogv|mov)(\?|#|$)/i;

/** What a URL can be shown as. Anything else stays a link, which always works. */
export function mediaKindOf(src: string): 'image' | 'video' | 'other' {
  if (src.startsWith('data:image/')) return 'image';
  if (IMAGE_EXTENSIONS.test(src)) return 'image';
  if (VIDEO_EXTENSIONS.test(src)) return 'video';
  return 'other';
}

/** Only http(s) and inline images are rendered; a `javascript:` src is never given to the DOM. */
export function isSafeSrc(src: string): boolean {
  return /^https?:\/\//i.test(src) || src.startsWith('data:image/');
}

/** The label a link card shows when the player typed no caption of their own. */
export function hostOf(src: string): string {
  try {
    return new URL(src).host;
  } catch (e) {
    console.debug('not a URL', e instanceof Error ? e.message : e);
    return src;
  }
}

/** Fit the board in view: the extent of every node, with a margin. */
export function boundsOf(canvas: KobBackpackCanvas): { x: number; y: number; width: number; height: number } | null {
  if (canvas.nodes.length === 0) return null;
  const left = Math.min(...canvas.nodes.map((node) => node.x));
  const top = Math.min(...canvas.nodes.map((node) => node.y));
  const right = Math.max(...canvas.nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...canvas.nodes.map((node) => node.y + node.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function createEdge(from: string, to: string, fromSide: KobBackpackSide, toSide: KobBackpackSide): KobBackpackEdge {
  return { id: crypto.randomUUID(), from, to, fromSide, toSide, label: '', color: null };
}

/** Where on a card's border an edge of that side attaches. */
export function anchorOf(node: KobBackpackNode, side: KobBackpackSide): { x: number; y: number } {
  const midX = node.x + node.width / 2;
  const midY = node.y + node.height / 2;
  if (side === 'top') return { x: midX, y: node.y };
  if (side === 'bottom') return { x: midX, y: node.y + node.height };
  if (side === 'left') return { x: node.x, y: midY };
  return { x: node.x + node.width, y: midY };
}

/**
 * A cubic curve that leaves and enters square to the borders it joins, which is what stops two
 * cards side by side being connected by a line through both of them.
 */
export function edgePath(start: { x: number; y: number }, startSide: KobBackpackSide, end: { x: number; y: number }, endSide: KobBackpackSide): string {
  const reach = Math.max(40, Math.hypot(end.x - start.x, end.y - start.y) / 2.5);
  const out = offsetFor(startSide, reach);
  const into = offsetFor(endSide, reach);
  return `M ${start.x} ${start.y} C ${start.x + out.x} ${start.y + out.y}, ${end.x + into.x} ${end.y + into.y}, ${end.x} ${end.y}`;
}

function offsetFor(side: KobBackpackSide, reach: number): { x: number; y: number } {
  if (side === 'top') return { x: 0, y: -reach };
  if (side === 'bottom') return { x: 0, y: reach };
  if (side === 'left') return { x: -reach, y: 0 };
  return { x: reach, y: 0 };
}

/** The side of `node` that faces `target`, so a new edge leaves by the border pointing at it. */
export function sideFacing(node: KobBackpackNode, target: { x: number; y: number }): KobBackpackSide {
  const dx = target.x - (node.x + node.width / 2);
  const dy = target.y - (node.y + node.height / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

/**
 * The cards a frame carries. Containment is by the card's centre rather than its whole rectangle,
 * so a card overhanging a frame's edge still travels with it — dragging a frame and leaving one
 * corner behind is the frustrating version of this.
 */
export function nodesInGroup(group: KobBackpackNode, nodes: KobBackpackNode[]): string[] {
  return nodes
    .filter((node) => node.id !== group.id && node.kind !== 'group')
    .filter((node) => {
      const x = node.x + node.width / 2;
      const y = node.y + node.height / 2;
      return x >= group.x && x <= group.x + group.width && y >= group.y && y <= group.y + group.height;
    })
    .map((node) => node.id);
}

/** Groups draw behind everything else, whatever order the document happens to store them in. */
export function inPaintOrder(nodes: KobBackpackNode[]): KobBackpackNode[] {
  return [...nodes].sort((a, b) => Number(a.kind !== 'group') - Number(b.kind !== 'group'));
}

/** The rectangle a marquee drag covers, from the two board points it was dragged between. */
export function marqueeBox(from: { x: number; y: number }, to: { x: number; y: number }) {
  return {
    x: Math.min(from.x, to.x),
    y: Math.min(from.y, to.y),
    width: Math.abs(to.x - from.x),
    height: Math.abs(to.y - from.y),
  };
}

/** Every card the marquee touches at all, which is what a selection rectangle is expected to do. */
export function nodesTouching(box: { x: number; y: number; width: number; height: number }, nodes: KobBackpackNode[]): string[] {
  return nodes
    .filter((node) => node.x < box.x + box.width
      && node.x + node.width > box.x
      && node.y < box.y + box.height
      && node.y + node.height > box.y)
    .map((node) => node.id);
}

/**
 * The topmost card at a board point, frames excluded: what an arrow lands on when it is let go.
 *
 * Read from the board's own geometry rather than `document.elementFromPoint`, which answers with
 * the dialog rather than the card once a pointer is captured — so every arrow silently landed on
 * nothing.
 */
export function nodeAtPoint(point: { x: number; y: number }, nodes: KobBackpackNode[]): KobBackpackNode | null {
  const hit = inPaintOrder(nodes).filter(
    (node) => node.kind !== 'group'
      && point.x >= node.x && point.x <= node.x + node.width
      && point.y >= node.y && point.y <= node.y + node.height,
  );
  return hit.at(-1) ?? null;
}
