'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import type { Task, TaskPause, TaskStatus } from '@/lib/supabase/types';
import {
  STATUS_COLOR,
  fmtDate,
  fmtDateTime,
  fmtDuration,
  isOverdue,
  isWithinWorkHours,
  accumulatedInProgressDuration,
  currentSessionDuration,
  currentPauseDuration,
  waitingDuration,
} from '@/lib/logic/tasks';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useNowTick } from '@/lib/hooks/useNowTick';
import { setStatus, deleteTask } from './actions';

export function TaskCard({
  task,
  pauses,
  assigneeName,
  projectName,
  style,
}: {
  task: Task;
  pauses: TaskPause[];
  assigneeName: string | null;
  projectName: string | null;
  style?: React.CSSProperties;
}) {
  const [isPending, startTransition] = useTransition();
  const dict = useDictionary();
  const overdue = isOverdue(task);
  const now = useNowTick();

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
  const withinWorkHours = isWithinWorkHours();

  function handleDelete() {
    if (!confirm(dict.taskCard.deleteConfirm)) return;
    startTransition(() => {
      deleteTask(task.id);
    });
  }

  function handleStatus(to: TaskStatus) {
    startTransition(() => {
      setStatus(task.id, to).then((result) => {
        if (result?.error) alert(result.error);
      });
    });
  }

  const total = accumulatedInProgressDuration(task, pauses, now);
  const session = currentSessionDuration(task, pauses, now);
  const pauseElapsed = currentPauseDuration(task, pauses, now);
  const waiting = waitingDuration(task, now);

  return (
    <div
      className={`task-card ${isPending ? 'task-card-pending' : ''}`}
      style={{ borderLeftColor: STATUS_COLOR[task.status], ...style }}
    >
      {assigneeName && <div className="t-assignee">{assigneeName}</div>}
      <div className="t-title">{task.title}</div>
      {task.description && <div className="t-desc">{task.description}</div>}
      <div className="t-meta">
        {projectName && <span className="project-tag">📁 {projectName}</span>}
        {task.location && <span>📍 {task.location}</span>}
        {task.deadline && (
          <span className={overdue ? 'overdue' : ''}>
            ⏰ {fmtDate(task.deadline, dict.intlLocale)}
            {overdue ? ` · ${dict.taskCard.overdue}` : ''}
          </span>
        )}
      </div>
      <div className="t-timers">
        <div className="t-timer-row">
          <span>{dict.taskCard.timeCreated}</span>
          <span className="mono">{fmtDateTime(task.created_at, dict.intlLocale)}</span>
        </div>
        {total !== null && (
          <div className="t-timer-row">
            <span>{dict.taskCard.timeTotal}</span>
            <span className="mono">{fmtDuration(total, dict.duration)}</span>
          </div>
        )}
        {waiting !== null && (
          <div className="t-timer-row">
            <span>{dict.taskCard.timeWaiting}</span>
            <span className="mono">{fmtDuration(waiting, dict.duration)}</span>
          </div>
        )}
        {session !== null && (
          <div className="t-timer-row t-timer-live">
            <span>{dict.taskCard.timeCurrentSession}</span>
            <span className="mono">{fmtDuration(session, dict.duration)}</span>
          </div>
        )}
        {pauseElapsed !== null && (
          <div className="t-timer-row t-timer-live">
            <span>{dict.taskCard.timePaused}</span>
            <span className="mono">{fmtDuration(pauseElapsed, dict.duration)}</span>
          </div>
        )}
      </div>
      {!withinWorkHours && actions.length > 0 && (
        <div className="t-locked-note">{dict.taskCard.outsideWorkHours}</div>
      )}
      <div className="t-actions">
        {withinWorkHours &&
          actions.map((a) => (
            <button key={a.to} className="btn btn-ghost" disabled={isPending} onClick={() => handleStatus(a.to)}>
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
    </div>
  );
}
