# Переключение на новый Supabase (okbuktaggaspnqpzmbyn)

Здесь, в Lovable, нужны только три маленькие правки в файлах. Всё остальное (создание таблиц, импорт данных, ключи, вход через Google/Apple) делается уже в Cursor через терминал — это не тратит кредиты Lovable.

## Что поменяю в коде

1. `.env` — адрес и ключ нового проекта:
   - `VITE_SUPABASE_PROJECT_ID="okbuktaggaspnqpzmbyn"`
   - `VITE_SUPABASE_URL="https://okbuktaggaspnqpzmbyn.supabase.co"`
   - `VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_XtBCL2yRCZC1PSYU901Slw_JmoR1pVd"`
2. `supabase/config.toml` — первая строка: `project_id = "okbuktaggaspnqpzmbyn"`.
3. `supabase/manual/01-rebind-project-ref.sql` — подставлю новый адрес и ключ вместо заглушек `<NEW_PROJECT_REF>` / `<NEW_ANON_KEY>`, чтобы файл можно было просто выполнить в SQL-редакторе.

Важно: превью в Lovable после этого будет смотреть на пустой новый проект, пока туда не залиты таблицы и данные. Это нормально.

## Когда переходить в Cursor

Сразу после этих правок. Дальше по `MIGRATE.md` всё делается локально:

```text
supabase login
supabase link --project-ref okbuktaggaspnqpzmbyn
supabase db push          # создать таблицы (шаг 3)
# выполнить supabase/manual/01-rebind-project-ref.sql (шаг 4)
# импорт данных (шаг 5), бакеты product-media и materials (шаг 6)
# секреты AWS/FCM (шаг 7)
supabase functions deploy # шаг 8
# Google/Apple и URL-адреса в панели Supabase (шаг 9)
# новые миграции от Cursor — в самом конце (шаг 11)
```

Кредиты Lovable на эти шаги не тратятся.

## Заметка

Ключ вида `sb_publishable_...` — новый формат публичного ключа Supabase. Он поддерживается текущей версией `@supabase/supabase-js` в проекте; если при первом запуске появится ошибка авторизации, в панели нового проекта есть и старый `anon`-ключ (JWT) — им можно заменить значение в `.env`.
