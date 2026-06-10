## Цель

Позволить автору курса загружать **картинку** и **видео (до 3 минут)** для продукта в форме редактирования. Эти медиа отображаются на странице продукта (которую видит ученик по ссылке).

## Что меняется

### 1. База данных
- В таблице `products` уже есть `image_url`. Добавляем поле `video_url TEXT NULL`.
- Миграция: `ALTER TABLE public.products ADD COLUMN video_url TEXT`.

### 2. Хранилище (Lovable Cloud Storage)
- Создаём новый **публичный** бакет `product-media` для картинок обложек и видео продуктов (нужен публичный доступ, т.к. страница продукта открыта всем по ссылке).
- RLS на `storage.objects`:
  - `SELECT` — публично (anon + authenticated).
  - `INSERT/UPDATE/DELETE` — только через edge function с проверкой сессии создателя (как сейчас в `upload-material`).
- Лимиты бакета: размер файла до ~200 МБ (с запасом под 3-минутное видео).

### 3. Edge function `upload-product-media`
Новая функция по образцу `supabase/functions/upload-material/index.ts`:
- Принимает `file`, `productId`, `creatorName`, `creatorToken`, `kind` (`image` | `video`).
- Валидирует сессию создателя через `creator_sessions`.
- Проверяет, что продукт принадлежит этому создателю.
- Для `video`: проверка MIME (`video/mp4`, `video/webm`, `video/quicktime`) и размера (≤ ~200 МБ).
- Для `image`: проверка MIME (`image/*`).
- Загружает в `product-media/<productId>/<timestamp>-<rand>.<ext>`, возвращает публичный URL.
- Длительность видео (≤ 3 минуты) проверяется **на клиенте** до загрузки через `<video>.duration` (надёжная серверная проверка потребовала бы ffprobe). Если видео длиннее — показываем ошибку и не загружаем.

### 4. Форма продукта (`src/components/creator/CreatorProductsTab.tsx`)
В `ProductForm` добавляем два блока:
- **Обложка (картинка)**: input `type="file" accept="image/*"`, превью текущей картинки, кнопка «Удалить». При выборе — сразу загрузка через edge function, в `formData.image_url` сохраняется URL.
- **Видео-презентация (до 3 минут)**: input `type="file" accept="video/*"`, превью `<video controls>`, кнопка «Удалить». Перед загрузкой:
  1. Создать `URL.createObjectURL`, прочитать `duration` через скрытый `<video>`.
  2. Если `duration > 180` сек → toast с ошибкой, прервать.
  3. Иначе — загрузка, URL в `formData.video_url`.
- Состояние загрузки (спиннер на инпуте) и обработка ошибок через `toast`.
- `handleCreate` / `handleUpdate` отправляют `image_url` и `video_url` в мутации.

### 5. Hook `useProducts.ts`
- Добавить `video_url: string | null` в интерфейс `Product`.
- В `CreateProductInput` добавить `video_url?: string | null`.
- В `useCreateProduct` пробросить `video_url`.

### 6. Страница продукта (`src/pages/ProductPage.tsx`)
- Если у продукта есть `video_url` — над описанием (или вместо hero-картинки) показывается `<video src controls playsInline preload="metadata" poster={image_url}>`.
- Если видео нет — fallback на текущую картинку.
- Картинка остаётся как poster видео и как hero, если видео отсутствует.

## Что НЕ меняется
- Бакет `materials` и логика учебных материалов.
- Логика покупок, расписания, учителей.
- Авторизация и сессии создателей.

## Технические детали
- Превью на странице продукта: `aspect-[16/9]`, `object-cover`, `playsInline` (для iOS), `preload="metadata"` (не качать всё видео сразу).
- Кэш `queryClient.invalidateQueries(["product"])` после обновления — уже есть.
- Все строки UI — двуязычные (ru/kk), как остальная форма.
