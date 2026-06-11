## Что делаем

Новый раздел `Обьявления` (так же и у ученика называется) — привязан к каждому продукту. Автор пишет посты в стиле Telegram (форматирование, фото/видео, ссылки) + настраивает одну отдельную кнопку «ссылка на группу/чат» с собственным текстом. Ученик видит их в самой левой вкладке сразу после получения доступа.

## База данных (миграции)

1. Новая таблица `announcements`:
  - `product_id` → products(id) ON DELETE CASCADE
  - `creator_name` text (изоляция как в других таблицах автора)
  - `content_html` text (HTML от TipTap)
  - `order_index` int (drag-порядок, новые сверху)
  - стандартные `id`, `created_at`, `updated_at` + триггер обновления
  - GRANT для authenticated, anon (read) и service_role; RLS:
    - всем (anon + authenticated) — SELECT (контент анонсов нужен ученикам без auth.uid, как и материалы)
    - INSERT/UPDATE/DELETE — только через edge-функцию с проверкой `creator_token` (как делают другие записи автора)
2. В таблицу `products` добавить:
  - `group_link_label` text — кастомный текст кнопки. По умолчанию пусто; на UI fallback «Ссылка на группу/чат».
  - (поле `telegram_link` уже есть — используем его как URL кнопки)
3. Storage bucket `announcement-media` (приватный) для фото/видео из редактора. Загрузка через edge-функцию с проверкой creator token, чтение — через подписанные URL.
4. Миграция данных: все существующие `materials` с `type in ('link','text')` переносятся в `announcements`:
  - `link` → `<p><a href="URL">Title</a></p>`
  - `text` → `<h3>Title</h3><p>content</p>`
  - `order_index` сохраняется, затем строки удаляются из `materials`.

## Edge-функции

- `create-announcement`, `update-announcement`, `delete-announcement`, `reorder-announcements` — проверяют creator session и владение продуктом.
- `upload-announcement-media` — presigned upload в bucket.
- `get-announcement-media-url` — выдаёт подписанный URL для просмотра (для учеников после проверки покупки).

## UI: автор

1. Новая вкладка `Анонсы` (slug `announcements`) — **первая слева** в `CreatorDashboard` (и desktop top tabs, и mobile bottom nav). После неё: Продукты, Ученики, Расписание, Уведомления, Кабинет. Иконка — `Megaphone` из lucide.
2. Компонент `CreatorAnnouncementsTab`:
  - список продуктов автора → выбор продукта → менеджер анонсов конкретного продукта.
  - В менеджере: поле URL чата/группы + кастомный label (сохраняется в `products`), список постов с drag-reorder, кнопка «Создать пост».
3. Редактор поста — **TipTap** (`@tiptap/react` + `@tiptap/starter-kit` + `Link`, `Image`, `Underline`, `TextStyle`, `Heading`). Тулбар: B, I, U, заголовок, ссылка, картинка/видео (через upload), очистить форматирование. По нажатию «Опубликовать» — сохраняется HTML.
4. В `ProductMaterialsManager` убрать варианты «Ссылка» и «Текст» из выбора типа — оставить только Файл и Папка. Существующие записи этих типов уже будут перенесены миграцией, так что отрисовывать их в материалах больше не придётся.

## UI: ученик

1. В `Dashboard` (bottom nav) добавить вкладку `home` **самой левой**, активной по умолчанию. Порядок: Home → Материалы → Расписание → Уведомления → Кабинет. Иконка `Home`.
2. Компонент `HomeTab`:
  - для каждого продукта, к которому есть доступ (status `confirmed`/`completed`):
    - заголовок продукта,
    - если у продукта есть `telegram_link` — крупная кнопка с `group_link_label` (или дефолтом),
    - список анонсов (новые сверху). HTML рендерится санитайзером (`DOMPurify`); картинки/видео подгружаются по подписанному URL.
3. Из `MaterialsTab` убрать блок «Вступить в группу…» (переезжает в Home) — внутри остаются только файлы/папки.

## Локализация

- `home`, `announcements`, `announcementsEmpty`, `createPost`, `chatGroupLink`, `chatGroupLinkLabelDefault`, плейсхолдеры тулбара — в `src/lib/translations.ts` для ru/kz.

## Технические детали

- Зависимости: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`, `@tiptap/extension-image`, `@tiptap/extension-underline`, `dompurify`, `@types/dompurify`, `@dnd-kit/sortable` (если ещё не стоит) для reorder.
- Видео встраиваем как `<video controls src=...>` через кастомное TipTap-расширение Node (на базе Image).
- Все запросы к announcement-таблице — через хук `useAnnouncements(productId)` и edge-функции для мутаций.
- Бейдж новых анонсов на Home для ученика — **вне scope** этого шага (можно добавить позже).
- Realtime-обновления анонсов — вне scope.

## Структура файлов (новые)

```text
src/components/creator/CreatorAnnouncementsTab.tsx
src/components/creator/ProductAnnouncementsManager.tsx
src/components/creator/AnnouncementEditor.tsx       // TipTap
src/components/dashboard/HomeTab.tsx
src/components/dashboard/AnnouncementView.tsx       // рендер HTML + медиа
src/hooks/useAnnouncements.ts
supabase/functions/create-announcement/index.ts
supabase/functions/update-announcement/index.ts
supabase/functions/delete-announcement/index.ts
supabase/functions/reorder-announcements/index.ts
supabase/functions/upload-announcement-media/index.ts
supabase/functions/get-announcement-media-url/index.ts
```