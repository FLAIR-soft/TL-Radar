-- TL-Organizer, схема под чистый Postgres (MIDAS).
-- Собрана из 33 миграций Supabase, но не повторяет их: выброшено всё, что
-- относилось к механизмам, которых больше нет — auth.users, RLS и политики,
-- pg_cron, pg_net, публикация realtime, функции с auth.uid().
--
-- Главное отличие: пользователь — это почта из заголовка X-Auth-Request-Email
-- шлюза MIDAS, в нижнем регистре. Никаких uuid-профилей, паролей и ролей.

create type task_status as enum ('waiting', 'in_progress', 'paused', 'done');
create type task_priority as enum ('low', 'medium', 'high', 'urgent');

-- Люди. Заводятся сами при первом заходе (этап 4); строка без display_name —
-- человек, добавленный по почте заранее и ещё ни разу не заходивший.
create table people (
  email         text primary key check (email = lower(email) and email like '%@%'),
  display_name  text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz
);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  location    text,
  owner_email text references people(email) on delete set null,
  icon        text,
  color       text,
  priority    task_priority,
  created_at  timestamptz not null default now(),
  created_by  text references people(email) on delete set null,
  deleted_at  timestamptz
);

create table tasks (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text not null default '',
  location          text not null default '',
  -- Дедлайн неизменен: его нельзя подвинуть ни действием, ни прямым запросом.
  -- Запрет ставится триггером на этапе 6, колонка заводится здесь.
  deadline          date,
  -- Обязательное объяснение, если задача завершена позже дедлайна (этап 6).
  late_reason       text,
  status            task_status not null default 'waiting',
  priority          task_priority,
  icon              text,
  project_id        uuid references projects(id) on delete set null,
  estimated_minutes integer check (estimated_minutes is null or estimated_minutes > 0),
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  completed_at      timestamptz,
  created_by        text references people(email) on delete set null,
  updated_by        text references people(email) on delete set null,
  deleted_at        timestamptz
);

create index tasks_status_idx   on tasks (status) where deleted_at is null;
create index tasks_deadline_idx on tasks (deadline) where deleted_at is null;
create index tasks_project_idx  on tasks (project_id) where deleted_at is null;

-- Паузы. auto = true: системная пауза на 16:00, ставится задним числом
-- при первом обращении после отсечки (этап 8). В «общее время на паузе»
-- такие записи не суммируются.
create table task_pauses (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  paused_at  timestamptz not null default now(),
  resumed_at timestamptz,
  auto       boolean not null default false,
  created_by text references people(email) on delete set null
);

create index task_pauses_task_idx on task_pauses (task_id, paused_at);

-- Назначения. Исторические строки не удаляются: removed_at закрывает период,
-- на этом держится расчёт времени по людям в аналитике.
create table task_assignees (
  id             uuid primary key default gen_random_uuid(),
  task_id        uuid not null references tasks(id) on delete cascade,
  assignee_email text not null references people(email) on delete cascade,
  added_at       timestamptz not null default now(),
  added_by       text references people(email) on delete set null,
  removed_at     timestamptz,
  removed_by     text references people(email) on delete set null
);

create index task_assignees_task_idx     on task_assignees (task_id);
create index task_assignees_assignee_idx on task_assignees (assignee_email) where removed_at is null;

create table labels (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null,
  created_at timestamptz not null default now(),
  created_by text references people(email) on delete set null,
  deleted_at timestamptz
);

create table task_labels (
  task_id  uuid not null references tasks(id) on delete cascade,
  label_id uuid not null references labels(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by text references people(email) on delete set null,
  primary key (task_id, label_id)
);

create table task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  author     text references people(email) on delete set null,
  body       text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index task_comments_task_idx on task_comments (task_id, created_at);

create table task_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references tasks(id) on delete cascade,
  title      text not null,
  done       boolean not null default false,
  position   int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index task_checklist_items_task_idx on task_checklist_items (task_id, position);

create table task_watchers (
  task_id    uuid not null references tasks(id) on delete cascade,
  email      text not null references people(email) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, email)
);

create table task_templates (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  description       text,
  location          text,
  estimated_minutes int check (estimated_minutes is null or estimated_minutes > 0),
  priority          task_priority,
  icon              text,
  project_id        uuid references projects(id) on delete set null,
  checklist         text[],
  created_at        timestamptz not null default now(),
  created_by        text references people(email) on delete set null,
  deleted_at        timestamptz
);

create table recurring_rules (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references task_templates(id) on delete cascade,
  frequency    text not null check (frequency in ('daily', 'weekly', 'monthly')),
  weekday      int check (weekday between 1 and 5),
  day_of_month int check (day_of_month between 1 and 31),
  next_run_at  date not null,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  created_by   text references people(email) on delete set null,
  deleted_at   timestamptz
);

create table saved_views (
  id         uuid primary key default gen_random_uuid(),
  email      text not null references people(email) on delete cascade,
  name       text not null,
  filters    jsonb not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index saved_views_email_idx on saved_views (email) where deleted_at is null;

create table activity_log (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('task', 'project')),
  entity_id   uuid not null,
  event_type  text not null check (event_type in (
                'created', 'updated', 'status_changed', 'deleted',
                'assignee_added', 'assignee_removed',
                'comment_added', 'checklist_item_added')),
  actor       text references people(email) on delete set null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index activity_log_entity_idx on activity_log (entity_type, entity_id, created_at);

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  recipient_email text not null references people(email) on delete cascade,
  type            text not null check (type in ('assigned', 'unassigned', 'deadline_soon', 'comment', 'mention')),
  task_id         uuid references tasks(id) on delete cascade,
  payload         jsonb,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_email, read_at, created_at);

-- Колонки «Erledigt» в канбане нет: завершённые задачи уезжают в архив.
-- Четвёртый лимит был настройкой-обманкой и в новой схеме не заводится.
create table wip_limits (
  status      text primary key check (status in ('waiting', 'in_progress', 'paused')),
  limit_count integer check (limit_count is null or limit_count > 0)
);

insert into wip_limits (status, limit_count) values
  ('waiting', null), ('in_progress', null), ('paused', null);

-- Служебные отметки: «правила повторения отработали за такой-то день»,
-- «автопауза проставлена до такого-то момента» (этап 8).
create table system_state (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);
