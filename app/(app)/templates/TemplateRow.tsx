'use client';

import { useRef, useState, useTransition } from 'react';
import { Trash2, Folder, MapPin, ListChecks } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import { deleteTemplate } from './actions';
import type { TaskTemplate } from '@/lib/supabase/types';

// Matches the .project-row max-height/opacity/padding transition duration
// in globals.css — the row stays on screen this long after delete so the
// collapse animation can play, instead of just popping out of the list the
// instant revalidatePath() refreshes it.
const EXIT_MS = 240;

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
  const [removing, setRemoving] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  function handleDelete() {
    if (!confirm(dict.templates.deleteConfirm)) return;
    const rowEl = rowRef.current;
    if (rowEl) {
      rowEl.style.maxHeight = `${rowEl.scrollHeight}px`;
      void rowEl.offsetHeight; // force reflow so the browser has a starting height to transition from
      requestAnimationFrame(() => {
        rowEl.style.maxHeight = '0px';
      });
    }
    setRemoving(true);
    startTransition(() => {
      setTimeout(() => {
        deleteTemplate(template.id);
      }, EXIT_MS);
    });
  }

  const TemplateIcon = isIconName(template.icon) ? ICON_MAP[template.icon] : undefined;
  const checklistCount = template.checklist?.length ?? 0;

  return (
    <div
      ref={rowRef}
      className={`project-row ${isPending ? 'task-card-pending' : ''} ${removing ? 'is-removing' : ''}`}
      style={{ borderLeftColor: template.priority ? PRIORITY_COLOR[template.priority] : 'var(--border)', ...style }}
    >
      <div className="project-row-main">
        <div className="project-row-head">
          <span className="project-row-name">
            {TemplateIcon && <TemplateIcon size={16} strokeWidth={1.75} className="t-title-icon" />}
            {template.title}
          </span>
          <div className="project-row-head-right">
            {template.priority && (
              <span className="pill" style={{ ['--pill-color' as string]: PRIORITY_COLOR[template.priority] }}>
                {dict.priority[template.priority]}
              </span>
            )}
            <div className="project-row-actions">
              <button
                className="icon-btn"
                title={dict.templates.deleteTitle}
                disabled={isPending || removing}
                onClick={handleDelete}
                data-testid="delete-template"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>
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
