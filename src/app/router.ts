import { useEffect, useState } from 'react';

export type Route =
  | { view: 'play'; id: string | null }
  | { view: 'library' }
  | { view: 'solver'; load: string | null }
  | { view: 'create'; id: string | null }
  | { view: 'learn' }
  | { view: 'settings' }
  | { view: 'shared'; code: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  const [head = '', ...rest] = path.split('/');
  const arg = rest.length ? decodeURIComponent(rest.join('/')) : null;
  switch (head) {
    case '':
    case 'play':
      return { view: 'play', id: arg };
    case 'library':
      return { view: 'library' };
    case 'solver':
      return { view: 'solver', load: arg };
    case 'create':
      return { view: 'create', id: arg };
    case 'learn':
      return { view: 'learn' };
    case 'settings':
      return { view: 'settings' };
    case 'p':
      return arg ? { view: 'shared', code: arg } : { view: 'play', id: null };
    default:
      return { view: 'play', id: null };
  }
}

export function href(route: Route): string {
  switch (route.view) {
    case 'play':
      return route.id ? `#/play/${encodeURIComponent(route.id)}` : '#/play';
    case 'solver':
      return route.load ? `#/solver/${encodeURIComponent(route.load)}` : '#/solver';
    case 'create':
      return route.id ? `#/create/${encodeURIComponent(route.id)}` : '#/create';
    case 'shared':
      return `#/p/${route.code}`;
    default:
      return `#/${route.view}`;
  }
}

export function navigate(route: Route, replace = false): void {
  const h = href(route);
  if (replace) history.replaceState(null, '', h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
