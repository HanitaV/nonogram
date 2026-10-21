import { EMPTY, FILLED, UNKNOWN, type Axis, type Clues, type Grid } from '../types/puzzle';
import { solveLine } from './patterns';
import { createContext, initialCounts, lineAxis, lineCells, propagate, solve } from './solver';
import { mistakesAgainst } from './validation';

export type Hint =
  | { kind: 'solved' }
  /** A line cannot be completed with the current fills and marks. */
  | { kind: 'line-contradiction'; axis: Axis; index: number }
  /** No complete solution agrees with the current board, though every single line still could. */
  | { kind: 'inconsistent'; mistakes: number[] | null }
  /** Single-line logic: every arrangement of this clue that fits agrees on these cells. */
  | { kind: 'line'; axis: Axis; index: number; cells: number[]; values: number[]; placements: number }
  /** One-step look-ahead: assuming the opposite value leads to a broken line. */
  | {
      kind: 'probe';
      cell: number;
      value: number;
      brokenAxis: Axis | null;
      brokenIndex: number | null;
    }
  /** Logic in this hint system is exhausted; reveal from a solution. */
  | { kind: 'reveal'; cell: number; value: number; fromUniqueSolution: boolean }
  | { kind: 'unknown' };

export interface HintOptions {
  /** Reference solution, only meaningful when the puzzle is proven unique. */
  uniqueSolution?: Grid | null;
  stepLimit?: number;
}

/** Normalise a player's board into solver knowledge (UNKNOWN / FILLED / EMPTY). */
function knowledge(board: Grid): Grid {
  const g = new Uint8Array(board.length);
  for (let i = 0; i < board.length; i++) g[i] = board[i] === FILLED ? FILLED : board[i] === EMPTY ? EMPTY : UNKNOWN;
  return g;
}

export function computeHint(clues: Clues, board: Grid, options: HintOptions = {}): Hint {
  const g = knowledge(board);
  const lines = clues.width + clues.height;
  const stepLimit = options.stepLimit ?? 400_000;

  // 1. A line that is already broken.
  for (let l = 0; l < lines; l++) {
    const cells = lineCells(clues, l);
    const clue = l < clues.height ? clues.rows[l]! : clues.cols[l - clues.height]!;
    const res = solveLine(clue, cells.map((c) => g[c]!));
    if (!res.ok) return { kind: 'line-contradiction', ...lineAxis(clues, l) };
  }

  // 2. Is the board still on the way to some solution?
  const check = solve(clues, { initial: g, maxSolutions: 1, stepLimit });
  if (check.status === 'none') {
    const mistakes = options.uniqueSolution ? mistakesAgainst(g, options.uniqueSolution) : null;
    return { kind: 'inconsistent', mistakes };
  }
  const witness = check.solutions[0] ?? null;
  if (witness && !g.includes(UNKNOWN)) return { kind: 'solved' };

  // 3. Single-line deduction. Prefer lines that force filled cells (more
  //    informative than marking the rest of a finished line), then the most cells.
  let bestLine: Hint | null = null;
  let bestCount = 0;
  for (let l = 0; l < lines; l++) {
    const cells = lineCells(clues, l);
    const clue = l < clues.height ? clues.rows[l]! : clues.cols[l - clues.height]!;
    const res = solveLine(clue, cells.map((c) => g[c]!));
    const score = res.ok ? res.changed.reduce((sum, i) => sum + (res.line[i] === FILLED ? 100 : 1), 0) : 0;
    if (res.ok && score > bestCount) {
      bestCount = score;
      bestLine = {
        kind: 'line',
        ...lineAxis(clues, l),
        cells: res.changed.map((i) => cells[i]!),
        values: res.changed.map((i) => res.line[i]!),
        placements: res.placements,
      };
    }
  }
  if (bestLine) return bestLine;

  // 4. One-step look-ahead: try a value, propagate, see if it breaks.
  const counts = initialCounts(clues);
  for (let cell = 0; cell < g.length; cell++) {
    if (g[cell] !== UNKNOWN) continue;
    for (const assumed of [FILLED, EMPTY]) {
      const ctx = createContext(clues, { stepLimit: 50_000, record: true, eventLimit: 4000 });
      const trial = g.slice();
      trial[cell] = assumed;
      const r = Math.floor(cell / clues.width);
      const c = cell % clues.width;
      const ok = propagate(ctx, trial, counts.slice(), [r, clues.height + c]);
      if (!ok && !ctx.aborted) {
        const last = [...ctx.events].reverse().find((e) => e.type === 'contradiction');
        return {
          kind: 'probe',
          cell,
          value: assumed === FILLED ? EMPTY : FILLED,
          brokenAxis: last && last.type === 'contradiction' ? last.axis : null,
          brokenIndex: last && last.type === 'contradiction' ? last.index : null,
        };
      }
    }
  }

  // 5. Out of logic this hint system knows. Reveal from a solution.
  if (witness) {
    const ref = options.uniqueSolution ?? witness;
    const cell = g.indexOf(UNKNOWN);
    if (cell >= 0) {
      return {
        kind: 'reveal',
        cell,
        value: ref[cell] === FILLED ? FILLED : EMPTY,
        fromUniqueSolution: Boolean(options.uniqueSolution),
      };
    }
  }
  return { kind: 'unknown' };
}
