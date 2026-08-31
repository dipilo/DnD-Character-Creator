import { useCallback, useRef, useState } from 'react';

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.25;
const MAX_SCALE = 2.5;

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

interface PointerState {
  id: number;
  clientX: number;
  clientY: number;
}

/**
 * Pan and zoom for the backpack board.
 *
 * One finger on the background pans, two pinch, the wheel zooms about the cursor. It is pointer
 * events throughout rather than separate mouse and touch paths, because CLAUDE.md's rule about
 * touch having no hover and no modifiers applies here as much as anywhere: the same gesture has to
 * work with a thumb and with a trackpad, and a phone in landscape gets no second control strip.
 */
export function useCanvasViewport(surface: React.RefObject<HTMLElement | null>) {
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const pointers = useRef(new Map<number, PointerState>());
  const pinch = useRef<{ distance: number; scale: number } | null>(null);
  const pan = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  /** Client coordinates to board coordinates: where on the board a tap actually landed. */
  const toBoard = useCallback(
    (clientX: number, clientY: number) => {
      const rect = surface.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - viewport.x) / viewport.scale,
        y: (clientY - rect.top - viewport.y) / viewport.scale,
      };
    },
    [surface, viewport],
  );

  const zoomAbout = useCallback((clientX: number, clientY: number, factor: number) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    setViewport((current) => {
      const scale = clampScale(current.scale * factor);
      const applied = scale / current.scale;
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      return {
        scale,
        x: px - (px - current.x) * applied,
        y: py - (py - current.y) * applied,
      };
    });
  }, [surface]);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    pointers.current.set(event.pointerId, { id: event.pointerId, clientX: event.clientX, clientY: event.clientY });
    const active = [...pointers.current.values()];
    if (active.length === 2) {
      pan.current = null;
      pinch.current = { distance: distanceBetween(active[0], active[1]), scale: viewport.scale };
      return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    pan.current = { x: event.clientX, y: event.clientY, originX: viewport.x, originY: viewport.y };
  }, [viewport]);

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    const tracked = pointers.current.get(event.pointerId);
    if (!tracked) return;
    tracked.clientX = event.clientX;
    tracked.clientY = event.clientY;

    const active = [...pointers.current.values()];
    if (active.length === 2 && pinch.current) {
      const distance = distanceBetween(active[0], active[1]);
      if (pinch.current.distance > 0) {
        const rect = surface.current?.getBoundingClientRect();
        const midX = (active[0].clientX + active[1].clientX) / 2;
        const midY = (active[0].clientY + active[1].clientY) / 2;
        const next = clampScale(pinch.current.scale * (distance / pinch.current.distance));
        if (rect) {
          setViewport((current) => {
            const applied = next / current.scale;
            const px = midX - rect.left;
            const py = midY - rect.top;
            return { scale: next, x: px - (px - current.x) * applied, y: py - (py - current.y) * applied };
          });
        }
      }
      return;
    }

    if (!pan.current) return;
    const { x, y, originX, originY } = pan.current;
    setViewport((current) => ({ ...current, x: originX + (event.clientX - x), y: originY + (event.clientY - y) }));
  }, [surface]);

  const onPointerUp = useCallback((event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) pan.current = null;
  }, []);

  const onWheel = useCallback((event: React.WheelEvent) => {
    zoomAbout(event.clientX, event.clientY, event.deltaY < 0 ? 1.1 : 1 / 1.1);
  }, [zoomAbout]);

  const zoomBy = useCallback((factor: number) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAbout(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
  }, [surface, zoomAbout]);

  /** Put a board rectangle in the middle of the surface at a readable zoom. */
  const frame = useCallback((box: { x: number; y: number; width: number; height: number } | null) => {
    const rect = surface.current?.getBoundingClientRect();
    if (!rect) return;
    if (!box || box.width === 0 || box.height === 0) {
      setViewport({ x: rect.width / 2, y: rect.height / 2, scale: 1 });
      return;
    }
    const margin = 48;
    const scale = clampScale(
      Math.min((rect.width - margin) / box.width, (rect.height - margin) / box.height, 1),
    );
    setViewport({
      scale,
      x: rect.width / 2 - (box.x + box.width / 2) * scale,
      y: rect.height / 2 - (box.y + box.height / 2) * scale,
    });
  }, [surface]);

  return { viewport, toBoard, onPointerDown, onPointerMove, onPointerUp, onWheel, zoomBy, frame };
}

function distanceBetween(a: PointerState, b: PointerState): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
