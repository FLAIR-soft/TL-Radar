import { Suspense } from 'react';
import { Pause, Play, Archive as ArchiveIcon, SearchX } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { fmtDateTime, fmtDuration, netDuration, completedLateBy } from '@/lib/logic/tasks';
import { parseTaskFilters, hasActiveFilters, matchesTaskFilters, type SearchParamsRecord } from '@/lib/logic/task-filters';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import type { TaskPause } from '@/lib/supabase/types';
import { EmptyState } from '@/components/EmptyState';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { TaskDetailPanel } from '@/app/(app)/dashboard/TaskDetailPanel';

export default async function ArchivePage({
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
      .eq('status', 'done')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('projects').select('id, name').is('deleted_at', null).order('name'),
  ]);

  const done = tasks ?? [];
  const profileList = profiles ?? [];
  const projectList = projects ?? [];
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));
  const projectNames = new Map(projectList.map((p) => [p.id, p.name]));

  let pauses: TaskPause[] = [];
  const assigneeNamesByTask = new Map<string, string[]>();
  const assigneeIdsByTask = new Map<string, string[]>();
  if (done.length) {
    const [{ data: pauseData }, { data: assigneeData }] = await Promise.all([
      supabase
        .from('task_pauses')
        .select('*')
        .in(
          'task_id',
          done.map((t) => t.id)
        )
        .order('paused_at', { ascending: true }),
      supabase
        .from('task_assignees')
        .select('task_id, assignee_id')
        .in(
          'task_id',
          done.map((t) => t.id)
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

  if (!done.length) {
    return (
      <div className="page-fade">
        <h2 className="section-title">{dict.archive.title}</h2>
        <p className="section-sub">{dict.archive.subtitle}</p>
        <EmptyState icon={ArchiveIcon} title={dict.archive.empty} subtitle={dict.archive.emptyTitle} />
      </div>
    );
  }

  const filtersActive = hasActiveFilters(filters);
  const filteredDone = filtersActive
    ? done.filter((t) => matchesTaskFilters(t, assigneeIdsByTask.get(t.id) ?? [], filters))
    : done;

  const rows = filteredDone.map((t) => {
    const taskPauses = pausesByTask.get(t.id) ?? [];
    return {
      t,
      taskPauses,
      net: netDuration(t, taskPauses),
      assignees: assigneeNamesByTask.get(t.id) ?? [],
      lateMs: completedLateBy(t),
    };
  });

  const pausesCell = (taskPauses: TaskPause[]) =>
    taskPauses.length ? (
      taskPauses.map((p) => (
        <div className="pause-line" key={p.id}>
          <Pause size={12} strokeWidth={1.75} />
          {fmtDateTime(p.paused_at, dict.intlLocale)}
          <span>→</span>
          <Play size={12} strokeWidth={1.75} />
          {p.resumed_at ? fmtDateTime(p.resumed_at, dict.intlLocale) : '—'}
        </div>
      ))
    ) : (
      <span className="mono">—</span>
    );

  const estimateCell = (t: (typeof rows)[number]['t'], net: number | null) =>
    t.estimated_minutes
      ? `${net !== null ? fmtDuration(net, dict.duration) : '—'} / ${fmtDuration(t.estimated_minutes * 60000, dict.duration)}`
      : '—';

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.archive.title}</h2>
      <p className="section-sub">{dict.archive.subtitle}</p>
      <Suspense fallback={null}>
        <TaskFilterBar profiles={profileList} projects={projectList} showExport />
      </Suspense>
      {filtersActive && rows.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title={dict.filters.noResultsTitle}
          subtitle={dict.filters.noResultsSubtitle}
          ctaHref="/archive"
          ctaLabel={dict.filters.reset}
        />
      ) : (
        <>
      <div className="archive-scroll">
        <table className="archive-table">
          <thead>
            <tr>
              <th>{dict.archive.colTask}</th>
              <th>{dict.archive.colProject}</th>
              <th>{dict.archive.colLocation}</th>
              <th>{dict.archive.colCreated}</th>
              <th>{dict.archive.colStarted}</th>
              <th>{dict.archive.colCompleted}</th>
              <th>{dict.archive.colPauses}</th>
              <th>{dict.archive.colNetDuration}</th>
              <th>{dict.archive.colEstimate}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, taskPauses, net, assignees, lateMs }, i) => {
              const RowIcon = isIconName(t.icon) ? ICON_MAP[t.icon] : undefined;
              return (
              <tr key={t.id} className="archive-row" style={{ animationDelay: `${i * 30}ms` }}>
                <td>
                  <span className="pill" style={{ ['--pill-color' as string]: 'var(--done)' }}>
                    {dict.status.done}
                  </span>
                  <br />
                  <strong className="archive-card-title">
                    {RowIcon && <RowIcon size={14} strokeWidth={1.75} className="t-title-icon" />}
                    {t.title}
                  </strong>
                  {assignees.length > 0 && (
                    <>
                      <br />
                      <span className="mono">{assignees.join(', ')}</span>
                    </>
                  )}
                </td>
                <td>{t.project_id ? projectNames.get(t.project_id) ?? '—' : '—'}</td>
                <td>{t.location || '—'}</td>
                <td className="mono">{fmtDateTime(t.created_at, dict.intlLocale)}</td>
                <td className="mono">{fmtDateTime(t.started_at, dict.intlLocale)}</td>
                <td className="mono">
                  {fmtDateTime(t.completed_at, dict.intlLocale)}
                  {lateMs !== null && (
                    <>
                      <br />
                      <span className="overdue-badge">
                        {dict.archive.lateBy} {fmtDuration(lateMs, dict.duration)}
                      </span>
                    </>
                  )}
                </td>
                <td>{pausesCell(taskPauses)}</td>
                <td className="mono">{net !== null ? fmtDuration(net, dict.duration) : '—'}</td>
                <td className="mono">{estimateCell(t, net)}</td>
                <td>
                  <TaskDetailPanel
                    task={t}
                    assigneeNames={assignees}
                    projectName={t.project_id ? projectNames.get(t.project_id) ?? null : null}
                    profileNames={profileNames}
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="archive-cards">
        {rows.map(({ t, taskPauses, net, assignees, lateMs }, i) => {
          const CardIcon = isIconName(t.icon) ? ICON_MAP[t.icon] : undefined;
          return (
          <div className="archive-card" key={t.id} style={{ animationDelay: `${i * 30}ms` }}>
            <div className="archive-card-head">
              <span className="pill" style={{ ['--pill-color' as string]: 'var(--done)' }}>
                {dict.status.done}
              </span>
              <span className="archive-card-title">
                {CardIcon && <CardIcon size={14} strokeWidth={1.75} className="t-title-icon" />}
                {t.title}
              </span>
              <TaskDetailPanel
                task={t}
                assigneeNames={assignees}
                projectName={t.project_id ? projectNames.get(t.project_id) ?? null : null}
                profileNames={profileNames}
              />
            </div>
            {assignees.length > 0 && <div className="mono archive-card-assignees">{assignees.join(', ')}</div>}
            <div className="archive-card-grid">
              <div>
                <span className="archive-card-label">{dict.archive.colProject}</span>
                <span>{t.project_id ? projectNames.get(t.project_id) ?? '—' : '—'}</span>
              </div>
              <div>
                <span className="archive-card-label">{dict.archive.colLocation}</span>
                <span>{t.location || '—'}</span>
              </div>
              <div>
                <span className="archive-card-label">{dict.archive.colCreated}</span>
                <span className="mono">{fmtDateTime(t.created_at, dict.intlLocale)}</span>
              </div>
              <div>
                <span className="archive-card-label">{dict.archive.colStarted}</span>
                <span className="mono">{fmtDateTime(t.started_at, dict.intlLocale)}</span>
              </div>
              <div>
                <span className="archive-card-label">{dict.archive.colCompleted}</span>
                <span className="mono">{fmtDateTime(t.completed_at, dict.intlLocale)}</span>
                {lateMs !== null && (
                  <span className="overdue-badge archive-card-late-badge">
                    {dict.archive.lateBy} {fmtDuration(lateMs, dict.duration)}
                  </span>
                )}
              </div>
              <div>
                <span className="archive-card-label">{dict.archive.colNetDuration}</span>
                <span className="mono">{net !== null ? fmtDuration(net, dict.duration) : '—'}</span>
              </div>
              <div>
                <span className="archive-card-label">{dict.archive.colEstimate}</span>
                <span className="mono">{estimateCell(t, net)}</span>
              </div>
            </div>
            <div className="archive-card-pauses">
              <span className="archive-card-label">{dict.archive.colPauses}</span>
              {pausesCell(taskPauses)}
            </div>
          </div>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}
