import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../app/store';
import { Board, type CellTag } from '../../components/game/Board';
import { LIBRARY } from '../../data/puzzles';
import { formatClue, parseClue, validateClues } from '../../engine/clues';
import type { SolveResult, SolverEvent } from '../../engine/solver';
import { plural } from '../../lib/format';
import { resolvePuzzle } from '../../lib/puzzles';
import { CancelledError, SolverChannel } from '../../lib/solverClient';
import { FILLED, type Axis, type Clues } from '../../types/puzzle';

interface Preset {
  label: string;
  width: number;
  height: number;
  rows: string;
  cols: string;
}

const toText = (cl: number[][]) => cl.map(formatClue).join('\n');

const examples: Preset[] = [
  { label: 'Ví dụ: cần phỏng đoán', width: 8, height: 8, rows: '1 1 1\n2\n2\n3 1\n3 1\n3\n1 1 1\n4', cols: '1 1\n1 1\n2 1\n2 2\n1 2 1\n1 1 2\n1 1 1\n2 1' },
  { label: 'Ví dụ: hai nghiệm', width: 6, height: 6, rows: '1 1\n1 1\n2\n2\n1 1\n1 1', cols: '1 1\n1 1\n2\n2\n1 1\n1 1' },
  { label: 'Ví dụ: vô nghiệm', width: 5, height: 5, rows: '1 1\n1 2\n1\n1 1\n1 1', cols: '2\n3\n1 1\n1\n1 1' },
];

const MAX = 30;
const EVENT_LIMIT = 40_000;

function describe(e: SolverEvent, clues: Clues): string {
  const name = (axis: Axis, i: number) => `${axis === 'row' ? 'Hàng' : 'Cột'} ${i + 1} (${formatClue(axis === 'row' ? clues.rows[i]! : clues.cols[i]!)})`;
  switch (e.type) {
    case 'line': {
      const fills = e.values.filter((v) => v === FILLED).length;
      const empties = e.values.length - fills;
      const elim =
        e.prev > e.now
          ? `các hàng/cột giao nhau giảm số cách sắp xếp từ ${e.prev} xuống ${e.now}`
          : `${plural(e.now, 'cách sắp xếp')} phù hợp`;
      const forced = [fills ? `${plural(fills, 'ô')} được tô` : '', empties ? `${plural(empties, 'ô')} trống` : ''].filter(Boolean).join(' và ');
      return `${name(e.axis, e.index)}: ${elim}. Mọi cách đều thống nhất: ${forced}.`;
    }
    case 'contradiction':
      return `${name(e.axis, e.index)} không còn cách sắp xếp hợp lệ. Mâu thuẫn ở độ sâu ${e.depth}.`;
    case 'branch': {
      const r = Math.floor(e.cell / clues.width) + 1;
      const c = (e.cell % clues.width) + 1;
      return `Lan truyền dừng. Phỏng đoán: hàng ${r}, cột ${c} là ${e.value === FILLED ? 'được tô' : 'trống'} (độ sâu ${e.depth}, chọn từ ${name(e.axis, e.index)}, ${plural(e.placements, 'cách sắp xếp')}).`;
    }
    case 'backtrack':
      return `Quay lui khỏi phỏng đoán ở độ sâu ${e.depth} và khôi phục bảng.`;
    case 'solution':
      return `Đã tìm thấy nghiệm ${e.count}.`;
  }
}

/** Replays solver events into board states. */
class Replayer {
  grid: Uint8Array;
  stack: Uint8Array[] = [];
  index = 0;
  constructor(
    private size: number,
    private events: SolverEvent[],
  ) {
    this.grid = new Uint8Array(size);
  }
  reset() {
    this.grid = new Uint8Array(this.size);
    this.stack = [];
    this.index = 0;
  }
  step(): SolverEvent | null {
    const e = this.events[this.index];
    if (!e) return null;
    this.index++;
    if (e.type === 'line') {
      const g = this.grid.slice();
      e.cells.forEach((c, i) => (g[c] = e.values[i]!));
      this.grid = g;
    } else if (e.type === 'branch') {
      this.stack.push(this.grid);
      const g = this.grid.slice();
      g[e.cell] = e.value;
      this.grid = g;
    } else if (e.type === 'backtrack') {
      this.grid = this.stack.pop() ?? new Uint8Array(this.size);
    }
    return e;
  }
}

