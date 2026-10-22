import { describe, expect, it } from 'vitest';
import { checkBoard, contradictoryCells, isSolution, mistakesAgainst } from '../engine/validation';
import { EMPTY, FILLED, UNKNOWN } from '../types/puzzle';
import { cluesOf } from './helpers';

const F = FILLED, E = EMPTY, U = UNKNOWN;

describe('completion validation', () => {
  const clues = cluesOf(['#.', '.#']); // two solutions exist

  it('accepts any arrangement that satisfies the clues, not only the stored answer', () => {
    expect(checkBoard(clues, Uint8Array.from([F, E, E, F])).state).toBe('solved');
    expect(checkBoard(clues, Uint8Array.from([E, F, F, E])).state).toBe('solved');
  });

  it('treats unmarked cells as empty when judging a finished picture', () => {
    expect(checkBoard(clues, Uint8Array.from([F, U, U, F])).state).toBe('solved');
  });

  it('distinguishes incomplete from contradictory', () => {
    expect(checkBoard(clues, Uint8Array.from([F, U, U, U])).state).toBe('incomplete');
    const bad = checkBoard(clues, Uint8Array.from([F, F, U, U]));
    expect(bad.state).toBe('contradiction');
    expect(bad.rows[0]!.impossible).toBe(true);
  });

  it('marks satisfied lines and counts progress', () => {
    const c = cluesOf(['##.', '..#', '###']);
    const check = checkBoard(c, Uint8Array.from([F, F, U, U, U, U, U, U, U]));
    expect(check.rows[0]!.satisfied).toBe(true);
    expect(check.rows[1]!.satisfied).toBe(false);
    expect(check.filled).toBe(2);
    expect(check.target).toBe(6);
  });

  it('isSolution and mistakesAgainst', () => {
    expect(isSolution(clues, Uint8Array.from([F, E, E, F]))).toBe(true);
    expect(isSolution(clues, Uint8Array.from([F, F, E, E]))).toBe(false);
    expect(mistakesAgainst(Uint8Array.from([F, F, U, E]), Uint8Array.from([F, E, E, F]))).toEqual([1, 3]);
  });

  it('does not flag a move that differs from the answer while both lines still fit', () => {
    const c = cluesOf(['##.', '.#.', '..#']);
    const board = Uint8Array.from([U, U, F, U, U, U, U, U, U]);
    expect(checkBoard(c, board).state).toBe('incomplete');
    expect(contradictoryCells(c, board)).toEqual([]);
  });

  it('flags known cells in contradictory lines and clears them when repaired', () => {
    const board = Uint8Array.from([F, F, U, E]);
    // Row 0 has too many fills; the valid mark in row 1 is not flagged.
    expect(contradictoryCells(clues, board)).toEqual([0, 1]);
    board[1] = U;
    board[3] = U;
    expect(contradictoryCells(clues, board)).toEqual([]);
  });

  it('detects empty marks that block a required run', () => {
    const c = cluesOf(['##.', '.#.', '..#']);
    const board = Uint8Array.from([U, E, U, U, U, U, U, U, U]);
    expect(contradictoryCells(c, board)).toEqual([1]);
  });

  it('does not flag an alternative valid solution', () => {
    expect(contradictoryCells(clues, Uint8Array.from([E, F, F, E]))).toEqual([]);
  });
});
