'use client';

import { useDictionary } from '@/lib/i18n/LocaleContext';
import { fmtDateTime } from '@/lib/logic/tasks';
import type { ActivityLog, ActivityEventType, TaskStatus } from '@/lib/supabase/types';

// Цвет точки события (редизайн v2, этап 6, скрин 05): вместо иконки слева
// у строки журнала цветная точка, смысл — по типу события.
const EVENT_COLOR: Record<ActivityEventType, string> = {
  created: 'var(--in-progress)',
  updated: 'var(--waiting)',
  status_changed: 'var(--paused)',
  deleted: 'var(--brand)',
  assignee_added: 'var(--in-progress)',
  assignee_removed: 'var(--waiting)',
  comment_added: 'var(--done)',
  checklist_item_added: 'var(--done)',
};

export function ActivityLogList({
  logs,
  profileNames,
}: {
  logs: ActivityLog[];
  profileNames: Map<string, string>;
}) {
  const dict = useDictionary();

  function resolveName(id: string | undefined | null): string {
    if (!id) return dict.activityLog.unknownUser;
    return profileNames.get(id) ?? dict.activityLog.unknownUser;
  }

  function describe(log: ActivityLog): string {
    switch (log.event_type) {
      case 'created':
        return dict.activityLog.created;
      case 'updated':
        return dict.activityLog.updated;
      case 'deleted':
        return dict.activityLog.deleted;
      case 'status_changed': {
        const from = log.detail?.from as TaskStatus | undefined;
        const to = log.detail?.to as TaskStatus | undefined;
        const fromLabel = from ? dict.status[from] : '?';
        const toLabel = to ? dict.status[to] : '?';
        return `${dict.activityLog.statusChanged}: ${fromLabel} → ${toLabel}`;
      }
      case 'assignee_added':
        return `${dict.activityLog.assigneeAdded}: ${resolveName(log.detail?.assigneeId as string | undefined)}`;
      case 'assignee_removed':
        return `${dict.activityLog.assigneeRemoved}: ${resolveName(log.detail?.assigneeId as string | undefined)}`;
      case 'comment_added':
        return dict.activityLog.commentAdded;
      case 'checklist_item_added':
        return `${dict.activityLog.checklistItemAdded}: ${(log.detail?.title as string | undefined) ?? ''}`;
      default:
        return log.event_type;
    }
  }

  if (!logs.length) {
    return <div className="empty-note">{dict.activityLog.empty}</div>;
  }

  return (
    <div className="activity-log-list">
      {logs.map((log) => (
        <div className="activity-log-row" key={log.id}>
          <span
            className="activity-log-dot"
            style={{ background: EVENT_COLOR[log.event_type] ?? 'var(--waiting)' }}
          />
          <div className="activity-log-desc">{describe(log)}</div>
          <div className="activity-log-meta mono">
            {resolveName(log.actor_id)} · {fmtDateTime(log.created_at, dict.intlLocale)}
          </div>
        </div>
      ))}
    </div>
  );
}
