import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { canViewStats } from '@/lib/logic/access';
import { availableWorkingMs, computePersonStats } from '@/lib/logic/analytics';
import { AnalyticsChart } from './AnalyticsChart';

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, locale')
    .eq('id', user.id)
    .single();
  if (!profile || !canViewStats(profile.role)) redirect('/dashboard');

  const dict = getDictionary(profile.locale ?? 'de');

  const rangeEnd = new Date();
  const rangeStart = new Date(rangeEnd.getTime() - days * 24 * 3600 * 1000);

  const [{ data: profiles }, { data: tasks }] = await Promise.all([
    supabase.from('profiles').select('id, name').order('name'),
    supabase.from('tasks').select('*').is('deleted_at', null).not('started_at', 'is', null),
  ]);

  const activeTasks = tasks ?? [];
  const taskIds = activeTasks.map((t) => t.id);

  const [{ data: pauses }, { data: assignees }] = taskIds.length
    ? await Promise.all([
        supabase.from('task_pauses').select('*').in('task_id', taskIds),
        supabase.from('task_assignees').select('*').in('task_id', taskIds),
      ])
    : [{ data: [] }, { data: [] }];

  const stats = computePersonStats({
    profiles: profiles ?? [],
    tasks: activeTasks,
    pauses: pauses ?? [],
    assignees: assignees ?? [],
    rangeStart,
    rangeEnd,
  });

  const availableMs = availableWorkingMs(rangeStart, rangeEnd);

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
      </div>
      {(profiles ?? []).length === 0 ? (
        <div className="empty-note">{dict.analytics.empty}</div>
      ) : (
        <AnalyticsChart stats={stats} availableMs={availableMs} />
      )}
    </div>
  );
}
