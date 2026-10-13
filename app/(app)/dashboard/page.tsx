import { Suspense } from 'react';
import Link from 'next/link';
import { Inbox, SearchX, Plus } from 'lucide-react';
import { rows } from '@/lib/db/client';
import { loadActiveTasks } from '@/lib/db/queries/tasks';
import { getCurrentUser } from '@/lib/auth/current-user';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { parseTaskFilters, hasActiveFilters, matchesTaskFilters, type SearchParamsRecord } from '@/lib/logic/task-filters';
import { buildTaskRelationMaps } from '@/lib/logic/task-relations';
import { KanbanBoard } from './KanbanBoard';
import { TaskTable } from './TaskTable';
import { CalendarView } from './CalendarView';
import { EmptyState } from '@/components/EmptyState';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import type { Label, Person, Project, SavedView, WipLimit } from '@/lib/db/types';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const resolvedSearchParams = await searchParams;
  const filters = parseTaskFilters(resolvedSearchParams);
  const rawView = resolvedSearchParams.view;
  const view = rawView === 'table' ? 'table' : rawView === 'calendar' ? 'calendar' : 'kanban';

  const user = await getCurrentUser();
  const dict = getDictionary(await getLocaleCookie());

  const [active, people, projectList, savedViewList, labelList, wipLimits] = await Promise.all([
    loadActiveTasks(),
    rows<Pick<Person, 'email' | 'display_name'>>(
      `select email, display_name from people order by coalesce(display_name, email)`
    ),
    rows<Pick<Project, 'id' | 'name' | 'color'>>(
      `select id, name, color from projects where deleted_at is null order by name`
    ),
    // Сохранённые представления теперь фильтруются явно по владельцу: раньше
    // это делала политика RLS, которой больше нет.
    rows<SavedView>(
      `select id, name, filters from saved_views
       where email = $1 and deleted_at is null order by created_at`,
      [user.email]
    ),
    rows<Label>(`select * from labels where deleted_at is null order by name`),
    rows<WipLimit>(`select * from wip_limits`),
  ]);

  // Фильтры и компоненты принимают список людей в форме { id, name }.
  // Идентификатором человека теперь служит почта — форму не меняем, чтобы
  // не тащить переименование через всё дерево компонентов.
  const profileList = people.map((p) => ({ id: p.email, name: p.display_name ?? p.email }));
  const limitByStatus = new Map(wipLimits.map((w) => [w.status, w.limit_count]));
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));
  const projectNames = new Map(projectList.map((p) => [p.id, p.name]));
  const projectColors = new Map(projectList.map((p) => [p.id, p.color]));
  const labelById = new Map(labelList.map((l) => [l.id, l]));

  const {
    pausesByTask,
    pausedByNameByTask,
    assigneeNamesByTask,
    assigneeEmailsByTask,
    commentCountsByTask,
    checklistProgressByTask,
    checklistItemsByTask,
    watcherCountsByTask,
    lastCommentByTask,
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
    ? active.filter((t) => matchesTaskFilters(t, assigneeEmailsByTask.get(t.id) ?? [], filters, labelIdsByTask.get(t.id) ?? []))
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
          pausesByTask={pausesByTask}
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
          pausesByTask={pausesByTask}
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
          checklistItemsByTask={checklistItemsByTask}
          watcherCountsByTask={watcherCountsByTask}
          lastCommentByTask={lastCommentByTask}
          labelsByTask={labelsByTask}
        />
      )}
    </div>
  );
}
