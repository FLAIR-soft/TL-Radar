import { createClient } from '@/lib/supabase/server';
import { STATUS } from '@/lib/logic/tasks';
import { TaskCard } from './TaskCard';
import type { TaskStatus } from '@/lib/supabase/types';

const COLUMNS: TaskStatus[] = ['waiting', 'in_progress', 'paused'];

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single();

  const editable = profile?.role === 'editor' || profile?.role === 'admin';

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .neq('status', 'done')
    .order('created_at', { ascending: true });

  const active = tasks ?? [];

  return (
    <>
      <h2 className="section-title">Дешборд</h2>
      <p className="section-sub">Активные задачи по статусам, в реальном времени.</p>
      <div className="kanban">
        {COLUMNS.map((s) => {
          const items = active.filter((t) => t.status === s);
          return (
            <div className="kanban-col" key={s}>
              <div className="col-head">
                <span
                  className={`signal ${s === 'in_progress' ? 'pulsing' : ''}`}
                  style={{ background: STATUS[s].color }}
                ></span>
                {STATUS[s].label} <span className="col-count">{items.length}</span>
              </div>
              <div className="card-stack">
                {items.length ? (
                  items.map((t) => <TaskCard key={t.id} task={t} editable={editable} />)
                ) : (
                  <div className="empty-note">Пусто.</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
