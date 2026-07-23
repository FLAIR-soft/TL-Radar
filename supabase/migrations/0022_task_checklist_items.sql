-- Чек-листы в задачах (Этап 6 роадмапа доработок).
create table task_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id),
  title text not null,
  done boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index task_checklist_items_task_idx on task_checklist_items (task_id, position);

alter table task_checklist_items enable row level security;

-- Стандартный паттерн: читать могут все авторизованные; писать (включая
-- отметку done и мягкое удаление через update deleted_at) — editor/admin.
-- В отличие от комментариев, у пункта чек-листа нет понятия «автора» —
-- любой editor/admin может отметить/удалить любой пункт.
create policy "task_checklist_items_select_all" on task_checklist_items
  for select using (auth.role() = 'authenticated');
create policy "task_checklist_items_insert_editor" on task_checklist_items
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "task_checklist_items_update_editor" on task_checklist_items
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );

-- checklist_item_added в activity_log.event_type: 0017/0019 менять нельзя,
-- поэтому пересоздаём check-constraint здесь (один шаг — одна миграция).
-- Отметка done и удаление пункта в лог не пишутся — слишком частое и
-- малозначимое событие для журнала задачи (как паузы/резюме не пишутся
-- отдельно от status_changed).
alter table activity_log drop constraint activity_log_event_type_check;
alter table activity_log add constraint activity_log_event_type_check
  check (event_type in (
    'created', 'updated', 'status_changed', 'deleted', 'assignee_added', 'assignee_removed',
    'comment_added', 'checklist_item_added'
  ));
