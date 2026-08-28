'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import {
  Folder,
  MapPin,
  CalendarClock,
  Pencil,
  Trash2,
  ChevronDown,
  MessageSquare,
  ListChecks,
  User,
  CircleAlert,
  Check,
  Eye,
} from 'lucide-react';
import type { ChecklistPreviewItem, LastComment } from '@/lib/logic/task-relations';
import type { Task, TaskPause, TaskStatus, Label } from '@/lib/supabase/types';
import {
  STATUS_COLOR,
  fmtDate,
  fmtDateShort,
  deadlineDayOffset,
  DEADLINE_HOUR_LABEL,
  fmtDateTime,
  fmtDuration,
  fmtTimer,
  isOverdue,
  overdueDays,
  isWithinWorkHours,
  accumulatedInProgressDuration,
  currentSessionDuration,
  currentPauseDuration,
  totalPausedDuration,
  waitingDuration,
} from '@/lib/logic/tasks';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { getInitials, getAvatarColor } from '@/lib/logic/initials';
import { plural } from '@/lib/i18n/plural';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useToast } from '@/components/ToastProvider';
import { useNowTick } from '@/lib/hooks/useNowTick';
import { setStatus, deleteTask } from './actions';
import { TaskDetailPanel } from './TaskDetailPanel';

