# HANDOFF — передача проекта в Cursor / Claude Code

Этот документ описывает всё, что нужно знать AI-ассистенту, чтобы продолжить разработку проекта после экспорта из Lovable. Скинь его первым сообщением в Cursor.

---

## 1. Стек и запуск

- **Frontend:** React 18, Vite 5, TypeScript 5, Tailwind CSS v3, shadcn/ui, React Query, React Router
- **Backend:** Supabase (Postgres + RLS, Auth, Storage, Edge Functions на Deno)
- **Файловое хранилище материалов:** AWS S3 (доступ через edge-функции с presigned URL)
- **Обложки продуктов:** Supabase Storage bucket `product-media`
- **Push:** Firebase Cloud Messaging (FCM)
- **Оплата:** Kaspi.kz (Казахстан) — ссылка/номер + ручное подтверждение автором. Никакого Stripe.

```bash
bun install
bun run dev      # http://localhost:8080
bun run build
```

`.env` уже содержит `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` — этого достаточно для локального фронта. Остальные секреты (AWS, FCM, service role) живут только на стороне Supabase Edge Functions.

---

## 2. Жёсткие правила для AI-ассистента

1. **Никогда** не редактируй `src/integrations/supabase/client.ts` и `src/integrations/supabase/types.ts` — они автогенерируются.
2. Импорт клиента только так: `import { supabase } from "@/integrations/supabase/client"`.
3. Изменения схемы БД — **только** через миграции в `supabase/migrations/*.sql`. Никаких изменений через дашборд руками.
4. Для **каждой** новой таблицы в схеме `public` порядок обязателен:
   1. `CREATE TABLE public.<name>(...)`
   2. `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<name> TO authenticated;` + `GRANT ALL ... TO service_role;` (и `anon` только если реально нужен публичный доступ)
   3. `ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;`
   4. `CREATE POLICY ...`
   Без GRANT'ов PostgREST вернёт permission denied — RLS одного мало.
5. Роли пользователей хранятся **только** в таблице `user_roles` и проверяются функцией `public.has_role(uuid, app_role)`. Не клади роли на `profiles`. Enum `app_role`: `student`, `teacher`, `creator`, `moderator`.
6. Всё время в UI — 24-часовой формат `HH:mm`. Таймзона расчётов — `Asia/Almaty`.
7. Одобренный статус покупки строго `completed` (не `confirmed`, не `approved`).
8. Изоляция данных:
   - Автор (creator) видит и управляет только своими продуктами (`products.owner_id = auth.uid()`).
   - Преподаватель (teacher) видит только продукты, к которым привязан через `product_teachers`.
   - Ученик (student) видит только свои покупки/бронирования/материалы, к которым получил доступ.
9. Терминология в UI: creator → «Автор», teacher → «Преподаватель», student → «Ученик».
10. Сложные формы (с фокусом внутри инпутов) держи как **inline JSX или standalone-функции**, не как вложенные React-компоненты внутри родителя — иначе теряется фокус на каждом рендере.
11. Никаких fake-JWT, service-role ключей и паролей БД в коде фронта. Service role доступен только в edge-функциях через `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`.

---

## 3. Структура БД (23 таблицы)

| Таблица | Назначение |
|---|---|
| `profiles` | Профиль пользователя (email, display_name, active_role). Создаётся триггером `handle_new_user` |
| `user_roles` | Роли (student/teacher/creator/moderator). Один пользователь может иметь несколько ролей |
| `products` | Продукты автора. `owner_id`, `is_paused`, `paused_message`, `kaspi_link`, `kaspi_phone`, `has_schedule`, `access_days` |
| `announcements` | Объявления на странице материалов продукта |
| `materials` | Материалы (файлы/ссылки/текст/папки). Поддерживает вложенность через `parent_id`, сортировку `order_index`, soft-delete `deleted_at` |
| `material_bookmarks` | Закладки пользователя на материалы |
| `material_unlocks` | Разблокированные материалы для конкретного ученика |
| `material_access_tokens` | Короткоживущие токены доступа к файлам S3 |
| `purchases` | Покупки. `status` ∈ pending/completed/rejected. `payment_intent_id` = номер операции Kaspi |
| `schedules` | Расписание продукта. `teacher_id` — привязка преподавателя |
| `time_slots` | Слоты в расписании (`date`, `start_time`, `end_time`, `max_participants`, `lesson_link`) |
| `bookings` | Записи учеников на слоты |
| `booking_reminders` | Очередь напоминаний (24h / 2h) — обрабатывается `send-reminders` |
| `booking_cancellations` | История отмен |
| `booking_reschedules` | Одобренные переносы |
| `reschedule_requests` | Запросы на перенос от учеников (pending/approved/rejected) |
| `product_teachers` | Привязка преподавателя к продукту |
| `school_teachers` | Список преподавателей в школе автора |
| `teacher_invites` | Приглашения преподавателей по email |
| `support_threads` / `support_messages` | Чат поддержки автор ↔ ученик |
| `push_tokens` | FCM-токены устройств пользователя |
| `notification_preferences` | Настройки уведомлений (email/push, за 24ч/2ч) |
| `app_settings` | Ключ-значение для параметров, читаемых из триггеров (например `supabase_anon_key`) |

