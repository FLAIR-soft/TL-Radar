-- Проекты — опциональная группировка задач (Этап 3).
create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id),
  deleted_at timestamptz
);

alter table tasks add column project_id uuid references projects(id);

alter table projects enable row level security;

-- projects: читать могут все авторизованные; писать (включая мягкое
-- удаление через update deleted_at) — только editor/admin, как и tasks.
create policy "projects_select_all" on projects
  for select using (auth.role() = 'authenticated');
create policy "projects_insert_editor" on projects
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "projects_update_editor" on projects
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
