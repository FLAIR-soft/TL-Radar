-- Сохранённые представления дашборда (Этап 10 бэклога): именованный набор
-- фильтров + режим отображения (канбан/таблица), привязанный к query string
-- дашборда целиком (см. lib/logic/task-filters.ts) — при выборе представления
-- просто переходим на /dashboard?<сохранённая строка>, без пересборки
-- отдельных параметров.
--
-- В отличие от остальных таблиц в проекте это личные настройки конкретного
-- пользователя, а не общая для команды сущность — поэтому RLS здесь другой
-- паттерн: видеть/писать может только владелец (user_id = auth.uid()), без
-- обычного "select all authenticated" + editor/admin insert/update.
create table saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  filters jsonb not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table saved_views enable row level security;

create policy "saved_views_select_own" on saved_views
  for select using (user_id = auth.uid());
create policy "saved_views_insert_own" on saved_views
  for insert with check (user_id = auth.uid());
create policy "saved_views_update_own" on saved_views
  for update using (user_id = auth.uid());