### Ключевые SECURITY DEFINER функции

- `has_role(_user_id uuid, _role app_role) → boolean` — единственный правильный способ проверить роль в RLS
- `owns_product(_product_id uuid, _user_id uuid) → boolean`
- `is_product_teacher(_product_id uuid, _user_id uuid) → boolean`
- `handle_new_user()` — триггер на `auth.users`, создаёт profile + базовую роль. Особо: `chingizkhairulla@gmail.com` получает роли `creator` + `moderator` и наследует старые продукты (`creator_id = 'ielts'`)
- `prevent_purchase_fraud()` — блокирует ручной перевод в `completed` мимо service role
- `create_booking_reminders()` — при создании booking'а планирует 4 напоминания (24h/2h × ученик/автор + при наличии teacher)
- `notify_*` — триггеры, дёргающие edge-функции через `net.http_post` (нужен `app_settings.supabase_anon_key`)

---

## 4. Edge Functions (`supabase/functions/`)

| Функция | Что делает |
|---|---|
| `approve-purchase` | Автор подтверждает/отклоняет покупку. Меняет `purchases.status` под service role |
| `get-material-url` | Выдаёт presigned URL к S3-файлу материала после проверки доступа |
| `upload-material` | Приём файла материала → загрузка в S3 |
| `upload-product-media` | Загрузка обложки продукта в bucket `product-media` |
| `product-media-redirect` | Редирект с публичного URL на presigned для обложек |
| `create-material-token` / `unlock-materials` | Токены доступа и разблокировка для учеников |
| `s3-presign-upload`, `s3-upload`, `s3-download`, `s3-download-proxy`, `s3-redirect`, `storage-redirect`, `proxy-material` | S3-обвязка |
| `material-file-sizes` | Подсчёт весов файлов для будущего раздела «Хранилище» |
| `manage-announcements` | CRUD объявлений (используется где нужно service role) |
| `manage-push-token` | Регистрация/удаление FCM-токена |
| `send-push-notification` | Отправка одного пуша через FCM v1 API |
| `send-reminders` | **CRON** — раз в минуту разбирает `booking_reminders` и шлёт пуши |
| `notify-purchase-change`, `notify-booking-change`, `notify-reschedule`, `notify-reschedule-request`, `notify-reschedule-response` | Триггеры БД дёргают эти функции, чтобы разослать пуши/письма при событиях |
| `ogproduct` | Генерация OG-image / соцпревью страницы продукта |

---

## 5. Секреты (только имена, значения в Supabase)

Frontend (`.env`, публичные):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Edge Functions (Supabase secrets):
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY(S)`, `SUPABASE_SECRET_KEYS`, `SUPABASE_JWKS`, `SUPABASE_DB_URL`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_REGION` — S3 для материалов
- `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` — сервисный аккаунт Google для FCM v1
- `LOVABLE_API_KEY` — Lovable AI Gateway (Gemini/OpenAI без своего ключа), можно заменить на любой другой при переезде
- `CREATOR_PASSWORD_HASH`, `MODERATOR_PASSWORD` — legacy от старой кастомной авторизации, можно удалить после полной миграции на Supabase Auth

---

## 6. Что уже работает

- **Auth:** email+password (с генератором 8-символьного пароля), Google, Apple. Восстановление пароля по email
- **Продукты автора:** CRUD, обложка, Kaspi-настройки, пауза с кастомным сообщением, флаг расписания, доступ по дням, предпросмотр mobile/desktop
- **Покупки:** страница `/checkout/:productId` с копированием номера Kaspi и вводом номера операции, ручное подтверждение/отклонение автором
- **Материалы:** базовое CRUD, вложенность через `parent_id`, S3-загрузка/выдача, объявления в корне продукта
- **Расписание:** создание расписаний и слотов автором, запись/отмена учеником, `lesson_link` виден только записавшимся, преподаватель видит слоты и списки записавшихся своих продуктов (read-only)
- **Роли:** `student` по умолчанию, `creator` через одобрение (или email `chingizkhairulla@gmail.com`), `teacher` при добавлении в `product_teachers`, `moderator` вручную

