import { createClient } from '@/lib/supabase/server';
import { getDictionary } from '@/lib/i18n/get-dictionary';
import { STATUS_COLOR } from '@/lib/logic/tasks';
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
    .select('locale')
    .eq('id', user!.id)
    .single();

  const dict = getDictionary(profile?.locale ?? 'de');

  const [{ data: tasks }, { data: profiles }] = await Promise.all([
    supabase.from('tasks').select('*').neq('status', 'done').order('created_at', { ascending: true }),
    supabase.from('profiles').select('id, name'),
  ]);

  const active = tasks ?? [];
  const assigneeNames = new Map((profiles ?? []).map((p) => [p.id, p.name]));

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
