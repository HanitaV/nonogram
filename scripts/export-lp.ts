/**
 * Write the ILP model of a library puzzle in CPLEX LP format.
 *
 *   npm run export:lp -- b01-heart > heart.lp
 *
 * Solve the file with any ILP solver (HiGHS, GLPK, CBC, Gurobi). Nonogram
 * Studio itself does not include an ILP solver.
 */
import { LIBRARY } from '../src/data/puzzles';
import { toLpFormat } from '../src/engine/ilp';

const id = process.argv[2];
const puzzle = LIBRARY.find((p) => p.id === id);
if (!puzzle) {
  console.error(`Unknown puzzle id "${id ?? ''}". Available: ${LIBRARY.map((p) => p.id).join(', ')}`);
  process.exit(1);
}
process.stdout.write(toLpFormat(puzzle, puzzle.name));