---

## 7. Что НЕ доделано (TODO)

В порядке приоритета:

1. **Переносы занятий (UI):** таблицы `reschedule_requests`, `booking_reschedules` и edge-функции `notify-reschedule*` уже готовы. Нужно:
   - Кнопка «Перенести» у ученика в его booking → диалог с выбором нового слота → INSERT в `reschedule_requests`
   - Раздел «Запросы на перенос» у автора/преподавателя → approve/reject → перенос booking'а
2. **Расширенные материалы:**
   - Drag&drop переупорядочивание (order_index) с блокировкой смены порядка внутри одного parent в режимах newest/oldest — только перетаскивание в папку или в хлебные крошки
   - Контекстные меню (правая кнопка) — переименовать/скачать/удалить/добавить
   - iOS-style Switch для `material_bookmarks.is_public` (автор может показать свои закладки ученикам)
   - Корзина: soft-delete через `deleted_at`, автоочистка через 30 дней (cron), восстановление в исходную или новую папку
   - Раздел «Хранилище» с квотой 10 ГБ, списком файлов и весами (уже есть `material-file-sizes`)
   - Тип материала «Ссылка» (URL) отдельно от файла
3. **Push-уведомления:** инфраструктура готова (`push_tokens`, `send-push-notification`, `send-reminders` как cron, FCM secrets). Нужно:
   - Регистрация FCM-токена в PWA (запрос permission, получение токена, вызов `manage-push-token`)
   - UI настроек `notification_preferences` (email/push, за 24ч/2ч, приватность)
4. **Поддержка:** таблицы `support_threads` и `support_messages` есть — нужен чат-UI для ученика (создать тред) и автора (список тредов + переписка)
5. **Вкладки автора «Уведомления» и «Пользователи»:** сейчас частично в `Dashboard.tsx`. Нужен полноценный список заявок на покупку с approve/reject и список учеников продукта
6. **Роли ученик/автор ↔ переключение:** `profiles.active_role` уже есть — сделать переключатель в шапке

---

## 8. Первый промпт для Claude в Cursor

Скопируй в чат первым сообщением:

> Прочитай `HANDOFF.md` в корне проекта — там весь контекст: стек (React 18 + Vite + TS + Tailwind + shadcn/ui + Supabase), правила работы с БД (миграции + GRANT + RLS + `user_roles`), структура 23 таблиц, список edge-функций и TODO.
>
> Ключевые правила: не трогать автогенерируемые файлы `src/integrations/supabase/client.ts` и `types.ts`, роли только через `user_roles` + `has_role()`, оплата только Kaspi (одобренный статус `completed`), время в 24ч формате, таймзона `Asia/Almaty`.
>
> Начни с задачи №1 из раздела TODO — переносы занятий (UI). База и edge-функции для этого уже готовы, нужен только фронт.

---

## 9. Экспорт кода и данных

> Переезд на собственный проект Supabase описан отдельно — см. **[MIGRATE.md](./MIGRATE.md)**
> (создание проекта, `supabase db push`, секреты, деплой функций, переключение `.env`,
> и в самом конце — применение новых миграций).

**Код:**
- Через GitHub: в Lovable «+» → GitHub → Connect project → Create Repository, дальше `git clone` в Cursor
- Или на десктопе: Code Editor → внизу сайдбара «Download codebase» (нужен платный workspace)

**Данные:**
- Lovable → Cloud → Advanced settings → Export data

**Env для локального запуска:**
`.env` уже в репо. Для работы edge-функций локально понадобится `supabase login` + `supabase link --project-ref <ref>` + `supabase functions serve` (значения секретов надо будет продублировать в локальный `.env.local` для функций).

---

## 10. Полезные пути в репо

- `src/pages/` — страницы роутинга
- `src/components/` — UI-компоненты, включая `CreatorProductsTab`, `CreatorTeachersManager`, `AnnouncementsSection` и т.д.
- `src/hooks/` — все React Query хуки (`useProducts`, `usePurchases`, `useSchedule`, `useAnnouncements`, `useMaterialBookmarks` и др.)
- `src/contexts/AuthContext.tsx` — Supabase Auth обёртка
- `src/integrations/supabase/` — АВТОГЕН, не трогать
- `supabase/migrations/` — SQL миграции (единственный способ менять схему)
- `supabase/functions/` — Deno edge-функции
- `supabase/config.toml` — АВТОГЕН, не трогать

Успехов в переезде.