import type { Hint } from '../engine/hints';
import type { SolveOptions, SolveResult } from '../engine/solver';
import type { Clues } from '../types/puzzle';
import type { WorkerRequest, WorkerResponse } from '../workers/solver.worker';

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type Pending = { resolve: (r: WorkerResponse) => void; reject: (e: unknown) => void };

/**
 * One background worker per screen. Starting a new job cancels the previous
 * one by terminating the worker, so a long search can always be stopped, and a
 * stale reply can never arrive: each reply is matched against the current job id.
 */
export class SolverChannel {
  private worker: Worker | null = null;
  private seq = 0;
  private pending: { id: number; p: Pending } | null = null;

  private ensure(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/solver.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const cur = this.pending;
        if (!cur || cur.id !== e.data.id) return; // stale
        this.pending = null;
        if (e.data.type === 'error') cur.p.reject(new Error(e.data.message));
        else cur.p.resolve(e.data);
      };
      this.worker.onerror = (e) => {
        const cur = this.pending;
        this.pending = null;
        this.worker?.terminate();
        this.worker = null;
        cur?.p.reject(new Error(e.message || 'Tác vụ nền gặp lỗi'));
      };
    }
    return this.worker;
  }

  /** Stop the running job, if any. Its promise rejects with CancelledError. */
  cancel(): void {
    if (this.pending) {
      this.pending.p.reject(new CancelledError());
      this.pending = null;
      this.worker?.terminate();
      this.worker = null;
    }
  }

  get busy(): boolean {
    return this.pending !== null;
  }

  private send(req: DistributiveOmit<WorkerRequest, 'id'>): Promise<WorkerResponse> {
    this.cancel();
    const id = ++this.seq;
    const w = this.ensure();
    return new Promise((resolve, reject) => {
      this.pending = { id, p: { resolve, reject } };
      w.postMessage({ ...req, id } as WorkerRequest);
    });
  }

  async solve(clues: Clues, options: Omit<SolveOptions, 'initial'> & { initial?: Uint8Array } = {}): Promise<SolveResult> {
    const { initial, ...rest } = options;
    const r = await this.send({
      type: 'solve',
      clues: plainClues(clues),
      options: { ...rest, initial: initial ? Array.from(initial) : undefined },
    });
    if (r.type !== 'solve') throw new Error('Phản hồi không hợp lệ');
    return r.result;
  }

  async hint(clues: Clues, board: Uint8Array, uniqueSolution: Uint8Array | null): Promise<Hint> {
    const r = await this.send({
      type: 'hint',
      clues: plainClues(clues),
      board: Array.from(board),
      uniqueSolution: uniqueSolution ? Array.from(uniqueSolution) : null,
    });
    if (r.type !== 'hint') throw new Error('Phản hồi không hợp lệ');
    return r.hint;
  }

  async generate(width: number, height: number, seed: number): Promise<Uint8Array | null> {
    const r = await this.send({ type: 'generate', width, height, seed });
    if (r.type !== 'generate') throw new Error('Phản hồi không hợp lệ');
    return r.grid ? Uint8Array.from(r.grid) : null;
  }

  dispose(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
  }
}

function plainClues(c: Clues): Clues {
  return { width: c.width, height: c.height, rows: c.rows, cols: c.cols };
}
