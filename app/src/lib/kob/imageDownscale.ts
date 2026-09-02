/**
 * Shrink a dropped picture before it becomes part of the character document.
 *
 * A character is one JSON blob, so an inlined photo is charged against the document's own size
 * cap. A phone camera produces 4-8 MB per shot and every one of them used to be refused; re-encoded
 * at a size a card actually displays, the same photo is a couple of hundred kilobytes and fits.
 */

/** Long edge, in pixels. A media card is 260px wide at 100% zoom, so this is generous already. */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

/**
 * Formats that survive a re-encode. A GIF loses its animation and an SVG is already tiny and
 * resolution-free, so both are passed through untouched.
 */
const REENCODABLE = ['image/png', 'image/jpeg', 'image/webp'];

export interface PreparedImage {
  dataUrl: string;
  /** Bytes of the encoded image, before base64. */
  bytes: number;
  type: string;
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('could not read that file'));
    reader.readAsDataURL(blob);
  });
}

function scaleFor(width: number, height: number): number {
  const longest = Math.max(width, height);
  return longest > MAX_EDGE ? MAX_EDGE / longest : 1;
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * The smallest of: a WebP re-encode, the original type re-encoded, and the file itself. WebP wins
 * almost always, but a small PNG of flat colour can beat it and there is no reason to take the
 * larger of the two.
 */
async function smallest(canvas: HTMLCanvasElement, file: File): Promise<{ blob: Blob; type: string }> {
  const candidates: Array<{ blob: Blob; type: string }> = [{ blob: file, type: file.type }];
  for (const type of ['image/webp', file.type]) {
    const encoded = await encode(canvas, type);
    // A browser that cannot encode this type hands back a PNG or null; only take a real match.
    if (encoded && encoded.type === type) candidates.push({ blob: encoded, type });
  }
  return candidates.reduce((best, one) => (one.blob.size < best.blob.size ? one : best));
}

/**
 * A picture ready to inline. Never throws for a format it cannot process: the original is returned
 * instead, and the caller's size check is what decides whether it is small enough to keep.
 */
export async function prepareImage(file: File): Promise<PreparedImage> {
  const passthrough = async (): Promise<PreparedImage> => ({
    dataUrl: await readAsDataUrl(file),
    bytes: file.size,
    type: file.type,
  });

  if (!REENCODABLE.includes(file.type)) return passthrough();

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    console.warn('could not decode that picture, inlining it as it is', e instanceof Error ? e.message : e);
    return passthrough();
  }

  try {
    const scale = scaleFor(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return passthrough();
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const best = await smallest(canvas, file);
    return { dataUrl: await readAsDataUrl(best.blob), bytes: best.blob.size, type: best.type };
  } finally {
    bitmap.close();
  }
}
