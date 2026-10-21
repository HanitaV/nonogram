import { describe, expect, it } from 'vitest';
import { countPlacements, generatePatterns, solveLine, totalPlacements } from '../engine/patterns';
import { EMPTY, FILLED, UNKNOWN } from '../types/puzzle';

const U = UNKNOWN, F = FILLED, E = EMPTY;

describe('line patterns', () => {
  it('enumerates every placement', () => {
    const p = generatePatterns([2, 1], 5).map((x) => Array.from(x, (v) => (v === F ? '#' : '.')).join(''));
    expect(p.sort()).toEqual(['##.#.', '##..#', '.##.#'].sort());
  });

  it('counts placements with binomial coefficients on an empty line', () => {
    // free space = n - minLength, placements = C(free + k, k)
    expect(totalPlacements([3, 1], 10)).toBe(21); // free 5, k 2 -> C(7,2)
    expect(totalPlacements([], 6)).toBe(1);
    expect(totalPlacements([7], 6)).toBe(0);
  });

  it('counting agrees with enumeration on partially known lines', () => {
    const known = [U, F, U, U, E, U, U, U, F, U];
    for (const clue of [[2], [2, 3], [1, 1, 1], [3, 2], [4]]) {
      expect(countPlacements(clue, known)).toBe(generatePatterns(clue, 10, { consistentWith: known }).length);
    }
  });

  it('finds overlap cells', () => {
    const r = solveLine([8], new Uint8Array(10));
    expect(r.ok && Array.from(r.line)).toEqual([U, U, F, F, F, F, F, F, U, U]);
  });

  it('fills a full line and empties a zero line', () => {
    const full = solveLine([2, 2], new Uint8Array(5));
    expect(full.ok && Array.from(full.line)).toEqual([F, F, E, F, F]);
    const zero = solveLine([], new Uint8Array(3));
    expect(zero.ok && Array.from(zero.line)).toEqual([E, E, E]);
  });

  it('uses marks and fills', () => {
    const r = solveLine([3], Uint8Array.from([U, U, E, U, F, U, U]));
    // the run must include index 4 and avoid index 2: it starts at 3 or 4, so index 5 is forced
    expect(r.ok && Array.from(r.line)).toEqual([E, E, E, U, F, F, U]);
  });

  it('detects contradictions', () => {
    expect(solveLine([3], Uint8Array.from([U, E, U, E, U])).ok).toBe(false);
    expect(solveLine([1], Uint8Array.from([F, U, F])).ok).toBe(false);
    expect(solveLine([], Uint8Array.from([U, F])).ok).toBe(false);
  });

  it('agrees with brute force on every 7-cell partial line for some clues', () => {
    const clues = [[1], [2, 1], [1, 1, 1], [3, 2], [7]];
    // sample partial lines deterministically
    for (let seed = 0; seed < 400; seed++) {
      const line = new Uint8Array(7);
      let s = seed * 2654435761;
      for (let i = 0; i < 7; i++) {
        s = (s * 1103515245 + 12345) >>> 0;
        line[i] = [U, U, U, F, E][s % 5]!;
      }
      for (const clue of clues) {
        const all = generatePatterns(clue, 7, { consistentWith: line });
        const r = solveLine(clue, line);
        if (all.length === 0) {
          expect(r.ok).toBe(false);
          continue;
        }
        expect(r.ok).toBe(true);
        if (!r.ok) continue;
        for (let i = 0; i < 7; i++) {
          const values = new Set(all.map((p) => p[i]));
          const expected = line[i] !== U ? line[i] : values.size === 1 ? [...values][0] : U;
          expect(r.line[i]).toBe(expected);
        }
      }
    }
  });
});
