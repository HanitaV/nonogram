import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../app/store';
import { gridFromSolution, lineClue } from '../../engine/clues';
import { diffBoards, emptyHistory, record, redo as redoH, undo as undoH, type CellChange, type History } from '../../engine/history';
import { lineCells } from '../../engine/solver';
import { checkBoard, isSolution } from '../../engine/validation';
import { playSolved } from '../../lib/sound';
import { decodeBoard, encodeBoard, type GameRecord, type GameStatus } from '../../lib/storage';
import { EMPTY, FILLED, UNKNOWN, type Puzzle } from '../../types/puzzle';

export interface Game {
  board: Uint8Array;
  status: GameStatus;
  elapsedMs: number;
  bestMs: number | null;
  /** True when this solve set a new personal best. */
  newBest: boolean;
  check: ReturnType<typeof checkBoard>;
  canUndo: boolean;
  canRedo: boolean;
  stroke: (changes: CellChange[]) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  reveal: (solution: Uint8Array) => void;
  apply: (cells: number[], values: number[]) => void;
}

function initialBoard(puzzle: Puzzle, rec: GameRecord | undefined): Uint8Array {
  const size = puzzle.width * puzzle.height;
  return (rec && decodeBoard(rec.board, size)) || new Uint8Array(size);
}

/**
 * All per-puzzle game state: board, history, timer, completion and saving.
 * Mount it with key={puzzle.id} so switching puzzles starts fresh state.
 */
