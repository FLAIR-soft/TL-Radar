'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { ChevronDown, Check, X, Plus } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { LABEL_COLORS } from '@/lib/logic/label-colors';
import { createLabel } from '../labels-actions';
import type { Label } from '@/lib/supabase/types';

// Tot zhe vypadayushchiy mul'ti-select, chto AssigneeSelect, plyus inline
// sozdaniye novoy metki pryamo v paneli (imya + tsvet iz fiksirovannoy
// palitry) — otdel'noy stranitsy upravleniya metkami net, sozdavat' ikh
// mozhno tol'ko v momente naznacheniya na zadachu.
export function LabelSelect({
  labels,
  defaultSelected,
}: {
  labels: Label[];
  defaultSelected: string[];
}) {
  const dict = useDictionary();
  const [allLabels, setAllLabels] = useState(labels);
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<string>(LABEL_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: globalThis.MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selectedSet = new Set(selected);
  const byId = new Map(allLabels.map((l) => [l.id, l]));

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function remove(id: string, e: MouseEvent) {
    e.stopPropagation();
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function handleCreate() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    createLabel(name, newColor).then((result) => {
      setCreating(false);
      if (result.error) {
        alert(result.error);
        return;
      }
      if (result.label) {
        setAllLabels((prev) => [...prev, result.label!].sort((a, b) => a.name.localeCompare(b.name)));
        setSelected((prev) => [...prev, result.label!.id]);
        setNewName('');
      }
    });
  }

  return (
    <div className="assignee-select" ref={rootRef}>
      {selected.map((id) => (
        <input key={id} type="hidden" name="labelIds" value={id} />
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
          <span className="assignee-select-placeholder">{dict.labels.placeholder}</span>
        )}
        <ChevronDown size={16} strokeWidth={1.75} className={open ? 'chevron-open' : ''} />
      </div>
      {open && (
        <div className="assignee-select-panel">
          <div className="assignee-select-list">
            {allLabels.length ? (
              allLabels.map((l) => (
                <div
                  key={l.id}
                  className={`assignee-option ${selectedSet.has(l.id) ? 'selected' : ''}`}
                  onClick={() => toggle(l.id)}
                >
                  <span className="label-option-name">
                    <span className="label-option-swatch" style={{ background: l.color }} />
                    {l.name}
                  </span>
                  {selectedSet.has(l.id) && <Check size={14} strokeWidth={2} />}
                </div>
              ))
            ) : (
              <div className="assignee-select-empty">{dict.labels.empty}</div>
            )}
          </div>
          <div className="label-create-row">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={dict.labels.namePlaceholder}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="label-swatch-row" onClick={(e) => e.stopPropagation()}>
              {LABEL_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`label-swatch ${newColor === c ? 'label-swatch-active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                  aria-label={c}
                />
              ))}
              <button
                type="button"
                className="icon-btn label-create-btn"
                disabled={!newName.trim() || creating}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreate();
                }}
                data-testid="create-label"
              >
                <Plus size={16} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
