import { lazy, Suspense, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { CreatorView } from '../features/creator/CreatorView';
import { PlayView } from '../features/gameplay/PlayView';
import { LibraryView } from '../features/library/LibraryView';
import { setSoundEnabled } from '../lib/sound';
import { SettingsView } from '../features/settings/SettingsView';
import { SharedView } from '../features/gameplay/SharedView';
import { SolverView } from '../features/solver/SolverView';
import { useRoute } from './router';
import { useStore } from './store';

const LearnView = lazy(() => import('../features/learning/LearnView'));

const titles: Record<string, string> = {
  play: 'Chơi',
  library: 'Thư viện',
  solver: 'Bộ giải',
  create: 'Tạo câu đố',
  learn: 'Hướng dẫn',
  settings: 'Cài đặt',
  shared: 'Câu đố được chia sẻ',
};

function useAppearance() {
  const { save } = useStore();
  const { theme, motion, sound } = save.settings;
  useEffect(() => setSoundEnabled(sound), [sound]);
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      const root = document.documentElement;
      const next = dark ? 'dark' : 'light';
      if (root.dataset.theme !== next) {
        root.classList.add('theme-anim');
        root.dataset.theme = next;
        window.setTimeout(() => root.classList.remove('theme-anim'), 250);
      }
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
  useEffect(() => {
    if (motion === 'system') delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = motion;
  }, [motion]);
}

export function App() {
  const route = useRoute();
  useAppearance();
  useEffect(() => {
    document.title = route.view === 'play' ? 'Nonogram Studio' : `${titles[route.view]} · Nonogram Studio`;
    window.scrollTo(0, 0);
  }, [route.view]);

  let view;
  switch (route.view) {
    case 'play':
      view = <PlayView id={route.id} />;
      break;
    case 'shared':
      view = <SharedView code={route.code} />;
      break;
    case 'library':
      view = <LibraryView />;
      break;
    case 'solver':
      view = <SolverView load={route.load} />;
      break;
    case 'create':
      view = <CreatorView key={route.id ?? 'new'} id={route.id} />;
      break;
    case 'learn':
      view = (
        <Suspense fallback={<p className="mx-auto max-w-[1200px] px-6 py-10 text-pencil">Đang tải…</p>}>
          <LearnView />
        </Suspense>
      );
      break;
    case 'settings':
      view = <SettingsView />;
      break;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => document.getElementById('main')?.focus()}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-sheet focus:px-3 focus:py-2"
      >
        Chuyển đến nội dung
      </button>
      <Header route={route} />
      <main id="main" tabIndex={-1} className="outline-none">
        {view}
      </main>
    </>
  );
}
