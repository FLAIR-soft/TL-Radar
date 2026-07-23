import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { fmtDateTime, fmtDuration, netDuration, completedLateBy } from '@/lib/logic/tasks';
import {
  parseTaskFilters,
  hasActiveFilters,
  matchesTaskFilters,
  searchParamsRecordFromURL,
} from '@/lib/logic/task-filters';
import { exportResponse, parseFormat } from '@/lib/export/respond';
import type { TaskPause } from '@/lib/supabase/types';

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { searchParams } = new URL(request.url);
  const format = parseFormat(searchParams);
  const filters = parseTaskFilters(searchParamsRecordFromURL(searchParams));

  const { data: profile } = await supabase.from('profiles').select('locale').eq('id', user.id).single();
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
  const profileNames = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const projectNames = new Map((projects ?? []).map((p) => [p.id, p.name]));

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
        ),
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

  const filteredDone = hasActiveFilters(filters)
    ? done.filter((t) => matchesTaskFilters(t, assigneeIdsByTask.get(t.id) ?? [], filters))
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
    dict.table.colAssignees,
  ];

  const rows = filteredDone.map((t) => {
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

  return exportResponse([header, ...rows], format, 'archive', dict.archive.title);
}
