'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ArrowUp, ArrowDown, Pencil, Trash2, ListChecks, MessageSquare } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useToast } from '@/components/ToastProvider';
import { STATUS_COLOR, isOverdue, fmtDate, isWithinWorkHours } from '@/lib/logic/tasks';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import { setStatus, deleteTask } from './actions';
import { TaskDetailPanel } from './TaskDetailPanel';
import type { Task, TaskPause, TaskStatus, Priority, Label } from '@/lib/supabase/types';

type SortKey = 'title' | 'status' | 'project' | 'priority' | 'deadline' | 'estimate';

const PRIORITY_ORDER: Record<Priority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };

export function TaskTable({
  tasks,
  pausesByTask,
  assigneeNamesByTask,
  projectNames,
  projectColors,
  profileNames,
  commentCountsByTask,
  checklistProgressByTask,
  labelsByTask,
}: {
  tasks: Task[];
  pausesByTask: Map<string, TaskPause[]>;
  assigneeNamesByTask: Map<string, string[]>;
  projectNames: Map<string, string>;
  projectColors?: Map<string, string | null>;
  profileNames: Map<string, string>;
  commentCountsByTask: Map<string, number>;
  checklistProgressByTask: Map<string, { done: number; total: number }>;
  labelsByTask?: Map<string, Label[]>;
}) {
  const dict = useDictionary();
  const [sortKey, setSortKey] = useState<SortKey>('deadline');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'title':
        cmp = a.title.localeCompare(b.title);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'project': {
        const an = a.project_id ? (projectNames.get(a.project_id) ?? '') : '';
        const bn = b.project_id ? (projectNames.get(b.project_id) ?? '') : '';
        cmp = an.localeCompare(bn);
        break;
      }
      case 'priority':
        cmp = (a.priority ? PRIORITY_ORDER[a.priority] : -1) - (b.priority ? PRIORITY_ORDER[b.priority] : -1);
        break;
      case 'deadline':
        cmp = (a.deadline ?? '9999-99-99').localeCompare(b.deadline ?? '9999-99-99');
        break;
      case 'estimate':
        cmp = (a.estimated_minutes ?? -1) - (b.estimated_minutes ?? -1);
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const columns: { key: SortKey; label: string }[] = [
    { key: 'title', label: dict.table.colTitle },
    { key: 'status', label: dict.table.colStatus },
    { key: 'project', label: dict.table.colProject },
    { key: 'priority', label: dict.table.colPriority },
    { key: 'deadline', label: dict.table.colDeadline },
    { key: 'estimate', label: dict.table.colEstimate },
  ];

  return (
    <div className="archive-scroll">
      <table className="archive-table" data-testid="task-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>
                <button type="button" className="table-sort-btn" onClick={() => toggleSort(c.key)} data-testid={`sort-${c.key}`}>
                  {c.label}
                  {sortKey === c.key &&
                    (sortDir === 'asc' ? (
                      <ArrowUp size={12} strokeWidth={2} />
                    ) : (
                      <ArrowDown size={12} strokeWidth={2} />
                    ))}
                </button>
              </th>
            ))}
            <th>{dict.table.colAssignees}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {sorted.map((task, i) => (
            <TaskTableRow
              key={task.id}
              task={task}
              pauses={pausesByTask.get(task.id) ?? []}
              assigneeNames={assigneeNamesByTask.get(task.id) ?? []}
              projectName={task.project_id ? (projectNames.get(task.project_id) ?? null) : null}
              projectColor={task.project_id ? (projectColors?.get(task.project_id) ?? null) : null}
              profileNames={profileNames}
              commentCount={commentCountsByTask.get(task.id) ?? 0}
              checklistProgress={checklistProgressByTask.get(task.id)}
              labels={labelsByTask?.get(task.id) ?? []}
              style={{ animationDelay: `${i * 20}ms` }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskTableRow({
  task,
  pauses,
  assigneeNames,
  projectName,
  projectColor,
  profileNames,
  commentCount,
  checklistProgress,
  labels = [],
  style,
}: {
  task: Task;
  pauses: TaskPause[];
  assigneeNames: string[];
  projectName: string | null;
  projectColor?: string | null;
  profileNames: Map<string, string>;
  commentCount: number;
  checklistProgress?: { done: number; total: number };
  labels?: Label[];
  style?: React.CSSProperties;
}) {
  const dict = useDictionary();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const overdue = isOverdue(task);
  const withinWorkHours = isWithinWorkHours();

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

  function handleStatus(to: TaskStatus) {
    startTransition(() => {
      setStatus(task.id, to).then((result) => {
        if (result?.error) toast.error(result.error);
      });
    });
  }

  function handleDelete() {
    if (!confirm(dict.taskCard.deleteConfirm)) return;
    startTransition(() => {
      deleteTask(task.id);
    });
  }

  const TaskIcon = isIconName(task.icon) ? ICON_MAP[task.icon] : undefined;

  return (
    <tr className={`archive-row ${isPending ? 'task-card-pending' : ''}`} style={style} data-testid="task-table-row">
      <td>
        <div className="t-title" style={{ fontSize: 'var(--fs-sm)' }}>
          {TaskIcon && <TaskIcon size={14} strokeWidth={1.75} className="t-title-icon" />}
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
      </td>
      <td>
        <span className="pill" style={{ ['--pill-color' as string]: STATUS_COLOR[task.status] }}>
          {dict.status[task.status]}
        </span>
      </td>
      <td>
        {projectName ? (
          <span className="table-project-cell">
            {projectColor && <span className="project-color-dot" style={{ background: projectColor }} />}
            {projectName}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td>
        {task.priority ? (
          <span className="pill" style={{ ['--pill-color' as string]: PRIORITY_COLOR[task.priority] }}>
            {dict.priority[task.priority]}
          </span>
        ) : (
          '—'
        )}
      </td>
      <td className={overdue ? 'overdue' : ''}>
        {task.deadline ? fmtDate(task.deadline, dict.intlLocale) : '—'}
        {overdue ? ` · ${dict.taskCard.overdue}` : ''}
      </td>
      <td>{task.estimated_minutes ? `${task.estimated_minutes} ${dict.duration.minuteShort}` : '—'}</td>
      <td>{assigneeNames.join(', ') || '—'}</td>
      <td>
        <div className="t-actions">
          {withinWorkHours &&
            actions.map((a) => (
              <button
                key={a.to}
                className="btn btn-ghost"
                disabled={isPending}
                onClick={() => handleStatus(a.to)}
                type="button"
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
            <Pencil size={16} strokeWidth={1.75} />
          </Link>
          <button
            className="icon-btn"
            title={dict.taskCard.deleteTitle}
            disabled={isPending}
            onClick={handleDelete}
            type="button"
            data-testid="delete-task"
          >
            <Trash2 size={16} strokeWidth={1.75} />
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
      </td>
    </tr>
  );
}
