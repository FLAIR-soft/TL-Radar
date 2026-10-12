#!/usr/bin/env bash
# Упаковка TL-Organizer для midas.mifcom.dev.
# Запускать из корня репозитория в Git Bash:  bash scripts/pack-midas.sh
set -euo pipefail

OUT="${1:-../tl-organizer.tgz}"

if [ ! -f .env.local ]; then
  echo "Нет .env.local — из него берутся NEXT_PUBLIC_* для сборки образа." >&2
  exit 1
fi

# В образ попадают только публичные переменные. Строка подключения к базе
# приходит от MIDAS на рантайме (DATABASE_URL) — её сюда класть нельзя.
grep -E '^NEXT_PUBLIC_(SUPABASE_URL|SUPABASE_ANON_KEY)=' .env.local > .env.production
echo "В .env.production записано:"
sed -E 's/=(.{8}).*/=\1…/' .env.production

trap 'rm -f .env.production' EXIT

tar -czf "$OUT" \
  --exclude='./.git' --exclude='./.github' --exclude='./.claude' \
  --exclude='./node_modules' --exclude='./.next' \
  --exclude='./e2e' --exclude='./design' --exclude='./docs' \
  --exclude='./playwright-report' --exclude='./test-results' \
  --exclude='./.env.local' \
  .

echo "Архив: $OUT ($(du -h "$OUT" | cut -f1))"
echo "Проверь, что midas.json и Dockerfile лежат в корне архива:"
tar -tzf "$OUT" | grep -E '^\./(midas\.json|Dockerfile)$' || echo "  ВНИМАНИЕ: не найдены!"
