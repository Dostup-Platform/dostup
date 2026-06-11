## Что меняем

### 1. Материалы автора видны только ученикам (учителя их не видят)

Файл: `src/components/teacher/TeacherMaterialsTab.tsx`

- Полностью убрать секцию **«Материалы автора» / «Автор материалдары»** (`Collapsible` с `creatorMaterials`) и связанный запрос `teacher-creator-materials`, helpers `getFileUrl`/`handleOfficeView` и состояния (`creatorMaterialsOpen`, `creatorLoading`).
- В разделе у учителя остаётся только «Мои материалы» (`TeacherMaterialsManager`), без поясняющей секции про материалы автора.
- Учитель не получает никаких ссылок на скачивание/просмотр файлов автора.

### 2. Скачивание файлов автора — только ученикам

Файл: `src/components/creator/ProductMaterialsManager.tsx` (раздел автора)

- Убрать в форме «Добавить файл» и «Редактировать файл» галочку **«Для учителя: Скачивание»** (поля `teacher_allow_download` в UI). На бэк отправлять `teacher_allow_download: false` всегда (учителя в любом случае больше не увидят эти материалы — см. п.1).
- В списке материалов у автора сам автор кнопок скачать/открыть не получает — оставляем как есть (он уже видит только Edit/Delete), специально ничего не добавляем.
- В режиме ученика (`src/components/dashboard/MaterialsTab.tsx`) скачивание остаётся как сейчас (управляется `allow_download` файла).
- Проверить: `src/components/teacher/TeacherMaterialsTab.tsx` теперь вообще не показывает материалы автора → у учителя нет ни кнопки скачать, ни просмотра.

Поле `teacher_allow_download` в БД оставляем как есть (миграции не делаем) — просто не используется в UI.

### 3. Drag & drop / paste после первой загрузки

Файл: `src/components/creator/ProductMaterialsManager.tsx`

Проблема: после добавления первого файла `<label htmlFor="file-upload">` оборачивает весь dropzone, и клик/drop/paste на нём не работают предсказуемо, т.к. label перехватывает события для скрытого `<input>`. Сейчас фактически работает только клик «выбрать файл».

Исправление:
- Перенести `onDrop`, `onDragOver`, `onDragEnter`, `onDragLeave`, `onPaste` уже стоят на внешнем `div` — оставить.
- Убрать `<label htmlFor="file-upload">` как обёртку всего содержимого dropzone. Вместо него:
  - кликабельная область вызывает `fileInputRef.current?.click()` через `onClick` на самом `div` (`role="button"`, `tabIndex={0}`);
  - `<input type="file" hidden ref={fileInputRef} multiple onChange=…>` остаётся внутри;
  - визуальная подсказка (иконка `Upload` + текст «Нажмите, перетащите или вставьте (Ctrl+V) файл(ы)») — обычный `<div>`.
- Это позволит и drop, и paste, и повторный клик работать одинаково как до, так и после добавления первого файла, и в корне, и внутри открытой папки.

То же исправление продублировать в `src/components/teacher/TeacherMaterialsManager.tsx` (там сейчас аналогичная dropzone-проблема — посмотрим строки 390+ и приведём к тому же паттерну).

## Что НЕ меняется

- Схема БД, RLS, edge-функции.
- Логика загрузки в S3, токены, office-просмотр.
- `ProductSwitcher`, `NoProductsEmptyState`, расписание, объявления.
- Режим ученика (`MaterialsTab.tsx`) — там скачивание уже работает по `allow_download`.

## Локализация

Никаких новых строк: только удаляем секцию у учителя и убираем чекбокс «Для учителя».
