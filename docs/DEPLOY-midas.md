# Деплой на MIDAS (midas.mifcom.dev)

MIDAS — внутренняя платформа MIFCOM. Один проект = один поддомен
`<имя>.midas.mifcom.dev`. Приложение загружается архивом `.tar.gz`; если в
корне архива есть `Dockerfile`, собирается образ и запускается контейнер.

Контракт платформы: `https://midas.mifcom.dev/llms.txt`.

## Решения по этому проекту

| Что | Значение |
| --- | --- |
| Имя проекта | `tl-organizer` → `https://tl-organizer.midas.mifcom.dev` |
| Видимость | `unlisted` — видят все, кто вошёл под учёткой MIFCOM и знает адрес; в каталоге дашборда не показывается |
| База | включена (`"database": true` в `midas.json`) |
| Владелец | берётся из API-токена, отдельным полем не передаётся |

Имя и владение привязываются при первом деплое и потом не меняются.
Видимость меняется на дашборде.

## Что уже подготовлено

| Файл | Зачем |
| --- | --- |
| `Dockerfile` | Next.js в standalone, `node:22-alpine`, непривилегированный пользователь, порт 3000 на `0.0.0.0` |
| `midas.json` | `type: docker`, `port: 3000`, `database: true` |
| `.dockerignore` | не тащит в образ `.git`, `node_modules`, `e2e`, `design` |
| `next.config.ts` | `output: "standalone"` |
| `scripts/pack-midas.sh` | собирает архив, кладёт `.env.production` только с публичными переменными, проверяет что `midas.json` и `Dockerfile` в корне |

## Порядок выкатки

Токен — на `https://midas.mifcom.dev/account` (один активный на пользователя,
протухает после 30 дней без использования). **В репозиторий его не класть.**

Всё из Git Bash, из корня репозитория:

```bash
npm ci
npm run build
npm run lint
bash scripts/pack-midas.sh          # → ../tl-organizer.tgz
```

Проверить имя:

```bash
curl -fsS -H "Authorization: Bearer $MIDAS_TOKEN" \
  https://midas.mifcom.dev/api/v1/projects/tl-organizer
```

Первый деплой. `curl.exe` из Git for Windows не понимает unix-пути —
путь конвертируется через `cygpath`:

```bash
WINPATH=$(cygpath -w ../tl-organizer.tgz)
curl -fsS -X POST https://midas.mifcom.dev/api/v1/deploy \
  -H "Authorization: Bearer $MIDAS_TOKEN" \
  -F "name=tl-organizer" \
  -F "tarball=@$WINPATH" \
  -F "visibility=unlisted" \
  -F "description=Internal task and time dashboard for the MIFCOM PC assembly team: who is working on what, where, and how long it actually took."
```

Первая сборка идёт минуту-две — ответ приходит, когда приложение уже живо.
Повторные деплои: то же самое без `visibility` и `description`.

## Что платформа даёт приложению

**Личность пользователя.** Все проекты стоят за Microsoft Entra SSO. Шлюз
добавляет в каждый запрос, дошедший до приложения:

- `X-Auth-Request-Email` — почта в нижнем регистре, **это и есть идентификатор**;
- `X-Auth-Request-User`, `-Preferred-Username`, `-Display-Name`.

Своего логина быть не должно: неаутентифицированный посетитель до приложения
не доходит.

**База.** На рантайме в контейнер приходят `DATABASE_URL` и `PGHOST`/`PGPORT`/
`PGUSER`/`PGPASSWORD`/`PGDATABASE`. Сертификат самоподписанный: подключаться с
выключенной проверкой (`ssl: { rejectUnauthorized: false }` для `pg`,
`sslmode=require` для libpq — **никогда `verify-full`**). База переживает
передеплои и удаляется только вместе с проектом.

**Справочник сотрудников.** `GET /api/v1/directory` — все пользователи MIFCOM
с почтой, именем и `erp_user_id`. Из браузера: обычный GET с
`credentials: "include"` и **без единого своего заголовка**, иначе preflight
упрётся в редирект на логин.

**Почта.** `POST /api/v1/mail`, только адреса MIFCOM, без своих SMTP-ключей.

## Чего платформа не даёт — и что из-за этого ломается

**Куки вырезаются в обе стороны.** Шлюз снимает `Cookie` с входящих запросов
и `Set-Cookie` с ответов. Ломается:

- сессия Supabase Auth — вход зациклится;
- выбор языка (`lib/i18n/cookie.ts`);
- выбор темы (`lib/theme/cookie.ts`).

Язык и тему переносить в `localStorage` или в базу по ключу
`X-Auth-Request-Email`. CSRF на куках тоже не работает — вместо него шлюз сам
отбивает межсайтовые POST.

**Нет планировщика.** В контракте MIDAS нет cron. Сейчас на pg_cron и Edge
Functions Supabase висят: автопауза в 16:00, правила повторяющихся задач,
уведомления о дедлайне. На MIDAS их исполнять нечем — нужно либо считать
состояние на лету при чтении, либо дёргать приложение извне.

**Приложение нельзя встроить в iframe** чужого проекта, межсайтовые
POST/WebSocket отбиваются с 403.
