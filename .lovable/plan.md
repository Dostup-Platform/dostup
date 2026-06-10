## Что добавим

1. **FAQ для продукта (автор курса)**
   - Новое поле `faq` в таблице `products` (JSONB массив `[{question, answer}]`).
   - В форме редактирования продукта (`CreatorProductsTab.tsx`) — блок "Часто задаваемые вопросы" с возможностью добавить/удалить/редактировать пары вопрос-ответ (кнопка "Добавить вопрос", поля question + answer, кнопка удаления у каждого).

2. **Отображение FAQ на странице продукта**
   - В `ProductPage.tsx` под блоком описания/цены добавить секцию "Часто задаваемые вопросы" (заголовок), список вопросов через shadcn `Accordion` (`type="single"`, `collapsible`) — иконка "+" справа, при клике раскрывается ответ. Локализация заголовка (RU/KZ).
   - Секция показывается только если массив непустой.

3. **Кнопка "Получить доступ"**
   - В `ProductPage.tsx` убрать цену из текста кнопки: вместо `{t("getAccess")} — {formatPrice(...)}` оставить просто `{t("getAccess")}`.

## Технические детали

- Миграция: `ALTER TABLE products ADD COLUMN faq JSONB NOT NULL DEFAULT '[]'::jsonb;`
- `useProducts.ts`: `faq?: Array<{question: string; answer: string}>` в `Product`, `CreateProductInput`, и проброс в insert/update.
- FAQ-редактор — отдельный inline-компонент внутри формы продукта, состояние в `formData.faq`, чтобы не вызывать потерю фокуса (правило проекта).
- Accordion уже есть в `src/components/ui/accordion.tsx`, используем `AccordionItem` / `AccordionTrigger` / `AccordionContent`. Стандартный chevron триггера заменим на `Plus`/`Minus` иконку (через кастомный trigger или через состояние open), чтобы соответствовать макету.
- Никаких изменений в расписании, учителях, материалах, оплате.
