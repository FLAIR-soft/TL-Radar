import { Suspense } from 'react';
import { Inbox, SearchX } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCachedUser, getCachedProfile } from '@/lib/supabase/request-cache';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { lastPausedBy } from '@/lib/logic/tasks';
import { parseTaskFilters, hasActiveFilters, matchesTaskFilters, type SearchParamsRecord } from '@/lib/logic/task-filters';
import { KanbanBoard } from './KanbanBoard';
import { TaskTable } from './TaskTable';
import { CalendarView } from './CalendarView';
import { EmptyState } from '@/components/EmptyState';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import type { TaskPause } from '@/lib/supabase/types';

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

  const [{ data: tasks }, { data: profiles }, { data: projects }, { data: savedViews }, { data: labels }, { data: wipLimits }] =
    await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .neq('status', 'done')
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase.from('profiles').select('id, name').order('name'),
      supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
      supabase.from('saved_views').select('id, name, filters').is('deleted_at', null).order('created_at', { ascending: true }),
      supabase.from('labels').select('*').is('deleted_at', null).order('name'),
      supabase.from('wip_limits').select('*'),
    ]);

  const active = tasks ?? [];
  const profileList = profiles ?? [];
  const projectList = projects ?? [];
  const savedViewList = savedViews ?? [];
  const labelList = labels ?? [];
  const limitByStatus = new Map((wipLimits ?? []).map((w) => [w.status, w.limit_count]));
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));
  const projectNames = new Map(projectList.map((p) => [p.id, p.name]));

  let pauses: TaskPause[] = [];
  const assigneeNamesByTask = new Map<string, string[]>();
  const assigneeIdsByTask = new Map<string, string[]>();
  const commentCountsByTask = new Map<string, number>();
  const checklistProgressByTask = new Map<string, { done: number; total: number }>();
  const labelIdsByTask = new Map<string, string[]>();
  if (active.length) {
    const [{ data: pauseData }, { data: assigneeData }, { data: commentData }, { data: checklistData }, { data: labelData }] =
      await Promise.all([
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
        supabase
          .from('task_comments')
          .select('task_id')
          .in(
            'task_id',
            active.map((t) => t.id)
          )
          .is('deleted_at', null),
        supabase
          .from('task_checklist_items')
          .select('task_id, done')
          .in(
            'task_id',
            active.map((t) => t.id)
          )
          .is('deleted_at', null),
        supabase
          .from('task_labels')
          .select('task_id, label_id')
          .in(
            'task_id',
            active.map((t) => t.id)
          ),
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
    for (const c of commentData ?? []) {
      commentCountsByTask.set(c.task_id, (commentCountsByTask.get(c.task_id) ?? 0) + 1);
    }
    for (const item of checklistData ?? []) {
      const progress = checklistProgressByTask.get(item.task_id) ?? { done: 0, total: 0 };
      progress.total += 1;
      if (item.done) progress.done += 1;
      checklistProgressByTask.set(item.task_id, progress);
    }
    for (const l of labelData ?? []) {
      const ids = labelIdsByTask.get(l.task_id) ?? [];
      ids.push(l.label_id);
      labelIdsByTask.set(l.task_id, ids);
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
    ? active.filter((t) => matchesTaskFilters(t, assigneeIdsByTask.get(t.id) ?? [], filters, labelIdsByTask.get(t.id) ?? []))
    : active;

  const labelById = new Map(labelList.map((l) => [l.id, l]));
  const labelsByTask = new Map(
    [...labelIdsByTask.entries()].map(([taskId, ids]) => [
      taskId,
      ids.map((id) => labelById.get(id)).filter((l): l is NonNullable<typeof l> => !!l),
    ])
  );

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.dashboard.title}</h2>
      <p className="section-sub">{dict.dashboard.subtitle}</p>
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
