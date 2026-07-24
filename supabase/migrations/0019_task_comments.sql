-- Комментарии к задачам (Этап 4 роадмапа доработок).
create table task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  author_id uuid references profiles(id) on delete set null,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index task_comments_task_idx on task_comments (task_id, created_at);

alter table task_comments enable row level security;

-- Читать могут все авторизованные; писать — только editor/admin (как tasks).
create policy "task_comments_select_all" on task_comments
  for select using (auth.role() = 'authenticated');
create policy "task_comments_insert_editor" on task_comments
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
-- Мягкое удаление (update deleted_at): автор — свой комментарий, admin — любой.
create policy "task_comments_update_own_or_admin" on task_comments
  for update using (
    author_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- comment_added в activity_log.event_type: 0017 менять нельзя, поэтому
-- пересоздаём check-constraint здесь (один шаг — одна миграция).
alter table activity_log drop constraint activity_log_event_type_check;
alter table activity_log add constraint activity_log_event_type_check
  check (event_type in (
    'created', 'updated', 'status_changed', 'deleted', 'assignee_added', 'assignee_removed', 'comment_added'
  ));
