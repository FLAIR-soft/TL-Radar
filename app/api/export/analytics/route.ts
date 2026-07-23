import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { canViewStats } from '@/lib/logic/access';
import { availableWorkingMs, computePersonStats } from '@/lib/logic/analytics';
import { fmtDuration } from '@/lib/logic/tasks';
import { exportResponse, parseFormat } from '@/lib/export/respond';

const PERIOD_OPTIONS = [7, 30, 90] as const;

function parsePeriod(raw: string | null): (typeof PERIOD_OPTIONS)[number] {
  const n = Number(raw);
  return (PERIOD_OPTIONS as readonly number[]).includes(n) ? (n as (typeof PERIOD_OPTIONS)[number]) : 7;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role, locale').eq('id', user.id).single();
  if (!profile || !canViewStats(profile.role)) return new Response('Forbidden', { status: 403 });

  const dict = getDictionary(profile.locale ?? 'de');
  const { searchParams } = new URL(request.url);
  const format = parseFormat(searchParams);
  const days = parsePeriod(searchParams.get('days'));

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

  const header = [dict.analytics.colPerson, dict.analytics.colWorked, dict.analytics.colPercent];
  const rows = stats.map((s) => {
    const pct = availableMs > 0 ? Math.round((s.workedMs / availableMs) * 100) : 0;
    return [s.name, fmtDuration(s.workedMs, dict.duration), `${pct}%`];
  });

  return exportResponse([header, ...rows], format, 'analytics', dict.analytics.title);
}
