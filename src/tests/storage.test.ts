import { describe, expect, it } from 'vitest';
import { decodeBoard, defaultSave, encodeBoard, loadSave, migrate, SCHEMA_VERSION, STORAGE_KEY, writeSave, type KeyValueStore } from '../lib/storage';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => void (data[k] = v),
    removeItem: (k) => void delete data[k],
  };
}

describe('persistence', () => {
  it('returns defaults for empty or unreadable storage and keeps a copy of unreadable data', () => {
    expect(loadSave(memoryStore())).toEqual(defaultSave());
    const store = memoryStore({ [STORAGE_KEY]: '{not json' });
    expect(loadSave(store)).toEqual(defaultSave());
    expect(store.data[`${STORAGE_KEY}:unreadable`]).toBe('{not json');
  });

  it('round-trips current data', () => {
    const store = memoryStore();
    const save = defaultSave();
    save.currentId = 'b01-heart';
    save.games['b01-heart'] = { board: '0120', elapsedMs: 5000, status: 'playing', bestMs: null, solves: 0, updatedAt: 1 };
    save.settings.theme = 'dark';
    writeSave(save, store);
    expect(loadSave(store)).toEqual(save);
  });

  it('migrates version 1 data', () => {
    const v1 = {
      version: 1,
      current: 'e02-umbrella',
      progress: { 'e02-umbrella': { cells: [1, 2, 0, 1], time: 12, done: true, best: 10 } },
      settings: { dark: true, sound: true },
      custom: [{ id: 'c1', name: 'Mine', width: 2, height: 1, solution: ['#.'] }],
    };
    const m = migrate(v1);
    expect(m.version).toBe(SCHEMA_VERSION);
    expect(m.currentId).toBe('e02-umbrella');
    expect(m.games['e02-umbrella']).toMatchObject({ board: '1201', elapsedMs: 12000, status: 'solved', bestMs: 10000, solves: 1 });
    expect(m.settings.theme).toBe('dark');
    expect(m.settings.sound).toBe(true);
    expect(m.puzzles[0]).toMatchObject({ id: 'c1', name: 'Mine', source: 'custom' });
  });

  it('drops only the invalid parts of a record', () => {
    const m = migrate({
      version: SCHEMA_VERSION,
      currentId: 42,
      games: { good: { board: '012', elapsedMs: 10, status: 'playing' }, bad: { board: 'xyz' } },
      settings: { theme: 'neon', sound: 'yes', axisLock: false },
      puzzles: [{ id: 'p', width: 2, height: 1, solution: ['#?'] }, { id: 'q', width: 1, height: 1, solution: ['#'] }],
    });
    expect(Object.keys(m.games)).toEqual(['good']);
    expect(m.currentId).toBeNull();
    expect(m.settings.theme).toBe('system');
    expect(m.settings.sound).toBe(true);
    expect(m.settings.axisLock).toBe(false);
    expect(m.puzzles.map((p) => p.id)).toEqual(['q']);
  });

  it('discards unknown old formats and encodes boards compactly', () => {
    expect(migrate({ version: 0 })).toEqual(defaultSave());
    expect(migrate('nope')).toEqual(defaultSave());
    const b = Uint8Array.from([0, 1, 2, 1]);
    expect(encodeBoard(b)).toBe('0121');
    expect(Array.from(decodeBoard('0121', 4)!)).toEqual([0, 1, 2, 1]);
    expect(decodeBoard('01', 4)).toBeNull();
  });
});