// Сколько пунктов чек-листа показывать на карточке до открытия панели.
const CHECKLIST_PREVIEW = 2;

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
  checklistItems = [],
  watcherCount = 0,
  lastComment = null,
  labels = [],
  dense = false,
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
  /** Первые пункты чек-листа для превью на карточке (этап 5). */
  checklistItems?: ChecklistPreviewItem[];
  watcherCount?: number;
  /** Последний комментарий для превью на карточке (этап 5, D6). */
  lastComment?: LastComment | null;
  labels?: Label[];
  /** Колонка переполнена (см. COMPACT_FROM в KanbanBoard) — карточка сворачивается. */
  dense?: boolean;
  style?: React.CSSProperties;
}) {
  const [isPending, startTransition] = useTransition();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [uncollapsed, setUncollapsed] = useState(false);
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
  const lastCommentAuthor =
    (lastComment?.authorId ? profileNames.get(lastComment.authorId) : undefined) ?? dict.activityLog.unknownUser;

  // Режим карточки не выбирается пользователем — он следует из контекста
  // (редизайн v2, этап 4):
  //   compact  — колонка переполнена, карточка сжата до заголовка, таймера,
  //              кто и где; разворачивается в стандартную одной кнопкой;
  //   expanded — задача на паузе: время и история показываются плиткой,
  //              а не прячутся под «Details»;
  //   standard — всё остальное.
  // Плашка просрочки — не режим, а надстройка: появляется у просроченной
  // задачи в стандартном и расширенном режимах.
  const compact = dense && !uncollapsed;
  const expanded = !compact && task.status === 'paused';
  const overdueSinceDays = overdue ? overdueDays(task) : null;

  // Дедлайн сегодня или завтра подписывается словом и часом отсечки
  // («Heute, 16:00» на скрине 03), остальные — обычной датой.
  const deadlineOffset = task.deadline ? deadlineDayOffset(task.deadline) : null;
  const deadlineLabel = !task.deadline
    ? ''
    : deadlineOffset === 0
      ? `${dict.taskCard.today}, ${DEADLINE_HOUR_LABEL}`
      : deadlineOffset === 1
        ? `${dict.taskCard.tomorrow}, ${DEADLINE_HOUR_LABEL}`
        : fmtDate(task.deadline, dict.intlLocale);
  const showOverdueBanner = overdue && !compact;

  // Полоса слева = приоритет (откат K4, редизайн v2, этап 3): на скрине 03
  // у карточки «Serverraum Umbau» она оранжевая при приоритете «Hoch».
  // Пилюля приоритета при этом остаётся в ряду пилюль.
  const cardStyle: React.CSSProperties = {
    borderLeftColor: task.priority ? PRIORITY_COLOR[task.priority] : 'var(--border)',
    ...style,
  };

  if (compact) {
    return (
      <div
        className={`task-card task-card-compact ${isPending ? 'task-card-pending' : ''} ${
          overdue ? 'task-card-overdue' : ''
        }`}
        style={cardStyle}
      >
        <div className="t-compact-head">
          <span className="t-compact-title">
            {TaskIcon && <TaskIcon size={16} strokeWidth={1.75} className="t-title-icon" />}
            {task.title}
          </span>
          {primaryMetric && (
            <span className="mono t-compact-timer">{fmtTimer(primaryMetric.value, inProgress)}</span>
          )}
        </div>
        <div className="t-compact-meta">
          {assigneeNames.length > 0 && (
            <span className="t-avatars">
              {assigneeNames.map((n, i) => (
                <span
                  key={`${n}-${i}`}
                  className="t-avatar"
                  style={{ ['--avatar-color' as string]: getAvatarColor(n) }}
                  title={n}
                >
                  {getInitials(n)}
                </span>
              ))}
            </span>
          )}
          {task.location && <span>{task.location}</span>}
          {task.location && task.deadline && <span className="t-compact-sep">·</span>}
          {task.deadline && (
            <span className={`mono ${overdue ? 'overdue-text' : ''}`}>
              {fmtDateShort(task.deadline, dict.intlLocale)}
            </span>
          )}
          <span className="t-compact-spacer" />
          {task.priority && (
            <span className="pill" style={{ ['--pill-color' as string]: PRIORITY_COLOR[task.priority] }}>
              {dict.priority[task.priority]}
            </span>
          )}
          <button
            type="button"
            className="t-compact-expand"
            onClick={() => setUncollapsed(true)}
            data-testid="expand-card"
          >
            <ChevronDown size={14} strokeWidth={1.75} />
            {dict.taskCard.details}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`task-card ${expanded ? 'task-card-expanded' : ''} ${isPending ? 'task-card-pending' : ''} ${
        overdue ? 'task-card-overdue' : ''
      }`}
      style={cardStyle}
    >
      {showOverdueBanner && (
        <div className="t-overdue-banner">
          <span className="t-overdue-banner-text">
            <CircleAlert size={14} strokeWidth={2} />
            {plural(dict.taskCard.overdueSince, overdueSinceDays ?? 0, dict.intlLocale)}
          </span>
          {task.deadline && (
            <span className="mono t-overdue-banner-deadline">
              {dict.taskCard.deadlineLabel} {fmtDate(task.deadline, dict.intlLocale)}
            </span>
          )}
        </div>
      )}
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
          {/* Просрочку показывает плашка сверху — дублировать её бейджем
              в шапке, как раньше, больше не нужно. */}
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
            {deadlineLabel}
            {overdue ? ` · ${dict.taskCard.overdue}` : ''}
          </span>
        )}
      </div>
      {expanded ? (
        /* Расширенный режим (задача на паузе): время и история не прячутся
           под «Details», а лежат плиткой — по правой колонке скрина 03. */
        <div className="t-tile">
          {primaryMetric && (
            <div className="t-tile-row">
              <span className="t-tile-label">{primaryMetric.label}</span>
              <span className={`mono t-tile-value ${overdue ? 't-tile-value-overdue' : ''}`}>
                {fmtTimer(primaryMetric.value, inProgress)}
              </span>
            </div>
          )}
          <div className="t-tile-row">
            <span className="t-tile-label">{dict.taskCard.timeCreated}</span>
            <span className="mono">{fmtDateTime(task.created_at, dict.intlLocale)}</span>
          </div>
          {creatorName && (
            <div className="t-tile-row">
              <span className="t-tile-label">{dict.taskCard.createdByPrefix}</span>
              <span className="t-tile-strong">{creatorName}</span>
            </div>
          )}
          {totalPaused > 0 && (
            <div className="t-tile-row">
              <span className="t-tile-label">
                {dict.taskCard.timeTotalPaused}
                {pauses.length > 0 && ` · ${plural(dict.taskCard.pauseCount, pauses.length, dict.intlLocale)}`}
              </span>
              <span className="mono">{fmtDuration(totalPaused, dict.duration)}</span>
            </div>
          )}
          {pausedByName && (
            <div className="t-tile-row">
              <span className="t-tile-label">{dict.taskCard.pausedBy}</span>
              <span className="t-tile-strong">{pausedByName}</span>
            </div>
          )}
        </div>
      ) : (
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
      )}
      {checklistProgress && checklistProgress.total > 0 && (
        /* Превью чек-листа на карточке (скрин 03): прогресс и первые пункты. */
        <div className="t-checklist">
          <div className="t-checklist-head">
            <span className="t-checklist-title">
              <ListChecks size={14} strokeWidth={1.75} />
              {dict.checklist.title}
            </span>
            <span className="mono">
              {checklistProgress.done}/{checklistProgress.total}
            </span>
          </div>
          <div className="t-checklist-bar">
            <div
              className="t-checklist-fill"
              style={{ width: `${(checklistProgress.done / checklistProgress.total) * 100}%` }}
            />
          </div>
          {checklistItems.slice(0, CHECKLIST_PREVIEW).map((item) => (
            <div key={item.id} className={`t-checklist-item ${item.done ? 'is-done' : ''}`}>
              <span className="t-checklist-mark">{item.done && <Check size={12} strokeWidth={2.5} />}</span>
              {item.title}
            </div>
          ))}
        </div>
      )}
      {lastComment && !expanded && (
        /* Превью последнего комментария (скрин 03): аватар, текст в одну-две
           строки и моно-подпись «кто · когда · сколько всего». */
        <div className="t-comment-preview">
          <span
            className="comment-avatar"
            style={{ ['--avatar-color' as string]: getAvatarColor(lastComment.authorId ?? '') }}
          >
            {getInitials(lastCommentAuthor)}
          </span>
          <div className="t-comment-preview-main">
            <div className="t-comment-preview-body">{lastComment.body}</div>
            <div className="mono t-comment-preview-meta">
              {lastCommentAuthor} · {fmtDateTime(lastComment.createdAt, dict.intlLocale)}
              {commentCount > 1 && ` · ${plural(dict.taskCard.commentsCount, commentCount, dict.intlLocale)}`}
            </div>
          </div>
        </div>
      )}
      {expanded && (commentCount > 0 || watcherCount > 0 || (checklistProgress && checklistProgress.total > 0)) && (
        <div className="t-counters">
          {commentCount > 0 && (
            <span title={dict.comments.title}>
              <MessageSquare size={14} strokeWidth={1.75} />
              {commentCount}
            </span>
          )}
          {checklistProgress && checklistProgress.total > 0 && (
            <span title={dict.checklist.title}>
              <ListChecks size={14} strokeWidth={1.75} />
              {checklistProgress.done}/{checklistProgress.total}
            </span>
          )}
          {watcherCount > 0 && (
            <span title={dict.watchers.watch}>
              <Eye size={14} strokeWidth={1.75} />
              {watcherCount}
            </span>
          )}
        </div>
      )}
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
        {!expanded && checklistProgress && checklistProgress.total > 0 && (
          <span className="comment-count-badge" title={dict.checklist.title}>
            <ListChecks size={14} strokeWidth={1.75} />
            {checklistProgress.done}/{checklistProgress.total}
          </span>
        )}
        {!expanded && commentCount > 0 && (
          <span className="comment-count-badge" title={dict.comments.title}>
            <MessageSquare size={14} strokeWidth={1.75} />
            {commentCount}
          </span>
        )}
        <TaskDetailPanel
          task={task}
          triggerLabel={expanded ? dict.taskCard.details : undefined}
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
