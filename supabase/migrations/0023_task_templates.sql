-- Шаблоны задач (Этап 7 роадмапа доработок): создаются только из
-- существующей задачи («сохранить как шаблон»), сам шаблон менять
-- потом нельзя — только список + мягкое удаление (см. roadmap).
create table task_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  estimated_minutes int check (estimated_minutes > 0),
  priority text check (priority in ('low', 'medium', 'high', 'urgent')),
  icon text,
  project_id uuid references projects(id),
  checklist jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table task_templates enable row level security;

-- Стандартный паттерн: читать могут все авторизованные; писать
-- (включая мягкое удаление) — только editor/admin.
create policy "task_templates_select_all" on task_templates
  for select using (auth.role() = 'authenticated');
create policy "task_templates_insert_editor" on task_templates
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "task_templates_update_editor" on task_templates
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
