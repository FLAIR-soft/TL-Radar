import { FolderKanban } from 'lucide-react';
import { rows } from '@/lib/db/client';
import { getLocale } from '@/lib/i18n/locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { ProjectRow } from './ProjectRow';
import { CreateProjectPanel } from './CreateProjectPanel';
import { EmptyState } from '@/components/EmptyState';
import type { Person, Project } from '@/lib/db/types';

export default async function ProjectsPage() {
  // Язык больше не хранится в профиле — он живёт в куке, как на дашборде.
  const dict = getDictionary(await getLocale());

  // Число задач в проекте (D2 в PLAN.md) — одним запросом на все проекты,
  // а не по запросу на каждый. Раньше тянули project_id всех неудалённых
  // задач и считали на месте; теперь считает сама база, результат тот же.
  const [projects, people, taskCounts] = await Promise.all([
    rows<Project>(
      `select * from projects where deleted_at is null order by created_at desc`
    ),
    rows<Pick<Person, 'email' | 'display_name'>>(
      `select email, display_name from people order by coalesce(display_name, email)`
    ),
    rows<{ project_id: string; task_count: number }>(
      `select project_id, count(*)::int as task_count
         from tasks
        where deleted_at is null and project_id is not null
        group by project_id`
    ),
  ]);

  const list = projects;

  // Компоненты ждут список людей в форме { id, name }. Идентификатором
  // человека теперь служит почта — форму не меняем, чтобы не тащить
  // переименование через ProjectForm и ProjectDetailPanel.
  const profileList = people.map((p) => ({ id: p.email, name: p.display_name ?? p.email }));
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));
  const taskCountByProject = new Map(taskCounts.map((r) => [r.project_id, r.task_count]));

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
              ownerName={p.owner_email ? profileNames.get(p.owner_email) ?? null : null}
              taskCount={taskCountByProject.get(p.id) ?? 0}
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
