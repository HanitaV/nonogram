import { EMPTY, FILLED, type Clue, type Clues, type Grid } from '../types/puzzle';

/** Run lengths of filled cells in a line. `isFilled` decides what counts as filled. */
export function lineClue(line: ArrayLike<number>, isFilled: (v: number) => boolean = (v) => v === FILLED): Clue {
  const runs: number[] = [];
  let run = 0;
  for (let i = 0; i < line.length; i++) {
    if (isFilled(line[i] as number)) run++;
    else if (run > 0) {
      runs.push(run);
      run = 0;
    }
  }
  if (run > 0) runs.push(run);
  return runs;
}

export function getRow(grid: Grid, width: number, r: number): Uint8Array {
  return grid.subarray(r * width, r * width + width);
}

export function getCol(grid: Grid, width: number, height: number, c: number): Uint8Array {
  const out = new Uint8Array(height);
  for (let r = 0; r < height; r++) out[r] = grid[r * width + c] as number;
  return out;
}

/** Compute clues from a solution grid (FILLED cells form the picture). */
export function cluesFromGrid(grid: Grid, width: number, height: number): Clues {
  const rows: Clue[] = [];
  const cols: Clue[] = [];
  for (let r = 0; r < height; r++) rows.push(lineClue(getRow(grid, width, r)));
  for (let c = 0; c < width; c++) cols.push(lineClue(getCol(grid, width, height, c)));
  return { width, height, rows, cols };
}

export function gridFromSolution(solution: string[]): { grid: Grid; width: number; height: number } {
  const height = solution.length;
  const width = solution[0]?.length ?? 0;
  const grid = new Uint8Array(width * height);
  solution.forEach((row, r) => {
    for (let c = 0; c < width; c++) grid[r * width + c] = row[c] === '#' ? FILLED : EMPTY;
  });
  return { grid, width, height };
}

export function solutionFromGrid(grid: Grid, width: number, height: number): string[] {
  const out: string[] = [];
  for (let r = 0; r < height; r++) {
    let s = '';
    for (let c = 0; c < width; c++) s += grid[r * width + c] === FILLED ? '#' : '.';
    out.push(s);
  }
  return out;
}

export function cluesEqual(a: Clue, b: Clue): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Minimum length a clue needs: sum of runs plus one gap between each pair. */
export function minLength(clue: Clue): number {
  return clue.length === 0 ? 0 : clue.reduce((s, v) => s + v, 0) + clue.length - 1;
}

export function formatClue(clue: Clue): string {
  return clue.length === 0 ? '0' : clue.join(' ');
}

/**
 * Parse one clue line typed by a person: "3 1", "3,1", "3-1", "0" or blank.
 * Returns null if it contains anything other than non-negative integers.
 */
export function parseClue(text: string): Clue | null {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  const parts = trimmed.split(/[\s,;.\-]+/).filter(Boolean);
  const out: number[] = [];
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return null;
    const n = Number(p);
    if (n > 0) out.push(n);
  }
  return out;
}

export interface ClueIssue {
  axis: 'row' | 'col' | 'both';
  index: number;
  message: string;
}

/** Structural checks on a set of clues that do not need a solver. */
export function validateClues(clues: Clues): ClueIssue[] {
  const issues: ClueIssue[] = [];
  const { width, height } = clues;
  if (clues.rows.length !== height) {
    issues.push({ axis: 'row', index: -1, message: `Cần ${height} chỉ dẫn hàng, nhưng nhận được ${clues.rows.length}.` });
  }
  if (clues.cols.length !== width) {
    issues.push({ axis: 'col', index: -1, message: `Cần ${width} chỉ dẫn cột, nhưng nhận được ${clues.cols.length}.` });
  }
  clues.rows.forEach((clue, i) => {
    if (minLength(clue) > width) {
      issues.push({ axis: 'row', index: i, message: `Hàng ${i + 1}: "${formatClue(clue)}" cần ${minLength(clue)} ô nhưng hàng chỉ có ${width}.` });
    }
  });
  clues.cols.forEach((clue, i) => {
    if (minLength(clue) > height) {
      issues.push({ axis: 'col', index: i, message: `Cột ${i + 1}: "${formatClue(clue)}" cần ${minLength(clue)} ô nhưng cột chỉ có ${height}.` });
    }
  });
  const rowSum = clues.rows.flat().reduce((s, v) => s + v, 0);
  const colSum = clues.cols.flat().reduce((s, v) => s + v, 0);
  if (rowSum !== colSum) {
    issues.push({ axis: 'both', index: -1, message: `Chỉ dẫn hàng yêu cầu tô ${rowSum} ô nhưng chỉ dẫn cột yêu cầu ${colSum}. Hai tổng phải bằng nhau.` });
  }
  return issues;
}
