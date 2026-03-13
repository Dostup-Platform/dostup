

## План: прямая загрузка в S3 через presigned URL

### Проблема
Edge Functions ограничены ~50-100 МБ по размеру тела запроса и ~150 МБ по памяти. Файл 1 ГБ не может пройти через них.

### Решение
Двухэтапная загрузка:
1. Клиент запрашивает presigned PUT URL у Edge Function (легкий запрос, без файла)
2. Клиент загружает файл напрямую в S3 по этому URL (без лимитов Edge Function)

### Изменения

**1. Новая Edge Function `supabase/functions/s3-presign-upload/index.ts`**
- Принимает JSON: `{ productId, role, fileName, fileType, creatorToken?, creatorName?, teacherId? }`
- Выполняет ту же авторизацию что и текущий `s3-upload`
- Генерирует S3 key и presigned PUT URL (срок 1 час)
- Возвращает `{ uploadUrl, storagePath }`

**2. Обновление `supabase/config.toml`**
- Добавить `[functions.s3-presign-upload]` с `verify_jwt = false`

**3. Обновление `src/lib/s3Helpers.ts` -- функция `uploadFileToS3`**
- Шаг 1: вызов `s3-presign-upload` для получения presigned URL
- Шаг 2: `fetch(PUT)` файла напрямую в S3
- Добавить поддержку `onProgress` через `XMLHttpRequest` для отображения прогресса

**4. Обновление UI компонентов загрузки** (опционально)
- `ProductMaterialsManager.tsx` и `TeacherMaterialsManager.tsx` -- добавить прогресс-бар загрузки

### Технические детали
- Presigned URL генерируется через AWS Signature V4 (аналогично текущему скачиванию в `s3-download`)
- Старый `s3-upload` остается для обратной совместимости с мелкими файлами, но `uploadFileToS3` переключится на новый путь
- CORS на S3 бакете должен разрешать PUT от домена приложения (нужно проверить настройки бакета)

### Важно
Для работы presigned upload нужно убедиться, что S3 бакет имеет CORS-конфигурацию разрешающую PUT-запросы с домена `dostup

.lovable.app` и `lovableproject.com`.

