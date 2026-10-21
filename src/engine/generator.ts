import { EMPTY, FILLED, type Grid } from '../types/puzzle';
import { cluesFromGrid } from './clues';
import { solve } from './solver';

/** Small deterministic PRNG (mulberry32). Same seed, same sequence, on every platform. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PictureOptions {
  density?: number;
  /** Majority-rule smoothing passes. More passes make blobbier, less noisy shapes. */
  smoothing?: number;
  /** Mirror left-right. */
  mirror?: boolean;
}

/** Random picture: noise, smoothed into shapes. */
export function randomPicture(width: number, height: number, rng: () => number, opts: PictureOptions = {}): Grid {
  const density = opts.density ?? 0.55;
  const smoothing = opts.smoothing ?? 1;
  let g = new Uint8Array(width * height);
  for (let i = 0; i < g.length; i++) g[i] = rng() < density ? FILLED : EMPTY;
  for (let pass = 0; pass < smoothing; pass++) {
    const next = new Uint8Array(g.length);
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        let n = 0;
        let total = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr;
            const cc = c + dc;
            if (rr < 0 || cc < 0 || rr >= height || cc >= width) continue;
            total++;
            if (g[rr * width + cc] === FILLED) n++;
          }
        }
        next[r * width + c] = n * 2 > total ? FILLED : n * 2 === total ? g[r * width + c]! : EMPTY;
      }
    }
    g = next;
  }
  if (opts.mirror) {
    for (let r = 0; r < height; r++) {
      for (let c = 0; c < Math.floor(width / 2); c++) g[r * width + (width - 1 - c)] = g[r * width + c]!;
    }
  }
  return g;
}

export interface UniqueResult {
  grid: Grid;
  unique: boolean;
  /** Cells changed from the input picture. */
  flips: number[];
}

/**
 * Nudge a picture until its clues have exactly one solution.
 * Ambiguity lives in the cells where two solutions differ, so we try flipping
 * those cells first. `rank` orders candidate cells (lower is preferred).
 */
export function makeUnique(
  input: Grid,
  width: number,
  height: number,
  opts: { maxIterations?: number; stepLimit?: number; rank?: (cell: number, grid: Grid) => number; rng?: () => number } = {},
): UniqueResult {
  const maxIterations = opts.maxIterations ?? 24;
  const stepLimit = opts.stepLimit ?? 300_000;
  const rng = opts.rng ?? mulberry32(1);
  let grid = input.slice();
  const flips: number[] = [];

  const status = (g: Grid) => solve(cluesFromGrid(g, width, height), { maxSolutions: 2, stepLimit });

  let res = status(grid);
  for (let iter = 0; iter < maxIterations; iter++) {
    if (res.status === 'unique') return { grid, unique: true, flips };
    if (res.status !== 'multiple') return { grid, unique: false, flips };
    const [a, b] = res.solutions as [Grid, Grid];
    let diff: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff.push(i);
    if (opts.rank) diff = diff.sort((x, y) => opts.rank!(x, grid) - opts.rank!(y, grid) || x - y);
    diff = diff.slice(0, 48);

    let fixed = false;
    for (const cell of diff) {
      const trial = grid.slice();
      trial[cell] = trial[cell] === FILLED ? EMPTY : FILLED;
      const r = status(trial);
      if (r.status === 'unique') {
        grid = trial;
        flips.push(cell);
        res = r;
        fixed = true;
        break;
      }
    }
    if (fixed) return { grid, unique: true, flips };
    // No single flip settles it: flip one ambiguous cell and continue.
    const pick = diff[opts.rank ? 0 : Math.floor(rng() * diff.length)]!;
    grid[pick] = grid[pick] === FILLED ? EMPTY : FILLED;
    flips.push(pick);
    res = status(grid);
  }
  return { grid, unique: res.status === 'unique', flips };
}

export interface GeneratedPuzzle {
  grid: Grid;
  width: number;
  height: number;
  seed: number;
}

/** Generate a random puzzle with a proven unique solution. Deterministic for a given seed. */
export function generatePuzzle(width: number, height: number, seed: number, opts: PictureOptions = {}): GeneratedPuzzle | null {
  const rng = mulberry32(seed);
  for (let attempt = 0; attempt < 12; attempt++) {
    const pic = randomPicture(width, height, rng, opts);
    const res = makeUnique(pic, width, height, { rng });
    if (res.unique) return { grid: res.grid, width, height, seed };
  }
  return null;
}
