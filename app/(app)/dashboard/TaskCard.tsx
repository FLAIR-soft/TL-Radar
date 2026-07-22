'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Folder, MapPin, CalendarClock, Pencil, Trash2, ChevronDown } from 'lucide-react';
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
  totalPausedDuration,
  waitingDuration,
} from '@/lib/logic/tasks';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useNowTick } from '@/lib/hooks/useNowTick';
import { setStatus, deleteTask } from './actions';
import { TaskDetailPanel } from './TaskDetailPanel';

export function TaskCard({
  task,
  pauses,
  assigneeNames,
  projectName,
  pausedByName,
  profileNames,
  style,
}: {
  task: Task;
  pauses: TaskPause[];
  assigneeNames: string[];
  projectName: string | null;
  pausedByName: string | null;
  profileNames: Map<string, string>;
  style?: React.CSSProperties;
}) {
  const [isPending, startTransition] = useTransition();
  const [detailsOpen, setDetailsOpen] = useState(false);
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
  const totalPaused = totalPausedDuration(pauses, now);

  const estimateMs = task.estimated_minutes ? task.estimated_minutes * 60000 : null;
  const estimatePercent = estimateMs && total !== null ? (total / estimateMs) * 100 : null;
  const estimateOver = estimatePercent !== null && estimatePercent > 100;

  // Klyuchevaya metrika, vidimaya srazu — rovno odna iz trekh (zavisit ot
  // statusa), ostal'noye (sozdana, vsego v rabote, otsenka) — po disclosure.
  const primaryMetric =
    waiting !== null
      ? { label: dict.taskCard.timeWaiting, value: waiting }
      : session !== null
        ? { label: dict.taskCard.timeCurrentSession, value: session }
        : pauseElapsed !== null
          ? { label: dict.taskCard.timePaused, value: pauseElapsed }
          : null;

  const TaskIcon = isIconName(task.icon) ? ICON_MAP[task.icon] : undefined;

  return (
    <div
      className={`task-card ${isPending ? 'task-card-pending' : ''} ${overdue ? 'task-card-overdue' : ''}`}
      style={{ borderLeftColor: task.priority ? PRIORITY_COLOR[task.priority] : 'var(--border)', ...style }}
    >
      <div className="t-card-header">
        {assigneeNames.length > 0 ? (
          <div className="t-assignee">{assigneeNames.join(', ')}</div>
        ) : (
          <span />
        )}
        <div className="t-card-header-right">
          {overdue && <span className="overdue-badge">{dict.taskCard.overdue}</span>}
          <span className="pill" style={{ ['--pill-color' as string]: STATUS_COLOR[task.status] }}>
            {dict.status[task.status]}
          </span>
        </div>
      </div>
      <div className="t-title">
        {TaskIcon && <TaskIcon size={16} strokeWidth={1.75} className="t-title-icon" />}
        {task.title}
      </div>
      {task.description && <div className="t-desc">{task.description}</div>}
      <div className="t-meta">
        {projectName && (
          <span className="project-tag">
            <Folder size={14} strokeWidth={1.75} />
            {projectName}
          </span>
        )}
        {task.location && (
          <span>
            <MapPin size={14} strokeWidth={1.75} />
            {task.location}
          </span>
        )}
        {task.deadline && (
          <span className={overdue ? 'overdue' : ''}>
            <CalendarClock size={14} strokeWidth={1.75} />
            {fmtDate(task.deadline, dict.intlLocale)}
            {overdue ? ` · ${dict.taskCard.overdue}` : ''}
          </span>
        )}
      </div>
      <div className="t-timers">
        {primaryMetric && (
          <div className="t-timer-row t-timer-live t-timer-primary">
            <span>{primaryMetric.label}</span>
            <span className="mono">{fmtDuration(primaryMetric.value, dict.duration)}</span>
          </div>
        )}
        <button
          type="button"
          className="t-timers-toggle"
          onClick={() => setDetailsOpen((v) => !v)}
          aria-expanded={detailsOpen}
        >
          <ChevronDown size={14} strokeWidth={1.75} className={detailsOpen ? 'chevron-open' : ''} />
          {dict.taskCard.details}
        </button>
        {detailsOpen && (
          <div className="t-timers-details">
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
            {totalPaused > 0 && (
              <div className="t-timer-row">
                <span>{dict.taskCard.timeTotalPaused}</span>
                <span className="mono">{fmtDuration(totalPaused, dict.duration)}</span>
              </div>
            )}
            {pausedByName && (
              <div className="t-timer-row">
                <span>{dict.taskCard.pausedBy}</span>
                <span className="mono">{pausedByName}</span>
              </div>
            )}
            {estimateMs !== null && total !== null && (
              <div className="t-estimate">
                <div className="t-timer-row">
                  <span>{dict.taskCard.estimate}</span>
                  <span className="mono">
                    {fmtDuration(total, dict.duration)} / {fmtDuration(estimateMs, dict.duration)}
                  </span>
                </div>
                <div className="t-estimate-bar">
                  <div
                    className={`t-estimate-fill ${estimateOver ? 't-estimate-over' : ''}`}
                    style={{ width: `${Math.min(100, estimatePercent ?? 0)}%` }}
                  />
                </div>
              </div>
            )}
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
        <Link
          href={`/dashboard/new?edit=${task.id}`}
          className="icon-btn"
          title={dict.taskCard.editTitle}
          data-testid="edit-task"
        >
          <Pencil size={18} strokeWidth={1.75} />
        </Link>
        <button
          className="icon-btn"
          title={dict.taskCard.deleteTitle}
          disabled={isPending}
          onClick={handleDelete}
          data-testid="delete-task"
        >
          <Trash2 size={18} strokeWidth={1.75} />
        </button>
        <TaskDetailPanel task={task} assigneeNames={assigneeNames} projectName={projectName} profileNames={profileNames} />
      </div>
    </div>
  );
}
