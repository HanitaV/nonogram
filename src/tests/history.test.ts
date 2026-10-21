import { describe, expect, it } from 'vitest';
import { diffBoards, emptyHistory, MAX_HISTORY, record, redo, undo } from '../engine/history';

describe('undo / redo', () => {
  it('undoes and redoes whole strokes', () => {
    let board = new Uint8Array(4);
    let h = emptyHistory();
    const stroke = [
      { index: 0, from: 0, to: 1 },
      { index: 1, from: 0, to: 1 },
    ];
    board = Uint8Array.from([1, 1, 0, 0]);
    h = record(h, stroke);
    const u = undo(h, board)!;
    expect(Array.from(u.board)).toEqual([0, 0, 0, 0]);
    const r = redo(u.history, u.board)!;
    expect(Array.from(r.board)).toEqual([1, 1, 0, 0]);
    expect(undo(emptyHistory(), board)).toBeNull();
    expect(redo(h, board)).toBeNull();
  });

  it('clears the redo stack on a new stroke', () => {
    let h = record(emptyHistory(), [{ index: 0, from: 0, to: 1 }]);
    const u = undo(h, Uint8Array.from([1]))!;
    h = record(u.history, [{ index: 0, from: 0, to: 2 }]);
    expect(h.future).toHaveLength(0);
  });

  it('ignores empty strokes and caps length', () => {
    let h = emptyHistory();
    expect(record(h, [])).toBe(h);
    for (let i = 0; i < MAX_HISTORY + 20; i++) h = record(h, [{ index: 0, from: 0, to: 1 }]);
    expect(h.past).toHaveLength(MAX_HISTORY);
  });

  it('restores overlapping changes in reverse order', () => {
    const stroke = diffBoards(Uint8Array.from([0, 2, 1]), Uint8Array.from([1, 0, 1]));
    expect(stroke).toEqual([
      { index: 0, from: 0, to: 1 },
      { index: 1, from: 2, to: 0 },
    ]);
    const u = undo(record(emptyHistory(), stroke), Uint8Array.from([1, 0, 1]))!;
    expect(Array.from(u.board)).toEqual([0, 2, 1]);
  });
});
