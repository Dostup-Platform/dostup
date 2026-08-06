# Сравнение подключений: старая vs новая версия

## Версии

| | Старая (основная) | Новая (GitHub main) |
|---|---|---|
| Путь | `dostup-a2e5d88d-main` | `chingizkhairulla/dostup` |
| Supabase | `pgbgenvyjxxgdztymakp` | `okbuktaggaspnqpzmbyn` |
| Файлов в src | 158 | 115 |
| Вход | `simple_users` + `creator_accounts` | Supabase Auth (`auth.users`) |

## Подключения

| Сервис | Старая | Новая | Действие |
|---|---|---|---|
| Supabase DB/Auth | Свой проект Lovable | Свой проект после миграции | Оставить старый проект |
| AWS S3 (материалы) | Есть (функции + lib) | Есть | Секреты в Supabase |
| Firebase Push | Есть (hardcoded config) | Есть (через .env) | Оставить старый код, добавить .env.example |
| Supabase Storage (обложки) | Есть | Есть | Бакет `product-media` |
| Google/Apple OAuth | Нет (не нужен) | Есть | **Не переносить** — конфликт с simple auth |
| Cron напоминаний | Триггер на `simple_bookings` | Триггер на `bookings` | Оставить `simple_bookings` |

## Edge Functions

**Только в старой (оставляем):** `register-creator`, `verify-creator-password`, `validate-creator-session`, `change-creator-password`, `create-signup-token`, `verify-signup-token`, `moderator-api`, `verify-moderator-password`, `support-api`

**Общие (34):** S3, push, notify, materials, ogproduct и др.

**Исправления из новой (перенесены):**
- `call_edge_function` — настраиваемый URL вместо хардкода
- `create_booking_reminders` — снова учитывает `notification_preferences`
- `notify-purchase-change` — статус `completed` вместо `confirmed`
- GRANT UPDATE на `simple_purchases`

**Не переносили (ломают simple auth):**
- Миграции `20260718*` (удаляют simple_* таблицы)
- `manage-push-token` с JWT-авторизацией
- `get-material-url` с Supabase Auth

## Миграции

Новые миграции из GitHub **не копируются целиком** — они для auth.users.
Добавлена одна адаптированная: `20260806170000_connections_from_new_version.sql`
