import { EMPTY, FILLED, UNKNOWN, type Clues, type Grid } from '../types/puzzle';
import { cluesEqual, lineClue } from './clues';
import { countPlacements } from './patterns';
import { lineCells } from './solver';

export type BoardState = 'incomplete' | 'contradiction' | 'solved';

export interface LineStatus {
  /** Filled cells in this line already spell the clue exactly. */
  satisfied: boolean;
  /** No placement of the clue fits the current fills and marks. */
  impossible: boolean;
}

export interface BoardCheck {
  state: BoardState;
  rows: LineStatus[];
  cols: LineStatus[];
  filled: number;
  /** Total filled cells any solution has (sum of row clues). */
  target: number;
}

const isFilled = (v: number) => v === FILLED;

function lineValues(board: Grid, cells: number[]): Uint8Array {
  const out = new Uint8Array(cells.length);
  cells.forEach((c, i) => (out[i] = board[c]!));
  return out;
}

/**
 * Check a player's board against the clues only (never against a stored answer),
 * so any arrangement that satisfies every clue counts as solved.
 */
export function checkBoard(clues: Clues, board: Grid): BoardCheck {
  const rows: LineStatus[] = [];
  const cols: LineStatus[] = [];
  let allSatisfied = true;
  let anyImpossible = false;
  const total = clues.width + clues.height;
  for (let l = 0; l < total; l++) {
    const isRow = l < clues.height;
    const clue = isRow ? clues.rows[l]! : clues.cols[l - clues.height]!;
    const values = lineValues(board, lineCells(clues, l));
    const satisfied = cluesEqual(lineClue(values, isFilled), clue);
    const impossible = countPlacements(clue, values) === 0;
    if (!satisfied) allSatisfied = false;
    if (impossible) anyImpossible = true;
    (isRow ? rows : cols).push({ satisfied, impossible });
  }
  let filled = 0;
  for (let i = 0; i < board.length; i++) if (board[i] === FILLED) filled++;
  const target = clues.rows.flat().reduce((s, v) => s + v, 0);
  // A board whose filled cells satisfy every row and column is solved, even if
  // some cells are still unmarked: unmarked cells count as empty.
  const state: BoardState = allSatisfied ? 'solved' : anyImpossible ? 'contradiction' : 'incomplete';
  return { state, rows, cols, filled, target };
}

/** True if `grid` (FILLED = black, anything else = white) satisfies all clues. */
export function isSolution(clues: Clues, grid: Grid): boolean {
  for (let l = 0; l < clues.width + clues.height; l++) {
    const clue = l < clues.height ? clues.rows[l]! : clues.cols[l - clues.height]!;
    if (!cluesEqual(lineClue(lineValues(grid, lineCells(clues, l)), isFilled), clue)) return false;
  }
  return true;
}

/** Cells whose known value disagrees with a reference solution. */
export function mistakesAgainst(board: Grid, solution: Grid): number[] {
  const out: number[] = [];
  for (let i = 0; i < board.length; i++) {
    const v = board[i];
    if (v === UNKNOWN) continue;
    const want = solution[i] === FILLED ? FILLED : EMPTY;
    if (v !== want) out.push(i);
  }
  return out;
}
