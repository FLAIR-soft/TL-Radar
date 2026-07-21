# TL-Radar — план переноса на Supabase + Next.js

Этот файл — техническое задание для Claude Code: схема БД, RLS-политики под роли
и Edge Function для автопаузы в 16:00 по Мюнхену. Логика статусов и полей 1:1
повторяет прототип-артефакт (`tl-radar.html`), но данные и автоматика теперь
живут на бэкенде, а не в браузере.

## 1. Роли и аутентификация

Через Supabase Auth (email + пароль или magic link). При регистрации пользователь
выбирает роль (viewer / editor) — сохраняется в отдельной таблице `profiles`,
привязанной к `auth.users`. Роль `admin` зарезервирована на будущее для
статистики по времени — сейчас не используется в UI.

## 2. Схема БД (`supabase/migrations/0001_init.sql`)

```sql
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
```

## 3. Edge Function автопаузы (`supabase/functions/auto-pause/index.ts`)

Часовой пояс Мюнхена (Europe/Berlin) переходит на летнее время дважды в год,
поэтому фиксированный UTC-cron уплывёт на час. Решение: функция запускается
часто (например, раз в 15 минут), сама вычисляет местное берлинское время и
защищена флагом `system_state`, чтобы сработать не более одного раза в день.

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!  // обходит RLS, только на сервере
)

Deno.serve(async () => {
  const berlinNow = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Europe/Berlin' })
  )
  const hour = berlinNow.getHours()
  const todayKey = berlinNow.toISOString().slice(0, 10)

  if (hour < 16) {
    return new Response('Ещё не 16:00 по Мюнхену', { status: 200 })
  }

  const { data: state } = await supabase
    .from('system_state')
    .select('value')
    .eq('key', 'last_auto_pause_date')
    .single()

  if (state?.value === todayKey) {
    return new Response('Уже выполнено сегодня', { status: 200 })
  }

  const nowIso = new Date().toISOString()

  const { data: activeTasks } = await supabase
    .from('tasks')
    .select('id')
    .eq('status', 'in_progress')

  for (const t of activeTasks ?? []) {
    await supabase.from('task_pauses').insert({
      task_id: t.id,
      paused_at: nowIso,
      auto: true
    })
    await supabase.from('tasks').update({ status: 'paused' }).eq('id', t.id)
  }

  await supabase
    .from('system_state')
    .update({ value: todayKey })
    .eq('key', 'last_auto_pause_date')

  return new Response(`Автопауза: ${activeTasks?.length ?? 0} задач`, { status: 200 })
})
```

**Планировщик:** в Supabase Dashboard → Edge Functions → Cron задать расписание
`*/15 * * * *` (каждые 15 минут). Сама функция решает, действовать ей или нет —
поэтому частый запуск безопасен и не создаёт дублей.

## 4. Что переносить из прототипа как есть

Из `tl-radar.html` без изменений переносится **логика переходов статусов**
(`waiting → in_progress → paused/done`, авто-простановка `started_at` /
`completed_at`, закрытие открытой паузы при переводе в `done`) и **расчёт
чистого времени** (`completed_at − started_at` минус сумма пауз) — она была
уже отлажена в прототипе, меняется только источник данных (Supabase вместо
`window.storage`).

## 5. Структура страниц в Next.js (предложение)

```
/app
  /login          — вход / регистрация (email + пароль, выбор роли при первой регистрации)
  /dashboard       — канбан (Ожидание / В процессе / Пауза), доступен всем
  /dashboard/new   — форма новой задачи, только editor (проверка роли из profiles)
  /archive         — таблица завершённых задач, доступен всем
```

Роль подтягивается на сервере (Server Component) через
`supabase.from('profiles').select('role').eq('id', user.id).single()` —
UI-элементы редактора рендерятся только если `role === 'editor'`.

## 6. Заделы на будущее (не сейчас)

- Роль `admin`: страница `/admin/stats` — суммарное время по дням за период
  (`SUM(completed_at - started_at - паузы)`, группировка по `date_trunc('day', ...)`).
  Время без активных задач считается как «время на монтаже» — эта логика
  добавится, когда админ-панель станет приоритетом.
- Отдельная политика RLS для `admin`, если понадобится ограничить доступ к
  агрегированной статистике.
