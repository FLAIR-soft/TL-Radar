import { rows } from '@/lib/db/client';
import { loadArchivedTasks } from '@/lib/db/queries/tasks';
import { getLocaleCookie } from '@/lib/i18n/cookie';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { fmtDateTime, fmtDuration, netDuration, completedLateBy } from '@/lib/logic/tasks';
import {
  parseTaskFilters,
  hasActiveFilters,
  matchesTaskFilters,
  searchParamsRecordFromURL,
} from '@/lib/logic/task-filters';
import { buildTaskRelationMaps } from '@/lib/logic/task-relations';
import { exportResponse, parseFormat } from '@/lib/export/respond';
import type { Label, Person, Project } from '@/lib/db/types';

export async function GET(request: Request) {
  // Проверки сессии здесь больше нет: аутентификацию делает шлюз MIDAS,
  // неаутентифицированный запрос до маршрута не доходит. Личность для
  // выгрузки архива всё равно не нужна — она одинакова для всех.
  const { searchParams } = new URL(request.url);
  const format = parseFormat(searchParams);
  const filters = parseTaskFilters(searchParamsRecordFromURL(searchParams));

  const dict = getDictionary(await getLocaleCookie());

  // Тот же запрос, что и у страницы архива: связи приходят вместе с задачами,
  // поэтому выгрузка и экран гарантированно показывают один и тот же набор
  // строк в одном и том же порядке.
  const [done, people, projectList] = await Promise.all([
    loadArchivedTasks(),
    rows<Pick<Person, 'email' | 'display_name'>>(
      `select email, display_name from people order by coalesce(display_name, email)`
    ),
    rows<Pick<Project, 'id' | 'name'>>(
      `select id, name from projects where deleted_at is null order by name`
    ),
  ]);

  const profileNames = new Map(people.map((p) => [p.email, p.display_name ?? p.email]));
  const projectNames = new Map(projectList.map((p) => [p.id, p.name]));

  // Метки в выгрузке не печатаются — нужны только их id, чтобы отработал
  // фильтр по меткам. Поэтому справочник меток не запрашивается, и
  // labelsByTask из раскладки остаётся пустым: его здесь никто не читает.
  const { pausesByTask, assigneeNamesByTask, assigneeEmailsByTask, labelIdsByTask } = buildTaskRelationMaps(
    done,
    profileNames,
    new Map<string, Label>()
  );

  const filteredDone = hasActiveFilters(filters)
    ? done.filter((t) => matchesTaskFilters(t, assigneeEmailsByTask.get(t.id) ?? [], filters, labelIdsByTask.get(t.id) ?? []))
    : done;

  const header = [
    dict.archive.colTask,
    dict.archive.colProject,
    dict.archive.colLocation,
    dict.archive.colCreated,
    dict.archive.colStarted,
    dict.archive.colCompleted,
    dict.archive.lateBy,
    dict.archive.colNetDuration,
    dict.archive.colEstimate,
    dict.archive.colAssignees,
  ];

  const exportRows = filteredDone.map((t) => {
    const taskPauses = pausesByTask.get(t.id) ?? [];
    const net = netDuration(t, taskPauses);
    const lateMs = completedLateBy(t);
    const estimate = t.estimated_minutes
      ? `${net !== null ? fmtDuration(net, dict.duration) : '—'} / ${fmtDuration(t.estimated_minutes * 60000, dict.duration)}`
      : '—';
    return [
      t.title,
      t.project_id ? projectNames.get(t.project_id) ?? '' : '',
      t.location || '',
      fmtDateTime(t.created_at, dict.intlLocale),
      fmtDateTime(t.started_at, dict.intlLocale),
      fmtDateTime(t.completed_at, dict.intlLocale),
      lateMs !== null ? fmtDuration(lateMs, dict.duration) : '',
      net !== null ? fmtDuration(net, dict.duration) : '',
      estimate,
      (assigneeNamesByTask.get(t.id) ?? []).join(', '),
    ];
  });

  return exportResponse([header, ...exportRows], format, 'archive', dict.archive.title);
}
