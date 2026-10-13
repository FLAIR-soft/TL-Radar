import { rows } from '@/lib/db/client';
import { getLocale } from '@/lib/i18n/locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { availableWorkingMs, computePersonStats, workedPercent } from '@/lib/logic/analytics';
import { fmtDuration } from '@/lib/logic/tasks';
import { exportResponse, parseFormat } from '@/lib/export/respond';
import type { Person, Task, TaskAssignee, TaskPause } from '@/lib/db/types';

const PERIOD_OPTIONS = [7, 30, 90] as const;

function parsePeriod(raw: string | null): (typeof PERIOD_OPTIONS)[number] {
  const n = Number(raw);
  return (PERIOD_OPTIONS as readonly number[]).includes(n) ? (n as (typeof PERIOD_OPTIONS)[number]) : 7;
}

export async function GET(request: Request) {
  // Ролей в новой схеме нет, своей сессии у приложения тоже: кто дошёл до
  // маршрута, того пропустил шлюз MIDAS. Прежние ответы 401/403 по
  // profile.role убраны вместе с ролями — см. страницу /analytics.
  const dict = getDictionary(await getLocale());
  const { searchParams } = new URL(request.url);
  const format = parseFormat(searchParams);
  const days = parsePeriod(searchParams.get('days'));

  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd.getTime() - days * 24 * 3600 * 1000);

  // Отбор задач тот же, что и раньше: неудалённые и уже запущенные. Паузы и
  // назначения берутся соединением с этим же отбором — вместо второго захода
  // со списком id задач в .in().
  const [people, activeTasks, pauses, assignees] = await Promise.all([
    rows<Pick<Person, 'email' | 'display_name'>>(
      `select email, display_name from people order by coalesce(display_name, email)`
    ),
    rows<Task>(`select * from tasks where deleted_at is null and started_at is not null`),
    rows<TaskPause>(
      `select p.* from task_pauses p
       join tasks t on t.id = p.task_id
       where t.deleted_at is null and t.started_at is not null`
    ),
    rows<TaskAssignee>(
      `select a.* from task_assignees a
       join tasks t on t.id = a.task_id
       where t.deleted_at is null and t.started_at is not null`
    ),
  ]);

  // Человек в расчёте — это { id, name }, где id теперь почта: тот же ключ,
  // что и в task_assignees.assignee_email.
  const profileList = people.map((p) => ({ id: p.email, name: p.display_name ?? p.email }));

  const stats = computePersonStats({
    profiles: profileList,
    tasks: activeTasks,
    pauses,
    assignees,
    rangeStart,
    rangeEnd,
  });
  const availableMs = availableWorkingMs(rangeStart, rangeEnd);

  const header = [dict.analytics.colPerson, dict.analytics.colWorked, dict.analytics.colPercent];
  const exportRows = stats.map((s) => {
    const pct = Math.round(workedPercent(s.workedMs, availableMs));
    return [s.name, fmtDuration(s.workedMs, dict.duration), `${pct}%`];
  });

  return exportResponse([header, ...exportRows], format, 'analytics', dict.analytics.title);
}
