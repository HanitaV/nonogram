import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatClue } from '../../engine/clues';
import type { CellChange } from '../../engine/history';
import type { LineStatus } from '../../engine/validation';
import { EMPTY, FILLED, UNKNOWN, type Axis, type Clues } from '../../types/puzzle';

export type CellTag = 'hint' | 'mistake' | 'branch' | 'forced' | 'diff';
export type Tool = 'fill' | 'mark';

export interface BoardProps {
  clues: Clues;
  board: Uint8Array;
  /** play: fill/mark/clear. draw: fill/clear only (puzzle editor). view: read-only. */
  mode: 'play' | 'draw' | 'view';
  tool?: Tool;
  onStroke?: (changes: CellChange[]) => void;
  /** Called on each painted cell (for sound). */
  onPaint?: () => void;
  lineStatus?: { rows: LineStatus[]; cols: LineStatus[] } | null;
  tags?: Map<number, CellTag> | null;
  activeLine?: { axis: Axis; index: number } | null;
  solved?: boolean;
  axisLock?: boolean;
  crosshair?: boolean;
  showClues?: boolean;
  zoom?: number;
  /** Largest cell size in px. */
  maxCell?: number;
  /** Fraction of the viewport height the board may use. */
  heightBudget?: number;
  /** Centre the board in its container. */
  center?: boolean;
  label: string;
}

const MIN_TOUCH_CELL = 24;
const MIN_POINTER_CELL = 18;

interface Stroke {
  pointerId: number;
  from: number;
  to: number;
  start: { r: number; c: number };
  last: { r: number; c: number };
  axis: 'row' | 'col' | null;
  changes: Map<number, CellChange>;
}

function nextValue(mode: BoardProps['mode'], current: number, tool: Tool): number {
  if (mode === 'draw') return current === FILLED ? UNKNOWN : FILLED;
  const v = tool === 'mark' ? EMPTY : FILLED;
  return current === v ? UNKNOWN : v;
}

