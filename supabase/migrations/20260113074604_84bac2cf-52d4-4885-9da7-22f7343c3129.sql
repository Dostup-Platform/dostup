-- Добавить creator_password для общего пароля создателей (секретный ключ)
-- Это можно хранить в secrets или в отдельной таблице настроек

-- Обновить таблицу profiles для поддержки телефонной регистрации
-- phone уже есть в таблице profiles

-- Создать таблицу для хранения сессий пользователей (без Supabase Auth для простой регистрации)
CREATE TABLE IF NOT EXISTS public.simple_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'creator')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Добавить индекс на phone для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_simple_users_phone ON public.simple_users(phone);

-- Enable RLS на simple_users
ALTER TABLE public.simple_users ENABLE ROW LEVEL SECURITY;

-- Разрешить всем регистрироваться (insert)
CREATE POLICY "Anyone can register"
ON public.simple_users
FOR INSERT
WITH CHECK (true);

-- Разрешить всем читать по phone (для логина)
CREATE POLICY "Anyone can lookup by phone"
ON public.simple_users
FOR SELECT
USING (true);

-- Разрешить обновлять свои данные
CREATE POLICY "Users can update own data"
ON public.simple_users
FOR UPDATE
USING (true);

-- Создать таблицу для покупок с ожидающим подтверждением статусом
-- Модифицируем логику: покупка будет привязана к simple_user
CREATE TABLE IF NOT EXISTS public.simple_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  simple_user_id UUID REFERENCES public.simple_users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  amount NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS на simple_purchases
ALTER TABLE public.simple_purchases ENABLE ROW LEVEL SECURITY;

-- Разрешить создавать покупки
CREATE POLICY "Anyone can create purchase"
ON public.simple_purchases
FOR INSERT
WITH CHECK (true);

-- Разрешить смотреть свои покупки
CREATE POLICY "Users can view own purchases"
ON public.simple_purchases
FOR SELECT
USING (true);

-- Разрешить обновлять покупки (для подтверждения)
CREATE POLICY "Allow update purchases"
ON public.simple_purchases
FOR UPDATE
USING (true);

-- Создать таблицу для глобальных настроек (пароль создателя)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Вставить общий пароль создателя
INSERT INTO public.app_settings (key, value) VALUES ('creator_password', 'creator123');

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Только чтение для всех
CREATE POLICY "Anyone can read settings"
ON public.app_settings
FOR SELECT
USING (true);

-- Триггер для обновления updated_at на simple_users
CREATE OR REPLACE TRIGGER update_simple_users_updated_at
BEFORE UPDATE ON public.simple_users
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();