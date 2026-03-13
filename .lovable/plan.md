

## План: универсальная ссылка на группу вместо Telegram

### Что меняем

**1. `src/components/creator/CreatorProductsTab.tsx`** — форма создания/редактирования:
- Label: "Telegram ссылка" → "Ссылка на группу/канал"
- Placeholder: `https://t.me/your_channel` → `https://t.me/... или https://discord.gg/...`
- Подсказка: обновить текст — "Ссылка на группу или канал (Telegram, Discord и др.). Будет показана ученикам после покупки."

**2. `src/components/dashboard/MaterialsTab.tsx`** — кнопка для ученика:
- Убрать иконку `Send`
- Текст: "Вступить в Telegram канал" → "Вступить в группу" / "Топқа қосылу"

Никаких изменений в БД или хуках не нужно — поле `telegram_link` остаётся как есть в базе, меняется только UI-текст.

