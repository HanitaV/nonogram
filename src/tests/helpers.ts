import { generatePatterns } from '../engine/patterns';
import { lineClue } from '../engine/clues';
import { cluesFromGrid, gridFromSolution } from '../engine/clues';
import type { Clues } from '../types/puzzle';

export function cluesOf(rows: string[]): Clues {
  const { grid, width, height } = gridFromSolution(rows);
  return cluesFromGrid(grid, width, height);
}

/** Count solutions by checking every possible grid. Only for tiny puzzles. */
export function bruteForceCount(clues: Clues, cap = 3): number {
  const n = clues.width * clues.height;
  let count = 0;
  for (let mask = 0; mask < 1 << n; mask++) {
    const rows: string[] = [];
    for (let r = 0; r < clues.height; r++) {
      let s = '';
      for (let c = 0; c < clues.width; c++) s += mask & (1 << (r * clues.width + c)) ? '#' : '.';
      rows.push(s);
    }
    const got = cluesOf(rows);
    if (JSON.stringify(got.rows) === JSON.stringify(clues.rows) && JSON.stringify(got.cols) === JSON.stringify(clues.cols)) {
      count++;
      if (count >= cap) return count;
    }
  }
  return count;
}

/** Count solutions by combining every valid pattern of every row. Independent of the solver. */
export function bruteForceByRows(clues: Clues, cap = 3): number {
  const rowPatterns = clues.rows.map((c) => generatePatterns(c, clues.width));
  let count = 0;
  const chosen: Uint8Array[] = [];
  const rec = (r: number): void => {
    if (count >= cap) return;
    if (r === clues.height) {
      for (let c = 0; c < clues.width; c++) {
        const col = chosen.map((row) => row[c]!);
        if (JSON.stringify(lineClue(col)) !== JSON.stringify(clues.cols[c])) return;
      }
      count++;
      return;
    }
    for (const p of rowPatterns[r]!) {
      chosen.push(p);
      rec(r + 1);
      chosen.pop();
    }
  };
  rec(0);
  return count;
}
