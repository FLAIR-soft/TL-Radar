import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCachedUser, getCachedProfile } from '@/lib/supabase/request-cache';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { canViewStats } from '@/lib/logic/access';
import { availableWorkingMs, computePersonStats } from '@/lib/logic/analytics';
import { computeCumulativeFlow } from '@/lib/logic/cumulative-flow';
import { computeEstimateAccuracy } from '@/lib/logic/estimate-accuracy';
import { EmptyState } from '@/components/EmptyState';
import { AnalyticsStats } from './AnalyticsStats';
import { CumulativeFlowChart } from '@/components/CumulativeFlowChart';
import { EstimateAccuracyTable } from '@/components/EstimateAccuracyTable';
import { ExportMenu } from '@/components/ExportMenu';

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

  const supabase = await createClient();
  const user = await getCachedUser();
  if (!user) redirect('/login');

  const profile = await getCachedProfile(user.id);
  if (!profile || !canViewStats(profile.role)) redirect('/dashboard');

  const dict = getDictionary(profile.locale ?? 'de');

  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd.getTime() - days * 24 * 3600 * 1000);

  const [{ data: profiles }, { data: tasks }] = await Promise.all([
    supabase.from('profiles').select('id, name').order('name'),
    // Vse nezaudalyonnyye zadachi (ne tol'ko zapushchennyye) — nuzhny i
    // 'waiting' zadachi dlya cumulative flow (Etap 11).
    supabase.from('tasks').select('*').is('deleted_at', null),
  ]);

  const allTasks = tasks ?? [];
  const activeTasks = allTasks.filter((t) => t.started_at);
  const taskIds = allTasks.map((t) => t.id);

  const [{ data: pauses }, { data: assignees }, { data: statusChanges }] = taskIds.length
    ? await Promise.all([
        supabase.from('task_pauses').select('*').in('task_id', taskIds),
        supabase.from('task_assignees').select('*').in('task_id', taskIds),
        supabase
          .from('activity_log')
          .select('*')
          .eq('entity_type', 'task')
          .eq('event_type', 'status_changed')
          .in('entity_id', taskIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const stats = computePersonStats({
    profiles: profiles ?? [],
    tasks: activeTasks,
    pauses: pauses ?? [],
    assignees: assignees ?? [],
    rangeStart,
    rangeEnd,
  });

  const availableMs = availableWorkingMs(rangeStart, rangeEnd);

  const cumulativeFlow = computeCumulativeFlow({
    tasks: allTasks,
    statusChanges: statusChanges ?? [],
    rangeStart,
    rangeEnd,
  });

  const estimateAccuracy = computeEstimateAccuracy({
    profiles: profiles ?? [],
    tasks: allTasks,
    pauses: pauses ?? [],
    assignees: assignees ?? [],
  });

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.analytics.title}</h2>
      <p className="section-sub">{dict.analytics.subtitle}</p>
      <div className="period-switcher">
        {PERIOD_OPTIONS.map((d) => (
          <Link key={d} href={`/analytics?days=${d}`} className={`tab ${d === days ? 'active' : ''}`}>
            {dict.analytics.periodLabels[d]}
          </Link>
        ))}
        <ExportMenu
          csvHref={`/api/export/analytics?format=csv&days=${days}`}
          xlsxHref={`/api/export/analytics?format=xlsx&days=${days}`}
        />
      </div>
      {(profiles ?? []).length === 0 ? (
        <EmptyState icon={Users} title={dict.analytics.empty} />
      ) : (
        <>
          <AnalyticsStats stats={stats} availableMs={availableMs} />

          <h3 className="section-title analytics-subsection-title">{dict.analytics.cumulativeFlowTitle}</h3>
          <p className="section-sub">{dict.analytics.cumulativeFlowSubtitle}</p>
          <CumulativeFlowChart data={cumulativeFlow} dict={dict} />

          <h3 className="section-title analytics-subsection-title">{dict.analytics.estimateAccuracyTitle}</h3>
          <p className="section-sub">{dict.analytics.estimateAccuracySubtitle}</p>
          <EstimateAccuracyTable stats={estimateAccuracy} dict={dict} />
        </>
      )}
    </div>
  );
}
