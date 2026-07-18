
# Миграция на Supabase Auth

Полный переход с кастомной авторизации (`simple_users` + `creator_accounts` + `creator_sessions` + PBKDF2) на встроенный Supabase Auth с email/паролем, Google и Apple. Единый аккаунт на пользователя с возможностью иметь несколько ролей одновременно (покупатель / автор / учитель в N школах / администратор школы / модератор) и переключаться между ними.

По просьбе — удаляем всех существующих пользователей, **кроме `ielts` и `ieltsmock`** (эти два аккаунта переносим в `auth.users` вручную с известными email, они смогут войти по email + сброс пароля).

## Этап 1. Схема БД и роли

**Новые/изменённые таблицы:**

- `app_role` enum: `student`, `creator`, `school_admin`, `teacher`, `moderator`.
- `public.user_roles(user_id, role, unique(user_id, role))` — универсальная роль-таблица (по гайду, без FK в auth.users как значений, только через RLS).
- `public.school_teachers(school_user_id, teacher_user_id, invited_at, accepted_at)` — связь «школа ↔ учитель», один учитель может быть в нескольких школах.
- `public.teacher_invites(id, school_user_id, email, token, expires_at, accepted_at)` — приглашения по email.
- `public.profiles` расширяется: `display_name`, `login` (опциональный публичный ник, уникальный), `active_role` (какая роль сейчас выбрана в UI).
- Функция `public.has_role(_user_id, _role)` — SECURITY DEFINER, для RLS без рекурсии.
- Триггер `handle_new_user`: создаёт `profiles`, назначает роль `student` по умолчанию.

**Что удаляется полностью:**

- `simple_users`, `simple_purchases`, `simple_bookings` (данные), `creator_accounts`, `creator_sessions`, `moderator_sessions`, `signup_tokens`.
- Все ссылки на `simple_user_id` в `bookings`, `purchases`, `material_bookmarks`, `notification_preferences`, `push_tokens`, `support_threads`, `booking_reminders`, `announcements`, `material_unlocks` заменяются на `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE`.
- `products.creator_id` (сейчас `text`) → `creator_id UUID` → `auth.users(id)`.
- `creator_name` в `creator_sessions` и аналогичные текстовые ссылки убираются.

**Что переносится вручную для `ielts` и `ieltsmock`:**

- В `auth.users` через service role создаются два пользователя с известными email (спросим отдельно, какие email использовать).
- Их `products`, `materials`, `schedules`, `announcements` перевешиваются на новые `user_id`.
- Роль `creator` назначается обоим.
- При первом входе — сброс пароля через письмо на почту.

## Этап 2. RLS-политики

Все таблицы получают чистые политики через `auth.uid()`:

- `bookings`, `purchases`, `material_bookmarks`, `notification_preferences`, `push_tokens` — читает/пишет только владелец.
- `products`, `schedules`, `materials`, `announcements` — создатель редактирует, публично читать могут все (карточки продукта); приватные материалы — только по `material_unlocks`.
- `support_threads` / `support_messages` — только участники + модератор.
- `user_roles` — читает только сам пользователь + модератор; писать — только через SECURITY DEFINER функции (`grant_role`, `revoke_role`).
- `product_teachers` / `school_teachers` — управляет только school_admin, читает связанный teacher.
- Публичный `anon` доступ убирается везде, где сейчас утечка PII (bookings, purchases, support).
- Каждый `CREATE TABLE` в новой миграции сопровождается блоком `GRANT` под нужные роли.

## Этап 3. Auth-конфиг

- `supabase--configure_auth`: `auto_confirm_email: false`, `password_hibp_enabled: true`, `disable_signup: false`, `external_anonymous_users_enabled: false`.
- `supabase--configure_social_auth`: enable `google`, `apple` (managed OAuth, БЕЗ отключения email — оба нужны).
- Настройка redirect URL: `window.location.origin/auth/callback`.
- Email-шаблоны (сброс пароля, подтверждение, приглашение учителя) — сделаем на этапе полировки, не в первой итерации. Пока используются дефолтные Lovable-шаблоны.

## Этап 4. Клиентский код

**Контексты:**

- Удаляются: `SimpleAuthContext`.
- Переписывается: `AuthContext` — добавляет `roles: AppRole[]`, `activeRole: AppRole`, `switchRole(role)`, `signUpWithEmail`, `signInWithEmail`, `signInWithGoogle`, `signInWithApple`, `resetPassword`.
- Новый хук `useUserRoles()` для загрузки ролей из `user_roles`.

**Страницы:**

