import { Pause, Play } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { fmtDateTime, fmtDuration, netDuration } from '@/lib/logic/tasks';
import type { TaskPause } from '@/lib/supabase/types';

export default async function ArchivePage() {
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
    supabase.from('profiles').select('id, name'),
    supabase.from('projects').select('id, name'),
  ]);

  const done = tasks ?? [];
  const profileNames = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const projectNames = new Map((projects ?? []).map((p) => [p.id, p.name]));

  let pauses: TaskPause[] = [];
  const assigneeNamesByTask = new Map<string, string[]>();
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
      const list = assigneeNamesByTask.get(a.task_id) ?? [];
      const name = profileNames.get(a.assignee_id);
      if (name) list.push(name);
      assigneeNamesByTask.set(a.task_id, list);
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
        <p className="section-sub">{dict.archive.emptyTitle}</p>
        <div className="empty-note">{dict.archive.empty}</div>
      </div>
    );
  }

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.archive.title}</h2>
      <p className="section-sub">{dict.archive.subtitle}</p>
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
            </tr>
          </thead>
          <tbody>
            {done.map((t, i) => {
              const taskPauses = pausesByTask.get(t.id) ?? [];
              const net = netDuration(t, taskPauses);
              return (
                <tr key={t.id} className="archive-row" style={{ animationDelay: `${i * 30}ms` }}>
                  <td>
                    <strong>{t.title}</strong>
                    {(assigneeNamesByTask.get(t.id) ?? []).length > 0 && (
                      <>
                        <br />
                        <span className="mono">{(assigneeNamesByTask.get(t.id) ?? []).join(', ')}</span>
                      </>
                    )}
                  </td>
                  <td>{t.project_id ? projectNames.get(t.project_id) ?? '—' : '—'}</td>
                  <td>{t.location || '—'}</td>
                  <td className="mono">{fmtDateTime(t.created_at, dict.intlLocale)}</td>
                  <td className="mono">{fmtDateTime(t.started_at, dict.intlLocale)}</td>
                  <td className="mono">{fmtDateTime(t.completed_at, dict.intlLocale)}</td>
                  <td>
                    {taskPauses.length ? (
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
                    )}
                  </td>
                  <td className="mono">{net !== null ? fmtDuration(net, dict.duration) : '—'}</td>
                  <td className="mono">
                    {t.estimated_minutes
                      ? `${net !== null ? fmtDuration(net, dict.duration) : '—'} / ${fmtDuration(
                          t.estimated_minutes * 60000,
                          dict.duration
                        )}`
                      : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
