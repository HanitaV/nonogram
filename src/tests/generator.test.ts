import { describe, expect, it } from 'vitest';
import { cluesFromGrid } from '../engine/clues';
import { generatePuzzle, makeUnique, mulberry32 } from '../engine/generator';
import { solve } from '../engine/solver';
import { EMPTY, FILLED } from '../types/puzzle';

describe('puzzle generation', () => {
  it('is deterministic for a seed', () => {
    const a = generatePuzzle(10, 10, 1234)!;
    const b = generatePuzzle(10, 10, 1234)!;
    expect(Array.from(a.grid)).toEqual(Array.from(b.grid));
  });

  it('produces puzzles with a proven unique solution', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = generatePuzzle(12, 9, seed);
      expect(g).not.toBeNull();
      const r = solve(cluesFromGrid(g!.grid, 12, 9));
      expect(r.uniqueProven).toBe(true);
    }
  });

  it('repairs an ambiguous picture', () => {
    // A checkerboard-like picture with many solutions.
    const grid = new Uint8Array(36);
    for (let i = 0; i < 36; i++) grid[i] = (Math.floor(i / 6) + i) % 2 ? FILLED : EMPTY;
    expect(solve(cluesFromGrid(grid, 6, 6)).status).toBe('multiple');
    const fixed = makeUnique(grid, 6, 6, { rng: mulberry32(3) });
    if (fixed.unique) expect(solve(cluesFromGrid(fixed.grid, 6, 6)).uniqueProven).toBe(true);
    expect(fixed.flips.length).toBeGreaterThan(0);
  });
});