export function SolverView({ load }: { load: string | null }) {
  const { save } = useStore();
  const [width, setWidth] = useState(10);
  const [height, setHeight] = useState(10);
  const [rowsText, setRowsText] = useState('');
  const [colsText, setColsText] = useState('');
  const [result, setResult] = useState<SolveResult | null>(null);
  const [solvedFor, setSolvedFor] = useState<Clues | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channel = useRef<SolverChannel | null>(null);
  channel.current ??= new SolverChannel();

  // playback
  const replay = useRef<Replayer | null>(null);
  const [frame, setFrame] = useState<{ grid: Uint8Array; event: SolverEvent | null; index: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(8);

  useEffect(() => {
    const ch = channel.current;
    return () => ch?.dispose();
  }, []);

  const applyPreset = (p: Preset) => {
    setWidth(p.width);
    setHeight(p.height);
    setRowsText(p.rows);
    setColsText(p.cols);
  };

  useEffect(() => {
    const p = load ? resolvePuzzle(load, save.puzzles) : null;
    applyPreset(p ? { label: '', width: p.width, height: p.height, rows: toText(p.rows), cols: toText(p.cols) } : examples[0]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const parsed = useMemo(() => {
    const lines = (t: string) => (t.trim() === '' ? [] : t.replace(/\s+$/, '').split('\n'));
    const problems: string[] = [];
    const parse = (t: string, label: string) =>
      lines(t).map((line, i) => {
        const c = parseClue(line);
        if (!c) problems.push(`${label} ${i + 1}: "${line.trim()}" không phải là danh sách số.`);
        return c ?? [];
      });
    const rows = parse(rowsText, 'Hàng');
    const cols = parse(colsText, 'Cột');
    const clues: Clues = { width, height, rows, cols };
    if (problems.length === 0) problems.push(...validateClues(clues).map((i) => i.message));
    return { clues, problems };
  }, [rowsText, colsText, width, height]);

  const stale = solvedFor !== null && JSON.stringify(solvedFor) !== JSON.stringify(parsed.clues);

  const runSolve = async () => {
    setError(null);
    setPlaying(false);
    setBusy(true);
    try {
      const r = await channel.current!.solve(parsed.clues, { maxSolutions: 2, record: true, eventLimit: EVENT_LIMIT, stepLimit: 3_000_000 });
      setResult(r);
      setSolvedFor(parsed.clues);
      replay.current = new Replayer(width * height, r.events);
      setFrame(null);
    } catch (e) {
      if (!(e instanceof CancelledError)) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const stepOnce = () => {
    const rp = replay.current;
    if (!rp) return false;
    const e = rp.step();
    if (!e) {
      setPlaying(false);
      return false;
    }
    setFrame({ grid: rp.grid, event: e, index: rp.index });
    return true;
  };

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      if (!stepOnce()) clearInterval(id);
    }, 1000 / speed);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const restart = () => {
    replay.current?.reset();
    setFrame(replay.current ? { grid: replay.current.grid, event: null, index: 0 } : null);
    setPlaying(false);
  };

  const boardClues = solvedFor ?? parsed.clues;
  const canShowBoard = parsed.problems.length === 0 || solvedFor !== null;
  const total = result?.events.length ?? 0;
  const atEnd = frame !== null && frame.index >= total;

  // What the board shows: playback frame, else the first solution, else empty.
  let shown: Uint8Array = new Uint8Array(boardClues.width * boardClues.height);
  const tags = new Map<number, CellTag>();
  let activeLine: { axis: Axis; index: number } | null = null;
  if (frame) {
    shown = frame.grid;
    const e = frame.event;
    if (e?.type === 'line') {
      activeLine = { axis: e.axis, index: e.index };
      e.cells.forEach((c) => tags.set(c, 'forced'));
    } else if (e?.type === 'contradiction') activeLine = { axis: e.axis, index: e.index };
    else if (e?.type === 'branch') tags.set(e.cell, 'branch');
  } else if (result?.solutions[0]) {
    shown = result.solutions[0];
    if (result.solutions[1]) {
      const [a, b] = result.solutions as [Uint8Array, Uint8Array];
      a.forEach((v, i) => v !== b[i] && tags.set(i, 'diff'));
    }
  }

  const verdict = result && (
    <p className={`text-base font-semibold ${result.status === 'unique' ? 'text-solved' : result.status === 'limit' ? '' : 'text-redpen'}`}>
      {result.status === 'unique' && 'Một nghiệm, đã chứng minh là duy nhất.'}
      {result.status === 'multiple' && 'Có nhiều nghiệm.'}
      {result.status === 'none' && 'Vô nghiệm: các chỉ dẫn mâu thuẫn nhau.'}
      {result.status === 'limit' && 'Đã dừng tại giới hạn bước trước khi có kết luận.'}
    </p>
  );

  const stats: [string, string][] = result
    ? [
        ['Số lần xét hàng/cột', result.lineSteps.toLocaleString('vi-VN')],
        ['Phỏng đoán (nhánh)', result.branches.toLocaleString('vi-VN')],
        ['Số lần quay lui', result.backtracks.toLocaleString('vi-VN')],
        ['Độ sâu phỏng đoán lớn nhất', String(result.maxDepth)],
        ['Số nghiệm tìm được', `${result.solutions.length}${result.status === 'multiple' ? ' (dừng tìm khi có 2 nghiệm)' : ''}`],
        ['Đã tìm kiếm xong', result.complete ? 'Có' : 'Không'],
        ['Đã chứng minh nghiệm duy nhất', result.uniqueProven ? 'Có' : 'Không'],
        ['Chỉ cần suy luận theo hàng/cột', result.logicOnly ? 'Có' : 'Không'],
        ['Thời gian xử lý nền', `${result.elapsedMs.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} ms`],
      ]
    : [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <h1 className="text-xl font-semibold">Bộ giải</h1>
      <p className="mt-0.5 max-w-[68ch] text-sm text-pencil">
        Nhập chỉ dẫn, mỗi dòng ứng với một hàng hoặc cột, các số cách nhau bằng dấu cách. Dùng 0 hoặc để dòng trống cho hàng/cột không có ô tô. Bộ giải cho biết câu đố có một nghiệm, nhiều nghiệm hay vô nghiệm, và cho phép xem lại từng bước.
      </p>

      <div className="mt-6 grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (parsed.problems.length === 0) void runSolve();
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-pencil">Chiều rộng</span>
              <input className="field mt-1 w-20" type="number" min={1} max={MAX} value={width} onChange={(e) => setWidth(Math.max(1, Math.min(MAX, Number(e.target.value) || 1)))} />
            </label>
            <label className="text-sm">
              <span className="block text-pencil">Chiều cao</span>
              <input className="field mt-1 w-20" type="number" min={1} max={MAX} value={height} onChange={(e) => setHeight(Math.max(1, Math.min(MAX, Number(e.target.value) || 1)))} />
            </label>
            <label className="min-w-0 flex-1 text-sm">
              <span className="block text-pencil">Nạp chỉ dẫn</span>
              <select
                className="field mt-1 w-full"
                value=""
                onChange={(e) => {
                  const v = e.target.value;
                  const ex = examples.find((x) => x.label === v);
                  if (ex) return applyPreset(ex);
                  const p = LIBRARY.find((x) => x.id === v);
                  if (p) applyPreset({ label: '', width: p.width, height: p.height, rows: toText(p.rows), cols: toText(p.cols) });
                }}
              >
                <option value="">Chọn…</option>
                {examples.map((x) => (
                  <option key={x.label} value={x.label}>
                    {x.label}
                  </option>
                ))}
                {LIBRARY.map((p) => (
                  <option key={p.id} value={p.id}>
                    Câu trong thư viện số {p.number} ({p.width} × {p.height})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-pencil">Hàng, từ trên xuống</span>
              <textarea className="field mt-1 h-64 w-full resize-y font-mono leading-snug" spellCheck={false} value={rowsText} onChange={(e) => setRowsText(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="block text-pencil">Cột, từ trái sang</span>
              <textarea className="field mt-1 h-64 w-full resize-y font-mono leading-snug" spellCheck={false} value={colsText} onChange={(e) => setColsText(e.target.value)} />
            </label>
          </div>
          {parsed.problems.length > 0 ? (
            <ul className="space-y-1 border-l-2 border-redpen pl-3 text-sm" aria-live="polite">
              {parsed.problems.slice(0, 5).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-pencil" aria-live="polite">
              Chỉ dẫn có vẻ nhất quán: {parsed.clues.rows.flat().reduce((s, v) => s + v, 0)} ô cần tô từ cả hai hướng.
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-ink" disabled={parsed.problems.length > 0 || busy}>
              {busy ? 'Đang giải…' : 'Giải'}
            </button>
            {busy && (
              <button type="button" className="btn btn-line" onClick={() => channel.current?.cancel()}>
                Dừng
              </button>
            )}
          </div>
          {error && <p className="text-sm text-redpen">{error}</p>}
        </form>

        <section aria-label="Đáp án và các bước giải" className="min-w-0">
          {stale && <p className="mb-3 text-sm text-pencil">Chỉ dẫn đã thay đổi. Hãy giải lại để cập nhật kết quả.</p>}
          {verdict}
          {result?.status === 'multiple' && !frame && (
            <p className="mt-1 text-sm text-pencil">Đang hiện một nghiệm. Các ô tô bóng khác với nghiệm thứ hai tìm được.</p>
          )}
          <div className="mt-4">
            {canShowBoard ? (
              <Board clues={boardClues} board={shown} mode="view" solved={!frame && !!result?.solutions[0]} tags={tags} activeLine={activeLine} heightBudget={0.6} maxCell={32} crosshair={false} label="Bảng của bộ giải" />
            ) : (
              <p className="text-sm text-pencil">Bảng sẽ hiện khi chỉ dẫn hợp lệ.</p>
            )}
          </div>

          {result && result.events.length > 0 && (
            <div className="mt-6 border-t border-rule pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn btn-line" onClick={() => (atEnd ? (restart(), setPlaying(true)) : setPlaying((p) => !p))}>
                  {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
                  {playing ? 'Tạm dừng' : frame === null || frame.index === 0 ? 'Bắt đầu' : atEnd ? 'Xem lại' : 'Tiếp tục'}
                </button>
                <button type="button" className="btn btn-line" onClick={() => stepOnce()} disabled={playing || atEnd}>
                  <StepForward size={15} aria-hidden="true" /> Bước tiếp theo
                </button>
                <button type="button" className="btn btn-line" onClick={restart} disabled={frame === null}>
                  <RotateCcw size={15} aria-hidden="true" /> Bắt đầu lại
                </button>
                <label className="ml-auto flex items-center gap-2 text-sm text-pencil">
                  Tốc độ
                  <input type="range" min={1} max={60} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-valuetext={`${speed} bước mỗi giây`} />
                  <span className="w-14 font-mono text-xs tnum">{speed}/s</span>
                </label>
              </div>
              <p className="mt-3 min-h-[3rem] text-sm" aria-live="polite">
                <span className="font-mono text-xs text-pencil tnum">
                  {frame?.index ?? 0} / {total}
                </span>{' '}
                {frame?.event ? describe(frame.event, boardClues) : 'Bắt đầu để xem lại quá trình giải. Phần nổi bật là hàng/cột đang xét và các ô được suy ra. Viền đỏ là ô phỏng đoán.'}
              </p>
              {result.eventsTruncated && (
                <p className="text-xs text-pencil">Bản phát lại giữ {EVENT_LIMIT.toLocaleString('vi-VN')} bước đầu; thống kê bao gồm toàn bộ tìm kiếm.</p>
              )}
            </div>
          )}

          {result && (
            <dl className="mt-6 grid max-w-md grid-cols-[1fr_auto] gap-x-6 border-t border-rule pt-4 text-sm">
              {stats.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="py-0.5 text-pencil">{k}</dt>
                  <dd className="py-0.5 text-right font-mono tnum">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </div>
    </div>
  );
}
