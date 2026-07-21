'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import type { Task, TaskStatus } from '@/lib/supabase/types';
import { STATUS, fmtDate, isOverdue } from '@/lib/logic/tasks';
import { setStatus, deleteTask } from './actions';

const NEXT_ACTIONS: Partial<Record<TaskStatus, { to: TaskStatus; label: string }[]>> = {
  waiting: [{ to: 'in_progress', label: 'Начать' }],
  in_progress: [
    { to: 'paused', label: 'Пауза' },
    { to: 'done', label: 'Готово' },
  ],
  paused: [
    { to: 'in_progress', label: 'Возобновить' },
    { to: 'done', label: 'Готово' },
  ],
};

export function TaskCard({ task, editable }: { task: Task; editable: boolean }) {
  const [isPending, startTransition] = useTransition();
  const overdue = isOverdue(task);
  const actions = NEXT_ACTIONS[task.status] || [];

  function handleDelete() {
    if (!confirm('Удалить эту задачу без возможности восстановления?')) return;
    startTransition(() => {
      deleteTask(task.id);
    });
  }

  return (
    <div className="task-card" style={{ borderLeftColor: STATUS[task.status].color }}>
      <div className="t-person">{task.person}</div>
      <div className="t-title">{task.title}</div>
      {task.description && <div className="t-desc">{task.description}</div>}
      <div className="t-meta">
        {task.location && <span>📍 {task.location}</span>}
        {task.deadline && (
          <span className={overdue ? 'overdue' : ''}>
            ⏰ {fmtDate(task.deadline)}
            {overdue ? ' · просрочено' : ''}
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
          <Link href={`/dashboard/new?edit=${task.id}`} className="icon-btn" title="Изменить">
            ✎
          </Link>
          <button className="icon-btn" title="Удалить" disabled={isPending} onClick={handleDelete}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
