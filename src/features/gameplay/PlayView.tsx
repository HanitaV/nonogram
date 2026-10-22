import { Eraser, Lightbulb, Plus, Redo2, RotateCcw, Search, Square, Undo2, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { Board, type CellTag, type Tool } from '../../components/game/Board';
import { Menu } from '../../components/ui/Menu';
import { LIBRARY } from '../../data/puzzles';
import { formatClue } from '../../engine/clues';
import type { Hint } from '../../engine/hints';
import { contradictoryCells, mistakesAgainst } from '../../engine/validation';
import { difficultyLabel, formatTime, plural } from '../../lib/format';
import { addPuzzle, nextLibraryPuzzle, randomLibraryPuzzle, storedFromGrid } from '../../lib/library';
import { puzzleLabel, resolvePuzzle } from '../../lib/puzzles';
import { CancelledError, SolverChannel } from '../../lib/solverClient';
import { playTick } from '../../lib/sound';
import { EMPTY, FILLED, type Axis, type Puzzle } from '../../types/puzzle';
import { solutionGrid, useGame } from './useGame';

export function PlayView({ id }: { id: string | null }) {
  const { save } = useStore();
  const wanted = id ?? save.currentId ?? LIBRARY[0]!.id;
  const puzzle = useMemo(() => resolvePuzzle(wanted, save.puzzles), [wanted, save.puzzles]);
  if (!puzzle) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-xl font-semibold">Không tìm thấy câu đố</h1>
        <p className="mt-2 text-pencil">
          Câu đố có thể đã bị xóa khỏi trình duyệt hoặc liên kết chưa đầy đủ. Hãy chọn câu khác trong thư viện.
        </p>
        <a className="btn btn-ink mt-6" href="#/library">
          Mở thư viện
        </a>
      </div>
    );
  }
  return <PlaySession key={puzzle.id} puzzle={puzzle} />;
}

interface Note {
  tone: 'plain' | 'warn' | 'good';
  body: ReactNode;
  tags?: Map<number, CellTag>;
  line?: { axis: Axis; index: number } | null;
  actions?: { label: string; run: () => void; primary?: boolean }[];
}

const cellName = (p: Puzzle, idx: number) => `hàng ${Math.floor(idx / p.width) + 1}, cột ${(idx % p.width) + 1}`;
const lineName = (p: Puzzle, axis: Axis, index: number) =>
  `${axis === 'row' ? 'Hàng' : 'Cột'} ${index + 1} (${formatClue(axis === 'row' ? p.rows[index]! : p.cols[index]!)})`;

