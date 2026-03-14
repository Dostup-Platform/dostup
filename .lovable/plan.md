

## Исправление загрузки файлов в S3

### Проблема
Presigned URL генерируется с глобальным эндпоинтом `dostup-materials-prod.s3.amazonaws.com`, а бакет находится в регионе `eu-north-1`. Для PUT-запросов S3 не выполняет автоматический редирект на региональный эндпоинт, что приводит к ошибке после загрузки данных.

Из логов видно:
```
uploadUrl: "https://dostup-materials-prod.s3.amazonaws.com/..."
```
Должно быть:
```
uploadUrl: "https://dostup-materials-prod.s3.eu-north-1.amazonaws.com/..."
```

### Решение
Заменить библиотеку `aws_s3_presign` на AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) в Edge Function `s3-presign-upload`. AWS SDK корректно формирует региональный эндпоинт и подписывает PUT-запросы.

### Изменения

**1. `supabase/functions/s3-presign-upload/index.ts`**
- Заменить `getSignedUrl` из `deno.land/x/aws_s3_presign` на `PutObjectCommand` + `getSignedUrl` из AWS SDK v3
- AWS SDK автоматически использует правильный региональный эндпоинт `s3.eu-north-1.amazonaws.com`
- Вся остальная логика (авторизация, генерация ключа) остаётся без изменений

**2. `src/lib/s3Helpers.ts`**
- Убрать отправку `Content-Type` заголовка в XHR, т.к. AWS SDK уже включает его в подпись через query string
- Это предотвратит возможные проблемы с несовпадением подписи

### Результат
- Файлы любого размера (до 5 ГБ) будут загружаться напрямую в S3
- Прогресс-бар продолжит работать
- Не нужна настройка CORS на S3 (AWS SDK presigned URLs работают без дополнительных заголовков)

