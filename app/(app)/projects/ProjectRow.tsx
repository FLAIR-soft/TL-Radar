'use client';

import { useState, useTransition, useMemo } from 'react';
import { Trash2, Pencil, MapPin, User } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import type { Project } from '@/lib/supabase/types';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import { deleteProject, editProject } from './actions';
import { ProjectForm } from './ProjectForm';
import { ProjectDetailPanel } from './ProjectDetailPanel';

export function ProjectRow({
  project,
  ownerName,
  profiles,
  style,
}: {
  project: Project;
  ownerName: string | null;
  profiles: { id: string; name: string }[];
  style?: React.CSSProperties;
}) {
  const dict = useDictionary();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const profileNames = useMemo(() => new Map(profiles.map((p) => [p.id, p.name])), [profiles]);

  function handleDelete() {
    if (!confirm(dict.projects.deleteConfirm)) return;
    startTransition(() => {
      deleteProject(project.id);
    });
  }

  if (editing) {
    return (
      <div style={style}>
        <ProjectForm
          action={editProject.bind(null, project.id)}
          editing={{
            name: project.name,
            description: project.description ?? '',
            location: project.location ?? '',
            ownerId: project.owner_id ?? '',
            icon: project.icon ?? '',
            priority: project.priority ?? '',
            color: project.color ?? '',
          }}
          profiles={profiles}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const ProjectIcon = isIconName(project.icon) ? ICON_MAP[project.icon] : undefined;

  return (
    <div
      className={`project-row ${isPending ? 'task-card-pending' : ''}`}
      style={{ borderLeftColor: project.priority ? PRIORITY_COLOR[project.priority] : 'var(--border)', ...style }}
    >
      <div className="project-row-main">
        <div className="project-row-head">
          <span className="project-row-name">
            {project.color && <span className="project-color-dot" style={{ background: project.color }} />}
            {ProjectIcon && <ProjectIcon size={16} strokeWidth={1.75} className="t-title-icon" />}
            {project.name}
          </span>
          <div className="project-row-head-right">
            {project.priority && (
              <span className="pill" style={{ ['--pill-color' as string]: PRIORITY_COLOR[project.priority] }}>
                {dict.priority[project.priority]}
              </span>
            )}
            <div className="project-row-actions">
              <button
                className="icon-btn"
                title={dict.projects.editTitle}
                disabled={isPending}
                onClick={() => setEditing(true)}
              >
                <Pencil size={16} strokeWidth={1.75} />
              </button>
              <button
                className="icon-btn"
                title={dict.projects.deleteTitle}
                disabled={isPending}
                onClick={handleDelete}
                data-testid="delete-project"
              >
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
              <ProjectDetailPanel project={project} ownerName={ownerName} profileNames={profileNames} />
            </div>
          </div>
        </div>
        {project.description && <p className="project-row-desc">{project.description}</p>}
        {(project.location || ownerName) && (
          <div className="t-meta">
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
    </div>
  );
}
