'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Folder, MapPin, CalendarClock, Pencil, Trash2, ChevronDown, MessageSquare, ListChecks, User } from 'lucide-react';
import type { Task, TaskPause, TaskStatus, Label } from '@/lib/supabase/types';
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
import { useToast } from '@/components/ToastProvider';
import { useNowTick } from '@/lib/hooks/useNowTick';
import { setStatus, deleteTask } from './actions';
import { TaskDetailPanel } from './TaskDetailPanel';

export function TaskCard({
  task,
  pauses,
  assigneeNames,
  projectName,
  projectColor,
  pausedByName,
  profileNames,
  commentCount = 0,
  checklistProgress,
  labels = [],
  style,
}: {
  task: Task;
  pauses: TaskPause[];
  assigneeNames: string[];
  projectName: string | null;
  projectColor?: string | null;
  pausedByName: string | null;
  profileNames: Map<string, string>;
  commentCount?: number;
  checklistProgress?: { done: number; total: number };
  labels?: Label[];
  style?: React.CSSProperties;
}) {
  const [isPending, startTransition] = useTransition();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const dict = useDictionary();
  const toast = useToast();
  const overdue = isOverdue(task);
  const now = useNowTick();

  const nextActions: Partial<Record<TaskStatus, { to: TaskStatus; label: string; variant: 'dark' | 'success' | 'ghost' }[]>> = {
    waiting: [{ to: 'in_progress', label: dict.taskCard.start, variant: 'dark' }],
    in_progress: [
      { to: 'paused', label: dict.taskCard.pause, variant: 'ghost' },
      { to: 'done', label: dict.taskCard.done, variant: 'success' },
    ],
    paused: [
      { to: 'in_progress', label: dict.taskCard.resume, variant: 'dark' },
      { to: 'done', label: dict.taskCard.done, variant: 'ghost' },
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
        if (result?.error) toast.error(result.error);
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
  const creatorName = task.created_by ? profileNames.get(task.created_by) : undefined;

  return (
    <div
      className={`task-card ${isPending ? 'task-card-pending' : ''} ${overdue ? 'task-card-overdue' : ''}`}
      // Project color, not priority — priority now has its own visible pill
      // in the header, so the border is free to carry "which project" at a
      // glance instead (and stays neutral for project-less tasks).
      style={{ borderLeftColor: projectColor ?? 'var(--border)', ...style }}
    >
      <div className="t-card-header">
        {assigneeNames.length > 0 ? (
          <div className="t-assignee">{assigneeNames.join(', ')}</div>
        ) : (
          <span />
        )}
        <div className="t-card-header-right">
          {overdue && <span className="overdue-badge">{dict.taskCard.overdue}</span>}
          {task.priority && (
            <span className="pill" style={{ ['--pill-color' as string]: PRIORITY_COLOR[task.priority] }}>
              {dict.priority[task.priority]}
            </span>
          )}
          <span className="pill" style={{ ['--pill-color' as string]: STATUS_COLOR[task.status] }}>
            {dict.status[task.status]}
          </span>
        </div>
      </div>
      <div className="t-title">
        {TaskIcon && <TaskIcon size={16} strokeWidth={1.75} className="t-title-icon" />}
        {task.title}
      </div>
      {labels.length > 0 && (
        <div className="t-labels">
          {labels.map((l) => (
            <span key={l.id} className="pill label-pill" style={{ ['--pill-color' as string]: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}
      {task.description && <div className="t-desc">{task.description}</div>}
      <div className="t-meta">
        {creatorName && (
          <span>
            <User size={14} strokeWidth={1.75} />
            {dict.taskCard.createdByPrefix} {creatorName}
          </span>
        )}
        {projectName && (
          <span className="project-tag">
            {projectColor && <span className="project-color-dot" style={{ background: projectColor }} />}
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
          <div
            className={`t-timer-row t-timer-live t-timer-primary ${
              task.status === 'in_progress' ? 't-timer-primary-progress' : task.status === 'paused' ? 't-timer-primary-paused' : ''
            }`}
          >
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
            <button
              key={a.to}
              className={`btn ${a.variant === 'dark' ? 'btn-dark' : a.variant === 'success' ? 'btn-success' : 'btn-ghost'}`}
              disabled={isPending}
              onClick={() => handleStatus(a.to)}
            >
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
        {checklistProgress && checklistProgress.total > 0 && (
          <span className="comment-count-badge" title={dict.checklist.title}>
            <ListChecks size={14} strokeWidth={1.75} />
            {checklistProgress.done}/{checklistProgress.total}
          </span>
        )}
        {commentCount > 0 && (
          <span className="comment-count-badge" title={dict.comments.title}>
            <MessageSquare size={14} strokeWidth={1.75} />
            {commentCount}
          </span>
        )}
        <TaskDetailPanel
          task={task}
          assigneeNames={assigneeNames}
          projectName={projectName}
          projectColor={projectColor}
          profileNames={profileNames}
        />
      </div>
    </div>
  );
}
