#!/usr/bin/env bash
# Упаковка TL-Organizer для hostit.mifcom.dev (MIDAS).
# Запускать из корня репозитория в Git Bash:  bash scripts/pack-hostit.sh
set -euo pipefail

OUT="${1:-../tl-organizer-hostit.tgz}"

if [ ! -f .env.local ]; then
  echo "Нет .env.local — из него берутся NEXT_PUBLIC_* для сборки." >&2
  exit 1
fi

# В образ попадают только публичные переменные. Сервисный ключ не берём
# намеренно: hostit не умеет рантайм-переменные, ключ оказался бы в образе.
grep -E '^NEXT_PUBLIC_(SUPABASE_URL|SUPABASE_ANON_KEY)=' .env.local > .env.production
echo "В .env.production записано:"
sed -E 's/=(.{8}).*/=\1…/' .env.production

trap 'rm -f .env.production' EXIT

tar -czf "$OUT" \
  --exclude='./.git' \
  --exclude='./.github' \
  --exclude='./.claude' \
  --exclude='./node_modules' \
  --exclude='./.next' \
  --exclude='./e2e' \
  --exclude='./design' \
  --exclude='./playwright-report' \
  --exclude='./test-results' \
  --exclude='./.env.local' \
  .

echo "Архив: $OUT ($(du -h "$OUT" | cut -f1))"
