import { Copy, Download, FlipHorizontal, Redo2, Undo2, Upload } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { Board, type CellTag } from '../../components/game/Board';
import { cluesFromGrid, gridFromSolution, solutionFromGrid } from '../../engine/clues';
import { emptyHistory, record, redo as redoH, undo as undoH, diffBoards, type CellChange } from '../../engine/history';
import type { SolveResult } from '../../engine/solver';
import { addPuzzle, newId } from '../../lib/library';
import { parsePuzzleFile, toPuzzleFile } from '../../lib/puzzleIO';
import { encodeShare } from '../../lib/share';
import { CancelledError, SolverChannel } from '../../lib/solverClient';
import type { StoredPuzzle } from '../../lib/storage';
import { FILLED, UNKNOWN } from '../../types/puzzle';

const SIZES = [5, 8, 10, 12, 15, 20, 25];

/** In the editor a cell is FILLED or UNKNOWN (blank). */
function toSolutionGrid(drawing: Uint8Array): Uint8Array {
  return drawing.map((v) => (v === FILLED ? FILLED : 0));
}

export function CreatorView({ id }: { id: string | null }) {
  const { save, update } = useStore();
  const editing = id ? save.puzzles.find((p) => p.id === id && p.source === 'custom') : undefined;
  const [puzzleId, setPuzzleId] = useState<string | null>(editing?.id ?? null);
  const [name, setName] = useState(editing?.name ?? '');
  const [width, setWidth] = useState(editing?.width ?? 10);
  const [height, setHeight] = useState(editing?.height ?? 10);
  const [drawing, setDrawing] = useState<Uint8Array>(() =>
    editing ? gridFromSolution(editing.solution).grid.map((v) => (v === FILLED ? FILLED : UNKNOWN)) : new Uint8Array(100),
  );
  const [history, setHistory] = useState(emptyHistory);
  const [check, setCheck] = useState<SolveResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ tone: 'plain' | 'warn' | 'good'; text: string } | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const channel = useRef<SolverChannel | null>(null);
  channel.current ??= new SolverChannel();

  useEffect(() => {
    const ch = channel.current;
    return () => ch?.dispose();
  }, []);

  const clues = useMemo(() => cluesFromGrid(toSolutionGrid(drawing), width, height), [drawing, width, height]);
  const filled = drawing.reduce((s, v) => s + (v === FILLED ? 1 : 0), 0);

  // Any edit makes the uniqueness check and share link stale.
  const changed = () => {
    setCheck(null);
    setShareUrl(null);
    channel.current?.cancel();
    setChecking(false);
  };

  const commit = (next: Uint8Array, changes: CellChange[]) => {
    setDrawing(next);
    setHistory((h) => record(h, changes));
    changed();
  };

  const onStroke = (changes: CellChange[]) => {
    const next = drawing.slice();
    for (const c of changes) next[c.index] = c.to;
    commit(next, changes);
  };

  const resize = (w: number, h: number) => {
    const next = new Uint8Array(w * h);
    for (let r = 0; r < Math.min(h, height); r++) for (let c = 0; c < Math.min(w, width); c++) next[r * w + c] = drawing[r * width + c]!;
    setWidth(w);
    setHeight(h);
    setDrawing(next);
    setHistory(emptyHistory());
    changed();
  };

  const transform = (fn: (r: number, c: number) => number) => {
    const next = new Uint8Array(width * height);
    for (let r = 0; r < height; r++) for (let c = 0; c < width; c++) next[r * width + c] = fn(r, c);
    commit(next, diffBoards(drawing, next));
  };

  const runCheck = async () => {
    setChecking(true);
    setMessage(null);
    try {
      const r = await channel.current!.solve(clues, { maxSolutions: 2, stepLimit: 3_000_000 });
      setCheck(r);
    } catch (e) {
      if (!(e instanceof CancelledError)) setMessage({ tone: 'warn', text: (e as Error).message });
    } finally {
      setChecking(false);
    }
  };

  const current = (): StoredPuzzle => ({
    id: puzzleId ?? newId('my'),
    name: name.trim() || 'Chưa đặt tên',
    width,
    height,
    solution: solutionFromGrid(toSolutionGrid(drawing), width, height),
    source: 'custom',
    unique: check?.status === 'unique' ? true : check?.status === 'multiple' ? false : null,
    createdAt: Date.now(),
  });

  const saveLocal = (): StoredPuzzle => {
    const p = current();
    setPuzzleId(p.id);
    update((s) => {
      // Edited drawings invalidate old progress on this puzzle.
      const games = { ...s.games };
      delete games[p.id];
      return addPuzzle({ ...s, games }, p);
    });
    return p;
  };

  const exportJson = () => {
    const p = current();
    const blob = new Blob([JSON.stringify(toPuzzleFile(p), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(p.name || 'puzzle').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'puzzle'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    const r = parsePuzzleFile(await file.text());
    if (!r.ok) {
      setMessage({ tone: 'warn', text: `Không thể nhập ${file.name}: ${r.error}` });
      return;
    }
    setPuzzleId(null);
    setName(r.name);
    setWidth(r.width);
    setHeight(r.height);
    setDrawing(gridFromSolution(r.solution).grid.map((v) => (v === FILLED ? FILLED : UNKNOWN)));
    setHistory(emptyHistory());
    changed();
    setMessage({ tone: 'good', text: `Đã nhập "${r.name}". Hãy lưu để giữ trong bộ sưu tập của bạn.` });
  };

  const share = async () => {
    const code = encodeShare(current());
    const url = `${location.origin}${location.pathname}#/p/${code}`;
    setShareUrl(url);
    try {
      await navigator.clipboard.writeText(url);
      setMessage({ tone: 'good', text: 'Đã sao chép liên kết. Bất kỳ ai mở liên kết đều có thể chơi; không có dữ liệu nào được tải lên.' });
    } catch {
      setMessage({ tone: 'plain', text: 'Sao chép liên kết bên dưới. Bất kỳ ai mở liên kết đều có thể chơi; không có dữ liệu nào được tải lên.' });
    }
  };

  const diffTags = useMemo(() => {
    if (check?.status !== 'multiple') return null;
    const [a, b] = check.solutions as [Uint8Array, Uint8Array];
    const m = new Map<number, CellTag>();
    a.forEach((v, i) => v !== b[i] && m.set(i, 'diff'));
    return m;
  }, [check]);

  const verdict = checking ? (
    <p className="text-sm text-pencil">
      Đang kiểm tra…{' '}
      <button type="button" className="underline underline-offset-2" onClick={() => channel.current?.cancel()}>
        Dừng
      </button>
    </p>
  ) : check ? (
    <p className={`border-l-2 pl-3 text-sm ${check.status === 'unique' ? 'border-solved' : 'border-redpen'}`} role="status">
      {check.status === 'unique' && `Một nghiệm. ${check.logicOnly ? 'Giải được từng hàng/cột, không cần phỏng đoán.' : `Cần suy luận thử trước một bước (${check.branches} lần phỏng đoán trong bộ giải).`}`}
      {check.status === 'multiple' &&
        'Có nhiều hình phù hợp với các chỉ dẫn này. Các ô tô bóng có thể nhận cả hai trạng thái; hãy tô hoặc xóa một số ô để loại bỏ sự mơ hồ.'}
      {check.status === 'limit' && 'Đã đạt giới hạn bước kiểm tra mà chưa có kết luận.'}
      {check.status === 'none' && 'Không có nghiệm. Điều này không nên xảy ra với bản vẽ; vui lòng báo lỗi.'}
    </p>
  ) : (
    <p className="text-sm text-pencil">Chưa kiểm tra. Một câu đố tốt có đúng một nghiệm.</p>
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <h1 className="text-xl font-semibold">Tạo câu đố</h1>
      <p className="mt-0.5 max-w-[68ch] text-sm text-pencil">
        Vẽ một hình. Chỉ dẫn sẽ cập nhật khi bạn vẽ. Kiểm tra nghiệm duy nhất, sau đó chơi thử, lưu hoặc chia sẻ liên kết.
      </p>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0" aria-label="Bản vẽ">
          <Board
            clues={clues}
            board={drawing}
            mode="draw"
            onStroke={onStroke}
            tags={diffTags}
            axisLock={save.settings.axisLock}
            crosshair={save.settings.crosshair}
            heightBudget={0.66}
            maxCell={34}
            label={`Bản vẽ, ${width} × ${height}`}
          />
          <p className="mt-3 text-sm text-pencil">
            Nhấn hoặc kéo để vẽ; nhấn ô đã tô để xóa. {filled}/{width * height} ô đã tô.
          </p>
        </section>

        <aside className="space-y-6" aria-label="Thiết lập câu đố">
          <label className="block text-sm">
            <span className="text-pencil">Tên</span>
            <input className="field mt-1 w-full" value={name} maxLength={60} placeholder="Chưa đặt tên" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex gap-3">
            <label className="text-sm">
              <span className="block text-pencil">Chiều rộng</span>
              <select className="field mt-1" value={width} onChange={(e) => resize(Number(e.target.value), height)}>
                {SIZES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-pencil">Chiều cao</span>
              <select className="field mt-1" value={height} onChange={(e) => resize(width, Number(e.target.value))}>
                {SIZES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="-mx-2.5 flex flex-wrap">
            <button type="button" className="btn" disabled={history.past.length === 0} onClick={() => { const r = undoH(history, drawing); if (r) { setHistory(r.history); setDrawing(r.board); changed(); } }}>
              <Undo2 size={16} aria-hidden="true" /> Hoàn tác
            </button>
            <button type="button" className="btn" disabled={history.future.length === 0} onClick={() => { const r = redoH(history, drawing); if (r) { setHistory(r.history); setDrawing(r.board); changed(); } }}>
              <Redo2 size={16} aria-hidden="true" /> Làm lại
            </button>
            <button type="button" className="btn" onClick={() => transform((r, c) => drawing[r * width + (width - 1 - c)]!)}>
              <FlipHorizontal size={16} aria-hidden="true" /> Lật ngang
            </button>
            <button type="button" className="btn" onClick={() => transform((r, c) => (drawing[r * width + c] === FILLED ? UNKNOWN : FILLED))}>
              Đảo ô
            </button>
            <button type="button" className="btn" disabled={filled === 0} onClick={() => transform(() => UNKNOWN)}>
              Xóa
            </button>
          </div>

          <div className="space-y-3 border-t border-rule pt-4">
            {verdict}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ink" onClick={() => void runCheck()} disabled={checking || filled === 0}>
                Kiểm tra nghiệm duy nhất
              </button>
              <button
                type="button"
                className="btn btn-line"
                disabled={filled === 0}
                onClick={() => {
                  const p = saveLocal();
                  navigate({ view: 'play', id: p.id });
                }}
              >
                Chơi thử
              </button>
            </div>
          </div>

          <div className="-mx-2.5 flex flex-col border-t border-rule pt-3">
            <button
              type="button"
              className="btn"
              disabled={filled === 0}
              onClick={() => {
                saveLocal();
                setMessage({ tone: 'good', text: 'Đã lưu vào mục Câu đố của bạn trong thư viện.' });
              }}
            >
              {puzzleId ? 'Lưu thay đổi' : 'Lưu vào câu đố của tôi'}
            </button>
            <button type="button" className="btn" disabled={filled === 0} onClick={() => void share()}>
              <Copy size={16} aria-hidden="true" /> Sao chép liên kết chia sẻ
            </button>
            <button type="button" className="btn" disabled={filled === 0} onClick={exportJson}>
              <Download size={16} aria-hidden="true" /> Xuất JSON
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
              <Upload size={16} aria-hidden="true" /> Nhập JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn"
              disabled={filled === 0}
              onClick={() => {
                const p = saveLocal();
                navigate({ view: 'solver', load: p.id });
              }}
            >
              Mở trong bộ giải
            </button>
          </div>

          {message && (
            <p role="status" className={`text-sm ${message.tone === 'warn' ? 'text-redpen' : message.tone === 'good' ? 'text-solved' : ''}`}>
              {message.text}
            </p>
          )}
          {shareUrl && (
            <label className="block text-sm">
              <span className="text-pencil">Liên kết chia sẻ</span>
              <input className="field mt-1 w-full font-mono text-xs" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
            </label>
          )}
        </aside>
      </div>
    </div>
  );
}

