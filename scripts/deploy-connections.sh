#!/bin/bash
# Деплой подключений в Supabase проект pgbgenvyjxxgdztymakp
set -euo pipefail

PROJECT_REF="pgbgenvyjxxgdztymakp"

echo "=== 1. Проверка Supabase CLI ==="
if ! command -v supabase &>/dev/null; then
  echo "Установите: npm i -g supabase"
  exit 1
fi

echo "=== 2. Логин и привязка проекта ==="
supabase login
supabase link --project-ref "$PROJECT_REF"

echo "=== 3. Применение миграций ==="
supabase db push

echo "=== 4. Деплой edge-функций ==="
supabase functions deploy

echo "=== 5. Секреты (задайте вручную если ещё не заданы) ==="
echo "  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, AWS_S3_REGION"
echo "  FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY"
echo ""
echo "Пример:"
echo "  supabase secrets set AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_S3_BUCKET=... AWS_S3_REGION=eu-central-1"
echo "  supabase secrets set FCM_PROJECT_ID=... FCM_CLIENT_EMAIL=... FCM_PRIVATE_KEY='...'"

echo ""
echo "=== 6. Cron для напоминаний (SQL Editor) ==="
echo "  select cron.schedule('send-reminders', '* * * * *',"
echo "    \$\$ select net.http_post("
echo "         url := 'https://${PROJECT_REF}.supabase.co/functions/v1/send-reminders',"
echo "         headers := jsonb_build_object('Content-Type','application/json',"
echo "           'Authorization','Bearer <ANON_KEY>'),"
echo "         body := '{}'::jsonb) \$\$);"

echo ""
echo "Готово. Запустите фронт: npm install && npm run dev"
