import { Suspense } from 'react';
import { Pause, Play, Archive as ArchiveIcon, SearchX } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCachedUser, getCachedProfile } from '@/lib/supabase/request-cache';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { fmtDateTime, fmtDuration, netDuration, completedLateBy } from '@/lib/logic/tasks';
import { parseTaskFilters, hasActiveFilters, matchesTaskFilters, type SearchParamsRecord } from '@/lib/logic/task-filters';
import { buildTaskRelationMaps, type EmbeddedTaskRelations } from '@/lib/logic/task-relations';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import type { Task, TaskPause } from '@/lib/supabase/types';
import { EmptyState } from '@/components/EmptyState';
import { TaskFilterBar } from '@/components/TaskFilterBar';
import { ExportButtons } from '@/components/ExportButtons';
import { TaskDetailPanel } from '@/app/(app)/dashboard/TaskDetailPanel';

// The export links have to carry the current filters, and since the buttons
// now live in the page header instead of inside TaskFilterBar, the query
// string is rebuilt here from the same searchParams the page already reads.
function toQueryString(params: SearchParamsRecord): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) qs.append(key, v);
    else qs.append(key, value);
  }
  return qs.toString();
}

const TASKS_SELECT = `
  *,
  task_pauses(*),
  task_assignees(assignee_id),
  task_labels(label_id)
`;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const rawSearchParams = await searchParams;
  const filters = parseTaskFilters(rawSearchParams);
  const exportQuery = toQueryString(rawSearchParams);
  const supabase = await createClient();

  const user = await getCachedUser();
  const profile = await getCachedProfile(user!.id);

  const dict = getDictionary(profile?.locale ?? 'de');

  const [{ data: taskRows }, { data: profiles }, { data: projects }, { data: labels }] = await Promise.all([
    supabase
      .from('tasks')
      .select(TASKS_SELECT)
      .eq('status', 'done')
      .is('deleted_at', null)
      .is('task_assignees.removed_at', null)
      .order('created_at', { ascending: false })
      .order('paused_at', { ascending: true, referencedTable: 'task_pauses' }),
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('projects').select('id, name, color').is('deleted_at', null).order('name'),
    supabase.from('labels').select('*').is('deleted_at', null).order('name'),
  ]);

  const done = (taskRows ?? []) as unknown as (Task & EmbeddedTaskRelations)[];
  const profileList = profiles ?? [];
  const projectList = projects ?? [];
  const labelList = labels ?? [];
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));
  const projectNames = new Map(projectList.map((p) => [p.id, p.name]));
  const projectColors = new Map(projectList.map((p) => [p.id, p.color]));
  const labelById = new Map(labelList.map((l) => [l.id, l]));

  const { pausesByTask, assigneeNamesByTask, assigneeIdsByTask, labelIdsByTask, labelsByTask } = buildTaskRelationMaps(
    done,
    profileNames,
    labelById
  );

  if (!done.length) {
    return (
      <div className="page-fade">
        <div className="page-header">
          <div>
            <h2 className="section-title">{dict.archive.title}</h2>
            <p className="section-sub">{dict.archive.subtitle}</p>
          </div>
        </div>
        <EmptyState icon={ArchiveIcon} title={dict.archive.empty} subtitle={dict.archive.emptyTitle} />
      </div>
    );
  }

  const filtersActive = hasActiveFilters(filters);
  const filteredDone = filtersActive
    ? done.filter((t) => matchesTaskFilters(t, assigneeIdsByTask.get(t.id) ?? [], filters, labelIdsByTask.get(t.id) ?? []))
    : done;

  const rows = filteredDone.map((t) => {
    const taskPauses = pausesByTask.get(t.id) ?? [];
    return {
      t,
      taskPauses,
      net: netDuration(t, taskPauses),
      assignees: assigneeNamesByTask.get(t.id) ?? [],
      labels: labelsByTask.get(t.id) ?? [],
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
      <div className="page-header">
        <div>
          <h2 className="section-title">{dict.archive.title}</h2>
          <p className="section-sub">{dict.archive.subtitle}</p>
        </div>
        <ExportButtons
          csvHref={`/api/export/archive?format=csv&${exportQuery}`}
          xlsxHref={`/api/export/archive?format=xlsx&${exportQuery}`}
        />
      </div>
      <Suspense fallback={null}>
        <TaskFilterBar profiles={profileList} projects={projectList} labels={labelList} />
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
              <th className="ta-right">{dict.archive.colNetDuration}</th>
              <th className="ta-right">{dict.archive.colEstimate}</th>
              <th>{dict.archive.colAssignees}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, taskPauses, net, assignees, labels, lateMs }, i) => {
              const RowIcon = isIconName(t.icon) ? ICON_MAP[t.icon] : undefined;
              const estimateMs = t.estimated_minutes ? t.estimated_minutes * 60000 : null;
              const estimateOver = estimateMs !== null && net !== null && net > estimateMs;
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
                  {labels.length > 0 && (
                    <div className="t-labels">
                      {labels.map((l) => (
                        <span key={l.id} className="pill label-pill" style={{ ['--pill-color' as string]: l.color }}>
                          {l.name}
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  {t.project_id && projectNames.get(t.project_id) ? (
                    <span className="table-project-cell">
                      {projectColors.get(t.project_id) && (
                        <span
                          className="project-color-dot"
                          style={{ background: projectColors.get(t.project_id) ?? undefined }}
                        />
                      )}
                      {projectNames.get(t.project_id)}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
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
                <td className="mono ta-right">{net !== null ? fmtDuration(net, dict.duration) : '—'}</td>
                <td className={`mono ta-right ${t.estimated_minutes ? (estimateOver ? 'ta-over' : 'ta-under') : ''}`}>
                  {estimateCell(t, net)}
                </td>
                <td>{assignees.join(', ') || '—'}</td>
                <td>
                  <TaskDetailPanel
                    task={t}
                    assigneeNames={assignees}
                    projectName={t.project_id ? projectNames.get(t.project_id) ?? null : null}
                    projectColor={t.project_id ? projectColors.get(t.project_id) ?? null : null}
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
        {rows.map(({ t, taskPauses, net, assignees, labels, lateMs }, i) => {
          const CardIcon = isIconName(t.icon) ? ICON_MAP[t.icon] : undefined;
          const estimateMs = t.estimated_minutes ? t.estimated_minutes * 60000 : null;
          const estimateOver = estimateMs !== null && net !== null && net > estimateMs;
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
                projectColor={t.project_id ? projectColors.get(t.project_id) ?? null : null}
                profileNames={profileNames}
              />
            </div>
            {labels.length > 0 && (
              <div className="t-labels">
                {labels.map((l) => (
                  <span key={l.id} className="pill label-pill" style={{ ['--pill-color' as string]: l.color }}>
                    {l.name}
                  </span>
                ))}
              </div>
            )}
            <div className="archive-card-grid">
              <div>
                <span className="archive-card-label">{dict.archive.colAssignees}</span>
                <span>{assignees.join(', ') || '—'}</span>
              </div>
              <div>
                <span className="archive-card-label">{dict.archive.colProject}</span>
                <span className="table-project-cell">
                  {t.project_id && projectColors.get(t.project_id) && (
                    <span
                      className="project-color-dot"
                      style={{ background: projectColors.get(t.project_id) ?? undefined }}
                    />
                  )}
                  {t.project_id ? projectNames.get(t.project_id) ?? '—' : '—'}
                </span>
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
                <span className={`mono ${t.estimated_minutes ? (estimateOver ? 'ta-over' : 'ta-under') : ''}`}>
                  {estimateCell(t, net)}
                </span>
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
