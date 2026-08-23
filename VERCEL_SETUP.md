# Деплой на Vercel

## Быстрый старт

1. Зайти на [vercel.com](https://vercel.com) → **Add New Project**
2. Импортировать репозиторий **chingizkhairulla/dostup** (ветка `main`)
3. Framework: **Vite** (определится автоматически из `vercel.json`)
4. Добавить **Environment Variables**:

```
VITE_SUPABASE_PROJECT_ID=mebomnqdtuqmjjefvgkx
VITE_SUPABASE_URL=https://mebomnqdtuqmjjefvgkx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key из Supabase Dashboard → Settings → API>
SUPABASE_URL=https://mebomnqdtuqmjjefvgkx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key — только для serverless / middleware, не в браузер>
```

`SUPABASE_SERVICE_ROLE_KEY` нужен для Vercel middleware (редирект UUID→slug) и OG-превью на `/p/*`.

5. Нажать **Deploy**

## Supabase проект

- **Название:** Dostup Simple Auth
- **Project ref:** `mebomnqdtuqmjjefvgkx`
- **Dashboard:** https://supabase.com/dashboard/project/mebomnqdtuqmjjefvgkx

## После деплоя

В Supabase → **Authentication → URL Configuration**:
- Site URL: ваш URL Vercel (например `https://dostup-xxx.vercel.app`)

## Cron напоминаний (вручную)

В Supabase SQL Editor выполнить (подставить anon key):

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
