'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';

// Vypadayushchiy mul'ti-select vmesto ploskogo spiska checkbox'ov: ne razrastayetsya
// na stranitse, kogda registrirovannykh pol'zovateley stanovitsya mnogo (100+).
// Fakticheskiye znacheniya dlya formy — skrytyye <input type="hidden">, tak chto
// server-action prodolzhayet chitat' ikh cherez formData.getAll('assigneeIds')
// bez izmeneniy.
export function AssigneeSelect({
  assignees,
  defaultSelected,
}: {
  assignees: { id: string; name: string }[];
  defaultSelected: string[];
}) {
  const dict = useDictionary();
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: globalThis.MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selectedSet = new Set(selected);
  const byId = new Map(assignees.map((a) => [a.id, a]));
  const filtered = assignees.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function remove(id: string, e: MouseEvent) {
    e.stopPropagation();
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  return (
    <div className="assignee-select" ref={rootRef}>
      {selected.map((id) => (
        <input key={id} type="hidden" name="assigneeIds" value={id} />
      ))}
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
      >
        {selected.length ? (
          <span className="assignee-chips">
            {selected.map((id) => {
              const a = byId.get(id);
              if (!a) return null;
              return (
                <span className="assignee-chip" key={id}>
                  {a.name}
                  <button type="button" onClick={(e) => remove(id, e)} aria-label={a.name}>
                    <X size={12} strokeWidth={2} />
                  </button>
                </span>
              );
            })}
          </span>
        ) : (
          <span className="assignee-select-placeholder">{dict.taskForm.assigneesPlaceholder}</span>
        )}
        <ChevronDown size={16} strokeWidth={1.75} className={open ? 'chevron-open' : ''} />
      </div>
      {open && (
        <div className="assignee-select-panel">
          <div className="assignee-select-search">
            <Search size={14} strokeWidth={1.75} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.taskForm.assigneesSearchPlaceholder}
            />
          </div>
          <div className="assignee-select-list">
            {filtered.length ? (
              filtered.map((a) => (
                <div
                  key={a.id}
                  className={`assignee-option ${selectedSet.has(a.id) ? 'selected' : ''}`}
                  onClick={() => toggle(a.id)}
                >
                  <span>{a.name}</span>
                  {selectedSet.has(a.id) && <Check size={14} strokeWidth={2} />}
                </div>
              ))
            ) : (
              <div className="assignee-select-empty">{dict.taskForm.assigneesEmpty}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
