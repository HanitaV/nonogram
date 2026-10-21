import { LIBRARY } from '../data/puzzles';
import { solutionFromGrid } from '../engine/clues';
import type { SaveData, StoredPuzzle } from './storage';

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function storedFromGrid(grid: Uint8Array, width: number, height: number, name: string, source: StoredPuzzle['source'], unique: boolean | null): StoredPuzzle {
  return { id: newId(source === 'generated' ? 'gen' : 'my'), name, width, height, solution: solutionFromGrid(grid, width, height), source, unique, createdAt: Date.now() };
}

export function addPuzzle(save: SaveData, p: StoredPuzzle): SaveData {
  // Keep at most 30 generated puzzles; never drop the user's own.
  let puzzles = [p, ...save.puzzles.filter((x) => x.id !== p.id)];
  const generated = puzzles.filter((x) => x.source === 'generated');
  if (generated.length > 30) {
    const drop = new Set(generated.slice(30).map((x) => x.id));
    puzzles = puzzles.filter((x) => !drop.has(x.id));
  }
  return { ...save, puzzles };
}

/** Next unsolved library puzzle after `id`, wrapping around. */
export function nextLibraryPuzzle(save: SaveData, id: string | null): string {
  const start = Math.max(0, LIBRARY.findIndex((p) => p.id === id));
  for (let k = 1; k <= LIBRARY.length; k++) {
    const p = LIBRARY[(start + k) % LIBRARY.length]!;
    if (save.games[p.id]?.status !== 'solved') return p.id;
  }
  return LIBRARY[(start + 1) % LIBRARY.length]!.id;
}

export function randomLibraryPuzzle(save: SaveData, exclude: string | null): string {
  const pool = LIBRARY.filter((p) => p.id !== exclude && save.games[p.id]?.status !== 'solved');
  const from = pool.length ? pool : LIBRARY.filter((p) => p.id !== exclude);
  return from[Math.floor(Math.random() * from.length)]!.id;
}
