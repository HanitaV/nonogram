/**
 * Versioned LocalStorage persistence.
 *
 * Loading never throws: malformed JSON or invalid fields fall back to defaults
 * one field at a time, so a single bad record does not wipe everything else.
 * A copy of unreadable data is kept under `${STORAGE_KEY}:unreadable`.
 */

import { MAX_PUZZLE_SIZE } from './puzzleLimits';

export const STORAGE_KEY = 'nonogram-studio';
export const SCHEMA_VERSION = 2;

export type GameStatus = 'playing' | 'solved' | 'revealed';

export interface GameRecord {
  /** One character per cell: 0 unknown, 1 filled, 2 marked empty. */
  board: string;
  elapsedMs: number;
  status: GameStatus;
  /** Fastest solve without using Solve. */
  bestMs: number | null;
  /** How many times this puzzle has been solved. */
  solves: number;
  updatedAt: number;
}

export type ThemeSetting = 'system' | 'light' | 'dark';
export type MotionSetting = 'system' | 'reduce' | 'full';

export interface Settings {
  theme: ThemeSetting;
  sound: boolean;
  motion: MotionSetting;
  /** Highlight the row and column under the cursor. */
  crosshair: boolean;
  /** Lock a drag to the row or column it starts moving along. */
  axisLock: boolean;
}

export interface StoredPuzzle {
  id: string;
  name: string;
  width: number;
  height: number;
  solution: string[];
  source: 'custom' | 'generated' | 'shared';
  unique: boolean | null;
  createdAt: number;
}

export interface SaveData {
  version: typeof SCHEMA_VERSION;
  currentId: string | null;
  games: Record<string, GameRecord>;
  settings: Settings;
  puzzles: StoredPuzzle[];
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  sound: false,
  motion: 'system',
  crosshair: true,
  axisLock: true,
};

export function defaultSave(): SaveData {
  return { version: SCHEMA_VERSION, currentId: null, games: {}, settings: { ...DEFAULT_SETTINGS }, puzzles: [] };
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);

function cleanGame(v: unknown): GameRecord | null {
  if (!isObj(v)) return null;
  if (typeof v.board !== 'string' || !/^[012]*$/.test(v.board) || v.board.length === 0) return null;
  const best = v.bestMs;
  return {
    board: v.board,
    elapsedMs: Math.max(0, num(v.elapsedMs, 0)),
    status: oneOf(v.status, ['playing', 'solved', 'revealed'] as const, 'playing'),
    bestMs: typeof best === 'number' && Number.isFinite(best) && best > 0 ? best : null,
    solves: Math.max(0, Math.floor(num(v.solves, 0))),
    updatedAt: num(v.updatedAt, 0),
  };
}

function cleanSettings(v: unknown): Settings {
  const s = isObj(v) ? v : {};
  return {
    theme: oneOf(s.theme, ['system', 'light', 'dark'] as const, DEFAULT_SETTINGS.theme),
    sound: bool(s.sound, DEFAULT_SETTINGS.sound),
    motion: oneOf(s.motion, ['system', 'reduce', 'full'] as const, DEFAULT_SETTINGS.motion),
    crosshair: bool(s.crosshair, DEFAULT_SETTINGS.crosshair),
    axisLock: bool(s.axisLock, DEFAULT_SETTINGS.axisLock),
  };
}

