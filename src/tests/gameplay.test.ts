import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveData } from '../lib/storage';
import { defaultSave } from '../lib/storage';
import { cluesOf } from './helpers';
import type { Puzzle } from '../types/puzzle';

// Keep the callbacks from ONE render: all events below arrive before a rerender.
// This explicitly exercises the stale-closure failure reported for rapid input.
const harness = vi.hoisted(() => ({ save: null as unknown as SaveData, states: [] as unknown[] }));
vi.mock('../app/store', () => ({ useStore: () => ({
  save: harness.save,
  update: (fn: (save: SaveData) => SaveData) => { harness.save = fn(harness.save); },
}) }));
vi.mock('react', () => ({
  useState: (initial: unknown) => {
    const index = harness.states.length;
    const value = typeof initial === 'function' ? initial() : initial;
    harness.states.push(value);
    return [value, (next: unknown) => {
      harness.states[index] = typeof next === 'function' ? next(harness.states[index]) : next;
    }];
  },
  useRef: (current: unknown) => ({ current }),
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useEffect: () => {},
}));
import { useGame } from '../features/gameplay/useGame';

const puzzle: Puzzle = {
  ...cluesOf(['#..', '.#.', '..#']),
  id: 'rapid', name: 'Rapid', solution: ['#..', '.#.', '..#'], difficulty: 'custom', source: 'custom',
};
const savedBoard = () => harness.save.games.rapid!.board;
beforeEach(() => { harness.save = defaultSave(); harness.states = []; });

describe('rapid game input before React rerenders', () => {
  it('retains consecutive edits and restores them with consecutive undo/redo', () => {
    const game = useGame(puzzle);
    game.stroke([{ index: 0, from: 0, to: 1 }]);
    game.stroke([{ index: 4, from: 0, to: 1 }]);
    expect(savedBoard()).toBe('100010000');
    game.undo();
    expect(savedBoard()).toBe('100000000');
    game.undo();
    expect(savedBoard()).toBe('000000000');
    game.redo();
    game.redo();
    expect(savedBoard()).toBe('100010000');
  });

  it('records the actual previous value when an event carries an old from value', () => {
    const game = useGame(puzzle);
    game.stroke([{ index: 0, from: 0, to: 1 }]);
    game.stroke([{ index: 0, from: 0, to: 2 }]);
    game.undo();
    expect(savedBoard()).toBe('100000000');
  });

  it('combines hints with pending edits and ignores edits after completion', () => {
    const game = useGame(puzzle);
    game.stroke([{ index: 0, from: 0, to: 1 }]);
    game.apply([4, 8], [1, 1]);
    expect(savedBoard()).toBe('100010001');
    expect(harness.save.games.rapid!.solves).toBe(1);
    game.stroke([{ index: 1, from: 0, to: 1 }]);
    game.redo();
    expect(savedBoard()).toBe('100010001');
    expect(harness.save.games.rapid!.solves).toBe(1);
  });

  it('starts a fresh history after reset even before a rerender', () => {
    const game = useGame(puzzle);
    game.stroke([{ index: 0, from: 0, to: 1 }]);
    game.reset();
    game.stroke([{ index: 4, from: 0, to: 1 }]);
    expect(savedBoard()).toBe('000010000');
    game.undo();
    expect(savedBoard()).toBe('000000000');
    game.undo();
    expect(savedBoard()).toBe('000000000');
  });
});

