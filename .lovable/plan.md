

# Подключение AWS S3 для хранения материалов

## Что изменится
Сейчас все файлы материалов хранятся во встроенном хранилище с лимитом ~1 ГБ на весь проект. После подключения AWS S3:
- Общий объём хранилища — практически безлимитный (оплата только за использованное место)
- Лимит на один файл — до 5 ГБ (вместо ~50 МБ)
- Стоимость — ~$0.023/ГБ в месяц (~10 тенге за 1 ГБ)
- Интерфейс для авторов, учителей и учеников останется прежним

## Что потребуется от вас
1. Создать аккаунт AWS (если нет) — https://aws.amazon.com
2. Создать S3 bucket в AWS Console
3. Создать IAM пользователя с доступом к этому bucket
4. Передать 3 значения: **AWS Access Key ID**, **AWS Secret Access Key**, **S3 Bucket Name** и **AWS Region**

## Технический план реализации

### Шаг 1: Добавление секретов
Сохранить 4 секрета в проект:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_S3_BUCKET`
- `AWS_S3_REGION`

### Шаг 2: Новая Edge Function `s3-upload`
Создать серверную функцию, которая:
- Принимает файл от клиента (FormData)
- Проверяет авторизацию (creator session или teacher ID)
- Загружает файл напрямую в AWS S3 через AWS SDK
- Возвращает путь к файлу (ключ в S3)

### Шаг 3: Новая Edge Function `s3-download`
Создать серверную функцию, которая:
- Принимает путь файла и ID пользователя
- Проверяет доступ (покупка или роль автора/учителя)
- Генерирует presigned URL из AWS S3 (временная ссылка на 1 час)
- Возвращает URL клиенту

### Шаг 4: Обновить Edge Function `proxy-material`
Добавить поддержку файлов из S3 для Office Viewer (документы Word/Excel/PowerPoint):
- Если файл хранится в S3, скачивать его оттуда
- Остальная логика (токены доступа) остаётся прежней

### Шаг 5: Обновить `useMaterials.ts`
Функция `uploadMaterialFile`:
- Вместо `supabase.storage.upload` вызывать Edge Function `s3-upload`
- Сохранять в БД путь вида `s3://bucket/productId/filename.ext`

### Шаг 6: Обновить `useTeacherMaterials.ts`
Функция `uploadTeacherMaterialFile`:
- Аналогично, загружать через `s3-upload`
- Путь вида `s3://bucket/teacher-teacherId/productId/filename.ext`

### Шаг 7: Обновить компоненты просмотра/скачивания
В трёх файлах (`ProductMaterialsManager.tsx`, `TeacherMaterialsManager.tsx`, `MaterialsTab.tsx`):
- При открытии/скачивании файла определять: файл в S3 или во встроенном хранилище (по префиксу `s3://`)
- Для S3-файлов — вызывать `s3-download` для получения presigned URL
- Для старых файлов — оставить текущую логику (обратная совместимость)

### Шаг 8: Обновить Edge Function `upload-material`
- Перенаправить загрузку на S3 вместо встроенного хранилища (для случаев когда загрузка идёт через эту функцию)

### Шаг 9: Обновить `supabase/config.toml`
- Добавить новые функции `s3-upload` и `s3-download` с `verify_jwt = false`

## Обратная совместимость
- Все уже загруженные файлы продолжат работать через встроенное хранилище
- Новые файлы будут загружаться в AWS S3
- Переключение происходит автоматически по типу пути в базе данных

## Итого изменяемые файлы
1. `supabase/functions/s3-upload/index.ts` — новый
2. `supabase/functions/s3-download/index.ts` — новый
3. `supabase/functions/proxy-material/index.ts` — обновление
4. `supabase/functions/upload-material/index.ts` — обновление
5. `supabase/config.toml` — обновление
6. `src/hooks/useMaterials.ts` — обновление
7. `src/hooks/useTeacherMaterials.ts` — обновление
8. `src/components/creator/ProductMaterialsManager.tsx` — обновление
9. `src/components/teacher/TeacherMaterialsManager.tsx` — обновление
10. `src/components/dashboard/MaterialsTab.tsx` — обновление
11. `src/lib/materialToken.ts` — возможно небольшое обновление

