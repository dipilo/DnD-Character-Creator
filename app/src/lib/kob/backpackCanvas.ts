import type { KobBackpackCanvas, KobBackpackNode, KobBackpackNodeKind } from '@/types/kob';

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
};

export const EMPTY_CANVAS: KobBackpackCanvas = { nodes: [] };

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
  return { nodes: canvas.nodes.filter(isNode).map(normaliseNode) };
}

function normaliseNode(node: KobBackpackNode): KobBackpackNode {
  const size = DEFAULT_NODE_SIZE[node.kind] ?? DEFAULT_NODE_SIZE.note;
  return {
    id: node.id,
    kind: node.kind === 'link' || node.kind === 'media' ? node.kind : 'note',
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

/** `{ ok }` or the reason to show the player, in the words the dialog prints. */
export function checkInlineFile(file: File, canvas: KobBackpackCanvas): { ok: true } | { ok: false; reason: string } {
  if (!INLINE_IMAGE_TYPES.includes(file.type)) {
    return { ok: false, reason: 'Pictures can be dropped in; for video, paste a link instead.' };
  }
  if (file.size * BASE64_OVERHEAD > MAX_INLINE_IMAGE_BYTES) {
    return { ok: false, reason: 'That picture is over 512 KB. Paste a link to it instead.' };
  }
  if (inlineBytes(canvas) + file.size * BASE64_OVERHEAD > MAX_CANVAS_INLINE_BYTES) {
    return { ok: false, reason: 'This backpack already holds 4 MB of pictures. Use links from here on.' };
  }
  return { ok: true };
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('could not read that file'));
    reader.readAsDataURL(file);
  });
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
