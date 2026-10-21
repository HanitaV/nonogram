import { describe, expect, it } from 'vitest';
import { parsePuzzleFile, toPuzzleFile } from '../lib/puzzleIO';
import { decodeShare, encodeShare } from '../lib/share';
import { toLpFormat, ilpStats, startRange } from '../engine/ilp';
import { cluesOf } from './helpers';
import { MAX_PUZZLE_SIZE } from '../lib/puzzleLimits';
import { defaultSave, migrate } from '../lib/storage';

const sample = { name: 'Tiny ☕', width: 3, height: 2, solution: ['#.#', '###'] };

describe('import / export', () => {
  it('round-trips a puzzle file', () => {
    const text = JSON.stringify(toPuzzleFile(sample));
    const r = parsePuzzleFile(text);
    expect(r).toEqual({ ok: true, name: 'Tiny ☕', width: 3, height: 2, solution: ['#.#', '###'] });
  });

  it('rejects invalid files with a reason', () => {
    expect(parsePuzzleFile('{oops').ok).toBe(false);
    expect(parsePuzzleFile('{}').ok).toBe(false);
    const wrongRow = { ...toPuzzleFile(sample), solution: ['#.#', '##'] };
    expect(parsePuzzleFile(JSON.stringify(wrongRow))).toMatchObject({ ok: false });
    const wrongClues = { ...toPuzzleFile(sample), rows: [[1], [3]] };
    expect(parsePuzzleFile(JSON.stringify(wrongClues))).toEqual({ ok: false, error: 'Chỉ dẫn trong tệp không khớp với đáp án.' });
    const tooBig = { ...toPuzzleFile(sample), width: MAX_PUZZLE_SIZE + 1 };
    expect(parsePuzzleFile(JSON.stringify(tooBig)).ok).toBe(false);
  });

  it('accepts files without clues', () => {
    const { rows: _r, cols: _c, ...rest } = toPuzzleFile(sample);
    expect(parsePuzzleFile(JSON.stringify(rest)).ok).toBe(true);
  });

  it('preserves a detailed image puzzle through JSON, sharing and persistence', () => {
    const width = MAX_PUZZLE_SIZE;
    const height = 150;
    const large = {
      name: 'HAMIC', width, height,
      solution: Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => (r + c) % 3 === 0 ? '#' : '.').join('')),
    };
    expect(parsePuzzleFile(JSON.stringify(toPuzzleFile(large)))).toEqual({ ok: true, ...large });
    expect(decodeShare(encodeShare(large))).toEqual(large);
    const save = defaultSave();
    save.puzzles.push({ ...large, id: 'hamic', source: 'custom', unique: null, createdAt: 1 });
    expect(migrate(JSON.parse(JSON.stringify(save))).puzzles).toEqual(save.puzzles);
    const invalid = { ...large, width: MAX_PUZZLE_SIZE + 1, solution: large.solution.map((row) => row + '.') };
    expect(parsePuzzleFile(JSON.stringify({ format: 'nonogram-studio/puzzle', version: 1, ...invalid })).ok).toBe(false);
    expect(decodeShare(encodeShare(invalid))).toBeNull();
  });
});

describe('share links', () => {
  it('round-trips puzzles through a URL-safe code', () => {
    const code = encodeShare(sample);
    expect(code).toMatch(/^[A-Za-z0-9_.x-]+$/);
    expect(decodeShare(code)).toEqual({ width: 3, height: 2, solution: ['#.#', '###'], name: 'Tiny ☕' });
  });

  it('rejects malformed codes', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('3x2.@@@')).toBeNull();
    expect(decodeShare('99x2.AA')).toBeNull();
    expect(decodeShare('3x2.AAAA')).toBeNull(); // wrong byte length
  });
});

describe('ILP model export', () => {
  it('computes start ranges', () => {
    expect(startRange([3, 1], 7, 0)).toEqual([0, 2]);
    expect(startRange([3, 1], 7, 1)).toEqual([4, 6]);
  });

  it('writes a model with one start constraint per run and one link per cell', () => {
    const clues = cluesOf(['#.#', '###']);
    const stats = ilpStats(clues);
    const runs = clues.rows.flat().length + clues.cols.flat().length;
    const gaps = clues.rows.concat(clues.cols).reduce((s, c) => s + Math.max(0, c.length - 1), 0);
    expect(stats.cellVars).toBe(6);
    expect(stats.constraints).toBe(runs + gaps + 2 * 6);
    const lp = toLpFormat(clues);
    expect(lp).toContain('Subject To');
    expect(lp).toContain('r0_gap0:');
    expect(lp.trim().endsWith('End')).toBe(true);
  });
});
