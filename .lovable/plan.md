

# Исправить открытие/скачивание файлов учителем

## Проблема
В `TeacherMaterialsTab.tsx` функция `handleOpenFile` не проверяет S3-пути (`s3://...`). Она всегда использует `supabase.storage.createSignedUrl()`, который не работает для S3-файлов. Поэтому все файлы автора (которые хранятся в S3) выдают ошибку.

## Решение
Обновить `handleOpenFile` в `TeacherMaterialsTab.tsx` (строки 121-170), добавив проверку S3 — аналогично тому, как это уже сделано в `TeacherMaterialsManager.tsx` (строки 263-330).

## Изменение (1 файл)

### `src/components/teacher/TeacherMaterialsTab.tsx`
Заменить `handleOpenFile` (строки 121-170): добавить `import("@/lib/s3Helpers")`, проверку `isS3Path()`, и вызов `getS3DownloadUrl()` для S3-файлов. Для не-S3 файлов оставить текущую логику с `supabase.storage`.