export function Board(props: BoardProps) {
  const {
    clues,
    board,
    mode,
    tool = 'fill',
    onStroke,
    onPaint,
    lineStatus,
    tags,
    activeLine,
    solved = false,
    axisLock = true,
    crosshair = true,
    showClues = true,
    zoom = 1,
    maxCell = 40,
    heightBudget = 0.7,
    center = false,
    label,
  } = props;
  const { width: W, height: H } = clues;
  const wrapRef = useRef<HTMLDivElement>(null);
  const cellsRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState({ w: 600, h: 800, coarse: false });
  const [preview, setPreview] = useState<Uint8Array | null>(null);
  const stroke = useRef<Stroke | null>(null);
  const previewRef = useRef<Uint8Array | null>(null);
  const showPreview = (b: Uint8Array | null) => {
    previewRef.current = b;
    setPreview(b);
  };
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const [cursor, setCursor] = useState<{ r: number; c: number } | null>(null);
  const [announce, setAnnounce] = useState('');
  const shown = preview ?? board;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () =>
      setAvail({
        w: el.clientWidth,
        h: window.innerHeight,
        coarse: window.matchMedia('(pointer: coarse)').matches,
      });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Size: fit the width and a share of the viewport height, never below a usable minimum.
  const layout = useMemo(() => {
    const rowChars = (fs: number) =>
      Math.max(
        1,
        ...clues.rows.map((c) => {
          const nums = c.length ? c : [0];
          const digits = nums.reduce((s, n) => s + String(n).length, 0);
          return digits * 0.6 * fs + (nums.length - 1) * 0.6 * 0.6 * fs;
        }),
      );
    const colCount = Math.max(1, ...clues.cols.map((c) => Math.max(1, c.length)));
    const sizeFor = (fs: number) => {
      const rg = showClues ? Math.ceil(rowChars(fs) + 14) : 0;
      const cg = showClues ? Math.ceil(colCount * fs * 1.25 + 8) : 0;
      const fitW = (avail.w - rg - 4) / W;
      const fitH = (avail.h * heightBudget - cg - 4) / H;
      return { rg, cg, fit: Math.floor(Math.min(fitW, fitH)) };
    };
    let fs = 13;
    let s = sizeFor(fs);
    const minCell = mode === 'view' ? 10 : avail.coarse ? MIN_TOUCH_CELL : MIN_POINTER_CELL;
    let cell = Math.max(minCell, Math.min(maxCell, s.fit));
    fs = Math.max(11, Math.min(15, Math.round(cell * 0.52)));
    s = sizeFor(fs);
    cell = Math.round(Math.max(minCell, Math.min(maxCell, s.fit)) * zoom);
    fs = Math.max(11, Math.min(16, Math.round(cell * 0.52)));
    s = sizeFor(fs);
    return { cell, fs, rg: s.rg, cg: s.cg };
  }, [avail, clues, W, H, zoom, maxCell, heightBudget, mode, showClues]);

  const { cell, fs, rg, cg } = layout;

  const cellAt = useCallback(
    (clientX: number, clientY: number, clamp: boolean) => {
      const el = cellsRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      let c = Math.floor((clientX - rect.left - 2) / cell);
      let r = Math.floor((clientY - rect.top - 2) / cell);
      if (clamp) {
        c = Math.max(0, Math.min(W - 1, c));
        r = Math.max(0, Math.min(H - 1, r));
      } else if (c < 0 || r < 0 || c >= W || r >= H) return null;
      return { r, c };
    },
    [cell, W, H],
  );

  const paintTo = useCallback(
    (s: Stroke, target: { r: number; c: number }, base: Uint8Array) => {
      let { r, c } = target;
      if (axisLock) {
        if (!s.axis && (r !== s.start.r || c !== s.start.c)) {
          s.axis = Math.abs(r - s.start.r) >= Math.abs(c - s.start.c) ? 'col' : 'row';
        }
        if (s.axis === 'row') r = s.start.r;
        if (s.axis === 'col') c = s.start.c;
      }
      const next = base.slice();
      let painted = false;
      // Walk from the last cell to the target so fast drags do not skip cells.
      const steps = Math.max(Math.abs(r - s.last.r), Math.abs(c - s.last.c));
      for (let i = 1; i <= steps; i++) {
        const rr = Math.round(s.last.r + ((r - s.last.r) * i) / steps);
        const cc = Math.round(s.last.c + ((c - s.last.c) * i) / steps);
        const idx = rr * W + cc;
        if (s.changes.has(idx)) continue;
        // Only cells in the same state as the starting cell change: a drag that
        // fills never overwrites marks, and a drag that clears only clears.
        if (next[idx] !== s.from) continue;
        s.changes.set(idx, { index: idx, from: next[idx]!, to: s.to });
        next[idx] = s.to;
        painted = true;
      }
      s.last = { r, c };
      if (painted) onPaint?.();
      return next;
    },
    [axisLock, W, onPaint],
  );

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (mode === 'view' || !onStroke) return;
    if (e.button !== 0 && e.button !== 2) return;
    const at = cellAt(e.clientX, e.clientY, false);
    if (!at) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const idx = at.r * W + at.c;
    const current = board[idx]!;
    const t: Tool = e.button === 2 || (e.pointerType === 'mouse' && (e.ctrlKey || e.altKey)) ? 'mark' : tool;
    const to = nextValue(mode, current, t);
    const s: Stroke = {
      pointerId: e.pointerId,
      from: current,
      to,
      start: at,
      last: at,
      axis: null,
      changes: new Map([[idx, { index: idx, from: current, to }]]),
    };
    stroke.current = s;
    const next = board.slice();
    next[idx] = to;
    showPreview(next);
    onPaint?.();
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (s && s.pointerId === e.pointerId) {
      const at = cellAt(e.clientX, e.clientY, true);
      if (!at) return;
      showPreview(paintTo(s, at, previewRef.current ?? board));
      return;
    }
    if (e.pointerType === 'mouse') {
      const at = cellAt(e.clientX, e.clientY, false);
      setHover((h) => (h?.r === at?.r && h?.c === at?.c ? h : at));
    }
  };

  const endStroke = (e: PointerEvent<HTMLDivElement>) => {
    const s = stroke.current;
    if (!s || s.pointerId !== e.pointerId) return;
    stroke.current = null;
    showPreview(null);
    if (s.changes.size > 0) onStroke?.([...s.changes.values()]);
  };

  // Keyboard play
  const describe = (r: number, c: number, b: Uint8Array) => {
    const v = b[r * W + c];
    const state = v === FILLED ? 'đã tô' : v === EMPTY ? 'đã đánh dấu trống' : 'chưa xác định';
    return `Hàng ${r + 1}, cột ${c + 1}: ${state}. Chỉ dẫn hàng ${formatClue(clues.rows[r]!)}. Chỉ dẫn cột ${formatClue(clues.cols[c]!)}.`;
  };
  const lastKeyAction = useRef<number | null>(null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = cursor ?? { r: 0, c: 0 };
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      const r = Math.max(0, Math.min(H - 1, cur.r + mv[0]));
      const c = Math.max(0, Math.min(W - 1, cur.c + mv[1]));
      setCursor({ r, c });
      if (e.shiftKey && lastKeyAction.current !== null && mode !== 'view' && onStroke) {
        const idx = r * W + c;
        if (board[idx] !== lastKeyAction.current) {
          onStroke([{ index: idx, from: board[idx]!, to: lastKeyAction.current }]);
          onPaint?.();
        }
      }
      setAnnounce(describe(r, c, board));
      return;
    }
    if (mode === 'view' || !onStroke) return;
    const idx = cur.r * W + cur.c;
    let to: number | null = null;
    if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'f') to = nextValue(mode, board[idx]!, 'fill');
    else if ((e.key.toLowerCase() === 'x' || e.key === '.') && mode === 'play') to = nextValue(mode, board[idx]!, 'mark');
    else if (e.key === 'Backspace' || e.key === 'Xóa' || e.key === '0') to = UNKNOWN;
    if (to === null) return;
    e.preventDefault();
    setCursor(cur);
    lastKeyAction.current = to;
    if (board[idx] !== to) {
      onStroke([{ index: idx, from: board[idx]!, to }]);
      onPaint?.();
      const after = board.slice();
      after[idx] = to;
      setAnnounce(describe(cur.r, cur.c, after));
    }
  };

  useEffect(() => {
    if (solved) setCursor(null);
  }, [solved]);

  const focusLine = cursor ?? hover;
  const lineOn = (r: number, c: number) =>
    (crosshair && !solved && focusLine && (focusLine.r === r || focusLine.c === c)) ||
    (activeLine && ((activeLine.axis === 'row' && activeLine.index === r) || (activeLine.axis === 'col' && activeLine.index === c)));

  const cells = [];
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const idx = r * W + c;
      const v = shown[idx];
      let cls = 'cell';
      if (v === FILLED) cls += ' f';
      else if (v === EMPTY && mode !== 'draw') cls += ' x';
      if ((c + 1) % 5 === 0) cls += ' r5';
      if ((r + 1) % 5 === 0) cls += ' b5';
      if (c === W - 1) cls += ' lastc';
      if (r === H - 1) cls += ' lastr';
      if (lineOn(r, c)) cls += ' lineon';
      if (cursor && cursor.r === r && cursor.c === c && !solved) cls += ' cursor';
      const tag = tags?.get(idx);
      if (tag) cls += ` tag-${tag}`;
      cells.push(<div key={idx} className={cls} style={{ width: cell, height: cell }} />);
    }
  }

  const clueClass = (axis: Axis, i: number) => {
    const st = axis === 'row' ? lineStatus?.rows[i] : lineStatus?.cols[i];
    let cls = axis === 'row' ? 'clue-row' : 'clue-col';
    if (st?.impossible) cls += ' clue-bad';
    else if (st?.satisfied && mode === 'play') cls += ' clue-done';
    const active =
      (activeLine?.axis === axis && activeLine.index === i) ||
      (crosshair && !solved && focusLine && (axis === 'row' ? focusLine.r === i : focusLine.c === i));
    if (active) cls += ' clue-active';
    return cls;
  };

  const lineLabel = (axis: Axis, i: number) => {
    const st = axis === 'row' ? lineStatus?.rows[i] : lineStatus?.cols[i];
    return st?.impossible ? ' (không thể hoàn thành)' : st?.satisfied && mode === 'play' ? ' (đã hoàn thành)' : '';
  };

  return (
    <div ref={wrapRef} className="w-full min-w-0">
      <div className="board-scroll" style={{ maxHeight: zoom > 1 ? `${Math.round(avail.h * heightBudget + cg)}px` : undefined }}>
        <div
          className={`board${center ? ' mx-auto' : ''}`}
          style={{ gridTemplateColumns: `${rg}px auto`, gridTemplateRows: `${cg}px auto`, fontSize: fs }}
        >
          <div className="corner" aria-hidden="true" />
          {showClues ? (
            <div className="strip-top" style={{ gridTemplateColumns: `repeat(${W}, ${cell}px)` }} aria-label="Chỉ dẫn cột">
              {clues.cols.map((clue, i) => (
                <div key={i} className={clueClass('col', i)} aria-label={`Cột ${i + 1}: ${formatClue(clue)}${lineLabel('col', i)}`}>
                  {(clue.length ? clue : [0]).map((n, j) => (
                    <span key={j} className="clue-num" aria-hidden="true">
                      {n}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div />
          )}
          {showClues ? (
            <div className="strip-left" style={{ gridTemplateRows: `repeat(${H}, ${cell}px)` }} aria-label="Chỉ dẫn hàng">
              {clues.rows.map((clue, i) => (
                <div key={i} className={clueClass('row', i)} aria-label={`Hàng ${i + 1}: ${formatClue(clue)}${lineLabel('row', i)}`}>
                  {(clue.length ? clue : [0]).map((n, j) => (
                    <span key={j} className="clue-num" aria-hidden="true">
                      {n}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div />
          )}
          <div
            ref={cellsRef}
            className={`cells${solved ? ' solved' : ''}`}
            style={{ gridTemplateColumns: `repeat(${W}, ${cell}px)`, cursor: mode === 'view' ? 'default' : 'crosshair' }}
            role="application"
            aria-roledescription="bảng câu đố"
            aria-label={label}
            aria-describedby={mode === 'view' ? undefined : 'board-keys'}
            tabIndex={mode === 'view' ? -1 : 0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={() => setHover(null)}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (!cursor && mode !== 'view') {
                setCursor({ r: 0, c: 0 });
                setAnnounce(describe(0, 0, board));
              }
            }}
            onBlur={() => setCursor(null)}
          >
            {cells}
          </div>
        </div>
      </div>
      {mode !== 'view' && (
        <p id="board-keys" className="sr-only">
          Phím mũi tên để di chuyển. Space để tô{mode === 'play' ? ', X để đánh dấu trống' : ''}, Delete để xóa. Giữ Shift và phím mũi tên để lặp lại thao tác trước.
        </p>
      )}
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </div>
  );
}
