/// <reference lib="webworker" />
import { computeHint, type Hint } from '../engine/hints';
import { generatePuzzle } from '../engine/generator';
import { solve, type SolveOptions, type SolveResult } from '../engine/solver';
import type { Clues } from '../types/puzzle';

export type WorkerRequest =
  | { id: number; type: 'solve'; clues: Clues; options: Omit<SolveOptions, 'initial'> & { initial?: number[] } }
  | { id: number; type: 'hint'; clues: Clues; board: number[]; uniqueSolution: number[] | null }
  | { id: number; type: 'generate'; width: number; height: number; seed: number };

export type WorkerResponse =
  | { id: number; type: 'solve'; result: SolveResult }
  | { id: number; type: 'hint'; hint: Hint }
  | { id: number; type: 'generate'; grid: number[] | null }
  | { id: number; type: 'error'; message: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === 'solve') {
      const { initial, ...rest } = req.options;
      const result = solve(req.clues, { ...rest, initial: initial ? Uint8Array.from(initial) : undefined });
      ctx.postMessage({ id: req.id, type: 'solve', result } satisfies WorkerResponse);
    } else if (req.type === 'hint') {
      const hint = computeHint(req.clues, Uint8Array.from(req.board), {
        uniqueSolution: req.uniqueSolution ? Uint8Array.from(req.uniqueSolution) : null,
      });
      ctx.postMessage({ id: req.id, type: 'hint', hint } satisfies WorkerResponse);
    } else if (req.type === 'generate') {
      const g = generatePuzzle(req.width, req.height, req.seed, { density: 0.55, smoothing: 1 });
      ctx.postMessage({ id: req.id, type: 'generate', grid: g ? Array.from(g.grid) : null } satisfies WorkerResponse);
    }
  } catch (err) {
    ctx.postMessage({ id: req.id, type: 'error', message: err instanceof Error ? err.message : String(err) } satisfies WorkerResponse);
  }
};
