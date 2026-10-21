import { cluesEqual, cluesFromGrid, gridFromSolution } from '../engine/clues';
import type { Puzzle } from '../types/puzzle';
import { isValidSolution } from './storage';

export const EXPORT_FORMAT = 'nonogram-studio/puzzle';
export const MAX_SIZE = 30;

export interface PuzzleFile {
  format: typeof EXPORT_FORMAT;
  version: 1;
  name: string;
  width: number;
  height: number;
  rows: number[][];
  cols: number[][];
  solution: string[];
}

export function toPuzzleFile(p: Pick<Puzzle, 'name' | 'width' | 'height' | 'solution'>): PuzzleFile {
  const { grid } = gridFromSolution(p.solution);
  const clues = cluesFromGrid(grid, p.width, p.height);
  return {
    format: EXPORT_FORMAT,
    version: 1,
    name: p.name,
    width: p.width,
    height: p.height,
    rows: clues.rows,
    cols: clues.cols,
    solution: p.solution,
  };
}

export type ImportResult =
  | { ok: true; name: string; width: number; height: number; solution: string[] }
  | { ok: false; error: string };

const isClueList = (v: unknown): v is number[][] =>
  Array.isArray(v) && v.every((c) => Array.isArray(c) && c.every((n) => Number.isInteger(n) && n >= 0));

export function parsePuzzleFile(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON không hợp lệ.' };
  }
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'Cần một đối tượng JSON.' };
  const o = raw as Record<string, unknown>;
  if (o.format !== EXPORT_FORMAT) return { ok: false, error: `Thiếu "format": "${EXPORT_FORMAT}".` };
  const width = o.width;
  const height = o.height;
  if (!Number.isInteger(width) || !Number.isInteger(height)) return { ok: false, error: 'Chiều rộng và chiều cao phải là số nguyên.' };
  const w = width as number;
  const h = height as number;
  if (w < 1 || h < 1 || w > MAX_SIZE || h > MAX_SIZE) return { ok: false, error: `Kích thước phải từ 1 đến ${MAX_SIZE}.` };
  if (!isValidSolution(o.solution, w, h)) {
    return { ok: false, error: `"solution" phải gồm ${h} hàng, mỗi hàng ${w} ký tự, chỉ dùng # và .` };
  }
  const { grid } = gridFromSolution(o.solution);
  const clues = cluesFromGrid(grid, w, h);
  if (o.rows !== undefined || o.cols !== undefined) {
    if (!isClueList(o.rows) || !isClueList(o.cols)) return { ok: false, error: '"rows" và "cols" phải là danh sách các danh sách số.' };
    const rows = o.rows.map((c) => c.filter((n) => n > 0));
    const cols = o.cols.map((c) => c.filter((n) => n > 0));
    const match =
      rows.length === h && cols.length === w && rows.every((c, i) => cluesEqual(c, clues.rows[i]!)) && cols.every((c, i) => cluesEqual(c, clues.cols[i]!));
    if (!match) return { ok: false, error: 'Chỉ dẫn trong tệp không khớp với đáp án.' };
  }
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 60) : 'Câu đố đã nhập';
  return { ok: true, name, width: w, height: h, solution: o.solution };
}
