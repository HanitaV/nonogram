import { Settings } from 'lucide-react';
import type { Route } from '../../app/router';
import logo from '../../../assets/logo/hamic.png';
import { playClick } from '../../lib/sound';

const links: { view: Route['view']; label: string; href: string }[] = [
  { view: 'play', label: 'Chơi', href: '#/play' },
  { view: 'library', label: 'Thư viện', href: '#/library' },
  { view: 'solver', label: 'Bộ giải', href: '#/solver' },
  { view: 'create', label: 'Tạo câu đố', href: '#/create' },
  { view: 'learn', label: 'Hướng dẫn', href: '#/learn' },
];

export function Header({ route }: { route: Route }) {
  const current = route.view === 'shared' ? 'play' : route.view;
  return (
    <header className="site-header">
      <div className="mx-auto flex h-12 max-w-[1200px] items-center gap-2 px-3 sm:gap-6 sm:px-6">
        <a href="#/play" className="brand flex items-center gap-3 font-semibold max-[359px]:hidden" aria-label="HAMIC Nonogram Studio, chơi">
          <img src={logo} alt="" className="brand-logo shrink-0" />
          <span className="hidden sm:inline">Nonogram Studio</span>
        </a>
        <nav aria-label="Điều hướng chính" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center gap-0.5 sm:gap-1">
            {links.map((l) => (
              <li key={l.view}>
                <a
                  href={l.href}
                  aria-current={current === l.view ? 'page' : undefined}
                  className="nav-link relative block px-1.5 py-3 text-sm min-[400px]:px-2 aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-1.5"
                  onClick={playClick}
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
