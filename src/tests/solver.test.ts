import { describe, expect, it } from 'vitest';
import { cluesFromGrid } from '../engine/clues';
import { mulberry32 } from '../engine/generator';
import { solve } from '../engine/solver';
import { isSolution } from '../engine/validation';
import { EMPTY, FILLED } from '../types/puzzle';
import { bruteForceByRows, bruteForceCount, cluesOf } from './helpers';

describe('solver', () => {
  it('solves a puzzle by line logic', () => {
    const clues = cluesOf(['.#.#.', '#####', '#####', '.###.', '..#..']);
    const r = solve(clues);
    expect(r.status).toBe('unique');
    expect(r.uniqueProven).toBe(true);
    expect(r.logicOnly).toBe(true);
    expect(isSolution(clues, r.solutions[0]!)).toBe(true);
  });

  it('detects multiple solutions', () => {
    const r = solve({ width: 2, height: 2, rows: [[1], [1]], cols: [[1], [1]] });
    expect(r.status).toBe('multiple');
    expect(r.solutions).toHaveLength(2);
    expect(r.uniqueProven).toBe(false);
    for (const s of r.solutions) expect(isSolution({ width: 2, height: 2, rows: [[1], [1]], cols: [[1], [1]] }, s)).toBe(true);
  });

  it('detects contradictory clues', () => {
    const r = solve({ width: 3, height: 3, rows: [[3], [], []], cols: [[1], [], [1]] });
    expect(r.status).toBe('none');
    expect(r.complete).toBe(true);
    expect(r.solutions).toHaveLength(0);
  });

  it('detects contradictions that only appear after branching', () => {
    // Row and column totals match and each line alone fits, but no grid satisfies all of them.
    const clues = { width: 5, height: 5, rows: [[1, 1], [1, 2], [1], [1, 1], [1, 1]], cols: [[2], [3], [1, 1], [1], [1, 1]] };
    expect(bruteForceByRows(clues)).toBe(0);
    const r = solve(clues);
    expect(r.status).toBe('none');
    expect(r.branches).toBeGreaterThan(0);
  });

  it('respects the step limit and does not claim uniqueness', () => {
    const clues = cluesOf(['#..#..#.', '.#..#..#', '..#..#..', '#..#..#.', '.#..#..#', '..#..#..', '#..#..#.', '.#..#..#']);
    const r = solve(clues, { stepLimit: 3 });
    expect(r.status).toBe('limit');
    expect(r.complete).toBe(false);
    expect(r.uniqueProven).toBe(false);
  });

  it('agrees with brute force on random 4x4 puzzles', () => {
    const rng = mulberry32(7);
    for (let t = 0; t < 120; t++) {
      const grid = new Uint8Array(16);
      for (let i = 0; i < 16; i++) grid[i] = rng() < 0.5 ? FILLED : EMPTY;
      const clues = cluesFromGrid(grid, 4, 4);
      const expected = bruteForceCount(clues, 2);
      const r = solve(clues);
      expect(r.status).toBe(expected >= 2 ? 'multiple' : 'unique');
      for (const s of r.solutions) expect(isSolution(clues, s)).toBe(true);
    }
  });

  it('honours a starting grid', () => {
    const clues = { width: 2, height: 2, rows: [[1], [1]], cols: [[1], [1]] };
    const initial = Uint8Array.from([FILLED, 0, 0, 0]);
    const r = solve(clues, { initial });
    expect(r.status).toBe('unique');
    expect(Array.from(r.solutions[0]!)).toEqual([FILLED, EMPTY, EMPTY, FILLED]);
    const bad = solve(clues, { initial: Uint8Array.from([FILLED, FILLED, 0, 0]) });
    expect(bad.status).toBe('none');
  });

  it('records real events that replay to the solution', () => {
    const clues = cluesOf(['#..#', '.##.', '.##.', '#..#']);
    const r = solve(clues, { record: true });
    expect(r.events.length).toBeGreaterThan(0);
    // Replay: apply line events and branches, restoring on backtrack.
    let g: Uint8Array = new Uint8Array(16);
    const stack: Uint8Array[] = [];
    let first: Uint8Array | null = null;
    for (const e of r.events) {
      if (e.type === 'line') e.cells.forEach((c, i) => (g[c] = e.values[i]!));
      else if (e.type === 'branch') {
        stack.push(g.slice());
        g[e.cell] = e.value;
      } else if (e.type === 'backtrack') g = stack.pop()!;
      else if (e.type === 'solution' && !first) first = g.slice();
    }
    expect(first).not.toBeNull();
    expect(Array.from(first!)).toEqual(Array.from(r.solutions[0]!));
  });
});