export function isValidSolution(solution: unknown, width: number, height: number): solution is string[] {
  return (
    Array.isArray(solution) &&
    solution.length === height &&
    solution.every((row) => typeof row === 'string' && row.length === width && /^[#.]+$/.test(row))
  );
}

function cleanPuzzle(v: unknown): StoredPuzzle | null {
  if (!isObj(v)) return null;
  const width = num(v.width, 0);
  const height = num(v.height, 0);
  if (typeof v.id !== 'string' || !v.id) return null;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_PUZZLE_SIZE || height > MAX_PUZZLE_SIZE) return null;
  if (!isValidSolution(v.solution, width, height)) return null;
  return {
    id: v.id,
    name: typeof v.name === 'string' && v.name.trim() ? v.name.slice(0, 60) : 'Chưa đặt tên',
    width,
    height,
    solution: v.solution,
    source: oneOf(v.source, ['custom', 'generated', 'shared'] as const, 'custom'),
    unique: typeof v.unique === 'boolean' ? v.unique : null,
    createdAt: num(v.createdAt, 0),
  };
}

/**
 * Version 1 was the pre-release format: boards as number arrays, times in
 * seconds, a single `dark` flag. It is converted rather than discarded.
 */
function fromV1(raw: Obj): Obj {
  const games: Obj = {};
  if (isObj(raw.progress)) {
    for (const [id, p] of Object.entries(raw.progress)) {
      if (!isObj(p) || !Array.isArray(p.cells)) continue;
      games[id] = {
        board: p.cells.map((c) => (c === 1 || c === 2 ? String(c) : '0')).join(''),
        elapsedMs: num(p.time, 0) * 1000,
        status: p.done === true ? 'solved' : 'playing',
        bestMs: typeof p.best === 'number' ? p.best * 1000 : null,
        solves: p.done === true ? 1 : 0,
        updatedAt: 0,
      };
    }
  }
  const s = isObj(raw.settings) ? raw.settings : {};
  return {
    version: 2,
    currentId: typeof raw.current === 'string' ? raw.current : null,
    games,
    settings: { theme: s.dark === true ? 'dark' : s.dark === false ? 'light' : 'system', sound: s.sound },
    puzzles: Array.isArray(raw.custom) ? raw.custom : [],
  };
}

/** Turn anything found in storage into valid SaveData. */
export function migrate(raw: unknown): SaveData {
  if (!isObj(raw)) return defaultSave();
  let data: Obj = raw;
  const version = num(raw.version, 0);
  if (version > SCHEMA_VERSION) {
    // Written by a newer version of the app. Read what we understand.
    data = raw;
  } else if (version === 1) {
    data = fromV1(raw);
  } else if (version !== SCHEMA_VERSION) {
    return defaultSave();
  }
  const games: Record<string, GameRecord> = {};
  if (isObj(data.games)) {
    for (const [id, g] of Object.entries(data.games)) {
      const clean = cleanGame(g);
      if (clean) games[id] = clean;
    }
  }
  const puzzles: StoredPuzzle[] = [];
  const seen = new Set<string>();
  if (Array.isArray(data.puzzles)) {
    for (const p of data.puzzles) {
      const clean = cleanPuzzle(p);
      if (clean && !seen.has(clean.id)) {
        seen.add(clean.id);
        puzzles.push(clean);
      }
    }
  }
  return {
    version: SCHEMA_VERSION,
    currentId: typeof data.currentId === 'string' ? data.currentId : null,
    games,
    settings: cleanSettings(data.settings),
    puzzles,
  };
}

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadSave(store: KeyValueStore | null = defaultStore()): SaveData {
  if (!store) return defaultSave();
  let text: string | null = null;
  try {
    text = store.getItem(STORAGE_KEY);
  } catch {
    return defaultSave();
  }
  if (text === null) return defaultSave();
  try {
    return migrate(JSON.parse(text));
  } catch {
    try {
      store.setItem(`${STORAGE_KEY}:unreadable`, text);
    } catch {
      /* storage full: nothing more we can do */
    }
    return defaultSave();
  }
}

export function writeSave(data: SaveData, store: KeyValueStore | null = defaultStore()): boolean {
  if (!store) return false;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function encodeBoard(board: Uint8Array): string {
  let s = '';
  for (let i = 0; i < board.length; i++) s += board[i] === 1 ? '1' : board[i] === 2 ? '2' : '0';
  return s;
}

export function decodeBoard(s: string, size: number): Uint8Array | null {
  if (s.length !== size) return null;
  const b = new Uint8Array(size);
  for (let i = 0; i < size; i++) b[i] = s.charCodeAt(i) - 48;
  return b;
}
