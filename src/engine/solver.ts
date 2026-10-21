import { EMPTY, FILLED, UNKNOWN, type Axis, type Clues, type Grid } from '../types/puzzle';
import { solveLine, totalPlacements } from './patterns';

/**
 * Nonogram solver: line-by-line constraint propagation to a fixpoint, then
 * depth-first search on the most constrained line when propagation stalls.
 *
 * Lines are numbered 0..height-1 for rows and height..height+width-1 for columns.
 */

export type SolverEvent =
  | {
      type: 'line';
      axis: Axis;
      index: number;
      depth: number;
      /** Consistent placements the last time this line was examined. */
      prev: number;
      /** Consistent placements now. prev - now placements were eliminated by crossing lines. */
      now: number;
      /** Grid indices forced by this step, with their values. */
      cells: number[];
      values: number[];
    }
  | { type: 'contradiction'; axis: Axis; index: number; depth: number }
  | { type: 'branch'; cell: number; value: number; depth: number; axis: Axis; index: number; placements: number }
  | { type: 'backtrack'; depth: number }
  | { type: 'solution'; count: number };

export type SolveStatus = 'unique' | 'multiple' | 'none' | 'limit';

export interface SolveOptions {
  /** Stop after finding this many solutions. 2 is enough to decide uniqueness. */
  maxSolutions?: number;
  /** Maximum number of line evaluations before giving up. */
  stepLimit?: number;
  /** Record events for visualisation. */
  record?: boolean;
  eventLimit?: number;
  /** Starting knowledge (FILLED / EMPTY treated as given). */
  initial?: Grid;
}

export interface SolveResult {
  status: SolveStatus;
  solutions: Grid[];
  /** True when the whole search space was explored (or enough solutions were found to decide). */
  complete: boolean;
  /** True only when the search finished and found exactly one solution. */
  uniqueProven: boolean;
  /** Line evaluations performed. */
  lineSteps: number;
  /** Search branches taken (guesses). */
  branches: number;
  backtracks: number;
  maxDepth: number;
  /** Puzzle solved by propagation alone, without guessing. */
  logicOnly: boolean;
  elapsedMs: number;
  events: SolverEvent[];
  eventsTruncated: boolean;
}

export function lineCells(clues: Clues, line: number): number[] {
  const { width, height } = clues;
  const out: number[] = [];
  if (line < height) for (let c = 0; c < width; c++) out.push(line * width + c);
  else {
    const c = line - height;
    for (let r = 0; r < height; r++) out.push(r * width + c);
  }
  return out;
}

export function lineAxis(clues: Clues, line: number): { axis: Axis; index: number } {
  return line < clues.height ? { axis: 'row', index: line } : { axis: 'col', index: line - clues.height };
}

function clueOf(clues: Clues, line: number) {
  return line < clues.height ? clues.rows[line]! : clues.cols[line - clues.height]!;
}

export interface PropagationContext {
  clues: Clues;
  cellsOf: number[][];
  steps: number;
  stepLimit: number;
  aborted: boolean;
  record: boolean;
  events: SolverEvent[];
  eventLimit: number;
  truncated: boolean;
}

export function createContext(clues: Clues, opts: { stepLimit?: number; record?: boolean; eventLimit?: number } = {}): PropagationContext {
  const lines = clues.height + clues.width;
  const cellsOf: number[][] = [];
  for (let l = 0; l < lines; l++) cellsOf.push(lineCells(clues, l));
  return {
    clues,
    cellsOf,
    steps: 0,
    stepLimit: opts.stepLimit ?? 2_000_000,
    aborted: false,
    record: opts.record ?? false,
    events: [],
    eventLimit: opts.eventLimit ?? 60_000,
    truncated: false,
  };
}

function emit(ctx: PropagationContext, e: SolverEvent): void {
  if (!ctx.record || ctx.truncated) return;
  if (ctx.events.length >= ctx.eventLimit) {
    ctx.truncated = true;
    return;
  }
  ctx.events.push(e);
}

export function initialCounts(clues: Clues): Float64Array {
  const lines = clues.height + clues.width;
  const counts = new Float64Array(lines);
  for (let l = 0; l < lines; l++) {
    const len = l < clues.height ? clues.width : clues.height;
    counts[l] = totalPlacements(clueOf(clues, l), len);
  }
  return counts;
}

/**
 * Propagate line deductions until nothing changes.
 * Mutates grid and counts. Returns false on contradiction (or if aborted).
 */
export function propagate(
  ctx: PropagationContext,
  grid: Grid,
  counts: Float64Array,
  dirtyLines: Iterable<number>,
  depth = 0,
): boolean {
  const { clues, cellsOf } = ctx;
  const { width, height } = clues;
  const lines = width + height;
  const dirty = new Uint8Array(lines);
  const queue: number[] = [];
  for (const l of dirtyLines) {
    if (!dirty[l]) {
      dirty[l] = 1;
      queue.push(l);
    }
  }
  const buf = new Uint8Array(Math.max(width, height));
  while (queue.length > 0) {
    if (ctx.steps >= ctx.stepLimit) {
      ctx.aborted = true;
      return false;
    }
    const l = queue.shift()!;
    dirty[l] = 0;
    const cells = cellsOf[l]!;
    const view = buf.subarray(0, cells.length);
    for (let i = 0; i < cells.length; i++) view[i] = grid[cells[i]!]!;
    ctx.steps++;
    const res = solveLine(clueOf(clues, l), view);
    if (!res.ok) {
      const { axis, index } = lineAxis(clues, l);
      emit(ctx, { type: 'contradiction', axis, index, depth });
      return false;
    }
    const prev = counts[l]!;
    counts[l] = res.placements;
    if (res.changed.length > 0 || (ctx.record && prev !== res.placements)) {
      const changedCells: number[] = [];
      const values: number[] = [];
      for (const i of res.changed) {
        const cell = cells[i]!;
        const v = res.line[i]!;
        grid[cell] = v;
        changedCells.push(cell);
        values.push(v);
        const r = Math.floor(cell / width);
        const c = cell % width;
        const cross = l < height ? height + c : r;
        if (!dirty[cross]) {
          dirty[cross] = 1;
          queue.push(cross);
        }
      }
      if (changedCells.length > 0) {
        const { axis, index } = lineAxis(clues, l);
        emit(ctx, { type: 'line', axis, index, depth, prev, now: res.placements, cells: changedCells, values });
      }
    }
  }
  return true;
}

