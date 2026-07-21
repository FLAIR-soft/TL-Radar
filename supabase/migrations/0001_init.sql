create extension if not exists "pgcrypto";

create type user_role as enum ('viewer', 'editor', 'admin');
create type task_status as enum ('waiting', 'in_progress', 'paused', 'done');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role user_role not null default 'viewer',
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  person text not null,
  title text not null,
  description text default '',
  location text default '',
  deadline date,
  status task_status not null default 'waiting',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_by uuid references profiles(id)
);

-- Пауза хранится как отдельные строки, а не JSON-массив —
-- так проще потом считать статистику по времени (Ф2: админ-панель)
create table task_pauses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  paused_at timestamptz not null default now(),
  resumed_at timestamptz,
  auto boolean not null default false  -- true = поставлено системой в 16:00
);

-- Флаг для идемпотентности ежедневной автопаузы
create table system_state (
  key text primary key,
  value text
);
insert into system_state (key, value) values ('last_auto_pause_date', null);

alter table profiles enable row level security;
alter table tasks enable row level security;
alter table task_pauses enable row level security;

-- profiles: все авторизованные видят имена/роли; создать свою запись может только сам пользователь
create policy "profiles_select_all" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_insert_self" on profiles
  for insert with check (auth.uid() = id);

-- tasks: читать могут все авторизованные; писать — только editor/admin
create policy "tasks_select_all" on tasks
  for select using (auth.role() = 'authenticated');
create policy "tasks_write_editor" on tasks
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "tasks_update_editor" on tasks
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "tasks_delete_editor" on tasks
  for delete using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );

-- task_pauses: читать все, писать editor/admin (сервис-роль крона обходит RLS)
create policy "pauses_select_all" on task_pauses
  for select using (auth.role() = 'authenticated');
create policy "pauses_write_editor" on task_pauses
  for insert with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
create policy "pauses_update_editor" on task_pauses
  for update using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('editor','admin'))
  );
