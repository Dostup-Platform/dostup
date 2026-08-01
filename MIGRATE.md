# Переезд на собственный Supabase

Пошаговая инструкция: как перевести проект «Доступ» с текущего бэкенда на свой проект Supabase.
Делать удобнее уже в Cursor, локально.

---

## 0. Что понадобится

- Аккаунт на supabase.com
- Supabase CLI: `npm i -g supabase` (или `brew install supabase/tap/supabase`)
- Ключи AWS S3 и Firebase (FCM) — те же, что использовались раньше

---

## 1. Создать новый проект

1. supabase.com → New project.
2. Регион — Frankfurt (`eu-central-1`) или Singapore, они ближе всего к Казахстану.
3. Придумать и **сохранить пароль базы** — второй раз его не покажут.
4. Записать из Project Settings → API:
   - **Project URL** — `https://<ref>.supabase.co`
   - **Project ref (ID)** — `<ref>`
   - **anon / publishable key** — публичный, его можно держать в `.env`
   - **service_role key** — секретный, только для edge-функций

---

## 2. Выгрузить данные со старого бэкенда

В Lovable: **Cloud → Advanced settings → Export data**. Дождаться готовности и скачать архив.

Отдельно выгрузить обложки продуктов из бакета `product-media` (они не входят в экспорт базы).

---

## 3. Применить схему базы

```bash
supabase login
supabase link --project-ref <NEW_PROJECT_REF>
supabase db push
```

`supabase db push` применит по порядку все файлы из `supabase/migrations/` — это все таблицы,
типы (`app_role`, `event_type`, `material_type`), функции и правила доступа (RLS).

Перед этим включить расширение `pg_net` (нужно для триггеров `notify_*`):

```sql
create extension if not exists pg_net with schema extensions;
```

---

## 4. Заменить адрес старого проекта

Функции `notify_*` содержали адрес старого проекта прямо в коде.
Открыть `supabase/manual/01-rebind-project-ref.sql`, подставить в первых строках
`<NEW_PROJECT_REF>` и `<NEW_ANON_KEY>`, и выполнить файл в SQL Editor нового проекта.

После этого адрес берётся из таблицы `app_settings` — при следующем переезде править код не придётся.

---

## 5. Залить данные

Импортировать выгруженные таблицы (порядок важен из-за связей):

```
profiles → user_roles → products → announcements → materials → schedules →
time_slots → purchases → bookings → остальные
```

**Про пользователей:** записи из `auth.users` обычным экспортом не переносятся.
Варианты:
- попросить пользователей войти заново через «Забыли пароль»;
- либо перенести `auth.users` отдельно через прямое подключение к базе (нужен пароль БД обоих проектов).

---

## 6. Хранилище

1. Создать приватный бакет `product-media` (Storage → New bucket, Public = off).
2. Создать приватный бакет `materials`.
3. Залить туда выгруженные обложки продуктов.

Файлы материалов лежат в **AWS S3** — они никуда не переезжают, достаточно перенести ключи (шаг 7).

---

## 7. Секреты edge-функций

Задать в новом проекте (Project Settings → Edge Functions → Secrets, либо `supabase secrets set`):

| Секрет | Откуда |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS IAM |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM |
| `AWS_S3_BUCKET` | название бакета |
| `AWS_S3_REGION` | регион бакета |
| `FCM_PROJECT_ID` | Firebase → сервисный аккаунт |
| `FCM_CLIENT_EMAIL` | Firebase → сервисный аккаунт |
| `FCM_PRIVATE_KEY` | Firebase → сервисный аккаунт |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`
Supabase подставляет сам — вручную задавать не нужно.

`LOVABLE_API_KEY` нужен, только если останутся вызовы Lovable AI. Сейчас их в функциях нет.

`CREATOR_PASSWORD_HASH` и `MODERATOR_PASSWORD` — остатки старой авторизации, переносить не нужно.

---

## 8. Выложить edge-функции

```bash
supabase functions deploy
```

Развернутся все 26 функций из `supabase/functions/`.
Настройки `verify_jwt` берутся из `supabase/config.toml` — там же надо поменять первую строку:

```toml
project_id = "<NEW_PROJECT_REF>"
```

Функцию `send-reminders` нужно поставить на расписание (раз в минуту) через
Database → Cron (`pg_cron` + `pg_net`) или внешний планировщик:

```sql
select cron.schedule(
  'send-reminders',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://<NEW_PROJECT_REF>.supabase.co/functions/v1/send-reminders',
       headers := jsonb_build_object('Content-Type','application/json',
                                     'Authorization','Bearer <NEW_ANON_KEY>'),
       body := '{}'::jsonb
     ) $$
);
```

---

## 9. Авторизация

Authentication → Providers:

- **Email** — включён, «Confirm email» оставить включённым.
- **Google** — включить, вставить Client ID и Client Secret из Google Cloud Console.
- **Apple** — включить, вставить Services ID и ключ из Apple Developer.

Authentication → URL Configuration:

- Site URL: адрес сайта (например `https://dostup.kz`)
- Redirect URLs: тот же адрес + `http://localhost:8080`

В Google Cloud и Apple Developer добавить новый callback:
`https://<NEW_PROJECT_REF>.supabase.co/auth/v1/callback`

Шаблоны писем (подтверждение, восстановление пароля) — Authentication → Email Templates.

---

## 10. Переключить фронтенд

В файле `.env` заменить три значения:

```
VITE_SUPABASE_PROJECT_ID="<NEW_PROJECT_REF>"
VITE_SUPABASE_URL="https://<NEW_PROJECT_REF>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="<NEW_ANON_KEY>"
```

Больше нигде в коде адрес проекта не прописан — всё берётся отсюда.

Затем:

```bash
npm install
npm run dev     # http://localhost:8080
```

---

## 11. Новые миграции от Cursor (переносы занятий)

Применять **в самом конце**, когда схема и данные уже на месте.

1. Положить новые `.sql` файлы в `supabase/migrations/`.
2. Имя должно быть по времени **позже** всех существующих, формат `2026MMDDHHMMSS_описание.sql`
   (сейчас последняя миграция — от марта 2026, так что бери текущую дату).
3. Проверить, что для каждой новой таблицы в файле есть блок в правильном порядке:
   `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL SECURITY` → `CREATE POLICY`.
4. Применить:

```bash
supabase db push
```

Если накатить их **до** импорта данных, экспорт может не совпасть со структурой таблиц — поэтому только после.

---

## 12. Проверка

- [ ] Вход по email работает, письмо восстановления приходит
- [ ] Вход через Google и Apple работает
- [ ] Список продуктов открывается
- [ ] Обложка продукта загружается и отображается
- [ ] Материал открывается и скачивается (S3)
- [ ] Расписание: слот создаётся, ученик записывается
- [ ] Покупка создаётся со статусом `pending`, автор подтверждает → `completed`
- [ ] Пуш-уведомление приходит
