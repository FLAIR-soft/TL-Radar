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
  fmtTimer,
  isOverdue,
  isWithinWorkHours,
  accumulatedInProgressDuration,
  currentSessionDuration,
  currentPauseDuration,
  totalPausedDuration,
  waitingDuration,
} from '@/lib/logic/tasks';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { getInitials, getAvatarColor } from '@/lib/logic/initials';
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
  // Секунды в живом таймере видны только пока задача в работе (этап 2), значит
  // и секундный тик нужен только там — остальные карточки продолжают
  // перерисовываться раз в 30 с, как раньше.
  const inProgress = task.status === 'in_progress';
  const now = useNowTick(inProgress ? 1000 : 30000);

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
      // Полоса слева = приоритет (откат K4, редизайн v2, этап 3): на скрине 03
      // у карточки «Serverraum Umbau» она оранжевая при приоритете «Hoch».
      // Пилюля приоритета при этом остаётся в ряду пилюль.
      style={{
        borderLeftColor: task.priority ? PRIORITY_COLOR[task.priority] : 'var(--border)',
        ...style,
      }}
    >
      <div className="t-card-header">
        {assigneeNames.length > 0 ? (
          <div className="t-people">
            <span className="t-avatars">
              {assigneeNames.map((n, i) => (
                <span key={`${n}-${i}`} className="t-avatar" style={{ ['--avatar-color' as string]: getAvatarColor(n) }}>
                  {getInitials(n)}
                </span>
              ))}
            </span>
            <span className="t-assignee">{assigneeNames.join(', ')}</span>
          </div>
        ) : (
          <span />
        )}
        <div className="t-card-header-right">
          {overdue && <span className="overdue-badge">{dict.taskCard.overdue}</span>}
          <span className="pill pill-with-dot" style={{ ['--pill-color' as string]: STATUS_COLOR[task.status] }}>
            <span className="pill-dot" />
            {dict.status[task.status]}
          </span>
        </div>
      </div>
      <div className="t-title">
        {TaskIcon && <TaskIcon size={18} strokeWidth={1.75} className="t-title-icon" />}
        {task.title}
      </div>
      {(task.priority || labels.length > 0) && (
        <div className="t-labels">
          {task.priority && (
            <span className="pill" style={{ ['--pill-color' as string]: PRIORITY_COLOR[task.priority] }}>
              {dict.priority[task.priority]}
            </span>
          )}
          {labels.map((l) => (
            <span key={l.id} className="pill label-pill" style={{ ['--pill-color' as string]: l.color }}>
              <span className="pill-dot" />
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
        {/* Блок таймера по скрину 03: слева подпись и крупное значение,
            справа оценка с процентом, под ними — полоса прогресса оценки.
            Раньше оценка и полоса были спрятаны под «Details». */}
        {primaryMetric && (
          <div
            /* t-timer-primary сохранён: на него смотрит e2e (golden-path). */
            className={`t-timer-block t-timer-primary t-timer-live ${
              task.status === 'in_progress' ? 't-timer-primary-progress' : task.status === 'paused' ? 't-timer-primary-paused' : ''
            }`}
          >
            <div className="t-timer-main">
              <span className="t-timer-label">{primaryMetric.label}</span>
              <span className="mono t-timer-value">{fmtTimer(primaryMetric.value, inProgress)}</span>
            </div>
            {estimateMs !== null && (
              <div className="t-timer-estimate">
                <span className="t-timer-label">
                  {dict.taskCard.estimate} {fmtDuration(estimateMs, dict.duration)}
                </span>
                {estimatePercent !== null && (
                  <span className={`mono t-timer-percent ${estimateOver ? 't-timer-percent-over' : ''}`}>
                    {Math.round(estimatePercent)} %
                  </span>
                )}
              </div>
            )}
          </div>
        )}
        {estimateMs !== null && estimatePercent !== null && (
          <div className="t-estimate-bar">
            <div
              className={`t-estimate-fill ${estimateOver ? 't-estimate-over' : ''}`}
              style={{ width: `${Math.min(100, estimatePercent)}%` }}
            />
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
          pauses={pauses}
          assigneeNames={assigneeNames}
          projectName={projectName}
          projectColor={projectColor}
          profileNames={profileNames}
        />
      </div>
    </div>
  );
}
