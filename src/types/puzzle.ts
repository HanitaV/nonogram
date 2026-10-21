/** Cell state on a board. Numeric so boards can live in typed arrays. */
export const UNKNOWN = 0;
export const FILLED = 1;
export const EMPTY = 2;
export type CellState = typeof UNKNOWN | typeof FILLED | typeof EMPTY;

/** A clue is the list of run lengths in one line. An empty line has the clue []. */
export type Clue = number[];

export type Axis = 'row' | 'col';

export type Difficulty = 'beginner' | 'easy' | 'intermediate' | 'advanced' | 'boss' | 'custom';

export interface Clues {
  width: number;
  height: number;
  rows: Clue[];
  cols: Clue[];
}

export interface Puzzle extends Clues {
  id: string;
  name: string;
  difficulty: Difficulty;
  /** Rows of '#' (filled) and '.' (empty). A solution that satisfies the clues. */
  solution: string[];
  /** Short description of what the picture shows, if anything. */
  note?: string;
  /** True when the solver has proven this puzzle has exactly one solution. */
  unique?: boolean;
  /** Where the puzzle came from. */
  source: 'library' | 'custom' | 'generated' | 'shared';
  /** Library index, 1-based, for display as "No. 12". */
  number?: number;
  /** Whether line-by-line logic alone solves it, or the solver had to branch. */
  solvedBy?: 'line-logic' | 'search';
}

export type Grid = Uint8Array;
