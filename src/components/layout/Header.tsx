import { Settings } from 'lucide-react';
import type { Route } from '../../app/router';

const links: { view: Route['view']; label: string; href: string }[] = [
  { view: 'play', label: 'Chơi', href: '#/play' },
  { view: 'library', label: 'Thư viện', href: '#/library' },
  { view: 'solver', label: 'Bộ giải', href: '#/solver' },
  { view: 'create', label: 'Tạo câu đố', href: '#/create' },
  { view: 'learn', label: 'Hướng dẫn', href: '#/learn' },
];

/** The mark: a 3×3 nonogram whose clues spell itself. */
function Mark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      <rect x="0.5" y="0.5" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1" />
      <g fill="currentColor">
        <rect x="2" y="2" width="4" height="4" />
        <rect x="12" y="2" width="4" height="4" />
        <rect x="7" y="7" width="4" height="4" />
        <rect x="2" y="12" width="4" height="4" />
        <rect x="7" y="12" width="4" height="4" />
      </g>
    </svg>
  );
}

export function Header({ route }: { route: Route }) {
  const current = route.view === 'shared' ? 'play' : route.view;
  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex h-12 max-w-[1200px] items-center gap-2 px-3 sm:gap-6 sm:px-6">
        <a href="#/play" className="flex items-center gap-2 font-semibold max-[359px]:hidden" aria-label="Nonogram Studio, chơi">
          <Mark />
          <span className="hidden sm:inline">Nonogram Studio</span>
        </a>
        <nav aria-label="Điều hướng chính" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center gap-0.5 sm:gap-1">
            {links.map((l) => (
              <li key={l.view}>
                <a
                  href={l.href}
                  aria-current={current === l.view ? 'page' : undefined}
                  className="relative block px-1.5 py-3 text-sm min-[400px]:px-2 text-pencil hover:text-ink aria-[current=page]:text-ink aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-1.5 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-[2px] aria-[current=page]:after:bg-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <a
          href="#/settings"
          aria-label="Cài đặt"
          aria-current={current === 'settings' ? 'page' : undefined}
          className="btn px-1.5 aria-[current=page]:bg-shade"
        >
          <Settings size={17} aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
