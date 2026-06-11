В `ProductForm` внутри `CreatorProductsTab.tsx` изменить начальное состояние секции «Детали»:

- Сейчас: `const [detailsOpen, setDetailsOpen] = useState(true);`
- Нужно: `const [detailsOpen, setDetailsOpen] = useState(!isEdit);`

Так при создании продукта секция «Детали» будет открыта по умолчанию, а при редактировании — закрыта (как сейчас «Оплата»). Никакие другие элементы затронуты не будут.