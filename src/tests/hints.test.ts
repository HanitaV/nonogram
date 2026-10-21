import { describe, expect, it } from 'vitest';
import { gridFromSolution } from '../engine/clues';
import { computeHint } from '../engine/hints';
import { EMPTY, FILLED } from '../types/puzzle';
import { cluesOf } from './helpers';

describe('hints', () => {
  it('starts with a single-line deduction', () => {
    const clues = cluesOf(['#####', '.#.#.', '.....', '#...#', '.###.']);
    const h = computeHint(clues, new Uint8Array(25));
    expect(h.kind).toBe('line');
    if (h.kind === 'line') expect(h.cells.length).toBeGreaterThan(0);
  });

  it('points at a broken line', () => {
    const clues = cluesOf(['#.', '.#']);
    const h = computeHint(clues, Uint8Array.from([FILLED, FILLED, 0, 0]));
    expect(h).toMatchObject({ kind: 'line-contradiction', axis: 'row', index: 0 });
  });

  it('reports a board that can no longer reach a solution, with mistakes when the answer is unique', () => {
    const rows = ['##.', '#..', '...'];
    const clues = cluesOf(rows);
    const { grid } = gridFromSolution(rows);
    // Mark (0,0) empty: every line still has a placement, but no solution fits.
    const board = new Uint8Array(9);
    board[0] = EMPTY;
    const h = computeHint(clues, board, { uniqueSolution: grid });
    expect(['inconsistent', 'line-contradiction']).toContain(h.kind);
    if (h.kind === 'inconsistent') expect(h.mistakes).toEqual([0]);
  });

  it('falls back to look-ahead or a labelled reveal when line logic is exhausted', () => {
    // 2x2 with two solutions: no line or look-ahead deduction exists.
    const clues = { width: 2, height: 2, rows: [[1], [1]], cols: [[1], [1]] };
    const h = computeHint(clues, new Uint8Array(4));
    expect(h.kind).toBe('reveal');
    if (h.kind === 'reveal') expect(h.fromUniqueSolution).toBe(false);
  });
});
