/**
 * Undo/redo for board edits. One stroke (a click or a drag) is one undo step.
 * Pure functions over an immutable history value.
 */

export interface CellChange {
  index: number;
  from: number;
  to: number;
}

export type Stroke = CellChange[];

export interface History {
  past: Stroke[];
  future: Stroke[];
}

export const MAX_HISTORY = 500;

export function emptyHistory(): History {
  return { past: [], future: [] };
}

export function record(history: History, stroke: Stroke): History {
  if (stroke.length === 0) return history;
  const past = [...history.past, stroke];
  if (past.length > MAX_HISTORY) past.splice(0, past.length - MAX_HISTORY);
  return { past, future: [] };
}

export function applyStroke(board: Uint8Array, stroke: Stroke, direction: 'forward' | 'back'): Uint8Array {
  const next = board.slice();
  if (direction === 'forward') for (const ch of stroke) next[ch.index] = ch.to;
  else for (let i = stroke.length - 1; i >= 0; i--) next[stroke[i]!.index] = stroke[i]!.from;
  return next;
}

export function undo(history: History, board: Uint8Array): { history: History; board: Uint8Array } | null {
  const stroke = history.past[history.past.length - 1];
  if (!stroke) return null;
  return {
    history: { past: history.past.slice(0, -1), future: [stroke, ...history.future] },
    board: applyStroke(board, stroke, 'back'),
  };
}

export function redo(history: History, board: Uint8Array): { history: History; board: Uint8Array } | null {
  const stroke = history.future[0];
  if (!stroke) return null;
  return {
    history: { past: [...history.past, stroke], future: history.future.slice(1) },
    board: applyStroke(board, stroke, 'forward'),
  };
}

/** Changes needed to turn `from` into `to` (for resets and reveals that should be undoable). */
export function diffBoards(from: Uint8Array, to: Uint8Array): Stroke {
  const out: Stroke = [];
  for (let i = 0; i < from.length; i++) if (from[i] !== to[i]) out.push({ index: i, from: from[i]!, to: to[i]! });
  return out;
}
