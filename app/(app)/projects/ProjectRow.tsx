'use client';

import { useTransition } from 'react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import type { Project } from '@/lib/supabase/types';
import { deleteProject } from './actions';

export function ProjectRow({ project, style }: { project: Project; style?: React.CSSProperties }) {
  const dict = useDictionary();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(dict.projects.deleteConfirm)) return;
    startTransition(() => {
      deleteProject(project.id);
    });
  }

  return (
    <div className={`project-row ${isPending ? 'task-card-pending' : ''}`} style={style}>
      <span className="project-row-name">{project.name}</span>
      <button className="icon-btn" title={dict.projects.deleteTitle} disabled={isPending} onClick={handleDelete}>
        ✕
      </button>
    </div>
  );
}
