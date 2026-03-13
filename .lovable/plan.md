

## План: Telegram-ссылка в продукте

### Что делаем
1. Добавляем колонку `telegram_link` в таблицу `products`
2. В форме создания/редактирования продукта (CreatorProductsTab) — поле для ввода ссылки на Telegram
3. В MaterialsTab — кнопка "Вступить в Telegram" над материалами продукта, если ссылка заполнена

### Изменения

| Файл / Место | Что меняем |
|---|---|
| SQL миграция | `ALTER TABLE products ADD COLUMN telegram_link text;` |
| `src/components/creator/CreatorProductsTab.tsx` | Добавляем поле `telegramLink` в форму ProductForm и в handleCreate/handleUpdate |
| `src/components/dashboard/MaterialsTab.tsx` | Загружаем `telegram_link` из продуктов, показываем кнопку-ссылку на Telegram перед материалами каждого продукта |
| `src/hooks/useSimplePurchases.ts` | Добавляем `telegram_link` в select продуктов для материалов |
| `src/hooks/useProducts.ts` | Добавляем `telegram_link` в интерфейс Product |

### UI для ученика
Над материалами каждого продукта, если `telegram_link` заполнен — кнопка с иконкой Telegram "Вступить в Telegram канал", открывает ссылку в новом окне.

