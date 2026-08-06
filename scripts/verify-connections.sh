#!/bin/bash
# Локальная проверка подключений (без доступа к Supabase)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0

check() {
  if eval "$2" &>/dev/null; then
    echo "  OK  $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $1"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Проверка файлов подключений ==="
check "Миграция подключений" "test -f supabase/migrations/20260806170000_connections_from_new_version.sql"
check "Rebind SQL" "test -f supabase/manual/01-rebind-project-ref.sql"
check "Инструкция MIGRATE.md" "test -f MIGRATE.md"
check "Аудит CONNECTIONS_AUDIT.md" "test -f CONNECTIONS_AUDIT.md"
check "Deploy скрипт" "test -x scripts/deploy-connections.sh"
check ".env.example" "test -f .env.example"
check "Firebase lib" "test -f src/lib/firebase.ts"
check "S3 helpers" "test -f src/lib/s3Helpers.ts"
check "manage-push-token" "test -f supabase/functions/manage-push-token/index.ts"
check "send-reminders" "test -f supabase/functions/send-reminders/index.ts"
check "register-creator (simple auth)" "test -f supabase/functions/register-creator/index.ts"

echo ""
echo "=== Проверка исправлений ==="
check "notify-purchase: completed" "grep -q 'record.status === \"completed\"' supabase/functions/notify-purchase-change/index.ts"
check "send-reminders: simple_user_id" "grep -q 'simple_user_id' supabase/functions/send-reminders/index.ts"
check "manage-push-token: creator_sessions" "grep -q 'creator_sessions' supabase/functions/manage-push-token/index.ts"
check "create_booking_reminders: notification_preferences" "grep -q 'notification_preferences' supabase/migrations/20260806170000_connections_from_new_version.sql"
check "Триггер на simple_bookings" "grep -q 'ON public.simple_bookings' supabase/migrations/20260806170000_connections_from_new_version.sql"

echo ""
echo "=== Сборка фронтенда ==="
if bun run build &>/dev/null; then
  echo "  OK  bun run build"
  PASS=$((PASS + 1))
else
  echo "  FAIL bun run build"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=== Итог: $PASS OK, $FAIL FAIL ==="

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Есть ошибки. Исправьте перед деплоем."
  exit 1
fi

echo ""
echo "Локальные проверки пройдены."
echo ""
echo "Дальше вручную (нужен Supabase CLI):"
echo "  1. ./scripts/deploy-connections.sh"
echo "  2. Проверить вход автора и ученика"
echo "  3. Проверить покупку и пуш-уведомление"
echo "  4. Проверить запись на занятие и напоминание"
