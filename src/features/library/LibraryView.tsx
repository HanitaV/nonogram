import { Shuffle, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { navigate } from '../../app/router';
import { useStore } from '../../app/store';
import { Thumbnail } from '../../components/game/Thumbnail';
import { LIBRARY } from '../../data/puzzles';
import { gridFromSolution } from '../../engine/clues';
import { difficultyLabel, formatTime } from '../../lib/format';
import { randomLibraryPuzzle } from '../../lib/library';
import { fromStored, puzzleLabel, resolvePuzzle } from '../../lib/puzzles';
import { decodeBoard, type GameRecord } from '../../lib/storage';
import type { Difficulty, Puzzle } from '../../types/puzzle';

type StatusFilter = 'all' | 'new' | 'playing' | 'solved';
const tiers: Difficulty[] = ['beginner', 'easy', 'intermediate', 'advanced', 'boss'];

function statusOf(rec: GameRecord | undefined): Exclude<StatusFilter, 'all'> {
  if (!rec) return 'new';
  if (rec.status === 'solved' || rec.bestMs !== null) return 'solved';
  if (rec.board.includes('1') || rec.board.includes('2') || rec.status === 'revealed') return 'playing';
  return 'new';
}

function Entry({ p, rec }: { p: Puzzle; rec: GameRecord | undefined }) {
  const st = statusOf(rec);
  const solvedOnce = st === 'solved';
  const cells = solvedOnce ? gridFromSolution(p.solution).grid : rec ? decodeBoard(rec.board, p.width * p.height) : null;
  const named = solvedOnce || p.source === 'custom';
  const statusText =
    st === 'solved'
      ? rec?.bestMs
        ? `Đã giải, kỷ lục ${formatTime(rec.bestMs)}`
        : 'Đã giải'
      : rec?.status === 'revealed'
        ? 'Đã hiện đáp án'
        : st === 'playing'
          ? `Đang chơi, ${formatTime(rec?.elapsedMs ?? 0)}`
          : 'Chưa chơi';
  return (
    <a
      href={`#/play/${encodeURIComponent(p.id)}`}
      className="group flex items-center gap-3 border-b border-r border-rule p-3 hover:bg-shade"
      aria-label={`${puzzleLabel(p)}${named ? `, ${p.name}` : ''}, ${p.width} × ${p.height}, ${statusText}`}
    >
      <Thumbnail width={p.width} height={p.height} cells={cells} size={44} faded={!solvedOnce && st === 'playing'} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">
          {p.number ? <span className="font-mono tnum">{p.number < 10 ? `0${p.number}` : p.number}</span> : null}
          {p.number && named ? ' ' : ''}
          {named ? p.name : p.number ? '' : 'Chưa đặt tên'}
        </span>
        <span className={`block text-xs ${st === 'solved' ? 'text-solved' : 'text-pencil'}`}>{statusText}</span>
      </span>
    </a>
  );
}

export function LibraryView() {
  const { save, update } = useStore();
  const [tier, setTier] = useState<'all' | Difficulty>('all');
  const [size, setSize] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [deleting, setDeleting] = useState<string | null>(null);

  const mine = useMemo(() => save.puzzles.map(fromStored), [save.puzzles]);
  const all = useMemo(() => [...LIBRARY, ...mine], [mine]);
  const sizes = useMemo(() => [...new Set(all.map((p) => `${p.width}×${p.height}`))], [all]);

  const keep = (p: Puzzle) =>
    (tier === 'all' || p.difficulty === tier) &&
    (size === 'all' || `${p.width}×${p.height}` === size) &&
    (status === 'all' || statusOf(save.games[p.id]) === status);

  const unfinished = useMemo(() => {
    const list = Object.entries(save.games)
      .filter(([, g]) => g.status === 'playing' && /[12]/.test(g.board))
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt);
    for (const [id, g] of list) {
      const p = resolvePuzzle(id, save.puzzles);
      if (p) return { p, g };
    }
    return null;
  }, [save.games, save.puzzles]);

  const solvedCount = LIBRARY.filter((p) => statusOf(save.games[p.id]) === 'solved').length;
  const sections = [
    ...tiers.map((t) => ({ key: t, title: difficultyLabel[t]!, list: LIBRARY.filter((p) => p.difficulty === t && keep(p)) })),
    { key: 'mine', title: 'Câu đố của bạn', list: mine.filter(keep) },
  ].filter((s) => s.list.length > 0 || (s.key === 'mine' && tier === 'all' && status === 'all' && size === 'all'));

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Thư viện</h1>
          <p className="mt-0.5 text-sm text-pencil">
            {LIBRARY.length} câu đố, gồm 40 màn thường và boss cuối 150 × 150. Bạn đã giải {solvedCount}. Tên sẽ hiện khi giải xong.
          </p>
        </div>
        <button type="button" className="btn btn-line" onClick={() => navigate({ view: 'play', id: randomLibraryPuzzle(save, null) })}>
          <Shuffle size={16} aria-hidden="true" /> Chọn ngẫu nhiên câu chưa giải
        </button>
      </div>

      {unfinished && (
        <a
          href={`#/play/${encodeURIComponent(unfinished.p.id)}`}
          className="mt-6 flex items-center gap-4 border-y border-rule py-3 hover:bg-shade"
        >
          <Thumbnail
            width={unfinished.p.width}
            height={unfinished.p.height}
            cells={decodeBoard(unfinished.g.board, unfinished.p.width * unfinished.p.height)}
            size={40}
            faded
          />
          <span className="text-sm">
            <span className="font-medium">Tiếp tục {puzzleLabel(unfinished.p)}</span>
            <span className="block text-pencil">
              {unfinished.p.width} × {unfinished.p.height}, {formatTime(unfinished.g.elapsedMs)} đã chơi
            </span>
          </span>
        </a>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3" role="group" aria-label="Bộ lọc">
        <div className="seg" role="radiogroup" aria-label="Độ khó">
          {(['all', ...tiers] as const).map((t) => (
            <label key={t}>
              <input type="radio" name="tier" checked={tier === t} onChange={() => setTier(t)} />
              <span>{t === 'all' ? 'Tất cả' : difficultyLabel[t]}</span>
            </label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-pencil">
          Kích thước
          <select className="field" value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="all">Bất kỳ</option>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s.replace('×', ' × ')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-pencil">
          Trạng thái
          <select className="field" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="all">Bất kỳ</option>
            <option value="new">Chưa chơi</option>
            <option value="playing">Đang chơi</option>
            <option value="solved">Đã giải</option>
          </select>
        </label>
      </div>

      {sections.length === 0 && (
        <p className="mt-10 text-pencil">
          Không có câu đố phù hợp với bộ lọc.{' '}
          <button
            type="button"
            className="text-ink underline underline-offset-2"
            onClick={() => {
              setTier('all');
              setSize('all');
              setStatus('all');
            }}
          >
            Xóa bộ lọc
          </button>
        </p>
      )}

      {sections.map((s) => {
        const sizesIn = [...new Set(s.list.map((p) => `${p.width} × ${p.height}`))];
        return (
          <section key={s.key} className="mt-9" aria-labelledby={`sec-${s.key}`}>
            <div className="mb-2 flex items-baseline gap-3">
              <h2 id={`sec-${s.key}`} className="text-base font-semibold">
                {s.title}
              </h2>
              {s.key !== 'mine' && <span className="text-sm text-pencil">{sizesIn.join(', ')}</span>}
            </div>
            {s.key === 'mine' && s.list.length === 0 ? (
              <p className="text-sm text-pencil">
                Các câu đố bạn vẽ trong <a className="text-ink underline underline-offset-2" href="#/create">Tạo câu đố</a>, tạo ngẫu nhiên từ màn Chơi hoặc nhập từ tệp sẽ hiện ở đây.
              </p>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(13.5rem,1fr))] border-l border-t border-rule">
                {s.list.map((p) =>
                  s.key === 'mine' ? (
                    <div key={p.id} className="relative">
                      <Entry p={p} rec={save.games[p.id]} />
                      {deleting === p.id ? (
                        <div className="absolute inset-0 flex items-center justify-end gap-1 border-b border-r border-rule bg-sheet px-2" role="group" aria-label={`Xóa ${p.name}?`}>
                          <span className="mr-auto pl-1 text-sm">Xóa câu đố này?</span>
                          <button
                            type="button"
                            className="btn btn-ink"
                            onClick={() => {
                              update((sv) => {
                                const games = { ...sv.games };
                                delete games[p.id];
                                return { ...sv, games, puzzles: sv.puzzles.filter((x) => x.id !== p.id) };
                              });
                              setDeleting(null);
                            }}
                          >
                            Xóa
                          </button>
                          <button type="button" className="btn btn-line" onClick={() => setDeleting(null)}>
                            Giữ lại
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn absolute right-1 top-1/2 -translate-y-1/2 px-2 text-pencil"
                          aria-label={`Xóa ${p.name}`}
                          onClick={() => setDeleting(p.id)}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <Entry key={p.id} p={p} rec={save.games[p.id]} />
                  ),
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
