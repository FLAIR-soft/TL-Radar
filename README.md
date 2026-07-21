# TL-Radar

Дешборд отслеживания задач тим лида. Next.js (App Router, TypeScript) + Supabase + Vercel.

Контекст и бизнес-логика описаны в двух файлах в корне репозитория:

- [`tl-radar.html`](./tl-radar.html) — исходный прототип с полной бизнес-логикой
  (переходы статусов, расчёт чистого времени выполнения, поля задачи).
- [`tl-radar-backend-plan.md`](./tl-radar-backend-plan.md) — план переноса на
  Supabase: SQL-миграция, Edge Function автопаузы, структура страниц.

## Стек

- Next.js 16 (App Router, TypeScript, Server Actions)
- Supabase (Postgres + Auth + RLS + Edge Functions + pg_cron)
- Vercel (хостинг)

## Роли

- **viewer** (зритель) — видит дешборд и архив.
- **editor** (редактор) — дополнительно создаёт/редактирует/удаляет задачи и
  меняет их статус.
- **admin** — зарезервирована на будущее (статистика по времени), в UI не
  используется.

Роль выбирается один раз при регистрации (email + пароль) и хранится в
таблице `profiles`.

## Локальная разработка

```bash
npm install
cp .env.example .env.local   # заполнить NEXT_PUBLIC_SUPABASE_URL / ANON_KEY
npm run dev
```

## Supabase

- `supabase/migrations/0001_init.sql` — таблицы `profiles`, `tasks`,
  `task_pauses`, `system_state` + RLS-политики по ролям.
- `supabase/migrations/0002_auto_pause_cron.sql` — расписание `pg_cron`
  (каждые 15 минут дёргает Edge Function `auto-pause` через `pg_net`).
  Ключ сервисной роли для авторизации вызова хранится в Supabase Vault
  под именем `tl_radar_service_role_key` (заводится отдельно, не в
  миграции — секреты в git не хранятся).
- `supabase/functions/auto-pause/index.ts` — в 16:00 по Мюнхену (с учётом
  перехода на летнее время) переводит все задачи в статусе «в процессе»
  в статус «пауза». Идемпотентна (флаг в `system_state`), поэтому её можно
  дёргать сколь угодно часто.

Применить миграции к своему проекту:

```bash
supabase link --project-ref <ref>
supabase db push
```

Задеплоить функцию:

```bash
supabase functions deploy auto-pause --no-verify-jwt=false
```

## Бизнес-логика (перенесена из прототипа как есть)

- `waiting → in_progress`: проставляется `started_at` (один раз).
- `in_progress → paused`: открывается запись в `task_pauses`
  (`paused_at`, `resumed_at = null`).
- `paused → in_progress`: закрывается открытая пауза (`resumed_at = now`).
- `→ done`: закрывается открытая пауза (если была), проставляется
  `completed_at`.
- Чистое время выполнения в архиве: `completed_at − started_at` минус
  сумма длительностей пауз.

См. `lib/logic/tasks.ts`.
