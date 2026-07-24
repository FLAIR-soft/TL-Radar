'use client';

import { useEffect, useState, useTransition } from 'react';
import { History, Folder, MapPin, CalendarClock, BookmarkPlus, Eye, EyeOff } from 'lucide-react';
import { SlideOver } from '@/components/SlideOver';
import { ActivityLogList } from '@/components/ActivityLogList';
import { CommentList } from '@/components/CommentList';
import { ChecklistList } from '@/components/ChecklistList';
import { getActivityLog } from '@/lib/logic/activity-log-query';
import { getTaskComments, type TaskCommentsResult } from './comments-actions';
import { getChecklistItems } from './checklist-actions';
import { createTemplateFromTask } from '@/app/(app)/templates/actions';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useToast } from '@/components/ToastProvider';
import { STATUS_COLOR, fmtDate, fmtDuration } from '@/lib/logic/tasks';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import type { Task, ActivityLog, TaskChecklistItem } from '@/lib/supabase/types';

export function TaskDetailPanel({
  task,
  assigneeNames,
  projectName,
  projectColor,
  profileNames,
}: {
  task: Task;
  assigneeNames: string[];
  projectName: string | null;
  projectColor?: string | null;
  profileNames: Map<string, string>;
}) {
  const dict = useDictionary();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[] | null>(null);
  const [comments, setComments] = useState<TaskCommentsResult | null>(null);
  const [checklist, setChecklist] = useState<TaskChecklistItem[] | null>(null);
  const [watching, setWatching] = useState<boolean | null>(null);

  useEffect(() => {
    if (!open || logs !== null) return;
    getActivityLog('task', task.id).then(setLogs);
  }, [open, logs, task.id]);

  useEffect(() => {
    if (!open || watching !== null) return;
    fetch(`/api/watch?taskId=${task.id}`)
      .then((r) => r.json())
      .then((data) => setWatching(!!data.watching))
      .catch(() => setWatching(false));
  }, [open, watching, task.id]);

  useEffect(() => {
    if (!open || comments !== null) return;
    getTaskComments(task.id).then(setComments);
  }, [open, comments, task.id]);

  useEffect(() => {
    if (!open || checklist !== null) return;
    getChecklistItems(task.id).then(setChecklist);
  }, [open, checklist, task.id]);

  function refreshComments() {
    getTaskComments(task.id).then(setComments);
    getActivityLog('task', task.id).then(setLogs);
  }

  function refreshChecklist() {
    getChecklistItems(task.id).then(setChecklist);
    getActivityLog('task', task.id).then(setLogs);
  }

  const TaskIcon = isIconName(task.icon) ? ICON_MAP[task.icon] : undefined;

  function handleSaveAsTemplate() {
    startTransition(() => {
      createTemplateFromTask(task.id).then((result) => {
        if (result?.error) toast.error(result.error);
        else toast.success(dict.templates.savedConfirm);
      });
    });
  }

  function handleToggleWatch() {
    fetch('/api/watch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: task.id }),
    })
      .then((r) => r.json())
      .then((data) => setWatching(!!data.watching))
      .catch(() => {});
  }

  return (
    <>
      <button
        className="icon-btn"
        title={dict.activityLog.viewTitle}
        onClick={() => setOpen(true)}
        data-testid="view-task-log"
      >
        <History size={18} strokeWidth={1.75} />
      </button>
      <SlideOver open={open} onClose={() => setOpen(false)} title={task.title}>
        <div className="detail-section">
          <div className="detail-pills">
            {TaskIcon && <TaskIcon size={16} strokeWidth={1.75} className="t-title-icon" />}
            <span className="pill" style={{ ['--pill-color' as string]: STATUS_COLOR[task.status] }}>
              {dict.status[task.status]}
            </span>
            {task.priority && (
              <span className="pill" style={{ ['--pill-color' as string]: PRIORITY_COLOR[task.priority] }}>
                {dict.priority[task.priority]}
              </span>
            )}
            <button
              type="button"
              className={`icon-btn detail-save-template-btn ${watching ? 'watch-active' : ''}`}
              title={watching ? dict.watchers.unwatch : dict.watchers.watch}
              disabled={watching === null}
              onClick={handleToggleWatch}
              data-testid="toggle-watch"
            >
              {watching ? <Eye size={16} strokeWidth={1.75} /> : <EyeOff size={16} strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              className="icon-btn detail-save-template-btn"
              title={dict.templates.saveAsTemplate}
              disabled={isPending}
              onClick={handleSaveAsTemplate}
              data-testid="save-as-template"
            >
              <BookmarkPlus size={16} strokeWidth={1.75} />
            </button>
          </div>
          {task.description && <p className="detail-desc">{task.description}</p>}
          <div className="t-meta detail-meta">
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
              <span>
                <CalendarClock size={14} strokeWidth={1.75} />
                {fmtDate(task.deadline, dict.intlLocale)}
              </span>
            )}
          </div>
          {assigneeNames.length > 0 && <div className="t-assignee">{assigneeNames.join(', ')}</div>}
          {task.estimated_minutes !== null && (
            <div className="detail-row">
              <span>{dict.taskCard.estimate}</span>
              <span className="mono">{fmtDuration(task.estimated_minutes * 60000, dict.duration)}</span>
            </div>
          )}
        </div>
        <div className="detail-log">
          <h4 className="detail-log-title">{dict.checklist.title}</h4>
          {checklist === null ? (
            <div className="empty-note loading-row">
              <span className="loading-spinner" />
              {dict.checklist.loading}
            </div>
          ) : (
            <ChecklistList taskId={task.id} items={checklist} onChange={refreshChecklist} />
          )}
        </div>
        <div className="detail-log">
          <h4 className="detail-log-title">{dict.comments.title}</h4>
          {comments === null ? (
            <div className="empty-note loading-row">
              <span className="loading-spinner" />
              {dict.comments.loading}
            </div>
          ) : (
            <CommentList
              taskId={task.id}
              comments={comments.comments}
              currentUserId={comments.currentUserId}
              isAdmin={comments.isAdmin}
              profileNames={profileNames}
              onChange={refreshComments}
            />
          )}
        </div>
        <div className="detail-log">
          <h4 className="detail-log-title">{dict.activityLog.title}</h4>
          {logs === null ? (
            <div className="empty-note loading-row">
              <span className="loading-spinner" />
              {dict.activityLog.loading}
            </div>
          ) : (
            <ActivityLogList logs={logs} profileNames={profileNames} />
          )}
        </div>
      </SlideOver>
    </>
  );
}
