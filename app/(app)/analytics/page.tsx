import Link from 'next/link';
import { Users } from 'lucide-react';
import { rows } from '@/lib/db/client';
import { getLocale } from '@/lib/i18n/locale';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { availableWorkingMs, computePersonStats } from '@/lib/logic/analytics';
import { computeCumulativeFlow } from '@/lib/logic/cumulative-flow';
import { computeEstimateAccuracy } from '@/lib/logic/estimate-accuracy';
import { EmptyState } from '@/components/EmptyState';
import { AnalyticsStats } from './AnalyticsStats';
import { CumulativeFlowChart } from '@/components/CumulativeFlowChart';
import { EstimateAccuracyTable } from '@/components/EstimateAccuracyTable';
import { ExportButtons } from '@/components/ExportButtons';
import type { ActivityLog, Person, Task, TaskAssignee, TaskPause } from '@/lib/db/types';

const PERIOD_OPTIONS = [7, 30, 90] as const;
type Period = (typeof PERIOD_OPTIONS)[number];

function parsePeriod(raw: string | undefined): Period {
  const n = Number(raw);
  return (PERIOD_OPTIONS as readonly number[]).includes(n) ? (n as Period) : 7;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const days = parsePeriod(daysParam);

  // Ролей в новой схеме нет: кто дошёл до приложения, тот прошёл Entra через
  // шлюз MIDAS. Прежняя проверка canViewStats(profile.role) вместе с редиректом
  // на /login и /dashboard отсюда убрана — проверять больше нечего.
  const dict = getDictionary(await getLocale());

  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd.getTime() - days * 24 * 3600 * 1000);

  // Боковые таблицы раньше запрашивались вторым заходом по списку id задач
  // (.in('task_id', taskIds)). Теперь тот же отбор выражается соединением с
  // tasks, поэтому все четыре запроса уходят параллельно, а длинный список
  // uuid не ездит в базу параметром.
  const [people, allTasks, pauses, assignees, statusChanges] = await Promise.all([
    rows<Pick<Person, 'email' | 'display_name'>>(
      `select email, display_name from people order by coalesce(display_name, email)`
    ),
    // Все неудалённые задачи (не только запущенные) — нужны и 'waiting'
    // задачи для cumulative flow (Этап 11).
    rows<Task>(`select * from tasks where deleted_at is null`),
    rows<TaskPause>(
      `select p.* from task_pauses p
       join tasks t on t.id = p.task_id
       where t.deleted_at is null`
    ),
    rows<TaskAssignee>(
      `select a.* from task_assignees a
       join tasks t on t.id = a.task_id
       where t.deleted_at is null`
    ),
    rows<ActivityLog>(
      `select al.* from activity_log al
       join tasks t on t.id = al.entity_id
       where al.entity_type = 'task'
         and al.event_type = 'status_changed'
         and t.deleted_at is null`
    ),
  ]);

  const activeTasks = allTasks.filter((t) => t.started_at);

  // Расчётные функции принимают людей как { id, name }; идентификатор —
  // почта, как и ключ в task_assignees.assignee_email, поэтому сопоставление
  // «строка назначения → человек» остаётся прямым.
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

  const cumulativeFlow = computeCumulativeFlow({
    tasks: allTasks,
    statusChanges,
    rangeStart,
    rangeEnd,
  });

  const estimateAccuracy = computeEstimateAccuracy({
    profiles: profileList,
    tasks: allTasks,
    pauses,
    assignees,
  });

  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <h2 className="section-title">{dict.analytics.title}</h2>
          <p className="section-sub">{dict.analytics.subtitle}</p>
        </div>
        <div className="page-header-actions">
          <div className="period-switcher-tabs">
            {PERIOD_OPTIONS.map((d) => (
              <Link key={d} href={`/analytics?days=${d}`} className={`tab ${d === days ? 'active' : ''}`}>
                {dict.analytics.periodLabels[d]}
              </Link>
            ))}
          </div>
          <ExportButtons
            csvHref={`/api/export/analytics?format=csv&days=${days}`}
            xlsxHref={`/api/export/analytics?format=xlsx&days=${days}`}
          />
        </div>
      </div>
      {profileList.length === 0 ? (
        <EmptyState icon={Users} title={dict.analytics.empty} />
      ) : (
        <>
          <AnalyticsStats stats={stats} availableMs={availableMs} />

          {/* Заголовки блоков переехали внутрь карточек: на скрине 01 у
              каждого блока своя карточка с заголовком и легендой в шапке. */}
          <CumulativeFlowChart
            data={cumulativeFlow}
            dict={dict}
            title={dict.analytics.cumulativeFlowTitle}
            subtitle={dict.analytics.cumulativeFlowSubtitle}
          />

          <EstimateAccuracyTable
            stats={estimateAccuracy}
            dict={dict}
            title={dict.analytics.estimateAccuracyTitle}
            subtitle={dict.analytics.estimateAccuracySubtitle}
          />
        </>
      )}
    </div>
  );
}
