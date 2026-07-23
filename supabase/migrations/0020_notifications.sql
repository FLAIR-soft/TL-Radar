-- In-app уведомления (Этап 5A роадмапа): назначение/снятие исполнителя,
-- новый комментарий, скорый дедлайн. task_id без FK — полиморфная ссылка,
-- как activity_log.entity_id, журнал должен переживать любые изменения
-- в tasks без риска сломать запись уведомления.
create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('assigned', 'unassigned', 'deadline_soon', 'comment')),
  task_id uuid not null,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_id, read_at, created_at);

alter table notifications enable row level security;

-- Видит и помечает прочитанным только получатель; пишут (включая cron
-- через service role, который RLS не проходит) — editor/admin, как везде.
create policy "notifications_select_own" on notifications
  for select using (recipient_id = auth.uid());
create policy "notifications_update_own" on notifications
  for update using (recipient_id = auth.uid());
create policy "notifications_insert_editor" on notifications
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
