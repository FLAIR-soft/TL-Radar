import { createClient } from '@/lib/supabase/server';
import { fmtDateTime, fmtDuration, netDuration } from '@/lib/logic/tasks';
import type { TaskPause } from '@/lib/supabase/types';

export default async function ArchivePage() {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'done')
    .order('created_at', { ascending: false });

  const done = tasks ?? [];

  let pauses: TaskPause[] = [];
  if (done.length) {
    const { data } = await supabase
      .from('task_pauses')
      .select('*')
      .in(
        'task_id',
        done.map((t) => t.id)
      )
      .order('paused_at', { ascending: true });
    pauses = data ?? [];
  }

  const pausesByTask = new Map<string, TaskPause[]>();
  for (const p of pauses) {
    const list = pausesByTask.get(p.task_id) ?? [];
    list.push(p);
    pausesByTask.set(p.task_id, list);
  }

  if (!done.length) {
    return (
      <>
        <h2 className="section-title">Архив</h2>
        <p className="section-sub">Сюда попадают завершённые задачи.</p>
        <div className="empty-note">Архив пока пуст.</div>
      </>
    );
  }

  return (
    <>
      <h2 className="section-title">Архив</h2>
      <p className="section-sub">
        Завершённые задачи, отсортированы по времени внесения (новые сверху).
      </p>
      <div className="archive-scroll">
        <table className="archive-table">
          <thead>
            <tr>
              <th>Задача / человек</th>
              <th>Место</th>
              <th>Внесена</th>
              <th>Начата</th>
              <th>Завершена</th>
              <th>Паузы</th>
              <th>Чистое время</th>
            </tr>
          </thead>
          <tbody>
            {done.map((t) => {
              const taskPauses = pausesByTask.get(t.id) ?? [];
              const net = netDuration(t, taskPauses);
              return (
                <tr key={t.id}>
                  <td>
                    <strong>{t.title}</strong>
                    <br />
                    <span className="mono">{t.person}</span>
                  </td>
                  <td>{t.location || '—'}</td>
                  <td className="mono">{fmtDateTime(t.created_at)}</td>
                  <td className="mono">{fmtDateTime(t.started_at)}</td>
                  <td className="mono">{fmtDateTime(t.completed_at)}</td>
                  <td>
                    {taskPauses.length ? (
                      taskPauses.map((p) => (
                        <div className="pause-line" key={p.id}>
                          ⏸ {fmtDateTime(p.paused_at)} → ▶ {p.resumed_at ? fmtDateTime(p.resumed_at) : '—'}
                        </div>
                      ))
                    ) : (
                      <span className="mono">—</span>
                    )}
                  </td>
                  <td className="mono">{net !== null ? fmtDuration(net) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
