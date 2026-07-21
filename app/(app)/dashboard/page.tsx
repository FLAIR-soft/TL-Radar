import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { STATUS_COLOR } from '@/lib/logic/tasks';
import { TaskCard } from './TaskCard';
import type { TaskPause, TaskStatus } from '@/lib/supabase/types';

const COLUMNS: TaskStatus[] = ['waiting', 'in_progress', 'paused'];

export default async function DashboardPage() {
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

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .neq('status', 'done')
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, name'),
  ]);

  const active = tasks ?? [];
  const assigneeNames = new Map((profiles ?? []).map((p) => [p.id, p.name]));

  let pauses: TaskPause[] = [];
  if (active.length) {
    const { data } = await supabase
      .from('task_pauses')
      .select('*')
      .in(
        'task_id',
        active.map((t) => t.id)
      );
    pauses = data ?? [];
  }
  const pausesByTask = new Map<string, TaskPause[]>();
  for (const p of pauses) {
    const list = pausesByTask.get(p.task_id) ?? [];
    list.push(p);
    pausesByTask.set(p.task_id, list);
  }

  return (
    <div className="page-fade">
      <h2 className="section-title">{dict.dashboard.title}</h2>
      <p className="section-sub">{dict.dashboard.subtitle}</p>
      <div className="kanban">
        {COLUMNS.map((s, colIndex) => {
          const items = active.filter((t) => t.status === s);
          return (
            <div className="kanban-col" key={s}>
              <div className="col-head">
                <span
                  className={`signal ${s === 'in_progress' ? 'pulsing' : ''}`}
                  style={{ background: STATUS_COLOR[s] }}
                ></span>
                {dict.status[s]} <span className="col-count">{items.length}</span>
              </div>
              <div className="card-stack">
                {items.length ? (
                  items.map((t, i) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      pauses={pausesByTask.get(t.id) ?? []}
                      assigneeName={t.assignee_id ? assigneeNames.get(t.assignee_id) ?? null : null}
                      style={{ animationDelay: `${(colIndex * 3 + i) * 40}ms` }}
                    />
                  ))
                ) : (
                  <div className="empty-note">{dict.dashboard.empty}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
