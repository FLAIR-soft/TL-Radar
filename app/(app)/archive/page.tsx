import { Suspense } from 'react';
import Link from 'next/link';
import { Pause, Play, Archive as ArchiveIcon, SearchX, ChevronRight } from 'lucide-react';
// Хелпер назван dbRows: ниже в компоненте есть своя переменная `rows`
// (готовые строки таблицы), и без переименования импорта она бы затенила
// хелпер на всю функцию — обращение к нему наверху упало бы в TDZ.
import { rows as dbRows } from '@/lib/db/client';
import { loadArchivedTasks } from '@/lib/db/queries/tasks';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { fmtDateTime, fmtDateTimeCompact, fmtTime, fmtDuration, netDuration, completedLateBy } from '@/lib/logic/tasks';
import { parseTaskFilters, hasActiveFilters, matchesTaskFilters, type SearchParamsRecord } from '@/lib/logic/task-filters';
import { buildTaskRelationMaps } from '@/lib/logic/task-relations';
import { ICON_MAP, isIconName } from '@/lib/logic/icons';
import type { Label, Person, Project, TaskPause } from '@/lib/db/types';
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
    if (value === undefined || key === 'page') continue;
    if (Array.isArray(value)) for (const v of value) qs.append(key, v);
    else qs.append(key, value);
  }
  return qs.toString();
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Номера страниц: все подряд, пока их немного, иначе первая, последняя и
// окно вокруг текущей — чтобы строка не расползалась на сотнях страниц.
function pageWindow(current: number, count: number): (number | 'gap')[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const pages = new Set([1, count, current, current - 1, current + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('gap');
    out.push(sorted[i]);
  }
  return out;
}

// Размер страницы архива. Раньше страница без фильтров резалась в базе через
// range() + count: 'exact', а с фильтрами — в памяти, потому что фильтры по
// исполнителям и меткам живут в связанных таблицах и в один запрос с range()
// не укладывались. Теперь архив целиком приходит одним запросом со связями
// (loadArchivedTasks), поэтому ветка одна: режем в памяти всегда — счётчик и
// номера страниц считаются по одному и тому же массиву и не могут разойтись.
const PAGE_SIZE = 25;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  const rawSearchParams = await searchParams;
  const filters = parseTaskFilters(rawSearchParams);
  const exportQuery = toQueryString(rawSearchParams);

  const dict = getDictionary(await getLocaleCookie());

  const filtersActive = hasActiveFilters(filters);
  const page = Math.max(1, Number(firstValue(rawSearchParams.page)) || 1);

  const [done, people, projectList, labelList] = await Promise.all([
    loadArchivedTasks(),
    dbRows<Pick<Person, 'email' | 'display_name'>>(
      `select email, display_name from people order by coalesce(display_name, email)`
    ),
    dbRows<Pick<Project, 'id' | 'name' | 'color'>>(
      `select id, name, color from projects where deleted_at is null order by name`
    ),
    dbRows<Label>(`select * from labels where deleted_at is null order by name`),
  ]);

  // Фильтры и компоненты принимают список людей в форме { id, name }.
  // Идентификатором человека теперь служит почта — форму не меняем, чтобы
  // не тащить переименование через всё дерево компонентов.
  const profileList = people.map((p) => ({ id: p.email, name: p.display_name ?? p.email }));
  const profileNames = new Map(profileList.map((p) => [p.id, p.name]));
  const projectNames = new Map(projectList.map((p) => [p.id, p.name]));
  const projectColors = new Map(projectList.map((p) => [p.id, p.color]));
  const labelById = new Map(labelList.map((l) => [l.id, l]));

  const { pausesByTask, assigneeNamesByTask, assigneeEmailsByTask, labelIdsByTask, labelsByTask } =
    buildTaskRelationMaps(done, profileNames, labelById);

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

  const filteredDone = filtersActive
    ? done.filter((t) => matchesTaskFilters(t, assigneeEmailsByTask.get(t.id) ?? [], filters, labelIdsByTask.get(t.id) ?? []))
    : done;

  const total = filteredDone.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageDone = filteredDone.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function pageHref(target: number): string {
    const qs = new URLSearchParams(exportQuery);
    if (target <= 1) qs.delete('page');
    else qs.set('page', String(target));
    const query = qs.toString();
    return query ? `/archive?${query}` : '/archive';
  }

  const rows = pageDone.map((t) => {
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
          {fmtTime(p.paused_at, dict.intlLocale)}
          <span>→</span>
          <Play size={12} strokeWidth={1.75} />
          {p.resumed_at ? fmtTime(p.resumed_at, dict.intlLocale) : '—'}
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
                  <strong className="archive-card-title">
                    {RowIcon && <RowIcon size={14} strokeWidth={1.75} className="t-title-icon" />}
                    {t.title}
                  </strong>
                  <div className="archive-task-meta">
                    <span className="pill" style={{ ['--pill-color' as string]: 'var(--done)' }}>
                      {dict.status.done}
                    </span>
                    {labels.map((l) => (
                      <span key={l.id} className="pill label-pill" style={{ ['--pill-color' as string]: l.color }}>
                        {l.name}
                      </span>
                    ))}
                    {assignees.length > 0 && <span className="mono archive-assignees">{assignees.join(', ')}</span>}
                  </div>
                </td>
                <td>
                  {t.project_id && projectNames.get(t.project_id) ? (
                    <span className="count-pill">{projectNames.get(t.project_id)}</span>
                  ) : (
                    <span className="row-placeholder">{dict.archive.noProject}</span>
                  )}
                </td>
                <td>{t.location || '—'}</td>
                <td className="mono">{fmtDateTimeCompact(t.created_at, dict.intlLocale)}</td>
                <td className="mono">{fmtTime(t.started_at, dict.intlLocale)}</td>
                <td className="mono">
                  {fmtTime(t.completed_at, dict.intlLocale)}
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
                <td>
                  <TaskDetailPanel
                    task={t}
                    pauses={taskPauses}
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
                pauses={taskPauses}
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

      <div className="archive-footer">
        <span className="archive-summary">
          {dict.archive.summary
            .replace('{n}', String(rows.length))
            .replace('{total}', String(total))}
        </span>
        {pageCount > 1 && (
          <nav className="pagination" aria-label={dict.archive.title}>
            {pageWindow(currentPage, pageCount).map((p, i) =>
              p === 'gap' ? (
                <span key={`gap-${i}`} className="pagination-gap">
                  …
                </span>
              ) : (
                <Link
                  key={p}
                  href={pageHref(p)}
                  className={`pagination-page ${p === currentPage ? 'is-active' : ''}`}
                  aria-current={p === currentPage ? 'page' : undefined}
                >
                  {p}
                </Link>
              )
            )}
            {currentPage < pageCount && (
              <Link href={pageHref(currentPage + 1)} className="pagination-page" aria-label={dict.archive.nextPage}>
                <ChevronRight size={14} strokeWidth={2} />
              </Link>
            )}
          </nav>
        )}
      </div>
        </>
      )}
    </div>
  );
}
