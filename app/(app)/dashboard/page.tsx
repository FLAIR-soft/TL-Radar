import { Suspense } from 'react';
import { Inbox, SearchX } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { STATUS_COLOR, lastPausedBy, compareByDeadlineUrgency } from '@/lib/logic/tasks';
import { parseTaskFilters, hasActiveFilters, matchesTaskFilters, type SearchParamsRecord } from '@/lib/logic/task-filters';
import { TaskCard } from './TaskCard';
import { EmptyState } from '@/components/EmptyState';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import type { TaskPause, TaskStatus } from '@/lib/supabase/types';

const COLUMNS: TaskStatus[] = ['waiting', 'in_progress', 'paused'];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const filters = parseTaskFilters(await searchParams);

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('locale')
    .eq('id', user!.id)
    .single();

  const dict = getDictionary(profile?.locale ?? 'de');

  const [{ data: tasks }, { data: profiles }, { data: projects }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .neq('status', 'done')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
  ]);

  const active = tasks ?? [];
  const profileList = profiles ?? [];
  const projectList = projects ?? [];
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));
  const projectNames = new Map(projectList.map((p) => [p.id, p.name]));

  let pauses: TaskPause[] = [];
  const assigneeNamesByTask = new Map<string, string[]>();
  const assigneeIdsByTask = new Map<string, string[]>();
  if (active.length) {
    const [{ data: pauseData }, { data: assigneeData }] = await Promise.all([
      supabase
        .from('task_pauses')
        .select('*')
        .in(
          'task_id',
          active.map((t) => t.id)
        ),
      supabase
        .from('task_assignees')
        .select('task_id, assignee_id')
        .in(
          'task_id',
          active.map((t) => t.id)
        )
        .is('removed_at', null),
    ]);
    pauses = pauseData ?? [];
    for (const a of assigneeData ?? []) {
      const names = assigneeNamesByTask.get(a.task_id) ?? [];
      const name = profileNames.get(a.assignee_id);
      if (name) names.push(name);
      assigneeNamesByTask.set(a.task_id, names);

      const ids = assigneeIdsByTask.get(a.task_id) ?? [];
      ids.push(a.assignee_id);
      assigneeIdsByTask.set(a.task_id, ids);
    }
  }
  const pausesByTask = new Map<string, TaskPause[]>();
  for (const p of pauses) {
    const list = pausesByTask.get(p.task_id) ?? [];
    list.push(p);
    pausesByTask.set(p.task_id, list);
  }
  const pausedByNameByTask = new Map<string, string | null>();
  for (const [taskId, taskPauses] of pausesByTask) {
    const id = lastPausedBy(taskPauses);
    pausedByNameByTask.set(taskId, id ? profileNames.get(id) ?? null : null);
  }

  if (!active.length) {
    return (
      <div className="page-fade">
        <h2 className="section-title">{dict.dashboard.title}</h2>
        <p className="section-sub">{dict.dashboard.subtitle}</p>
        <EmptyState
          icon={Inbox}
          title={dict.dashboard.empty}
          ctaHref="/dashboard/new"
          ctaLabel={dict.topbar.newTask}
        />
      </div>
    );
  }

  const filtersActive = hasActiveFilters(filters);
  const filteredActive = filtersActive
    ? active.filter((t) => matchesTaskFilters(t, assigneeIdsByTask.get(t.id) ?? [], filters))
    : active;

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.dashboard.title}</h2>
      <p className="section-sub">{dict.dashboard.subtitle}</p>
      <Suspense fallback={null}>
        <TaskFilterBar profiles={profileList} projects={projectList} />
      </Suspense>
      {filtersActive && filteredActive.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={dict.filters.noResultsTitle}
          subtitle={dict.filters.noResultsSubtitle}
          ctaHref="/dashboard"
          ctaLabel={dict.filters.reset}
        />
      ) : (
        <div className="kanban">
          {COLUMNS.map((s, colIndex) => {
            const items = filteredActive.filter((t) => t.status === s).sort(compareByDeadlineUrgency);
            return (
              <div className="kanban-col" key={s}>
                <div className="col-head">
                  <span
                    className={`signal ${s === 'in_progress' ? 'pulsing' : ''}`}
                    style={{ background: STATUS_COLOR[s] }}
                  ></span>
                  {dict.status[s]} <span className="col-count">{items.length}</span>
                </div>
                <div className="card-stack">
                  {items.length ? (
                    items.map((t, i) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        pauses={pausesByTask.get(t.id) ?? []}
                        assigneeNames={assigneeNamesByTask.get(t.id) ?? []}
                        projectName={t.project_id ? projectNames.get(t.project_id) ?? null : null}
                        pausedByName={pausedByNameByTask.get(t.id) ?? null}
                        profileNames={profileNames}
                        style={{ animationDelay: `${(colIndex * 3 + i) * 40}ms` }}
                      />
                    ))
                  ) : (
                    <div className="empty-note">{dict.dashboard.empty}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