function PlaySession({ puzzle }: { puzzle: Puzzle }) {
  const { save, update } = useStore();
  const settings = save.settings;
  const game = useGame(puzzle);
  const [tool, setTool] = useState<Tool>('fill');
  const [note, setNote] = useState<Note | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const channel = useRef<SolverChannel | null>(null);
  channel.current ??= new SolverChannel();
  const solved = game.status === 'solved';
  const revealed = game.status === 'revealed';
  const finished = solved || revealed;
  const showName = finished || puzzle.source === 'custom';
  const uniqueRef = useMemo(() => puzzle.unique ? solutionGrid(puzzle) : null, [puzzle]);
  const mistakes = useMemo(() => finished ? [] : contradictoryCells(puzzle, game.board, game.check), [puzzle, game.board, game.check, finished]);
  const boardTags = useMemo(() => {
    const tags = new Map(note?.tags);
    mistakes.forEach((index) => tags.set(index, 'mistake'));
    return tags;
  }, [note?.tags, mistakes]);

  useEffect(() => {
    const ch = channel.current;
    return () => ch?.dispose();
  }, []);

  // Any board change makes an old hint or check stale.
  const boardRef = useRef(game.board);
  useEffect(() => {
    if (boardRef.current !== game.board) {
      boardRef.current = game.board;
      setNote(null);
      channel.current?.cancel();
      setBusy(null);
    }
  }, [game.board]);

  const run = useCallback(async <T,>(label: string, job: () => Promise<T>): Promise<T | null> => {
    setBusy(label);
    try {
      return await job();
    } catch (e) {
      if (!(e instanceof CancelledError)) setNote({ tone: 'warn', body: `Đã xảy ra lỗi: ${(e as Error).message}` });
      return null;
    } finally {
      setBusy((b) => (b === label ? null : b));
    }
  }, []);

  const hint = useCallback(async () => {
    if (finished) return;
    const h = await run('hint', () => channel.current!.hint(puzzle, game.board, uniqueRef));
    if (h) setNote(describeHint(puzzle, h, game.apply, game.undo));
  }, [finished, run, puzzle, game.board, game.apply, game.undo, uniqueRef]);

  const check = useCallback(async () => {
    if (finished) return;
    const bad: { axis: Axis; index: number }[] = [];
    game.check.rows.forEach((s, i) => s.impossible && bad.push({ axis: 'row', index: i }));
    game.check.cols.forEach((s, i) => s.impossible && bad.push({ axis: 'col', index: i }));
    if (bad.length) {
      setNote({
        tone: 'warn',
        line: bad[0],
        body: (
          <>
            {bad.slice(0, 3).map((b) => lineName(puzzle, b.axis, b.index)).join(', ')}
            {bad.length > 3 ? ` và ${bad.length - 3} hàng/cột khác` : ''} không thể hoàn thành với các ô tô và dấu hiện tại. Chỉ dẫn
             hiện màu đỏ.
          </>
        ),
      });
      return;
    }
    const r = await run('check', () => channel.current!.solve(puzzle, { initial: game.board, maxSolutions: 1, stepLimit: 400_000 }));
    if (!r) return;
    if (r.status === 'none') {
      const mistakes = uniqueRef ? mistakesAgainst(game.board, uniqueRef) : [];
      setNote({
        tone: 'warn',
        body: 'Từng hàng/cột vẫn hợp lệ riêng lẻ, nhưng không có nghiệm hoàn chỉnh phù hợp với bảng. Một bước trước đó đã sai.',
        actions: uniqueRef
          ? [
              {
                label: `Hiện ${plural(mistakes.length, 'ô sai')}`,
                run: () =>
                  setNote({
                    tone: 'warn',
                    body: `${plural(mistakes.length, 'ô')} khác so với đáp án. Các ô này được viền đỏ.`,
                    tags: new Map(mistakes.map((m) => [m, 'mistake'])),
                  }),
              },
            ]
          : undefined,
      });
    } else if (r.status === 'limit') {
      setNote({ tone: 'plain', body: 'Hết thời gian kiểm tra mà chưa có kết luận.' });
    } else {
      setNote({
        tone: 'good',
        body: `Chưa có mâu thuẫn với chỉ dẫn. Đã tô ${game.check.filled}/${game.check.target} ô cần tô.`,
      });
    }
  }, [finished, game.check, game.board, puzzle, run, uniqueRef]);

  const solve = useCallback(async () => {
    const r = await run('solve', () => channel.current!.solve(puzzle, { maxSolutions: 2 }));
    if (!r) return;
    const sol = r.solutions[0];
    if (!sol) {
      setNote({ tone: 'warn', body: r.status === 'none' ? 'Các chỉ dẫn này không có nghiệm.' : 'Bộ giải đã hết thời gian.' });
      return;
    }
    game.reveal(sol);
    setNote({
      tone: 'plain',
      body:
        r.status === 'multiple'
          ? 'Đã hiện một nghiệm. Câu đố có nhiều nghiệm nên cách giải của bạn có thể khác mà vẫn đúng.'
          : 'Đã hiện đáp án. Lượt này được tính là giải có trợ giúp nên không ghi nhận thời gian.',
    });
  }, [run, puzzle, game]);

  const confirm = (body: string, label: string, action: () => void) =>
    setNote({
      tone: 'plain',
      body,
      actions: [
        { label, run: action, primary: true },
        { label: 'Hủy', run: () => setNote(null) },
      ],
    });

  const generate = async (size: number) => {
    const seed = Math.floor(Math.random() * 0xffffffff);
    const grid = await run('generate', () => channel.current!.generate(size, size, seed));
    if (!grid) {
      setNote({ tone: 'warn', body: 'Không tạo được câu đố có nghiệm duy nhất. Hãy thử lại.' });
      return;
    }
    const count = save.puzzles.filter((p) => p.source === 'generated').length + 1;
    const stored = storedFromGrid(grid, size, size, `Tạo ngẫu nhiên ${size}×${size} #${count}`, 'generated', true);
    update((s) => addPuzzle(s, stored));
    navigate({ view: 'play', id: stored.id });
  };

  // Global shortcuts (the board handles its own keys when focused).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [role=menu]')) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) game.redo();
        else game.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        game.redo();
      } else if (!mod && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === 'h') void hint();
        else if (k === 'c') void check();
        else if (k === 't') setTool((x) => (x === 'fill' ? 'mark' : 'fill'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, hint, check]);

  const progress = Math.min(1, game.check.target ? game.check.filled / game.check.target : 0);
  const title = showName ? puzzle.name : puzzleLabel(puzzle);
  const nextId = nextLibraryPuzzle(save, puzzle.id);

  const newMenu = [
    { label: 'Câu tiếp theo trong thư viện', onSelect: () => navigate({ view: 'play', id: nextId }) },
    { label: 'Chọn ngẫu nhiên từ thư viện', onSelect: () => navigate({ view: 'play', id: randomLibraryPuzzle(save, puzzle.id) }) },
    { label: 'Tạo ngẫu nhiên 5 × 5', hint: 'ngẫu nhiên, nghiệm duy nhất', onSelect: () => void generate(5) },
    { label: 'Tạo ngẫu nhiên 10 × 10', hint: 'ngẫu nhiên, nghiệm duy nhất', onSelect: () => void generate(10) },
    { label: 'Tạo ngẫu nhiên 15 × 15', hint: 'ngẫu nhiên, nghiệm duy nhất', onSelect: () => void generate(15) },
  ];

  const toolSwitch = (group: string) => (
    <div className="seg" role="radiogroup" aria-label="Công cụ chính">
      <label>
        <input type="radio" name={`tool-${group}`} checked={tool === 'fill'} onChange={() => setTool('fill')} disabled={finished} />
        <span>
          <Square size={13} fill="currentColor" aria-hidden="true" /> Tô ô
        </span>
      </label>
      <label>
        <input type="radio" name={`tool-${group}`} checked={tool === 'mark'} onChange={() => setTool('mark')} disabled={finished} />
        <span>
          <X size={14} aria-hidden="true" /> Đánh dấu
        </span>
      </label>
    </div>
  );

  const noteBox = note && (
    <div
      role="status"
      className={`border-l-2 py-1 pl-3 text-sm ${note.tone === 'warn' ? 'border-redpen' : note.tone === 'good' ? 'border-solved' : 'border-highlight'}`}
    >
      <p>{note.body}</p>
      {note.actions && (
        <div className="mt-2 flex flex-wrap gap-2">
          {note.actions.map((a) => (
            <button key={a.label} type="button" className={`btn ${a.primary ? 'btn-ink' : 'btn-line'}`} onClick={a.run}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const busyNote = busy && (
    <p role="status" className="text-sm text-pencil">
      {busy === 'hint' ? 'Đang tìm bước tiếp theo…' : busy === 'check' ? 'Đang kiểm tra bảng…' : busy === 'solve' ? 'Đang giải…' : 'Đang tạo câu đố…'}
      <button type="button" className="ml-2 underline underline-offset-2" onClick={() => channel.current?.cancel()}>
        Dừng
      </button>
    </p>
  );

  const finishedPanel = finished && (
    <div className="space-y-3" role="status">
      {solved ? (
        <>
          <p className="text-lg font-semibold text-solved">Đã giải trong {formatTime(game.elapsedMs)}</p>
          <p className="text-sm text-pencil">
            {game.newBest ? 'Kỷ lục cá nhân mới.' : game.bestMs !== null ? `Kỷ lục của bạn: ${formatTime(game.bestMs)}.` : ''}
            {puzzle.note ? ` ${puzzle.note}` : ''}
          </p>
        </>
      ) : (
        <p className="text-sm text-pencil">Đã hiện đáp án. Chơi lại để ghi nhận thời gian.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ink" onClick={() => navigate({ view: 'play', id: nextId })}>
          Câu tiếp theo
        </button>
        <button
          type="button"
          className="btn btn-line"
          onClick={() => {
            game.reset();
            setNote(null);
          }}
        >
          Chơi lại
        </button>
      </div>
    </div>
  );

  const actions = (
    <>
      <button type="button" className="btn" onClick={game.undo} disabled={!game.canUndo} aria-keyshortcuts="Control+Z">
        <Undo2 size={16} aria-hidden="true" /> Hoàn tác <kbd>Ctrl Z</kbd>
      </button>
      <button type="button" className="btn" onClick={game.redo} disabled={!game.canRedo} aria-keyshortcuts="Control+Y">
        <Redo2 size={16} aria-hidden="true" /> Làm lại <kbd>Ctrl Y</kbd>
      </button>
      <button type="button" className="btn" onClick={() => void hint()} disabled={finished || busy !== null} aria-keyshortcuts="H">
        <Lightbulb size={16} aria-hidden="true" /> Gợi ý <kbd>H</kbd>
      </button>
      <button type="button" className="btn" onClick={() => void check()} disabled={finished || busy !== null} aria-keyshortcuts="C">
        <Search size={16} aria-hidden="true" /> Kiểm tra <kbd>C</kbd>
      </button>
    </>
  );

  return (
    <div className="play-workspace mx-auto w-full max-w-[1200px] px-4 pb-28 pt-5 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-x-8 lg:pb-12 lg:pt-8">
      <section aria-labelledby="puzzle-title" className="puzzle-sheet min-w-0">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h1 id="puzzle-title" className="text-xl font-semibold leading-tight">
              {title}
            </h1>
            <p className="mt-0.5 text-sm text-pencil">
              {puzzle.width} × {puzzle.height}, {difficultyLabel[puzzle.difficulty]?.toLowerCase()}
              {puzzle.source === 'library' && !showName ? '. Tên sẽ hiện khi bạn giải xong.' : ''}
            </p>
          </div>
          {/* Compact status for small screens */}
          <div className="flex items-baseline gap-4 lg:hidden">
            <span className="font-mono text-lg tnum" aria-label={`Thời gian ${formatTime(game.elapsedMs)}`}>
              {formatTime(game.elapsedMs)}
            </span>
            <span className="text-sm text-pencil tnum">
              {game.check.filled}/{game.check.target}
            </span>
          </div>
        </header>

        <div className="puzzle-canvas">
        <Board
          clues={puzzle}
          board={game.board}
          mode={finished ? 'view' : 'play'}
          tool={tool}
          onStroke={game.stroke}
          onPaint={settings.sound ? playTick : undefined}
          lineStatus={game.check}
          tags={boardTags}
          activeLine={note?.line ?? null}
          solved={finished}
          axisLock={settings.axisLock}
          crosshair={settings.crosshair}
          zoom={zoom}
          maxCell={56}
          heightBudget={0.68}
          center
          label={`${title}, ${puzzle.width} × ${puzzle.height}`}
        />
        </div>

        {!finished && (
          <div className={`mistake-report ${mistakes.length ? 'has-mistakes' : ''}`} role="status" aria-live="polite" aria-atomic="true">
            <div className="flex items-center justify-between gap-3">
              <strong>{mistakes.length ? 'Có hàng hoặc cột vi phạm quy tắc' : 'Kiểm tra quy tắc'}</strong>
              <span className="text-xs">Theo chỉ dẫn</span>
            </div>
            <p className="mt-1 text-sm">
              {mistakes.length
                ? `Các ô đã chọn trong hàng/cột mâu thuẫn được đánh dấu đỏ: ${mistakes.slice(0, 4).map((index) => cellName(puzzle, index)).join('; ')}${mistakes.length > 4 ? `; và ${mistakes.length - 4} ô khác` : ''}. Hãy sửa các ô trong hàng/cột đó hoặc hoàn tác.`
                : 'Chưa có hàng hoặc cột vi phạm quy tắc. Chỉ báo đỏ khi không còn cách xếp hợp lệ theo chỉ dẫn. Dùng Kiểm tra để kiểm tra toàn bảng.'}
            </p>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[60ch] text-sm text-pencil">
            {!finished && (
              <>
                <span className="pointer-coarse:hidden">
                  Nhấn để tô, nhấn chuột phải để đánh dấu trống, kéo để tô một hàng/cột. Nhấn lại ô đã tô để xóa. Bạn cũng có thể dùng phím mũi tên và Space.
                </span>
                <span className="hidden pointer-coarse:inline">Chạm hoặc kéo để tô. Chuyển giữa Tô ô và Đánh dấu bên dưới; chạm lại vào ô để xóa.</span>
              </>
            )}
          </p>
          {puzzle.width > 10 && (
            <div className="flex gap-1" aria-label="Thu phóng bảng">
              <button type="button" className="btn btn-line" onClick={() => setZoom((z) => Math.max(1, z - 0.25))} disabled={zoom <= 1} aria-label="Thu nhỏ">
                <ZoomOut size={16} aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-line" onClick={() => setZoom((z) => Math.min(2, z + 0.25))} disabled={zoom >= 2} aria-label="Phóng to">
                <ZoomIn size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile: notes appear under the board */}
        <div className="mt-4 space-y-3 lg:hidden">
          {finishedPanel}
          {busyNote}
          {noteBox}
        </div>
      </section>

      {/* Desktop rail */}
      <aside className="game-rail hidden lg:block" aria-label="Điều khiển trò chơi">
        <div className="sticky top-6 space-y-6">
          <h2 className="text-base font-semibold">Lượt chơi của bạn</h2>
          <div>
            <p className="font-mono text-2xl leading-none tnum" aria-label={`Thời gian ${formatTime(game.elapsedMs)}`}>
              {formatTime(game.elapsedMs)}
            </p>
            <p className="mt-1.5 text-sm text-pencil">{game.bestMs !== null ? `Kỷ lục ${formatTime(game.bestMs)}` : 'Chưa có thời gian được ghi nhận'}</p>
          </div>
          <div>
            <div className="flex items-baseline justify-between text-sm">
              <span>Số ô đã tô</span>
              <span className="font-mono tnum">
                {game.check.filled} / {game.check.target}
              </span>
            </div>
            <div className="mt-1.5 h-[3px] bg-rule" role="progressbar" aria-label="Số ô đã tô" aria-valuenow={game.check.filled} aria-valuemin={0} aria-valuemax={game.check.target}>
              <div className="h-full bg-solved transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>

          {finished ? (
            finishedPanel
          ) : (
            <>
              {toolSwitch('rail')}
              <div className="-mx-2.5 flex flex-col">{actions}</div>
              {busyNote}
              {noteBox}
            </>
          )}

          <div className="-mx-2.5 flex flex-col border-t border-rule pt-3">
            <button
              type="button"
              className="btn"
              disabled={game.board.every((v) => v === 0) && game.elapsedMs === 0}
              onClick={() => confirm('Xóa bảng và đặt lại đồng hồ?', 'Xóa bảng', () => { game.reset(); setNote(null); })}
            >
              <RotateCcw size={16} aria-hidden="true" /> Đặt lại
            </button>
            <button
              type="button"
              className="btn"
              disabled={finished || busy !== null}
              onClick={() => confirm('Hiện đáp án? Câu đố sẽ không được tính là tự giải.', 'Hiện đáp án', () => void solve())}
            >
              <Eraser size={16} aria-hidden="true" /> Giải
            </button>
            <Menu label="Câu đố mới" items={newMenu} up>
              <Plus size={16} aria-hidden="true" /> Câu đố mới
            </Menu>
          </div>
        </div>
      </aside>

      {/* Mobile toolbar, within thumb reach */}
      <nav
        aria-label="Điều khiển trò chơi"
        className="mobile-tools fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 lg:hidden"
      >
        <div className="mx-auto flex max-w-xl items-center justify-between gap-1">
          {finished ? (
            <button type="button" className="btn btn-ink" onClick={() => navigate({ view: 'play', id: nextId })}>
              Câu tiếp theo
            </button>
          ) : (
            toolSwitch('bar')
          )}
          <div className="flex items-center">
            <button type="button" className="btn px-2.5" onClick={game.undo} disabled={!game.canUndo} aria-label="Hoàn tác">
              <Undo2 size={18} aria-hidden="true" />
            </button>
            <button type="button" className="btn px-2.5" onClick={game.redo} disabled={!game.canRedo} aria-label="Làm lại">
              <Redo2 size={18} aria-hidden="true" />
            </button>
            <button type="button" className="btn px-2.5" onClick={() => void hint()} disabled={finished || busy !== null} aria-label="Gợi ý">
              <Lightbulb size={18} aria-hidden="true" />
            </button>
            <Menu
              label="Thao tác khác"
              align="right"
              up
              className="btn px-2.5"
              items={[
                { label: 'Kiểm tra', onSelect: () => void check(), disabled: finished },
                { label: 'Đặt lại', onSelect: () => confirm('Xóa bảng và đặt lại đồng hồ?', 'Xóa bảng', () => { game.reset(); setNote(null); }) },
                { label: 'Giải', onSelect: () => confirm('Hiện đáp án? Câu đố sẽ không được tính là tự giải.', 'Hiện đáp án', () => void solve()), disabled: finished },
                ...newMenu,
              ]}
            >
              Thêm
            </Menu>
          </div>
        </div>
      </nav>
    </div>
  );
}

function describeHint(p: Puzzle, h: Hint, apply: (cells: number[], values: number[]) => void, undo: () => void): Note {
  const word = (v: number) => (v === FILLED ? 'được tô' : 'trống');
  switch (h.kind) {
    case 'solved':
      return { tone: 'good', body: 'Đã xác định mọi ô. Tô đủ hình để hoàn thành.' };
    case 'line-contradiction':
      return {
        tone: 'warn',
        line: { axis: h.axis, index: h.index },
        body: `${lineName(p, h.axis, h.index)} không thể hoàn thành với các ô tô và dấu hiện tại. Hãy hoàn tác hoặc xóa một ô trong đó.`,
        actions: [{ label: 'Hoàn tác bước trước', run: undo }],
      };
    case 'inconsistent':
      return {
        tone: 'warn',
        body: h.mistakes
          ? `Không còn nghiệm phù hợp với bảng, nên gợi ý sẽ dựa trên lỗi sai. Có ${plural(h.mistakes.length, 'ô')} khác so với đáp án; các ô này được viền đỏ.`
          : 'Không còn nghiệm hoàn chỉnh phù hợp với bảng, nên gợi ý sẽ dựa trên lỗi sai. Một bước trước đó đã sai.',
        tags: h.mistakes ? new Map(h.mistakes.map((m) => [m, 'mistake' as const])) : undefined,
      };
    case 'line': {
      const fills = h.values.filter((v) => v === FILLED).length;
      const empties = h.values.length - fills;
      const parts = [fills ? plural(fills, 'ô') + ' được tô' : '', empties ? plural(empties, 'ô') + ' trống' : ''].filter(Boolean).join(' và ');
      return {
        tone: 'plain',
        line: { axis: h.axis, index: h.index },
        tags: new Map(h.cells.map((c) => [c, 'hint' as const])),
        body: `${lineName(p, h.axis, h.index)}: ${
          h.placements === 1 ? 'chỉ có một cách sắp xếp phù hợp' : `cả ${h.placements} cách sắp xếp phù hợp đều thống nhất`
        }, suy ra ${parts}. Các ô này được viền nổi bật.`,
        actions: [{ label: 'Áp dụng', primary: true, run: () => apply(h.cells, h.values) }],
      };
    }
    case 'probe': {
      const broken = h.brokenAxis !== null && h.brokenIndex !== null ? lineName(p, h.brokenAxis, h.brokenIndex) : 'một hàng/cột';
      return {
        tone: 'plain',
        tags: new Map([[h.cell, 'hint' as const]]),
        line: h.brokenAxis !== null && h.brokenIndex !== null ? { axis: h.brokenAxis, index: h.brokenIndex } : null,
        body: `Không thể suy ra từ riêng một hàng/cột, nên thử trước một bước: nếu ô ở ${cellName(p, h.cell)} là ${word(h.value === FILLED ? EMPTY : FILLED)}, ${broken} sẽ không thể hoàn thành. Vậy ô này phải là ${word(h.value)}.`,
        actions: [{ label: 'Áp dụng', primary: true, run: () => apply([h.cell], [h.value]) }],
      };
    }
    case 'reveal':
      return {
        tone: 'plain',
        tags: new Map([[h.cell, 'hint' as const]]),
        body: `Không còn suy luận theo hàng/cột hay thử trước một bước. Cần tìm kiếm sâu hơn, nên gợi ý này chỉ hiện ô ở ${cellName(p, h.cell)} từ ${
          h.fromUniqueSolution ? 'nghiệm duy nhất' : 'một nghiệm hợp lệ (câu đố có thể có nghiệm khác)'
        }.`,
        actions: [{ label: 'Hiện ô này', primary: true, run: () => apply([h.cell], [h.value]) }],
      };
    default:
      return { tone: 'plain', body: 'Đã hết thời gian tìm gợi ý. Hãy dùng Kiểm tra.' };
  }
}
