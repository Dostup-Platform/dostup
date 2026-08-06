-- Удаляем дубликаты, оставляя самую старую запись для каждого имени
DELETE FROM simple_users
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM simple_users
  ORDER BY name, created_at ASC
);

-- Добавляем уникальный индекс на поле name
CREATE UNIQUE INDEX idx_simple_users_name_unique ON simple_users(name);