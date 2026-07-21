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

Решение по ролям (осознанное, не пересматривается без явного запроса):

- **editor** — единственная роль, назначаемая при самостоятельной регистрации.
  Все зарегистрированные пользователи могут создавать/редактировать/удалять
  задачи и менять их статус. Роль `viewer` не используется — это не баг и не
  недоделка, а сознательный выбор (см. миграцию `0006_remove_viewer_role.sql`).
- **admin** — не выбирается самостоятельно при регистрации. Назначается вручную
  через Supabase Dashboard → Table Editor (или SQL editor):
  ```sql
  update profiles set role = 'admin' where id = '<uuid пользователя>';
  ```
  UI для самоназначения `admin` сознательно не делается.

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
- `supabase/migrations/0008_audit_and_soft_delete.sql` — `tasks.updated_by`
  (кто последним менял задачу), `tasks.deleted_at` (мягкое удаление — строка
  не стирается физически, просто перестаёт показываться в дешборде/архиве),
  `task_pauses.created_by` (кто вручную поставил паузу; `null`, если пауза
  автоматическая, `auto = true`).

### Локальное тестирование миграций

Перед накаткой новой миграции на прод — проверить локально:

```bash
supabase start      # поднимает Postgres + Auth + PostgREST в Docker
supabase db reset   # прогоняет все миграции с нуля
```

Если Docker-раннер не поддерживает контейнер `edge_runtime` (например, в
песочнице с ограничениями на rlimits), временно отключить его в
`supabase/config.toml` (`[edge_runtime] enabled = false`) — это не мешает
проверке SQL-миграций и RLS. Не забыть вернуть `true` перед коммитом.

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
