import { EMPTY, FILLED, UNKNOWN, type Clue } from '../types/puzzle';

/**
 * Line-level reasoning.
 *
 * A "placement" of a clue in a line is one way to put every run in the line,
 * in order, with at least one empty cell between runs. A placement is
 * "consistent" with a partially known line if it fills every FILLED cell and
 * leaves every EMPTY cell empty.
 *
 * Everything here is built on one dynamic program over states (i, j):
 * "cells i.. are still to be explained, runs j.. are still to be placed".
 * From a state, the next cell is either empty, or run j starts there.
 */

interface Tables {
  n: number;
  k: number;
  /** suffix feasibility (or counts), index i * (k + 1) + j */
  table: Float64Array;
}

function canStartRun(line: ArrayLike<number>, emptyPrefix: Int32Array, s: number, len: number): boolean {
  const n = line.length;
  const end = s + len;
  if (end > n) return false;
  if (emptyPrefix[end]! - emptyPrefix[s]! !== 0) return false;
  if (end < n && line[end] === FILLED) return false;
  return true;
}

function emptyPrefixOf(line: ArrayLike<number>): Int32Array {
  const n = line.length;
  const p = new Int32Array(n + 1);
  for (let i = 0; i < n; i++) p[i + 1] = p[i]! + (line[i] === EMPTY ? 1 : 0);
  return p;
}

/** Suffix table of the number of consistent completions from each state. */
function suffixCounts(clue: Clue, line: ArrayLike<number>, emptyPrefix: Int32Array): Tables {
  const n = line.length;
  const k = clue.length;
  const W = k + 1;
  const table = new Float64Array((n + 1) * W);
  table[n * W + k] = 1;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = 0; j <= k; j++) {
      let total = 0;
      if (line[i] !== FILLED) total += table[(i + 1) * W + j]!;
      if (j < k) {
        const len = clue[j]!;
        if (canStartRun(line, emptyPrefix, i, len)) {
          const next = Math.min(n, i + len + 1);
          total += table[next * W + j + 1]!;
        }
      }
      table[i * W + j] = total;
    }
  }
  return { n, k, table };
}

/** Number of placements of `clue` consistent with `line`. */
export function countPlacements(clue: Clue, line: ArrayLike<number>): number {
  const ep = emptyPrefixOf(line);
  const { table } = suffixCounts(clue, line, ep);
  return table[0]!;
}

/** Placements of `clue` in an empty line of length n. */
export function totalPlacements(clue: Clue, n: number): number {
  return countPlacements(clue, new Uint8Array(n));
}

export type LineResult =
  | { ok: false }
  | {
      ok: true;
      /** The line with every forced cell set. */
      line: Uint8Array;
      /** Indices of cells that were UNKNOWN and are now forced. */
      changed: number[];
      /** Consistent placements before this deduction (equals after: deduction does not remove placements). */
      placements: number;
    };

/**
 * Find every cell that has the same value in all consistent placements.
 * Returns ok:false when no placement is consistent (a contradiction).
 */
export function solveLine(clue: Clue, line: ArrayLike<number>): LineResult {
  const n = line.length;
  const k = clue.length;
  const W = k + 1;
  const ep = emptyPrefixOf(line);
  const { table } = suffixCounts(clue, line, ep);
  const placements = table[0]!;
  if (placements === 0) return { ok: false };

  const canFill = new Uint8Array(n);
  const canEmpty = new Uint8Array(n);
  const reach = new Uint8Array((n + 1) * W);
  reach[0] = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= k; j++) {
      if (!reach[i * W + j] || table[i * W + j] === 0) continue;
      if (line[i] !== FILLED && table[(i + 1) * W + j]! > 0) {
        canEmpty[i] = 1;
        reach[(i + 1) * W + j] = 1;
      }
      if (j < k) {
        const len = clue[j]!;
        if (canStartRun(line, ep, i, len)) {
          const next = Math.min(n, i + len + 1);
          if (table[next * W + j + 1]! > 0) {
            for (let t = i; t < i + len; t++) canFill[t] = 1;
            if (i + len < n) canEmpty[i + len] = 1;
            reach[next * W + j + 1] = 1;
          }
        }
      }
    }
  }

  const out = new Uint8Array(n);
  const changed: number[] = [];
  for (let i = 0; i < n; i++) {
    const cur = line[i] as number;
    if (cur !== UNKNOWN) {
      out[i] = cur;
      continue;
    }
    if (canFill[i] && !canEmpty[i]) {
      out[i] = FILLED;
      changed.push(i);
    } else if (canEmpty[i] && !canFill[i]) {
      out[i] = EMPTY;
      changed.push(i);
    } else out[i] = UNKNOWN;
  }
  return { ok: true, line: out, changed, placements };
}

/**
 * Enumerate placements explicitly (used by the Learn page and tests).
 * Stops after `limit` patterns. Patterns use FILLED / EMPTY values.
 */
export function generatePatterns(
  clue: Clue,
  n: number,
  options: { limit?: number; consistentWith?: ArrayLike<number> } = {},
): Uint8Array[] {
  const limit = options.limit ?? 10_000;
  const known = options.consistentWith;
  const out: Uint8Array[] = [];
  const cur = new Uint8Array(n).fill(EMPTY);
  const k = clue.length;
  // minimum room needed by runs j.. (inclusive of gaps)
  const need = new Array<number>(k + 1).fill(0);
  for (let j = k - 1; j >= 0; j--) need[j] = clue[j]! + (j < k - 1 ? 1 + need[j + 1]! : 0);

  const fits = (): boolean => {
    if (!known) return true;
    for (let i = 0; i < n; i++) {
      const v = known[i];
      if (v !== UNKNOWN && v !== cur[i]) return false;
    }
    return true;
  };

  const place = (j: number, from: number): void => {
    if (out.length >= limit) return;
    if (j === k) {
      if (fits()) out.push(cur.slice());
      return;
    }
    const len = clue[j]!;
    for (let s = from; s + need[j]! <= n; s++) {
      for (let t = s; t < s + len; t++) cur[t] = FILLED;
      place(j + 1, s + len + 1);
      for (let t = s; t < s + len; t++) cur[t] = EMPTY;
      if (out.length >= limit) return;
    }
  };
  place(0, 0);
  return out;
}
