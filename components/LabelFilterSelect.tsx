'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import type { Label } from '@/lib/supabase/types';

// Kontroliruyemyy variant LabelSelect (kak AssigneeFilterSelect dlya
// AssigneeSelect) — dlya fil'tra nad kanbanom/arkhivom, gde vybor pishetsya v URL.
export function LabelFilterSelect({
  labels,
  value,
  onChange,
  placeholder,
}: {
  labels: Label[];
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: globalThis.MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selectedSet = new Set(value);
  const byId = new Map(labels.map((l) => [l.id, l]));

  function toggle(id: string) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  function remove(id: string, e: MouseEvent) {
    e.stopPropagation();
    onChange(value.filter((x) => x !== id));
  }

  return (
    <div className="assignee-select" ref={rootRef}>
      <div
        className="assignee-select-trigger"
        role="button"
        tabIndex={0}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        aria-expanded={open}
        data-testid="label-filter-trigger"
      >
        {value.length ? (
          <span className="assignee-chips">
            {value.map((id) => {
              const l = byId.get(id);
              if (!l) return null;
              return (
                <span className="assignee-chip label-chip" key={id} style={{ ['--pill-color' as string]: l.color }}>
                  {l.name}
                  <button type="button" onClick={(e) => remove(id, e)} aria-label={l.name}>
                    <X size={12} strokeWidth={2} />
                  </button>
                </span>
              );
            })}
          </span>
        ) : (
          <span className="assignee-select-placeholder">{placeholder}</span>
        )}
        <ChevronDown size={16} strokeWidth={1.75} className={open ? 'chevron-open' : ''} />
      </div>
      {open && (
        <div className="assignee-select-panel">
          <div className="assignee-select-list">
            {labels.map((l) => (
              <div
                key={l.id}
                className={`assignee-option ${selectedSet.has(l.id) ? 'selected' : ''}`}
                onClick={() => toggle(l.id)}
                data-testid="label-filter-option"
              >
                <span className="label-option-name">
                  <span className="label-option-swatch" style={{ background: l.color }} />
                  {l.name}
                </span>
                {selectedSet.has(l.id) && <Check size={14} strokeWidth={2} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
