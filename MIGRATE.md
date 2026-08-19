# Подключение сервисов (старая версия, simple auth)

Проект: **mebomnqdtuqmjjefvgkx** (см. `.env` и `supabase/config.toml`).  
Вход: ученики по имени (`simple_users` + `simple_user_sessions`), авторы по логину (`creator_accounts` + `creator_sessions`). Браузер держит только anon-ключ; записи идут через edge-функции.

## Что нужно

- Аккаунт supabase.com с доступом к проекту
- Supabase CLI: `npm i -g supabase`
- Ключи AWS S3 и Firebase (FCM)

## Шаги

### 1. Применить миграции

```bash
chmod +x scripts/deploy-connections.sh
./scripts/deploy-connections.sh
```

Или вручную:

```bash
supabase login
supabase link --project-ref mebomnqdtuqmjjefvgkx
supabase db push
supabase functions deploy
```

### 2. Секреты edge-функций

В Supabase → Project Settings → Edge Functions → Secrets:

| Секрет | Назначение |
|---|---|
| `AWS_ACCESS_KEY_ID` | S3 для материалов |
| `AWS_SECRET_ACCESS_KEY` | S3 |
| `AWS_S3_BUCKET` | Имя бакета |
| `AWS_S3_REGION` | Регион |
| `FCM_PROJECT_ID` | Firebase push |
| `FCM_CLIENT_EMAIL` | Firebase |
| `FCM_PRIVATE_KEY` | Firebase |

### 3. Storage

Создать приватные бакеты:
- `product-media` — обложки продуктов
- `materials` — если используется Supabase Storage (основные файлы в S3)

### 4. Cron напоминаний

В SQL Editor:

```sql
SELECT cron.schedule(
  'send-reminders',
  '* * * * *',
  $$ SELECT net.http_post(
       url := 'https://mebomnqdtuqmjjefvgkx.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object(
         'Content-Type','application/json',
         'Authorization','Bearer <ANON_KEY>'
       ),
       body := '{}'::jsonb
     ) $$
);
```

### 5. Фронтенд

```bash
cp .env.example .env   # заполнить ключи
npm install
npm run dev            # http://localhost:8080
```

## Что НЕ переносить из новой версии

- Google/Apple OAuth (конфликт с simple auth)
- Миграции `20260718*` (удаляют simple_* таблицы)
- Функции с JWT-авторизацией вместо creator_token/simple_user_id

## Проверка

- [ ] Регистрация и вход автора
- [ ] Вход ученика по имени
- [ ] Покупка → подтверждение → пуш «Оплата подтверждена»
- [ ] Запись на занятие → напоминание за 24ч/2ч
- [ ] Загрузка и открытие материала (S3)
- [ ] Обложка продукта (Storage)
