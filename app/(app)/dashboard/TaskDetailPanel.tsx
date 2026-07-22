'use client';

import { useEffect, useState } from 'react';
import { History, Folder, MapPin, CalendarClock } from 'lucide-react';
import { SlideOver } from '@/components/SlideOver';
import { ActivityLogList } from '@/components/ActivityLogList';
import { getActivityLog } from '@/lib/logic/activity-log-query';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { STATUS_COLOR, fmtDate, fmtDuration } from '@/lib/logic/tasks';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import type { Task, ActivityLog } from '@/lib/supabase/types';

export function TaskDetailPanel({
  task,
  assigneeNames,
  projectName,
  profileNames,
}: {
  task: Task;
  assigneeNames: string[];
  projectName: string | null;
  profileNames: Map<string, string>;
}) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[] | null>(null);

  useEffect(() => {
    if (!open || logs !== null) return;
    getActivityLog('task', task.id).then(setLogs);
  }, [open, logs, task.id]);

  const TaskIcon = isIconName(task.icon) ? ICON_MAP[task.icon] : undefined;

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
          </div>
          {task.description && <p className="detail-desc">{task.description}</p>}
          <div className="t-meta detail-meta">
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
          <h4 className="detail-log-title">{dict.activityLog.title}</h4>
          {logs === null ? (
            <div className="empty-note">{dict.activityLog.loading}</div>
          ) : (
            <ActivityLogList logs={logs} profileNames={profileNames} />
          )}
        </div>
      </SlideOver>
    </>
  );
}
