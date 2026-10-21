import { describe, expect, it } from 'vitest';
import { cluesEqual, cluesFromGrid, gridFromSolution } from '../engine/clues';
import { solve } from '../engine/solver';
import { isSolution, checkBoard } from '../engine/validation';
import { validateClues } from '../engine/clues';
import { LIBRARY } from '../data/puzzles';

const sizes = { beginner: 5, easy: 8, intermediate: 10, advanced: 15 } as const;

describe('curated library', () => {
  it('has at least ten puzzles per tier and unique ids', () => {
    for (const [tier, size] of Object.entries(sizes)) {
      const list = LIBRARY.filter((p) => p.difficulty === tier);
      expect(list.length).toBeGreaterThanOrEqual(10);
      for (const p of list) expect([p.width, p.height]).toEqual([size, size]);
    }
    expect(new Set(LIBRARY.map((p) => p.id)).size).toBe(LIBRARY.length);
  });

  for (const p of LIBRARY) {
    it(`${p.id}: dimensions, clues, solution and uniqueness`, () => {
      // 1. dimensions
      expect(p.solution).toHaveLength(p.height);
      for (const row of p.solution) expect(row).toHaveLength(p.width);
      expect(p.rows).toHaveLength(p.height);
      expect(p.cols).toHaveLength(p.width);
      // 2. clues match the stored solution
      const { grid } = gridFromSolution(p.solution);
      const derived = cluesFromGrid(grid, p.width, p.height);
      p.rows.forEach((c, i) => expect(cluesEqual(c, derived.rows[i]!)).toBe(true));
      p.cols.forEach((c, i) => expect(cluesEqual(c, derived.cols[i]!)).toBe(true));
      // 5. no structurally contradictory clues
      expect(validateClues(p)).toEqual([]);
      // 3 + 4. the solver finds a valid solution and proves it is the only one
      const r = solve(p, { maxSolutions: 2 });
      expect(r.status).toBe('unique');
      expect(r.uniqueProven).toBe(true);
      expect(isSolution(p, r.solutions[0]!)).toBe(true);
      expect(checkBoard(p, r.solutions[0]!).state).toBe('solved');
    });
  }
});
