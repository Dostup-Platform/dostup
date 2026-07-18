# Handoff-документ для Cursor / Claude Code

Создам один файл `HANDOFF.md` в корне репозитория. Его достаточно скинуть Claude первым сообщением — он получит полную картину проекта.

## Что войдёт в HANDOFF.md

### 1. Стек и запуск
- React 18 + Vite 5 + TypeScript 5 + Tailwind v3 + shadcn/ui + React Query + React Router
- Бэкенд: Supabase (Postgres+RLS, Auth, Storage, Edge Functions на Deno)
- Хранилище файлов материалов: AWS S3 (через edge-функции с presigned URL), обложки продуктов: Supabase Storage bucket `product-media`
- Push: FCM (secrets: `FCM_*`)
- Команды: `bun install`, `bun run dev`, `bun run build`

### 2. Правила работы с кодом (для Claude)
- Никогда не редактировать `src/integrations/supabase/client.ts` и `types.ts` — автоген
- Импорт клиента: `import { supabase } from "@/integrations/supabase/client"`
- Схема БД меняется только миграциями в `supabase/migrations/`
- Для каждой новой таблицы в `public`: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`
- Роли хранятся ТОЛЬКО в `user_roles` + функция `has_role(uuid, app_role)`. Не класть роли на `profiles`
- Время в UI — 24ч (HH:mm), таймзона `Asia/Almaty`
- Оплата — только Kaspi (никакого Stripe). Одобренный статус покупки — `completed`
- Изоляция: creator видит только свои данные, teacher — только продукты, к которым привязан
- Тексты: creators — «Автор», teachers — «Преподаватель», students — «Ученик»
- Формы: сложные формы делать standalone-функциями/inline JSX (не вложенными компонентами) чтобы не терять фокус

### 3. Структура БД (23 таблицы)
Список с краткой ролью каждой:
- `profiles`, `user_roles`, `products`, `announcements`, `materials`, `material_bookmarks`, `material_unlocks`, `material_access_tokens`
- `purchases`, `schedules`, `time_slots`, `bookings`, `booking_reminders`, `booking_cancellations`, `booking_reschedules`, `reschedule_requests`
- `product_teachers`, `school_teachers`, `teacher_invites`
- `support_threads`, `support_messages`
- `push_tokens`, `notification_preferences`, `app_settings`

Ключевые SECURITY DEFINER функции: `has_role`, `owns_product`, `is_product_teacher`, `handle_new_user`, `prevent_purchase_fraud`, `create_booking_reminders`, `notify_*` (триггеры на edge-функции).

### 4. Edge Functions (список)
Перечислю имена из `supabase/functions/*` с назначением: `approve-purchase`, `get-material-url`, `upload-product-media`, `product-media-redirect`, `notify-*`, `send-push-notification`, `send-reminders` и т.д.

### 5. Секреты (не значения, только имена)
`AWS_*`, `FCM_*`, `SUPABASE_*`, `LOVABLE_API_KEY`, `CREATOR_PASSWORD_HASH`, `MODERATOR_PASSWORD` — с пометкой где какой используется.

### 6. Что уже работает
Auth (email+password, Google, Apple), продукты (CRUD, пауза, обложки), покупки (Kaspi flow, чекаут, подтверждение автором), материалы (базовое CRUD + S3), расписание (создание слотов, запись, отмена), объявления, роль преподавателя (read-only просмотр расписаний своих продуктов).

### 7. Что НЕ доделано (TODO для Claude)
- Переносы занятий: таблицы `reschedule_requests`, `booking_reschedules` есть, edge-функции уведомлений есть — нужен UI (кнопка «Перенести» у ученика, диалог подтверждения у автора/преподавателя)
- Расширенные материалы: папки с drag&drop, iOS-switch публичности закладок, корзина (soft-delete + автоочистка 30 дней), раздел «Хранилище» с квотой 10 ГБ, контекстные меню (правая кнопка)
- Push-уведомления: `push_tokens` + FCM secrets готовы, `send-reminders` работает через cron — нужна регистрация токена в PWA и UI настроек `notification_preferences`
- Поддержка: `support_threads`/`support_messages` — нужен чат-UI для ученика и автора
- Вкладки автора «Уведомления» (заявки на покупку/перенос) и «Пользователи» (список учеников с approve/reject) — сейчас частично в Dashboard

### 8. Первый промпт для Claude
Готовый абзац, который пользователь копирует в Cursor первым сообщением — со ссылкой на HANDOFF.md и списком приоритетов.

### 9. Экспорт данных
Инструкция: Lovable → Cloud → Advanced settings → Export data. GitHub sync через «+» → GitHub.

---

Только один новый файл, кода не трогаю. После апрува плана — создам `HANDOFF.md`.
