'use client';

import { useState, useTransition } from 'react';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  moveChecklistItem,
} from '@/app/(app)/dashboard/checklist-actions';
import type { TaskChecklistItem } from '@/lib/supabase/types';

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
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = title.trim();
    if (!text) return;
    const formData = new FormData();
    formData.set('title', text);
    startTransition(() => {
      addChecklistItem(taskId, formData).then((result) => {
        if (result?.error) {
          alert(result.error);
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

  function handleDelete(id: string) {
    if (!confirm(dict.checklist.deleteConfirm)) return;
    startTransition(() => {
      deleteChecklistItem(id).then(() => onChange());
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
          <div className="checklist-row" key={item.id}>
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
                onClick={() => handleDelete(item.id)}
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
          className="btn btn-primary"
          disabled={isPending || !title.trim()}
          data-testid="checklist-submit"
        >
          {dict.checklist.addButton}
        </button>
      </form>
    </div>
  );
}
