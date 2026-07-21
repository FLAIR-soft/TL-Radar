-- Множественные исполнители (Этап 4): tasks.assignee_id заменяется
-- таблицей-связкой. Время засчитывается исполнителю только с момента
-- add_at (не задним числом) — это учитывается в аналитике (Этап 6),
-- здесь только хранение самой связи.
create table task_assignees (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  assignee_id uuid not null references profiles(id),
  added_at timestamptz not null default now(),
  added_by uuid references profiles(id),
  removed_at timestamptz,
  removed_by uuid references profiles(id)
);

-- Перенос существующих одиночных исполнителей. added_at = created_at
-- задачи — в старой модели исполнитель считался назначенным с момента
-- создания. added_by неизвестен (в старой модели не отслеживался),
-- оставляем null.
insert into task_assignees (task_id, assignee_id, added_at)
select id, assignee_id, created_at from tasks where assignee_id is not null;

alter table tasks drop column assignee_id;

alter table task_assignees enable row level security;

create policy "task_assignees_select_all" on task_assignees
  for select using (auth.role() = 'authenticated');
create policy "task_assignees_insert_editor" on task_assignees
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "task_assignees_update_editor" on task_assignees
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
