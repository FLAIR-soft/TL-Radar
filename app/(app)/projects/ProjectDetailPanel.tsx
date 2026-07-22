'use client';

import { useEffect, useState } from 'react';
import { History, MapPin, User } from 'lucide-react';
import { SlideOver } from '@/components/SlideOver';
import { ActivityLogList } from '@/components/ActivityLogList';
import { getActivityLog } from '@/lib/logic/activity-log-query';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import type { Project, ActivityLog } from '@/lib/supabase/types';

export function ProjectDetailPanel({
  project,
  ownerName,
  profileNames,
}: {
  project: Project;
  ownerName: string | null;
  profileNames: Map<string, string>;
}) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[] | null>(null);

  useEffect(() => {
    if (!open || logs !== null) return;
    getActivityLog('project', project.id).then(setLogs);
  }, [open, logs, project.id]);

  return (
    <>
      <button
        className="icon-btn"
        title={dict.activityLog.viewTitle}
        onClick={() => setOpen(true)}
        data-testid="view-project-log"
      >
        <History size={16} strokeWidth={1.75} />
      </button>
      <SlideOver open={open} onClose={() => setOpen(false)} title={project.name}>
        <div className="detail-section">
          {project.description && <p className="detail-desc">{project.description}</p>}
          {(project.location || ownerName) && (
            <div className="t-meta detail-meta">
              {project.location && (
                <span>
                  <MapPin size={14} strokeWidth={1.75} />
                  {project.location}
                </span>
              )}
              {ownerName && (
                <span>
                  <User size={14} strokeWidth={1.75} />
                  {ownerName}
                </span>
              )}
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
