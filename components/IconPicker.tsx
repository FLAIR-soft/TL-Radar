'use client';

import { useEffect, useRef, useState } from 'react';
import { ICON_NAMES, ICON_MAP, type IconName } from '@/lib/logic/icons';

export function IconPicker({ name, defaultValue }: { name: string; defaultValue: string | null }) {
  const [value, setValue] = useState(defaultValue ?? '');
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const Selected = value ? ICON_MAP[value as IconName] : undefined;

  return (
    <div className="icon-picker" ref={rootRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        className="icon-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {Selected ? <Selected size={18} strokeWidth={1.75} /> : <span className="icon-picker-placeholder">—</span>}
      </button>
      {open && (
        <div className="icon-picker-panel">
          <button
            type="button"
            className={`icon-picker-option ${value === '' ? 'selected' : ''}`}
            onClick={() => {
              setValue('');
              setOpen(false);
            }}
          >
            —
          </button>
          {ICON_NAMES.map((n) => {
            const Icon = ICON_MAP[n];
            return (
              <button
                type="button"
                key={n}
                className={`icon-picker-option ${value === n ? 'selected' : ''}`}
                title={n}
                onClick={() => {
                  setValue(n);
                  setOpen(false);
                }}
              >
                <Icon size={18} strokeWidth={1.75} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
