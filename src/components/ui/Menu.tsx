import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  hint?: string;
  disabled?: boolean;
}

/** Small disclosure menu. Closes on selection, Escape or outside click. */
export function Menu({
  label,
  items,
  align = 'left',
  up = false,
  className = 'btn',
  children,
}: {
  label: string;
  items: MenuItem[];
  align?: 'left' | 'right';
  up?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLButtonElement>('[role=menuitem]:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = [...(ref.current?.querySelectorAll<HTMLButtonElement>('[role=menuitem]:not(:disabled)') ?? [])];
    const i = list.indexOf(document.activeElement as HTMLButtonElement);
    const next = list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length];
    next?.focus();
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" className={className} aria-haspopup="menu" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {children ?? label}
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          className={`absolute z-30 min-w-56 border border-rule bg-sheet py-1 shadow-[0_6px_24px_-12px_rgb(0_0_0/0.35)] ${
            align === 'right' ? 'right-0' : 'left-0'
          } ${up ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ borderRadius: 6 }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              disabled={it.disabled}
              className="flex w-full items-baseline justify-between gap-4 px-3 py-2 text-left text-sm hover:bg-shade focus-visible:bg-shade disabled:opacity-45"
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              <span>{it.label}</span>
              {it.hint && <span className="text-xs text-pencil">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