- `AuthPage` полностью переделывается: вход по email/паролю + кнопки Google/Apple + «Забыли пароль?».
- Новый `SignUpPage`: email + автосгенерированный 8-символьный пароль (кнопка «сохранить» / «показать» / «сгенерировать заново») + возможность ввести свой + Google/Apple.
- Новый `ResetPasswordPage` (`/reset-password`) — обрабатывает `type=recovery` из URL и вызывает `supabase.auth.updateUser({ password })`.
- Новый `AcceptInvitePage` (`/invite/:token`) — принятие приглашения учителя.
- `Dashboard` / `CreatorDashboard` / `TeacherDashboard` / `SchoolDashboard` / `ModeratorDashboard` теперь выбираются по `activeRole`, а не по URL.
- Компонент `RoleSwitcher` в шапке — выпадающий список доступных ролей текущего пользователя.
- Удаляются: `CreatorLoginForm`, `CreatorRegisterForm`, `RoleSelection` (в старом виде), `SetupPasswordPage`.

**Хуки и утилиты:**

- `useSimplePurchases` → `usePurchases` (переиспользуем существующий, чистим от `simple_user_id`).
- Все места, где сейчас читается `localStorage.getItem('simple_user_id')` / `creator_token` / `moderator_token`, заменяются на `session.user.id` из Supabase Auth.

## Этап 5. Edge Functions

**Удаляются:**

- `verify-creator-password`, `validate-creator-session`, `register-creator`, `change-creator-password`, `verify-moderator-password`, `create-signup-token`, `verify-signup-token`.

**Переписываются под JWT (проверка `Authorization: Bearer` + `supabase.auth.getUser()`):**

- `approve-purchase`, `unlock-materials`, `manage-push-token`, `manage-announcements`, `upload-material`, `get-material-url`, `proxy-material`, `create-material-token`, `s3-upload`, `s3-download`, `s3-presign-upload`, `upload-product-media`, `material-file-sizes`, `send-reminders`, `notify-*`, `support-api`, `moderator-api`.
- `verify_jwt = true` для всех функций, кроме `ogproduct` (публичный OG) и `product-media-redirect`.
- Роль проверяется через `has_role(user.id, 'creator')` внутри функции.

## Этап 6. Учителя (приглашения)

1. Школа-администратор в `SchoolDashboard → Учителя` вводит email учителя.
2. Edge function `invite-teacher`:
   - Если `auth.users` с этим email существует → создаётся запись в `school_teachers` (`accepted_at = null`), учителю уходит письмо со ссылкой `/invite/:token`.
   - Если нет → создаётся `teacher_invites`, отправляется приглашение через встроенный `supabase.auth.admin.inviteUserByEmail` с redirect на `/invite/:token`.
3. На `/invite/:token` учитель либо логинится (если аккаунт есть), либо задаёт пароль (или Google/Apple), после чего:
   - Добавляется роль `teacher` в `user_roles`.
   - `school_teachers.accepted_at` = now().
   - `active_role` переключается на `teacher`.

## Этап 7. Порядок выполнения (итерации)

Слишком большой рефакторинг для одного захода. Разбиваю на PR-ы:

1. **Миграция БД** (схема + удаление старых пользователей + перенос ielts/ieltsmock) — отдельная миграция, требует твоего email-подтверждения для двух аккаунтов.
2. **Supabase Auth конфиг** (email + Google + Apple).
3. **Новый `AuthContext`, страницы входа/регистрации/reset-password, `RoleSwitcher`**.
4. **Переписывание клиентских хуков и дашбордов** на `auth.uid()`.
5. **Edge functions** — партиями по 3-4 штуки.
6. **Приглашения учителей** (`invite-teacher` + `AcceptInvitePage`).
7. **Кастомные email-шаблоны** (сброс пароля, приглашения) — по желанию.

## Что мне нужно от тебя перед стартом

1. **Email-адреса для `ielts` и `ieltsmock`** — на какие письма привязать эти два creator-аккаунта. Именно на них уйдёт письмо для сброса пароля при первом входе после миграции.
2. **Подтверждение**: удаляем ВСЕХ остальных пользователей (учеников, других авторов, модераторов, учителей, все их покупки/бронирования/закладки/уведомления). Это необратимо.
3. **Роль модератора** — оставляем как отдельную роль в `user_roles`? Кому назначить (твой email)?

## Технические детали

- **Автогенерация пароля**: `crypto.getRandomValues` → base32-like 8 символов (без похожих `0/O`, `1/l/I`), с кнопкой «показать/скопировать» и «сгенерировать заново».
- **HIBP включаем** — блокирует известные утёкшие пароли, стандарт безопасности.
- **Redirect URI для OAuth**: `${window.location.origin}/auth/callback`, интент возврата хранится в `sessionStorage`.
- **Восстановление пароля**: `resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`, обработка `type=recovery` в hash на странице `/reset-password`.
- **Мультироль в UI**: `activeRole` хранится в `profiles.active_role`, при загрузке приложения роутинг на дашборд идёт по нему; `RoleSwitcher` показывает все доступные роли из `user_roles`.
- **RLS-функции** для проверки роли: `has_role(_user_id, _role)`, `is_school_teacher(_school_id, _teacher_id)`, `owns_product(_product_id, _user_id)` — все SECURITY DEFINER, `search_path = public`.

Если план ок — на следующем сообщении ответь на 3 вопроса выше, начну с миграции БД.
