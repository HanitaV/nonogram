import type { Clue, Clues } from '../types/puzzle';

/**
 * Builds the integer linear programming model described on the Learn page,
 * written in CPLEX LP text format. Nonogram Studio does not solve this model
 * in the browser; the file can be opened by an ILP solver such as HiGHS,
 * GLPK, CBC or Gurobi.
 *
 *   x[r,c] ∈ {0,1}            cell (r,c) is filled
 *   s[r,b,j] ∈ {0,1}          run b of row r starts at column j
 *   t[c,b,i] ∈ {0,1}          run b of column c starts at row i
 */

export function startRange(clue: Clue, n: number, b: number): [number, number] {
  let earliest = 0;
  for (let a = 0; a < b; a++) earliest += clue[a]! + 1;
  let tail = 0;
  for (let a = b; a < clue.length; a++) tail += clue[a]! + (a > b ? 1 : 0);
  return [earliest, n - tail];
}

export interface IlpStats {
  cellVars: number;
  startVars: number;
  constraints: number;
}

interface Built {
  lines: string[];
  binaries: string[];
  stats: IlpStats;
}

function build(clues: Clues): Built {
  const { width, height } = clues;
  const lines: string[] = [];
  const binaries: string[] = [];
  let startVars = 0;
  let constraints = 0;
  const x = (r: number, c: number) => `x_${r}_${c}`;
  for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) binaries.push(x(r, c));

  const addLine = (kind: 'r' | 'c', idx: number, clue: Clue, n: number) => {
    const sv = (b: number, j: number) => (kind === 'r' ? `s_${idx}_${b}_${j}` : `t_${idx}_${b}_${j}`);
    const cell = (p: number) => (kind === 'r' ? x(idx, p) : x(p, idx));
    const ranges = clue.map((_, b) => startRange(clue, n, b));
    // each run starts exactly once
    clue.forEach((_, b) => {
      const [lo, hi] = ranges[b]!;
      const terms: string[] = [];
      for (let j = lo; j <= hi; j++) {
        terms.push(sv(b, j));
        binaries.push(sv(b, j));
        startVars++;
      }
      lines.push(` ${kind}${idx}_run${b}_once: ${terms.join(' + ')} = 1`);
      constraints++;
    });
    // runs in order with at least one gap
    for (let b = 0; b + 1 < clue.length; b++) {
      const [lo1, hi1] = ranges[b + 1]!;
      const [lo0, hi0] = ranges[b]!;
      const terms: string[] = [];
      for (let j = lo1; j <= hi1; j++) if (j !== 0) terms.push(`+ ${j} ${sv(b + 1, j)}`);
      for (let j = lo0; j <= hi0; j++) if (j !== 0) terms.push(`- ${j} ${sv(b, j)}`);
      lines.push(` ${kind}${idx}_gap${b}: ${terms.join(' ').replace(/^\+ /, '')} >= ${clue[b]! + 1}`);
      constraints++;
    }
    // link starts to cells: x = Σ over placements covering the cell
    for (let p = 0; p < n; p++) {
      const cover: string[] = [];
      clue.forEach((len, b) => {
        const [lo, hi] = ranges[b]!;
        for (let j = Math.max(lo, p - len + 1); j <= Math.min(hi, p); j++) cover.push(`- ${sv(b, j)}`);
      });
      lines.push(` ${kind}${idx}_cell${p}: ${cell(p)} ${cover.join(' ')} = 0`.replace(/\s+=/, ' ='));
      constraints++;
    }
  };

  for (let r = 0; r < height; r++) addLine('r', r, clues.rows[r]!, width);
  for (let c = 0; c < width; c++) addLine('c', c, clues.cols[c]!, height);
  return { lines, binaries, stats: { cellVars: width * height, startVars, constraints } };
}

export function ilpStats(clues: Clues): IlpStats {
  return build(clues).stats;
}

export function toLpFormat(clues: Clues, title = 'Nonogram'): string {
  const { lines, binaries, stats } = build(clues);
  const out: string[] = [];
  out.push(`\\ ${title}: ${clues.width}x${clues.height} nonogram dưới dạng bài toán khả thi 0-1`);
  out.push(`\\ ${stats.cellVars} biến ô, ${stats.startVars} biến vị trí bắt đầu đoạn, ${stats.constraints} ràng buộc`);
  out.push('Minimize');
  out.push(' obj: 0 x_0_0');
  out.push('Subject To');
  out.push(...lines);
  out.push('Binary');
  for (let i = 0; i < binaries.length; i += 8) out.push(' ' + binaries.slice(i, i + 8).join(' '));
  out.push('End');
  return out.join('\n') + '\n';
}
