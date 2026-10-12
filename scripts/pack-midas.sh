#!/usr/bin/env bash
# Упаковка TL-Organizer для midas.mifcom.dev.
# Запускать из корня репозитория в Git Bash:  bash scripts/pack-midas.sh
set -euo pipefail

OUT="${1:-../tl-organizer.tgz}"

# В образ попадают только публичные переменные. Строка подключения к базе
# приходит от MIDAS на рантайме (DATABASE_URL) — её сюда класть нельзя.
if [ -f .env.local ]; then
  grep -E '^NEXT_PUBLIC_(SUPABASE_URL|SUPABASE_ANON_KEY)=' .env.local > .env.production
  echo "В .env.production взято из .env.local:"
  sed -E 's/=(.{8}).*/=\1…/' .env.production
else
  # До этапа 3 страницы всё ещё импортируют клиент Supabase, и сборка падает
  # без этих переменных. Настоящие ключи для этого не нужны и в образ не
  # кладутся: на MIDAS эти страницы всё равно не работают (куки вырезаны).
  cat > .env.production <<'ENVEOF'
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key-not-a-real-credential
ENVEOF
  echo "ВНИМАНИЕ: .env.local нет — в образ идут заглушки вместо ключей Supabase."
  echo "Страницы приложения работать не будут, /api/health будет."
fi

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
