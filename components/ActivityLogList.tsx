'use client';

import { CirclePlus, Pencil, ArrowRightLeft, Trash2, UserPlus, UserMinus, MessageSquare } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { fmtDateTime } from '@/lib/logic/tasks';
import type { ActivityLog, ActivityEventType, TaskStatus } from '@/lib/supabase/types';

const EVENT_ICON: Record<ActivityEventType, typeof Pencil> = {
  created: CirclePlus,
  updated: Pencil,
  status_changed: ArrowRightLeft,
  deleted: Trash2,
  assignee_added: UserPlus,
  assignee_removed: UserMinus,
  comment_added: MessageSquare,
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
      default:
        return log.event_type;
    }
  }

  if (!logs.length) {
    return <div className="empty-note">{dict.activityLog.empty}</div>;
  }

  return (
    <div className="activity-log-list">
      {logs.map((log) => {
        const Icon = EVENT_ICON[log.event_type] ?? Pencil;
        return (
          <div className="activity-log-row" key={log.id}>
            <Icon size={16} strokeWidth={1.75} className="activity-log-icon" />
            <div className="activity-log-body">
              <div className="activity-log-desc">{describe(log)}</div>
              <div className="activity-log-meta mono">
                {resolveName(log.actor_id)} · {fmtDateTime(log.created_at, dict.intlLocale)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
