import { FolderKanban } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCachedUser, getCachedProfile } from '@/lib/supabase/request-cache';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { ProjectRow } from './ProjectRow';
import { CreateProjectPanel } from './CreateProjectPanel';
import { EmptyState } from '@/components/EmptyState';

export default async function ProjectsPage() {
  const supabase = await createClient();
  const user = await getCachedUser();
  const profile = await getCachedProfile(user!.id);

  const dict = getDictionary(profile?.locale ?? 'de');

  // Число задач в проекте (D2 в PLAN.md) — одним запросом на все проекты,
  // а не по запросу на каждый: тянем только project_id неудалённых задач
  // и считаем на месте.
  const [{ data: projects }, { data: profiles }, { data: taskProjectIds }] = await Promise.all([
    supabase.from('projects').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('tasks').select('project_id').is('deleted_at', null),
  ]);

  const taskCounts = new Map<string, number>();
  for (const row of taskProjectIds ?? []) {
    if (row.project_id) taskCounts.set(row.project_id, (taskCounts.get(row.project_id) ?? 0) + 1);
  }

  const list = projects ?? [];
  const profileList = profiles ?? [];
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h2 className="section-title">{dict.projects.title}</h2>
          <p className="section-sub">{dict.projects.subtitle}</p>
        </div>
        <CreateProjectPanel profiles={profileList} />
      </div>
      {list.length ? (
        <div className="project-list">
          {list.map((p, i) => (
            <ProjectRow
              key={p.id}
              project={p}
              ownerName={p.owner_id ? profileNames.get(p.owner_id) ?? null : null}
              taskCount={taskCounts.get(p.id) ?? 0}
              profiles={profileList}
              style={{ animationDelay: `${i * 30}ms` }}
            />
          ))}
        </div>
      ) : (
        <EmptyState icon={FolderKanban} title={dict.projects.empty} />
      )}
    </div>
  );
}