export function useGame(puzzle: Puzzle): Game {
  const { save, update } = useStore();
  const rec = save.games[puzzle.id];
  const settings = save.settings;
  const [board, setBoard] = useState(() => initialBoard(puzzle, rec));
  const [history, setHistory] = useState<History>(emptyHistory);
  const [status, setStatus] = useState<GameStatus>(rec?.status ?? 'playing');
  const [elapsedMs, setElapsed] = useState(rec?.elapsedMs ?? 0);
  const [newBest, setNewBest] = useState(false);
  // Event handlers may run again before React renders the last committed move.
  const boardRef = useRef(board);
  const historyRef = useRef(history);
  const statusRef = useRef(status);
  const replaceBoard = useCallback((next: Uint8Array) => { boardRef.current = next; setBoard(next); }, []);
  const replaceHistory = useCallback((next: History) => { historyRef.current = next; setHistory(next); }, []);
  const elapsedRef = useRef(elapsedMs);
  const started = useRef((rec?.elapsedMs ?? 0) > 0 || board.some((v) => v !== UNKNOWN));
  const persist = useCallback(
    (patch: Partial<GameRecord> & { board?: string }) => {
      update((s) => {
        const prev = s.games[puzzle.id];
        const base: GameRecord = prev ?? {
          board: encodeBoard(new Uint8Array(puzzle.width * puzzle.height)),
          elapsedMs: 0,
          status: 'playing',
          bestMs: null,
          solves: 0,
          updatedAt: Date.now(),
        };
        return { ...s, currentId: puzzle.id, games: { ...s.games, [puzzle.id]: { ...base, ...patch, updatedAt: Date.now() } } };
      });
    },
    [update, puzzle.id, puzzle.width, puzzle.height],
  );

  // Timer: runs while playing, after the first move, while the tab is visible.
  useEffect(() => {
    if (status !== 'playing') return;
    let last = performance.now();
    const tick = () => {
      const now = performance.now();
      if (started.current && document.visibilityState === 'visible') {
        elapsedRef.current += now - last;
        setElapsed(elapsedRef.current);
      }
      last = now;
    };
    const id = window.setInterval(tick, 500);
    const saveId = window.setInterval(() => started.current && persist({ elapsedMs: elapsedRef.current }), 5000);
    const onVis = () => {
      last = performance.now();
      if (document.visibilityState === 'hidden' && started.current) persist({ elapsedMs: elapsedRef.current });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      clearInterval(saveId);
      document.removeEventListener('visibilitychange', onVis);
      if (started.current) persist({ elapsedMs: elapsedRef.current });
    };
  }, [status, persist, puzzle.id]);

  const check = useMemo(() => checkBoard(puzzle, board), [puzzle, board]);

  const finishIfSolved = useCallback(
    (next: Uint8Array) => {
      if (!isSolution(puzzle, next)) return false;
      const time = Math.round(elapsedRef.current);
      const prevBest = save.games[puzzle.id]?.bestMs ?? null;
      const best = prevBest === null || time < prevBest ? time : prevBest;
      setNewBest(prevBest !== null && time < prevBest);
      setStatus('solved');
      statusRef.current = 'solved';
      persist({
        board: encodeBoard(next),
        status: 'solved',
        elapsedMs: time,
        bestMs: best,
        solves: (save.games[puzzle.id]?.solves ?? 0) + 1,
      });
      if (settings.sound) playSolved();
      return true;
    },
    [puzzle, persist, save.games, settings.sound],
  );

  /** Mark the rest of every completed line as empty (optional setting). */
  const autoCross = useCallback(
    (b: Uint8Array): Uint8Array => {
      const out = b.slice();
      for (let l = 0; l < puzzle.width + puzzle.height; l++) {
        const cells = lineCells(puzzle, l);
        const clue = l < puzzle.height ? puzzle.rows[l]! : puzzle.cols[l - puzzle.height]!;
        const got = lineClue(cells.map((c) => out[c]!));
        if (got.length === clue.length && got.every((v, i) => v === clue[i])) {
          for (const c of cells) if (out[c] === UNKNOWN) out[c] = EMPTY;
        }
      }
      return out;
    },
    [puzzle],
  );

  const commit = useCallback(
    (next: Uint8Array, changes: CellChange[]) => {
      if (statusRef.current !== 'playing') return;
      started.current = true;
      let final = next;
      let all = changes;
      if (settings.autoCross) {
        final = autoCross(next);
        all = diffBoards(boardRef.current, final);
      }
      if (all.length === 0) return;
      replaceBoard(final);
      replaceHistory(record(historyRef.current, all));
      if (!finishIfSolved(final)) persist({ board: encodeBoard(final), elapsedMs: elapsedRef.current });
    },
    [settings.autoCross, autoCross, finishIfSolved, persist, replaceBoard, replaceHistory],
  );

  const stroke = useCallback(
    (changes: CellChange[]) => {
      const next = boardRef.current.slice();
      for (const ch of changes) next[ch.index] = ch.to;
      commit(next, diffBoards(boardRef.current, next));
    },
    [commit],
  );

  const apply = useCallback(
    (cells: number[], values: number[]) => {
      const next = boardRef.current.slice();
      cells.forEach((c, i) => (next[c] = values[i]!));
      commit(next, diffBoards(boardRef.current, next));
    },
    [commit],
  );

  const undo = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    const r = undoH(historyRef.current, boardRef.current);
    if (!r) return;
    replaceHistory(r.history);
    replaceBoard(r.board);
    persist({ board: encodeBoard(r.board) });
  }, [persist, replaceBoard, replaceHistory]);

  const redo = useCallback(() => {
    if (statusRef.current !== 'playing') return;
    const r = redoH(historyRef.current, boardRef.current);
    if (!r) return;
    replaceHistory(r.history);
    replaceBoard(r.board);
    if (!finishIfSolved(r.board)) persist({ board: encodeBoard(r.board) });
  }, [persist, finishIfSolved, replaceBoard, replaceHistory]);

  const reset = useCallback(() => {
    const empty = new Uint8Array(puzzle.width * puzzle.height);
    replaceBoard(empty);
    replaceHistory(emptyHistory());
    statusRef.current = 'playing';
    setStatus('playing');
    setNewBest(false);
    elapsedRef.current = 0;
    setElapsed(0);
    started.current = false;
    persist({ board: encodeBoard(empty), status: 'playing', elapsedMs: 0 });
  }, [puzzle, persist, replaceBoard, replaceHistory]);

  const reveal = useCallback(
    (solution: Uint8Array) => {
      const b = new Uint8Array(solution.length);
      for (let i = 0; i < b.length; i++) b[i] = solution[i] === FILLED ? FILLED : EMPTY;
      replaceBoard(b);
      replaceHistory(emptyHistory());
      statusRef.current = 'revealed';
      setStatus('revealed');
      persist({ board: encodeBoard(b), status: 'revealed', elapsedMs: elapsedRef.current });
    },
    [persist, replaceBoard, replaceHistory],
  );

  return {
    board,
    status,
    elapsedMs,
    bestMs: save.games[puzzle.id]?.bestMs ?? null,
    newBest,
    check,
    canUndo: history.past.length > 0 && status === 'playing',
    canRedo: history.future.length > 0 && status === 'playing',
    stroke,
    undo,
    redo,
    reset,
    reveal,
    apply,
  };
}

export function solutionGrid(p: Puzzle): Uint8Array {
  return gridFromSolution(p.solution).grid;
}
