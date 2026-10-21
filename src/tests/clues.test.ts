import { describe, expect, it } from 'vitest';
import { cluesFromGrid, formatClue, gridFromSolution, lineClue, minLength, parseClue, solutionFromGrid, validateClues } from '../engine/clues';
import { FILLED } from '../types/puzzle';

describe('clue generation', () => {
  it('reads runs from a line', () => {
    expect(lineClue([1, 1, 0, 1, 2, 1, 1, 1])).toEqual([2, 1, 3]);
    expect(lineClue([0, 0, 0])).toEqual([]);
    expect(lineClue([1, 1, 1])).toEqual([3]);
  });

  it('computes row and column clues from a solution', () => {
    const { grid, width, height } = gridFromSolution(['#.#', '###', '..#']);
    const c = cluesFromGrid(grid, width, height);
    expect(c.rows).toEqual([[1, 1], [3], [1]]);
    expect(c.cols).toEqual([[2], [1], [3]]);
  });

  it('round-trips solutions through grids', () => {
    const rows = ['#..#', '.##.', '####'];
    const { grid, width, height } = gridFromSolution(rows);
    expect(grid[0]).toBe(FILLED);
    expect(solutionFromGrid(grid, width, height)).toEqual(rows);
  });

  it('parses typed clues', () => {
    expect(parseClue('3 1')).toEqual([3, 1]);
    expect(parseClue('3,1')).toEqual([3, 1]);
    expect(parseClue('  ')).toEqual([]);
    expect(parseClue('0')).toEqual([]);
    expect(parseClue('3 a')).toBeNull();
    expect(formatClue([])).toBe('0');
    expect(minLength([3, 1, 2])).toBe(8);
  });

  it('reports structural clue problems', () => {
    const issues = validateClues({ width: 3, height: 2, rows: [[2, 2], [1]], cols: [[1], [1], [1]] });
    expect(issues.some((i) => i.message.includes('cần 5 ô'))).toBe(true);
    expect(issues.some((i) => i.message.includes('phải bằng nhau'))).toBe(true);
    expect(validateClues({ width: 2, height: 1, rows: [[1]], cols: [[1], []] })).toEqual([]);
  });
});
