'use client';

import { useState } from 'react';
import { LABEL_COLORS } from '@/lib/logic/label-colors';

// Same curated palette as labels (lib/logic/label-colors.ts) — one set of
// colors proven readable in both themes, reused everywhere something needs
// a pickable color instead of every feature inventing its own.
export function ColorPicker({ name, defaultValue }: { name: string; defaultValue: string | null }) {
  const [value, setValue] = useState(defaultValue ?? '');

  return (
    <div className="label-swatch-row">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        className={`label-swatch label-swatch-none ${value === '' ? 'label-swatch-active' : ''}`}
        onClick={() => setValue('')}
        aria-label="—"
      >
        —
      </button>
      {LABEL_COLORS.map((c) => (
        <button
          type="button"
          key={c}
          className={`label-swatch ${value === c ? 'label-swatch-active' : ''}`}
          style={{ background: c }}
          onClick={() => setValue(c)}
          aria-label={c}
        />
      ))}
    </div>
  );
}