function allLines(clues: Clues): number[] {
  return Array.from({ length: clues.width + clues.height }, (_, i) => i);
}

/** Line with the fewest consistent placements that still has unknown cells. */
function chooseBranch(ctx: PropagationContext, grid: Grid, counts: Float64Array): { line: number; cell: number } | null {
  let best = -1;
  let bestCount = Infinity;
  for (let l = 0; l < counts.length; l++) {
    const cnt = counts[l]!;
    if (cnt <= 1 || cnt >= bestCount) continue;
    const cells = ctx.cellsOf[l]!;
    if (cells.some((c) => grid[c] === UNKNOWN)) {
      best = l;
      bestCount = cnt;
    }
  }
  if (best < 0) {
    // Fallback: any unknown cell (should not happen after a fixpoint).
    const idx = grid.indexOf(UNKNOWN);
    if (idx < 0) return null;
    return { line: Math.floor(idx / ctx.clues.width), cell: idx };
  }
  const cells = ctx.cellsOf[best]!;
  // Prefer the unknown cell nearest the middle of the line: it splits placements more evenly.
  let cell = -1;
  let bestDist = Infinity;
  const mid = (cells.length - 1) / 2;
  cells.forEach((c, i) => {
    if (grid[c] === UNKNOWN && Math.abs(i - mid) < bestDist) {
      bestDist = Math.abs(i - mid);
      cell = c;
    }
  });
  return { line: best, cell };
}

export function solve(clues: Clues, options: SolveOptions = {}): SolveResult {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const maxSolutions = options.maxSolutions ?? 2;
  const ctx = createContext(clues, options);
  const size = clues.width * clues.height;
  const solutions: Grid[] = [];
  let branches = 0;
  let backtracks = 0;
  let maxDepth = 0;

  const grid = new Uint8Array(size);
  if (options.initial) {
    for (let i = 0; i < size; i++) {
      const v = options.initial[i]!;
      grid[i] = v === FILLED || v === EMPTY ? v : UNKNOWN;
    }
  }
  const counts = initialCounts(clues);

  const search = (g: Grid, cnt: Float64Array, dirty: Iterable<number>, depth: number): void => {
    if (solutions.length >= maxSolutions || ctx.aborted) return;
    if (!propagate(ctx, g, cnt, dirty, depth)) return;
    const choice = chooseBranch(ctx, g, cnt);
    if (!choice) {
      solutions.push(g.slice());
      emit(ctx, { type: 'solution', count: solutions.length });
      return;
    }
    const { axis, index } = lineAxis(clues, choice.line);
    const r = Math.floor(choice.cell / clues.width);
    const c = choice.cell % clues.width;
    const touched = [r, clues.height + c];
    for (const value of [FILLED, EMPTY]) {
      if (solutions.length >= maxSolutions || ctx.aborted) return;
      branches++;
      maxDepth = Math.max(maxDepth, depth + 1);
      emit(ctx, { type: 'branch', cell: choice.cell, value, depth: depth + 1, axis, index, placements: cnt[choice.line]! });
      const g2 = g.slice();
      const c2 = cnt.slice();
      g2[choice.cell] = value;
      search(g2, c2, touched, depth + 1);
      if (solutions.length >= maxSolutions || ctx.aborted) return;
      backtracks++;
      emit(ctx, { type: 'backtrack', depth: depth + 1 });
    }
  };

  search(grid, counts, allLines(clues), 0);

  const decided = solutions.length >= maxSolutions && maxSolutions >= 2;
  const complete = !ctx.aborted;
  let status: SolveStatus;
  if (solutions.length >= 2) status = 'multiple';
  else if (!complete) status = 'limit';
  else status = solutions.length === 1 ? 'unique' : 'none';

  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    status,
    solutions,
    complete: complete || decided,
    uniqueProven: status === 'unique' && complete && maxSolutions >= 2,
    lineSteps: ctx.steps,
    branches,
    backtracks,
    maxDepth,
    logicOnly: branches === 0 && solutions.length === 1,
    elapsedMs: t1 - t0,
    events: ctx.events,
    eventsTruncated: ctx.truncated,
  };
}

/**
 * Propagation only, from a starting grid. Used for hints and difficulty grading.
 * Returns the deduced grid, or null if the starting grid contradicts the clues.
 */
export function propagateFrom(clues: Clues, start: Grid, stepLimit = 200_000): Grid | null {
  const ctx = createContext(clues, { stepLimit });
  const g = start.slice();
  const counts = initialCounts(clues);
  return propagate(ctx, g, counts, allLines(clues)) ? g : null;
}
