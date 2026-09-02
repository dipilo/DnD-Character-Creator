import { useRef, useState } from 'react';
import type { KobBackpackCanvas } from '@/types/kob';

/**
 * Undo and redo for the backpack board.
 *
 * The board is a controlled value written straight onto the character document, so there is no
 * store to roll back: history is the previous canvases, kept for as long as the dialog is open.
 * It is deliberately not persisted — the document holds the board, not how it got there.
 */
const LIMIT = 60;

/** Typing is one change, not one per keystroke, so a repeated key coalesces for this long. */
const COALESCE_MS = 700;

interface Entry {
  canvas: KobBackpackCanvas;
  key: string | null;
  at: number;
}

export interface CanvasHistory {
  /** Write a new canvas and remember the one it replaced. */
  commit: (next: KobBackpackCanvas, coalesceKey?: string) => void;
  /** Write without recording anything: what a drag's intermediate frames use. */
  replace: (next: KobBackpackCanvas) => void;
  /** Open a coalescing window, so everything until the next `seal` counts as one change. */
  seal: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useCanvasHistory(
  canvas: KobBackpackCanvas,
  onChange: (canvas: KobBackpackCanvas) => void,
): CanvasHistory {
  const past = useRef<Entry[]>([]);
  const future = useRef<KobBackpackCanvas[]>([]);
  const [depth, setDepth] = useState({ past: 0, future: 0 });

  // Nothing here is memoized and nothing reads a ref during render: the hook is called with the
  // live canvas each render, so every closure below already has it.
  const sync = () => setDepth({ past: past.current.length, future: future.current.length });

  const commit = (next: KobBackpackCanvas, coalesceKey?: string) => {
    const last = past.current.at(-1);
    const merges = coalesceKey !== undefined
      && last?.key === coalesceKey
      && Date.now() - last.at < COALESCE_MS;
    if (merges) {
      // Keep the canvas from before the run of edits; only the clock moves on.
      last.at = Date.now();
    } else {
      past.current.push({ canvas, key: coalesceKey ?? null, at: Date.now() });
      if (past.current.length > LIMIT) past.current.shift();
    }
    future.current = [];
    sync();
    onChange(next);
  };

  const replace = (next: KobBackpackCanvas) => onChange(next);

  // A drag commits once, before it starts moving anything; `seal` is what stops the frames after
  // it merging into the entry a later edit would otherwise land on.
  const seal = () => {
    const last = past.current.at(-1);
    if (last) last.key = null;
  };

  const undo = () => {
    const entry = past.current.pop();
    if (!entry) return;
    future.current.push(canvas);
    sync();
    onChange(entry.canvas);
  };

  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push({ canvas, key: null, at: Date.now() });
    sync();
    onChange(next);
  };

  return { commit, replace, seal, undo, redo, canUndo: depth.past > 0, canRedo: depth.future > 0 };
}
