'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import type { Task, TaskStatus } from '@/lib/supabase/types';
import { STATUS_COLOR, fmtDate, isOverdue } from '@/lib/logic/tasks';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { setStatus, deleteTask } from './actions';

export function TaskCard({
  task,
  editable,
  style,
}: {
  task: Task;
  editable: boolean;
  style?: React.CSSProperties;
}) {
  const [isPending, startTransition] = useTransition();
  const dict = useDictionary();
  const overdue = isOverdue(task);

  const nextActions: Partial<Record<TaskStatus, { to: TaskStatus; label: string }[]>> = {
    waiting: [{ to: 'in_progress', label: dict.taskCard.start }],
    in_progress: [
      { to: 'paused', label: dict.taskCard.pause },
      { to: 'done', label: dict.taskCard.done },
    ],
    paused: [
      { to: 'in_progress', label: dict.taskCard.resume },
      { to: 'done', label: dict.taskCard.done },
    ],
  };
  const actions = nextActions[task.status] || [];

  function handleDelete() {
    if (!confirm(dict.taskCard.deleteConfirm)) return;
    startTransition(() => {
      deleteTask(task.id);
    });
  }

  return (
    <div
      className={`task-card ${isPending ? 'task-card-pending' : ''}`}
      style={{ borderLeftColor: STATUS_COLOR[task.status], ...style }}
    >
      <div className="t-title">{task.title}</div>
      {task.description && <div className="t-desc">{task.description}</div>}
      <div className="t-meta">
        {task.location && <span>📍 {task.location}</span>}
        {task.deadline && (
          <span className={overdue ? 'overdue' : ''}>
            ⏰ {fmtDate(task.deadline, dict.intlLocale)}
            {overdue ? ` · ${dict.taskCard.overdue}` : ''}
          </span>
        )}
      </div>
      {editable && (
        <div className="t-actions">
          {actions.map((a) => (
            <button
              key={a.to}
              className="btn btn-ghost"
              disabled={isPending}
              onClick={() => startTransition(() => setStatus(task.id, a.to))}
            >
              {a.label}
            </button>
          ))}
          <Link href={`/dashboard/new?edit=${task.id}`} className="icon-btn" title={dict.taskCard.editTitle}>
            ✎
          </Link>
          <button className="icon-btn" title={dict.taskCard.deleteTitle} disabled={isPending} onClick={handleDelete}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
