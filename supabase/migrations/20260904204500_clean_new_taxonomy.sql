-- Очистка старых категорий и подкатегорий, установка новой структуры Dostup

BEGIN;

-- Временный сдвиг старых подкатегорий
UPDATE public.subcategories SET slug = 'old_' || id::text, sort_order = sort_order + 5000;

-- 1. Создание новых подкатегорий
INSERT INTO public.subcategories (id, category_id, slug, name_ru, name_kk, sort_order)
VALUES
  -- Онлайн-уроки
  ('c1000000-0000-0000-0000-000000000001'::uuid, '09653df8-e6e8-4aae-8ac7-11c3e0eadee1'::uuid, 'individual', 'Индивидуально', 'Жеке', 1),
  ('c1000000-0000-0000-0000-000000000002'::uuid, '09653df8-e6e8-4aae-8ac7-11c3e0eadee1'::uuid, 'group', 'Групповые занятия', 'Топтық сабақтар', 2),

  -- Материалы
  ('c2000000-0000-0000-0000-000000000001'::uuid, 'b61a33a3-003b-4909-8951-5540d7867f56'::uuid, 'video-courses', '🎥 Видеокурсы', '🎥 Бейнекурстар', 1),
  ('c2000000-0000-0000-0000-000000000002'::uuid, 'b61a33a3-003b-4909-8951-5540d7867f56'::uuid, 'ebooks', '📚 Электронные книги', '📚 Электронды кітаптар', 2),
  ('c2000000-0000-0000-0000-000000000003'::uuid, 'b61a33a3-003b-4909-8951-5540d7867f56'::uuid, 'files', '📁 Файлы', '📁 Файлдар', 3),

  -- Подписки
  ('c3000000-0000-0000-0000-000000000001'::uuid, '6f871e1e-f090-47de-8a64-246d2c394a20'::uuid, 'online', '🌐 Онлайн', '🌐 Онлайн', 1),
  ('c3000000-0000-0000-0000-000000000002'::uuid, '6f871e1e-f090-47de-8a64-246d2c394a20'::uuid, 'offline', '📍 Офлайн', '📍 Офлайн', 2),

  -- Мероприятия
  ('c4000000-0000-0000-0000-000000000001'::uuid, 'a9e499e9-8428-4e09-96cf-1e1caecf5734'::uuid, 'online', '🌐 Онлайн', '🌐 Онлайн', 1),
  ('c4000000-0000-0000-0000-000000000002'::uuid, 'a9e499e9-8428-4e09-96cf-1e1caecf5734'::uuid, 'offline', '📍 Офлайн', '📍 Офлайн', 2)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name_ru = EXCLUDED.name_ru,
  name_kk = EXCLUDED.name_kk,
  sort_order = EXCLUDED.sort_order;

-- 2. Обновление существующих продуктов
UPDATE public.products
SET category_id = 'b61a33a3-003b-4909-8951-5540d7867f56'::uuid,
    subcategory_id = 'c2000000-0000-0000-0000-000000000001'::uuid
WHERE category_id = '55b366d7-2742-4cee-a697-b02814981d27'::uuid;

UPDATE public.products
SET subcategory_id = CASE
  WHEN lesson_format = 'group' THEN 'c1000000-0000-0000-0000-000000000002'::uuid
  ELSE 'c1000000-0000-0000-0000-000000000001'::uuid
END
WHERE category_id = '09653df8-e6e8-4aae-8ac7-11c3e0eadee1'::uuid;

UPDATE public.products
SET subcategory_id = 'c2000000-0000-0000-0000-000000000002'::uuid
WHERE category_id = 'b61a33a3-003b-4909-8951-5540d7867f56'::uuid AND subcategory_id NOT IN ('c2000000-0000-0000-0000-000000000001'::uuid, 'c2000000-0000-0000-0000-000000000002'::uuid, 'c2000000-0000-0000-0000-000000000003'::uuid);

UPDATE public.products
SET subcategory_id = 'c3000000-0000-0000-0000-000000000001'::uuid
WHERE category_id = '6f871e1e-f090-47de-8a64-246d2c394a20'::uuid AND subcategory_id NOT IN ('c3000000-0000-0000-0000-000000000001'::uuid, 'c3000000-0000-0000-0000-000000000002'::uuid);

UPDATE public.products
SET subcategory_id = 'c4000000-0000-0000-0000-000000000001'::uuid
WHERE category_id = 'a9e499e9-8428-4e09-96cf-1e1caecf5734'::uuid AND subcategory_id NOT IN ('c4000000-0000-0000-0000-000000000001'::uuid, 'c4000000-0000-0000-0000-000000000002'::uuid);

-- 3. Удаление старых подкатегорий
DELETE FROM public.subcategories
WHERE id NOT IN (
  'c1000000-0000-0000-0000-000000000001'::uuid,
  'c1000000-0000-0000-0000-000000000002'::uuid,
  'c2000000-0000-0000-0000-000000000001'::uuid,
  'c2000000-0000-0000-0000-000000000002'::uuid,
  'c2000000-0000-0000-0000-000000000003'::uuid,
  'c3000000-0000-0000-0000-000000000001'::uuid,
  'c3000000-0000-0000-0000-000000000002'::uuid,
  'c4000000-0000-0000-0000-000000000001'::uuid,
  'c4000000-0000-0000-0000-000000000002'::uuid
);

-- 4. Удаление категории 'courses'
DELETE FROM public.categories WHERE slug = 'courses';

-- 5. Порядок отображения 4 основных категорий
UPDATE public.categories SET sort_order = 1 WHERE slug = 'online-lessons';
UPDATE public.categories SET sort_order = 2 WHERE slug = 'materials';
UPDATE public.categories SET sort_order = 3 WHERE slug = 'subscriptions';
UPDATE public.categories SET sort_order = 4 WHERE slug = 'events';

COMMIT;
