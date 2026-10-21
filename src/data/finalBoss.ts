import imported from './hamic-boss.json';
import type { Puzzle } from '../types/puzzle';

/** Preserve the imported artwork exactly; uniqueness has not been proven. */
export const FINAL_BOSS: Puzzle = {
  id: 'boss-hamic',
  name: imported.name,
  width: imported.width,
  height: imported.height,
  rows: imported.rows,
  cols: imported.cols,
  solution: imported.solution,
  difficulty: 'boss',
  source: 'library',
  number: 41,
  note: 'Boss cuối: logo HAMIC, 150 × 150 ô.',
};
