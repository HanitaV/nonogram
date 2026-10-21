import { LIBRARY } from '../data/puzzles';
import { cluesFromGrid, gridFromSolution } from '../engine/clues';
import type { Puzzle } from '../types/puzzle';
import { decodeShare } from './share';
import type { StoredPuzzle } from './storage';

export const libraryById = new Map(LIBRARY.map((p) => [p.id, p]));

export function fromStored(s: StoredPuzzle): Puzzle {
  const { grid } = gridFromSolution(s.solution);
  const clues = cluesFromGrid(grid, s.width, s.height);
  return {
    id: s.id,
    name: s.name,
    difficulty: 'custom',
    width: s.width,
    height: s.height,
    rows: clues.rows,
    cols: clues.cols,
    solution: s.solution,
    unique: s.unique === true,
    source: s.source,
  };
}

export const SHARED_PREFIX = 'shared:';

export function sharedPuzzle(code: string): Puzzle | null {
  const d = decodeShare(code);
  if (!d) return null;
  const { grid } = gridFromSolution(d.solution);
  const clues = cluesFromGrid(grid, d.width, d.height);
  return {
    id: SHARED_PREFIX + code,
    name: d.name,
    difficulty: 'custom',
    width: d.width,
    height: d.height,
    rows: clues.rows,
    cols: clues.cols,
    solution: d.solution,
    source: 'shared',
  };
}

export function resolvePuzzle(id: string, stored: StoredPuzzle[]): Puzzle | null {
  const lib = libraryById.get(id);
  if (lib) return lib;
  if (id.startsWith(SHARED_PREFIX)) return sharedPuzzle(id.slice(SHARED_PREFIX.length));
  const s = stored.find((p) => p.id === id);
  return s ? fromStored(s) : null;
}

export function puzzleLabel(p: Puzzle): string {
  return p.number ? `Câu số ${p.number}` : p.source === 'generated' ? 'Được tạo tự động' : p.source === 'shared' ? 'Được chia sẻ' : 'Câu đố của bạn';
}
