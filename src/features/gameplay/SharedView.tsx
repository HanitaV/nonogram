import { useMemo } from 'react';
import { PlayView } from './PlayView';
import { sharedPuzzle, SHARED_PREFIX } from '../../lib/puzzles';

/** A puzzle opened from a share link. Progress is kept under the link's code. */
export function SharedView({ code }: { code: string }) {
  const puzzle = useMemo(() => sharedPuzzle(code), [code]);
  if (!puzzle) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-xl font-semibold">Liên kết này không chứa câu đố</h1>
        <p className="mt-2 text-pencil">Địa chỉ có thể bị thiếu khi sao chép. Hãy xin lại liên kết hoặc chọn một câu đố trong thư viện.</p>
        <a className="btn btn-ink mt-6" href="#/library">
          Mở thư viện
        </a>
      </div>
    );
  }
  return <PlayView id={SHARED_PREFIX + code} />;
}
