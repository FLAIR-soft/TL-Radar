import { Suspense } from 'react';
import Link from 'next/link';
import { Inbox, SearchX, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCachedUser, getCachedProfile } from '@/lib/supabase/request-cache';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { parseTaskFilters, hasActiveFilters, matchesTaskFilters, type SearchParamsRecord } from '@/lib/logic/task-filters';
import { buildTaskRelationMaps, type EmbeddedTaskRelations } from '@/lib/logic/task-relations';
import { KanbanBoard } from './KanbanBoard';
import { TaskTable } from './TaskTable';
import { CalendarView } from './CalendarView';
import { EmptyState } from '@/components/EmptyState';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import type { Task } from '@/lib/supabase/types';

const TASKS_SELECT = `
  *,
  task_pauses(*),
  task_assignees(assignee_id),
  task_comments(count),
  task_checklist_items(done),
  task_labels(label_id)
`;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = parseTaskFilters(resolvedSearchParams);
  const rawView = resolvedSearchParams.view;
  const view = rawView === 'table' ? 'table' : rawView === 'calendar' ? 'calendar' : 'kanban';

  const supabase = await createClient();

  const user = await getCachedUser();
  const profile = await getCachedProfile(user!.id);

  const dict = getDictionary(profile?.locale ?? 'de');

  const [{ data: taskRows }, { data: profiles }, { data: projects }, { data: savedViews }, { data: labels }, { data: wipLimits }] =
    await Promise.all([
      supabase
        .from('tasks')
        .select(TASKS_SELECT)
        .neq('status', 'done')
        .is('deleted_at', null)
        .is('task_assignees.removed_at', null)
        .is('task_comments.deleted_at', null)
        .is('task_checklist_items.deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase.from('profiles').select('id, name').order('name'),
      supabase.from('projects').select('id, name, color').is('deleted_at', null).order('name'),
      supabase.from('saved_views').select('id, name, filters').is('deleted_at', null).order('created_at', { ascending: true }),
      supabase.from('labels').select('*').is('deleted_at', null).order('name'),
      supabase.from('wip_limits').select('*'),
    ]);

  const active = (taskRows ?? []) as unknown as (Task & EmbeddedTaskRelations)[];
  const profileList = profiles ?? [];
  const projectList = projects ?? [];
  const savedViewList = savedViews ?? [];
  const labelList = labels ?? [];
  const limitByStatus = new Map((wipLimits ?? []).map((w) => [w.status, w.limit_count]));
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));
  const projectNames = new Map(projectList.map((p) => [p.id, p.name]));
  const projectColors = new Map(projectList.map((p) => [p.id, p.color]));
  const labelById = new Map(labelList.map((l) => [l.id, l]));

  const {
    pausesByTask,
    pausedByNameByTask,
    assigneeNamesByTask,
    assigneeIdsByTask,
    commentCountsByTask,
    checklistProgressByTask,
    labelIdsByTask,
    labelsByTask,
  } = buildTaskRelationMaps(active, profileNames, labelById);

  if (!active.length) {
    return (
      <div className="page-fade">
        <div className="page-header">
          <div>
            <h2 className="section-title">{dict.dashboard.title}</h2>
            <p className="section-sub">{dict.dashboard.subtitle}</p>
          </div>
          <Link href="/dashboard/new" className="btn btn-primary" data-testid="new-task-button">
            <Plus size={16} strokeWidth={1.75} />
            {dict.topbar.newTask}
          </Link>
        </div>
        <EmptyState icon={Inbox} title={dict.dashboard.empty} />
      </div>
    );
  }

  const filtersActive = hasActiveFilters(filters);
  const filteredActive = filtersActive
    ? active.filter((t) => matchesTaskFilters(t, assigneeIdsByTask.get(t.id) ?? [], filters, labelIdsByTask.get(t.id) ?? []))
    : active;

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h2 className="section-title">{dict.dashboard.title}</h2>
          <p className="section-sub">{dict.dashboard.subtitle}</p>
        </div>
        <Link href="/dashboard/new" className="btn btn-primary" data-testid="new-task-button">
          <Plus size={16} strokeWidth={1.75} />
          {dict.topbar.newTask}
        </Link>
      </div>
      <Suspense fallback={null}>
        <TaskFilterBar
          profiles={profileList}
          projects={projectList}
          savedViews={savedViewList}
          view={view}
          labels={labelList}
        />
      </Suspense>
      {filtersActive && filteredActive.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={dict.filters.noResultsTitle}
          subtitle={dict.filters.noResultsSubtitle}
          ctaHref="/dashboard"
          ctaLabel={dict.filters.reset}
        />
      ) : view === 'table' ? (
        <TaskTable
          tasks={filteredActive}
          assigneeNamesByTask={assigneeNamesByTask}
          projectNames={projectNames}
          projectColors={projectColors}
          profileNames={profileNames}
          commentCountsByTask={commentCountsByTask}
          checklistProgressByTask={checklistProgressByTask}
          labelsByTask={labelsByTask}
        />
      ) : view === 'calendar' ? (
        <CalendarView
          tasks={filteredActive}
          assigneeNamesByTask={assigneeNamesByTask}
          projectNames={projectNames}
          projectColors={projectColors}
          profileNames={profileNames}
          labelsByTask={labelsByTask}
          month={typeof resolvedSearchParams.month === 'string' ? resolvedSearchParams.month : undefined}
        />
      ) : (
        <KanbanBoard
          tasks={filteredActive}
          limitByStatus={limitByStatus}
          pausesByTask={pausesByTask}
          assigneeNamesByTask={assigneeNamesByTask}
          projectNames={projectNames}
          projectColors={projectColors}
          pausedByNameByTask={pausedByNameByTask}
          profileNames={profileNames}
          commentCountsByTask={commentCountsByTask}
          checklistProgressByTask={checklistProgressByTask}
          labelsByTask={labelsByTask}
        />
      )}
    </div>
  );
}
