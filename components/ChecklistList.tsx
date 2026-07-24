'use client';

import { useState, useTransition } from 'react';
import { Trash2, ChevronUp, ChevronDown, Plus } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useToast } from './ToastProvider';
import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  moveChecklistItem,
} from '@/app/(app)/dashboard/checklist-actions';
import type { TaskChecklistItem } from '@/lib/supabase/types';

// Matches the .checklist-row max-height/opacity/padding transition duration
// in globals.css — the row stays in the DOM this long after delete so the
// collapse animation can play, instead of just vanishing.
const EXIT_MS = 240;

export function ChecklistList({
  taskId,
  items,
  onChange,
}: {
  taskId: string;
  items: TaskChecklistItem[];
  onChange: () => void;
}) {
  const dict = useDictionary();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    const formData = new FormData();
    formData.set('title', text);
    startTransition(() => {
      addChecklistItem(taskId, formData).then((result) => {
        if (result?.error) {
          toast.error(result.error);
          return;
        }
        setTitle('');
        onChange();
      });
    });
  }

  function handleToggle(item: TaskChecklistItem) {
    startTransition(() => {
      toggleChecklistItem(item.id, !item.done).then(() => onChange());
    });
  }

  function handleDelete(id: string, rowEl: HTMLElement | null) {
    if (!confirm(dict.checklist.deleteConfirm)) return;

    if (rowEl) {
      rowEl.style.maxHeight = `${rowEl.scrollHeight}px`;
      void rowEl.offsetHeight; // force reflow so the browser has a starting height to transition from
      requestAnimationFrame(() => {
        rowEl.style.maxHeight = '0px';
      });
    }
    setRemovingIds((prev) => new Set(prev).add(id));

    const settle = new Promise<void>((resolve) => setTimeout(resolve, EXIT_MS));
    startTransition(() => {
      Promise.all([deleteChecklistItem(id), settle]).then(() => {
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        onChange();
      });
    });
  }

  function handleMove(id: string, direction: 'up' | 'down') {
    startTransition(() => {
      moveChecklistItem(taskId, id, direction).then(() => onChange());
    });
  }

  return (
    <div className="checklist-list">
      {items.length === 0 ? (
        <div className="empty-note">{dict.checklist.empty}</div>
      ) : (
        items.map((item, i) => (
          <div
            className={`checklist-row ${removingIds.has(item.id) ? 'is-removing' : ''}`}
            key={item.id}
            style={{ animationDelay: `${i * 25}ms` }}
          >
            <label className="checklist-checkbox-label">
              <input
                type="checkbox"
                checked={item.done}
                disabled={isPending}
                onChange={() => handleToggle(item)}
                data-testid="checklist-item-checkbox"
              />
              <span className={item.done ? 'checklist-item-done' : ''}>{item.title}</span>
            </label>
            <div className="checklist-row-actions">
              <button
                type="button"
                className="icon-btn checklist-move-btn"
                title={dict.checklist.moveUp}
                disabled={isPending || i === 0}
                onClick={() => handleMove(item.id, 'up')}
                data-testid="checklist-move-up"
              >
                <ChevronUp size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className="icon-btn checklist-move-btn"
                title={dict.checklist.moveDown}
                disabled={isPending || i === items.length - 1}
                onClick={() => handleMove(item.id, 'down')}
                data-testid="checklist-move-down"
              >
                <ChevronDown size={14} strokeWidth={1.75} />
              </button>
              <button
                type="button"
                className="icon-btn checklist-move-btn"
                title={dict.checklist.deleteTitle}
                disabled={isPending}
                onClick={(e) => handleDelete(item.id, e.currentTarget.closest<HTMLElement>('.checklist-row'))}
                data-testid="checklist-delete"
              >
                <Trash2 size={14} strokeWidth={1.75} />
              </button>
            </div>
          </div>
        ))
      )}
      <form className="checklist-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="checklist-input"
          placeholder={dict.checklist.placeholder}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          data-testid="checklist-input"
        />
        <button
          type="submit"
          className="btn btn-primary checklist-add-btn"
          disabled={isPending || !title.trim()}
          data-testid="checklist-submit"
        >
          <Plus size={16} strokeWidth={2} />
          {dict.checklist.addButton}
        </button>
      </form>
    </div>
  );
}
