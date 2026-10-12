# Деплой на MIDAS (hostit.mifcom.dev)

Платформа принимает `.tar.gz` с проектом. Если внутри есть `Dockerfile` —
собирает образ и запускает контейнер; имя проекта становится поддоменом
`<name>.hostit.mifcom.dev`.

## Что уже подготовлено в репозитории

| Файл | Зачем |
| --- | --- |
| `Dockerfile` | Трёхстадийная сборка Next.js в standalone, финальный образ на `node:22-alpine`, запуск от непривилегированного пользователя |
| `hostit.json` | Явно задаёт тип `docker` и порт `3000` |
| `.dockerignore` | Не тащит в образ `.git`, `node_modules`, `e2e`, `design` |
| `next.config.ts` | `output: "standalone"` — без него образ пришлось бы собирать со всем `node_modules` |
| `scripts/pack-hostit.sh` | Собирает архив и кладёт в него `.env.production` только с публичными переменными |
| `.env.production.example` | Образец; реальный `.env.production` в git не хранится |

## Порядок выкатки

Всё из Git Bash, из корня репозитория.

```bash
npm ci
npm run build          # должен пройти с output: "standalone"
npm run lint

bash scripts/pack-hostit.sh
# → ../tl-organizer-hostit.tgz
```

Проверить, свободно ли имя:

```bash
curl -s https://hostit.mifcom.dev/api/v1/projects/tl-organizer
```

`{"exists": false}` — первая выкатка:

```bash
curl -X POST "https://hostit.mifcom.dev/api/v1/deploy" \
  -F "name=tl-organizer" \
  -F "creator=Roman Holovachov" \
  -F "description=Internal task and time dashboard for the MIFCOM PC assembly team" \
  -F "tarball=@../tl-organizer-hostit.tgz"
```

Ответ содержит `password`. **Он показывается один раз, восстановления нет** —
сразу в менеджер паролей. Повторные выкатки:

```bash
curl -X POST "https://hostit.mifcom.dev/api/v1/deploy" \
  -H "Authorization: Bearer <password>" \
  -F "name=tl-organizer" \
  -F "tarball=@../tl-organizer-hostit.tgz"
```

Лимиты: 100 МБ архив, 500 МБ в распакованном виде, 20 000 файлов.

## Ограничения платформы, которые меняют архитектуру

Проверено по описанию API hostit. Три вещи, которых там нет:

**1. Переменных окружения на рантайме нет.** В `deploy` передаются только имя,
автор, описание и архив. Всё, что нужно приложению, попадает внутрь образа на
сборке. Отсюда следствие: `SUPABASE_SERVICE_ROLE_KEY` использовать нельзя — он
дал бы полный обход RLS и лежал бы прямо в образе. Значит сброс паролей и
удаление пользователей в `/admin` на MIDAS не работают. При переходе на SSO это
и не нужно — страница `/admin` сокращается до WIP-лимитов.

**2. Базы данных платформа не предоставляет.** Это хостинг приложения, не СУБД,
и постоянного тома в API тоже нет. Решение «база тоже внутрь MIFCOM» на одном
hostit не реализуется: нужен отдельный Postgres внутри периметра и кто-то, кто
его админит. До этого момента приложение продолжает ходить в Supabase.

**3. Про аутентификацию в описании платформы нет ничего.** Поддомен описан как
публичный. Пока не подтверждено, что MIDAS закрывает приложение собой и
передаёт пользователя, **логин убирать нельзя** — иначе данные команды окажутся
доступны любому, кто знает адрес.

## Перед первой выкаткой

- `npm run build` и `npm run lint` зелёные;
- в `.env.production` попали только `NEXT_PUBLIC_*` (скрипт печатает, что записал);
- адрес Supabase в архиве — тот, который нужен; на боевой базе ничего не ломается;
- после выкатки открыть приложение и проверить вход, борд, архив и аналитику.
