'use client';

import { useTransition } from 'react';
import { Trash2, Folder, MapPin, ListChecks } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import { deleteTemplate } from './actions';
import type { TaskTemplate } from '@/lib/supabase/types';

export function TemplateRow({
  template,
  projectName,
  style,
}: {
  template: TaskTemplate;
  projectName: string | null;
  style?: React.CSSProperties;
}) {
  const dict = useDictionary();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(dict.templates.deleteConfirm)) return;
    startTransition(() => {
      deleteTemplate(template.id);
    });
  }

  const TemplateIcon = isIconName(template.icon) ? ICON_MAP[template.icon] : undefined;
  const checklistCount = template.checklist?.length ?? 0;

  return (
    <div
      className={`project-row ${isPending ? 'task-card-pending' : ''}`}
      style={{ borderLeftColor: template.priority ? PRIORITY_COLOR[template.priority] : 'var(--border)', ...style }}
    >
      <div className="project-row-main">
        <div className="project-row-head">
          <span className="project-row-name">
            {TemplateIcon && <TemplateIcon size={16} strokeWidth={1.75} className="t-title-icon" />}
            {template.title}
          </span>
          <div className="project-row-actions">
            <button
              className="icon-btn"
              title={dict.templates.deleteTitle}
              disabled={isPending}
              onClick={handleDelete}
              data-testid="delete-template"
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        {template.description && <p className="project-row-desc">{template.description}</p>}
        {(template.location || projectName || checklistCount > 0) && (
          <div className="t-meta">
            {projectName && (
              <span>
                <Folder size={14} strokeWidth={1.75} />
                {projectName}
              </span>
            )}
            {template.location && (
              <span>
                <MapPin size={14} strokeWidth={1.75} />
                {template.location}
              </span>
            )}
            {checklistCount > 0 && (
              <span>
                <ListChecks size={14} strokeWidth={1.75} />
                {checklistCount}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
