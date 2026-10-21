import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadSave, writeSave, type SaveData } from '../lib/storage';

interface Store {
  save: SaveData;
  update: (fn: (draft: SaveData) => SaveData) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const latest = useRef(save);
  const timer = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    writeSave(latest.current);
  }, []);

  const update = useCallback((fn: (d: SaveData) => SaveData) => {
    setSave((prev) => {
      const next = fn(prev);
      latest.current = next;
      return next;
    });
    if (timer.current === null) timer.current = window.setTimeout(flush, 250);
  }, [flush]);

  useEffect(() => {
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [flush]);

  const value = useMemo(() => ({ save, update }), [save, update]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
